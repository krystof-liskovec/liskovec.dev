import { PLANETS } from './orrery/catalog';
import type { MajorMoon } from './orrery/catalog';
import { drawGalaxyBackdrop, drawLocalStarfield } from './orrery/background-renderer';
import { drawFocusScene } from './orrery/focus-scene';
import { FocusController } from './orrery/focus-controller';
import { updateFocusRotation, updateGalaxyCamera, updateSolarCamera } from './orrery/frame-state';
import { moveGalacticMaterial } from './orrery/galactic-simulation';
import { GalaxyObjectRenderer, drawSolMarker } from './orrery/galaxy-object-renderer';
import { bindOrreryInteractions } from './orrery/interactions';
import { OrreryIntroController } from './orrery/intro-controller';
import { DEG, J2000, smoothstep, solveKeplerOrbit, visualTransitionProgress } from './orrery/math';
import {
    createRuntimeState,
    getGalacticElapsedYears as resolveGalacticElapsedYears,
    getOrbitDate as resolveOrbitDate,
    getRotationElapsedHours as resolveRotationElapsedHours,
} from './orrery/runtime-state';
import { createFocusCandidate, drawHoverReadouts, findHoveredBody, findHoveredComet } from './orrery/scene-ui';
import { GALACTIC_SOL } from './orrery/scene-data';
import { SolarSystemModel } from './orrery/solar-system-model';
import { SolarSystemSceneRenderer } from './orrery/solar-system-scene';
import type { FocusTarget, Vec3 } from './orrery/types';

const MAX_RENDER_FPS = 120;
const MIN_RENDER_INTERVAL = 1000 / MAX_RENDER_FPS;

const canvasElement = document.querySelector<HTMLCanvasElement>('#solar-canvas');
const systemElement = document.querySelector<HTMLElement>('#solar-system');
const clock = document.querySelector<HTMLElement>('#solar-time');
const cameraStats = document.querySelector<HTMLElement>('#camera-stats');
const zoomInput = document.querySelector<HTMLInputElement>('#cosmic-zoom');
const zoomStatus = document.querySelector<HTMLOutputElement>('#cosmic-zoom-status');
const solarSimulationSpeed = document.querySelector<HTMLSelectElement>('#solar-simulation-speed');
const galacticSimulationSpeed = document.querySelector<HTMLSelectElement>('#galactic-simulation-speed');
const rotationSimulationSpeed = document.querySelector<HTMLSelectElement>('#rotation-simulation-speed');
const zoomLocation = document.querySelector<HTMLElement>('#zoom-location');
const focusReturn = document.querySelector<HTMLButtonElement>('#object-focus-return');
const canvasContext = canvasElement?.getContext('2d');

if (canvasElement && systemElement && canvasContext) {
    // Stable non-null aliases are safe to retain inside animation callbacks.
    // TypeScript intentionally forgets narrowing for the outer DOM lookups.
    const canvas = canvasElement;
    const system = systemElement;
    const context = canvasContext;
    system.classList.add('is-canvas-ready');
    const {
        pointer,
        camera,
        galaxyCamera,
        objectFocus,
        easterEgg,
        cosmicZoom,
        orbitClock,
        galacticClock,
        rotationClock,
    } = createRuntimeState();
    let activeFocusCandidate: FocusTarget | null = null;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reducedMotionQuery.matches;
    const introController = new OrreryIntroController(reducedMotion);
    const solarHeading = document.querySelector<HTMLElement>('.solar-heading');
    if (introController.running) {
        system.classList.add('is-intro-running');
        solarHeading?.classList.add('is-intro-running');
    }
    let lastClockSecond = -1;
    let lastCameraStatsTick = -1;
    let lastFrameAt = 0;
    let zoomLocationState = 'solar';
    let zoomLocationTimer = 0;
    let animationFrame = 0;
    let systemVisible = true;
    let pageVisible = !document.hidden;
    const focusedMoonEpoch = Date.now();

    type ProjectedPoint = Vec3 & { scale: number };
    const finalSolOffsetScratch = { x: 0, y: 0 };
    const currentSolOffsetScratch = { x: 0, y: 0 };
    const simulatedSolScratch = { x: 0, y: 0 };
    const solarSystemModel = new SolarSystemModel();
    const { bodies, farMarks, nearMarks } = solarSystemModel;
    const galaxyObjectRenderer = new GalaxyObjectRenderer();
    const solarSystemRenderer = new SolarSystemSceneRenderer();

    const scheduleRender = () => {
        if (animationFrame || !systemVisible || !pageVisible) return;
        animationFrame = requestAnimationFrame(render);
    };

    const setZoomLocation = (state: string, copy: string) => {
        if (!zoomLocation || state === zoomLocationState) return;
        zoomLocationState = state;
        window.clearTimeout(zoomLocationTimer);
        if (reducedMotion) {
            zoomLocation.textContent = copy;
            return;
        }
        zoomLocation.classList.remove('is-changing');
        void zoomLocation.offsetWidth;
        zoomLocation.classList.add('is-changing');
        zoomLocationTimer = window.setTimeout(() => {
            zoomLocation.textContent = copy;
        }, 180);
    };

    const signedDegrees = (radians: number) => {
        const degrees = ((((radians / DEG + 180) % 360) + 360) % 360) - 180;
        const sign = degrees >= 0 ? '+' : '−';
        return `${sign}${Math.abs(degrees).toFixed(1)}°`;
    };

    const updateCameraStats = () => {
        if (!cameraStats) return;

        if (objectFocus.target && objectFocus.progress > 0.5) {
            const pitch = objectFocus.child ? objectFocus.childLatitude : objectFocus.latitude;
            const yaw = objectFocus.child ? objectFocus.childLongitude : objectFocus.longitude;
            cameraStats.textContent = `CAM · PITCH ${signedDegrees(pitch)} · YAW ${signedDegrees(yaw)} · ROLL +0.0°`;
            return;
        }

        if (cosmicZoom.current > 0.5) {
            const projectedTilt = Math.max(-1, Math.min(1, 0.58 * galaxyCamera.tilt));
            cameraStats.textContent = `CAM · PITCH ${signedDegrees(Math.asin(projectedTilt))} · YAW +0.0° · ROLL ${signedDegrees(galaxyCamera.rotation)}`;
            return;
        }

        cameraStats.textContent = `CAM · PITCH ${signedDegrees(camera.renderedPitch)} · YAW ${signedDegrees(camera.renderedYaw)} · ROLL ${signedDegrees(camera.renderedRoll)}`;
    };

    const focusController = new FocusController(
        objectFocus,
        system,
        focusReturn,
        zoomInput,
        cosmicZoom,
        camera,
        setZoomLocation,
        () => {
            activeFocusCandidate = null;
        },
    );

    reducedMotionQuery.addEventListener('change', (event) => {
        reducedMotion = event.matches;
    });

    const visibilityObserver = new IntersectionObserver(([entry]) => {
        systemVisible = entry.isIntersecting;
        if (systemVisible) {
            lastFrameAt = 0;
            scheduleRender();
        } else if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        }
    });
    visibilityObserver.observe(system);

    document.addEventListener('visibilitychange', () => {
        pageVisible = !document.hidden;
        if (pageVisible) {
            lastFrameAt = 0;
            scheduleRender();
        } else if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        }
    });

    function getOrbitDate(frameTime: number) {
        return resolveOrbitDate(orbitClock, frameTime, reducedMotion);
    }

    function getGalacticElapsedYears(frameTime: number) {
        return resolveGalacticElapsedYears(galacticClock, frameTime);
    }

    function getRotationElapsedHours(frameTime: number) {
        return resolveRotationElapsedHours(rotationClock, frameTime);
    }

    const formatGalacticEpoch = (elapsedYears: number) => {
        const absoluteYears = Math.abs(elapsedYears);
        if (absoluteYears < 5_000) return 'PRESENT';
        const direction = elapsedYears < 0 ? '−' : '+';
        if (absoluteYears < 1_000_000_000) return `T${direction}${(absoluteYears / 1_000_000).toFixed(2)} MY`;
        if (absoluteYears < 1_000_000_000_000) return `T${direction}${(absoluteYears / 1_000_000_000).toFixed(2)} GY`;
        return `T${direction}${(absoluteYears / 1_000_000_000_000).toFixed(2)} TY`;
    };

    const padTimePart = (value: number) => String(value).padStart(2, '0');
    const formatLocalDateTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())} / ${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}:${padTimePart(date.getSeconds())}`;
    };

    function render(frameTime: number) {
        animationFrame = 0;
        if (!systemVisible || !pageVisible) return;
        if (lastFrameAt && frameTime - lastFrameAt < MIN_RENDER_INTERVAL) {
            scheduleRender();
            return;
        }
        // The bitmap has an overflow-safe bleed around the hero, while all
        // projection and scale math remains tied to the original system box.
        const width = system.clientWidth;
        const height = system.clientHeight;
        const canvasBounds = canvas.getBoundingClientRect();
        const systemBounds = system.getBoundingClientRect();
        const renderWidth = canvas.clientWidth;
        const renderHeight = canvas.clientHeight;
        const canvasOriginX = systemBounds.left - canvasBounds.left;
        const canvasOriginY = systemBounds.top - canvasBounds.top;
        const renderLeft = -canvasOriginX;
        const renderTop = -canvasOriginY;
        const renderRight = renderWidth - canvasOriginX;
        const renderBottom = renderHeight - canvasOriginY;
        // Orbital spacing has to contract on a phone so Neptune remains visible.
        // Scale the ASCII bodies with it, instead of leaving desktop-sized glyphs
        // crowded into the smaller scene.
        const viewportGlyphScale = Math.min(1, Math.max(0.61, width / 700));
        const mobileSunProgress = Math.max(0, Math.min(1, (width - 430) / 270));
        const viewportSunScale = 0.52 + mobileSunProgress * 0.48;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const pixelWidth = Math.max(1, Math.round(renderWidth * dpr));
        const pixelHeight = Math.max(1, Math.round(renderHeight * dpr));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }
        // Use the canvas's real backing-store ratio. CSS grid sizing can produce
        // fractional dimensions, and a nominal DPR transform leaves that bitmap
        // fractionally stretched by the browser, softening small ASCII glyphs.
        context.setTransform(pixelWidth / renderWidth, 0, 0, pixelHeight / renderHeight, 0, 0);
        context.clearRect(0, 0, renderWidth, renderHeight);
        context.translate(canvasOriginX, canvasOriginY);
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const intro = introController.update(frameTime, reducedMotion);
        if (!introController.running) {
            system.classList.remove('is-intro-running');
            solarHeading?.classList.remove('is-intro-running');
        }

        pointer.x += (pointer.targetX - pointer.x) * 0.055;
        pointer.y += (pointer.targetY - pointer.y) * 0.055;
        const seconds = frameTime / 1000;
        const frameDelta = Math.min(40, lastFrameAt ? frameTime - lastFrameAt : 16.67);
        lastFrameAt = frameTime;
        focusController.update(frameDelta, reducedMotion);
        cosmicZoom.current += (cosmicZoom.target - cosmicZoom.current) * (reducedMotion ? 1 : 0.055);
        const outwardZoom = Math.max(0, cosmicZoom.current);
        const focusedPlanet =
            objectFocus.target?.kind === 'planet'
                ? (PLANETS.find((planet) => planet.name === objectFocus.target?.name) ?? null)
                : null;
        const focusedSun = objectFocus.target?.kind === 'star';
        // Exit completes at 6%, so map that outgoing tail to an exact zero. This
        // keeps the final world scale, centering, and scene opacity continuous
        // when focus clears.
        const visualFocusProgress = visualTransitionProgress(objectFocus.progress, objectFocus.exiting);
        const localFocusProgress = visualFocusProgress;
        const planetSceneFocus = focusedPlanet || focusedSun ? smoothstep(localFocusProgress) : 0;
        const localSphereGrowth = smoothstep((planetSceneFocus - 0.08) / 0.92) ** 1.45;
        const focusedSunDetailReveal = focusedSun ? smoothstep((planetSceneFocus - 0.06) / 0.3) : 0;
        const focusedSunBridgeScale = focusedSun ? (0.24 + localSphereGrowth * 0.76) / 0.24 : 1;
        const galaxyProgress = smoothstep((outwardZoom - 0.24) / 0.76);
        const galaxyVisibility = smoothstep((outwardZoom - 0.46) / 0.42);
        const localDetailOpacity = 1 - smoothstep((outwardZoom - 0.2) / 0.26);
        const solarSystemScale = Math.pow(0.055, Math.min(1, outwardZoom / 0.7));
        const renderedSunScale = solarSystemScale * viewportSunScale ** 2;
        updateSolarCamera({ camera, pointer, seconds, frameTime, frameDelta, reducedMotion });
        const revealProgress = easterEgg.unlocked
            ? Math.min(1, (frameTime - easterEgg.revealedAt) / (reducedMotion ? 1 : 1200))
            : 0;
        const plutoReveal = 1 - (1 - revealProgress) ** 3;
        const now = getOrbitDate(frameTime);
        const elapsedGalacticYears = getGalacticElapsedYears(frameTime);
        const elapsedRotationHours = getRotationElapsedHours(frameTime);
        const solveMoonOrbitAtDate = (moon: MajorMoon, elapsedDays: number, target = { angle: 0, distance: 1 }) => {
            const meanAnomaly = (moon.meanAnomaly + (elapsedDays / moon.periodDays) * 360) * DEG;
            solveKeplerOrbit(meanAnomaly, moon.eccentricity, target);
            target.angle += moon.periapsis * DEG;
            return target;
        };
        const solarMoonElapsedDays = (now - J2000) / 86400000;
        const focusedMoonElapsedDays =
            (focusedMoonEpoch - J2000) / 86400000 + (reducedMotion ? 0 : elapsedRotationHours / 24);
        const solveSolarMoonOrbit = (moon: MajorMoon, target = { angle: 0, distance: 1 }) =>
            solveMoonOrbitAtDate(moon, solarMoonElapsedDays, target);
        const solveFocusedMoonOrbit = (moon: MajorMoon, target = { angle: 0, distance: 1 }) =>
            solveMoonOrbitAtDate(moon, focusedMoonElapsedDays, target);
        const viewportCenterX = width * 0.52;
        const viewportCenterY = height * 0.38;
        const finalGalaxyRadius = Math.min(width * 0.48, height * 0.62);
        const distantGalaxyRadius = Math.max(width, height) * 2.2;
        const galaxyRadius = finalGalaxyRadius + (distantGalaxyRadius - finalGalaxyRadius) * (1 - galaxyProgress) ** 2;
        updateGalaxyCamera({ galaxyCamera, solarCamera: camera, frameTime, frameDelta, reducedMotion });
        updateFocusRotation(objectFocus, frameTime);
        // Cache the camera transform once per frame. Galactic layers contain
        // thousands of glyphs, so repeating trigonometry for every point is a
        // substantial and unnecessary cost.
        const galacticRotationCosine = Math.cos(galaxyCamera.rotation);
        const galacticRotationSine = Math.sin(galaxyCamera.rotation);
        const galacticProjectedTilt = 0.58 * galaxyCamera.tilt;
        const galacticOffset = (x: number, y: number, radius: number, target: { x: number; y: number }) => {
            // Spin within the galactic plane first, then project that plane toward
            // the viewer. Flattening first would rotate the projected ellipse itself.
            const rotatedX = x * galacticRotationCosine - y * galacticRotationSine;
            const rotatedY = x * galacticRotationSine + y * galacticRotationCosine;
            target.x = rotatedX * radius;
            target.y = rotatedY * galacticProjectedTilt * radius;
            return target;
        };
        // Follow Sol's live projected coordinate during the zoom. This is the same
        // point used by the Orion Spur marker, so rotation can never separate the
        // local scene from the place it expands into or contracts from.
        const simulatedSol = moveGalacticMaterial(
            GALACTIC_SOL.x,
            GALACTIC_SOL.y,
            elapsedGalacticYears,
            simulatedSolScratch,
        );
        const finalSolOffset = galacticOffset(simulatedSol.x, simulatedSol.y, finalGalaxyRadius, finalSolOffsetScratch);
        const currentSolOffset = galacticOffset(simulatedSol.x, simulatedSol.y, galaxyRadius, currentSolOffsetScratch);
        let centerX = viewportCenterX + finalSolOffset.x * galaxyProgress;
        let centerY = viewportCenterY + finalSolOffset.y * galaxyProgress;
        const galaxyCoreX = centerX - currentSolOffset.x;
        const galaxyCoreY = centerY - currentSolOffset.y;
        // Once a galactic close-up covers the scene, stop painting the hundreds of
        // Milky Way glyphs underneath it. The fade completes early enough that the
        // transition remains continuous while avoiding two full scenes per frame.
        const backgroundSceneOpacity =
            objectFocus.target?.kind === 'galactic' ? 1 - smoothstep((visualFocusProgress - 0.04) / 0.42) : 1;
        const galaxyAlpha = galaxyVisibility * backgroundSceneOpacity;
        const localSkyOpacity = (1 - smoothstep((cosmicZoom.current - 0.06) / 0.24)) * backgroundSceneOpacity;
        // Leave enough room for Neptune even at the nearest point in the projection.
        const baseWorldScale = width < 600 ? Math.min(width / 116, height / 54) : Math.min(width / 104, height / 50);
        const focusedSceneScale = 1 + planetSceneFocus * 13;
        const worldScale = baseWorldScale * (1 - plutoReveal * 0.11) * solarSystemScale * focusedSceneScale;
        const cameraDistance = 145;
        const cameraRollCosine = Math.cos(camera.renderedRoll);
        const cameraRollSine = Math.sin(camera.renderedRoll);
        const cameraPitchCosine = Math.cos(camera.renderedPitch);
        const cameraPitchSine = Math.sin(camera.renderedPitch);
        const cameraYawCosine = Math.cos(camera.renderedYaw);
        const cameraYawSine = Math.sin(camera.renderedYaw);

        const cameraProjection = (world: Vec3, target: ProjectedPoint): ProjectedPoint => {
            const rolledX = world.x * cameraRollCosine - world.y * cameraRollSine;
            const rolledY = world.x * cameraRollSine + world.y * cameraRollCosine;
            const pitchedY = rolledY * cameraPitchCosine - world.z * cameraPitchSine;
            const pitchedZ = rolledY * cameraPitchSine + world.z * cameraPitchCosine;
            const yawedX = rolledX * cameraYawCosine + pitchedZ * cameraYawSine;
            const yawedZ = -rolledX * cameraYawSine + pitchedZ * cameraYawCosine;
            const perspective = cameraDistance / (cameraDistance - yawedZ);
            target.x = yawedX * worldScale * perspective;
            target.y = pitchedY * worldScale * perspective;
            target.z = yawedZ;
            target.scale = perspective;
            return target;
        };
        if (focusedPlanet) {
            const focusedOffset = solarSystemModel.projectFocusedPlanet(focusedPlanet, now, cameraProjection);
            const focusedCentering = 1 - (1 - planetSceneFocus) / focusedSceneScale;
            centerX += (viewportCenterX - (centerX + focusedOffset.x)) * focusedCentering;
            centerY += (viewportCenterY - (centerY + focusedOffset.y)) * focusedCentering;
        }
        const cameraTransform = (world: Vec3, target: ProjectedPoint): ProjectedPoint => {
            cameraProjection(world, target);
            target.x += centerX;
            target.y += centerY;
            return target;
        };

        drawLocalStarfield(context, {
            width,
            height,
            pointerX: pointer.x,
            pointerY: pointer.y,
            seconds,
            reducedMotion,
            opacity: localSkyOpacity * intro.stars,
            renderLeft,
            renderTop,
            renderRight,
            renderBottom,
        });
        drawGalaxyBackdrop(context, {
            width,
            height,
            seconds,
            elapsedGalacticYears,
            reducedMotion,
            alpha: galaxyAlpha,
            radius: galaxyRadius,
            coreX: galaxyCoreX,
            coreY: galaxyCoreY,
            projectOffset: galacticOffset,
            renderLeft,
            renderTop,
            renderRight,
            renderBottom,
        });

        solarSystemModel.projectOrbits({
            cameraTransform,
            plutoUnlocked: easterEgg.unlocked,
            plutoReveal,
            localDetailOpacity,
            planetSceneFocus,
            introProgress: intro.orbits,
        });
        solarSystemModel.projectBodies({
            cameraTransform,
            now,
            plutoUnlocked: easterEgg.unlocked,
            plutoReveal,
            introProgress: intro.bodies,
        });
        const projectedHalley = solarSystemRenderer.projectHalley(now, cameraTransform);

        const localPointerX = pointer.clientX - systemBounds.left;
        const localPointerY = pointer.clientY - systemBounds.top;
        const showHoverVisuals = pointer.showsHover;
        const bodyHoverCandidate =
            pointer.active && !camera.dragging && !objectFocus.target && localDetailOpacity > 0.45
                ? findHoveredBody({
                      bodies,
                      pointerX: localPointerX,
                      pointerY: localPointerY,
                      solarSystemScale,
                      viewportGlyphScale,
                  })
                : null;
        const cometHoverCandidate =
            pointer.active &&
            !camera.dragging &&
            !objectFocus.target &&
            localDetailOpacity > 0.45 &&
            intro.details > 0.4
                ? findHoveredComet(projectedHalley, localPointerX, localPointerY)
                : null;
        const galaxyObjectOpacity = galaxyAlpha * smoothstep((galaxyProgress - 0.42) / 0.35);
        galaxyObjectRenderer.project({
            radius: galaxyRadius,
            coreX: galaxyCoreX,
            coreY: galaxyCoreY,
            verticalProjection: Math.sqrt(Math.max(0, 1 - galacticProjectedTilt ** 2)),
            elapsedGalacticYears,
            projectOffset: galacticOffset,
        });
        if (objectFocus.target?.kind === 'galactic') {
            const liveFocusedObject = galaxyObjectRenderer.findByName(objectFocus.target.name);
            if (liveFocusedObject) {
                objectFocus.target.originX = liveFocusedObject.x;
                objectFocus.target.originY = liveFocusedObject.y;
            }
        }
        const hoveredGalacticObject =
            pointer.active && !camera.dragging && !objectFocus.target && galaxyObjectOpacity > 0.35
                ? galaxyObjectRenderer.findHovered(localPointerX, localPointerY)
                : null;
        // Galactic objects are painted last. Within the local scene, the comet
        // and planets compete by depth; the Sun only wins uncovered pixels.
        const hoveredComet =
            !hoveredGalacticObject &&
            cometHoverCandidate &&
            (!bodyHoverCandidate || projectedHalley.z >= bodyHoverCandidate.z)
                ? cometHoverCandidate
                : null;
        const hoveredBody = hoveredGalacticObject || hoveredComet ? null : bodyHoverCandidate;
        const hoveredSun =
            !hoveredGalacticObject &&
            !hoveredComet &&
            !hoveredBody &&
            pointer.active &&
            !camera.dragging &&
            !objectFocus.target &&
            localDetailOpacity > 0.45 &&
            intro.sun > 0.55 &&
            Math.hypot(centerX - localPointerX, centerY - localPointerY) <
                48 * Math.max(0.55, Math.sqrt(renderedSunScale));

        activeFocusCandidate = createFocusCandidate({
            hoveredBody,
            hoveredComet,
            hoveredSun,
            hoveredGalacticObject,
            sunX: centerX,
            sunY: centerY,
        });

        solarSystemRenderer.draw(context, {
            farMarks,
            nearMarks,
            bodies,
            cameraTransform,
            solveMoonOrbit: solveSolarMoonOrbit,
            moonElapsedDays: solarMoonElapsedDays,
            focusedPlanet,
            focusedSun,
            focusedSunDetailReveal,
            focusedSunBridgeScale,
            hoveredBody,
            hoveredComet,
            hoveredSun,
            showHoverVisuals,
            centerX,
            centerY,
            renderedSunScale,
            now,
            seconds,
            reducedMotion,
            solarSystemScale,
            viewportGlyphScale,
            localDetailOpacity,
            planetSceneFocus,
            introSunOpacity: intro.sun,
            introDetailOpacity: intro.details,
        });
        galaxyObjectRenderer.draw(context, {
            width,
            height,
            seconds,
            reducedMotion,
            opacity: galaxyObjectOpacity,
            galaxyProgress,
            hovered: hoveredGalacticObject,
            showHoverVisuals,
            renderLeft,
            renderTop,
            renderRight,
            renderBottom,
        });
        drawSolMarker(context, {
            alpha: galaxyAlpha,
            localDetailOpacity,
            galaxyProgress,
            x: centerX,
            y: centerY,
        });

        if (showHoverVisuals) {
            drawHoverReadouts(context, {
                width,
                height,
                hoveredBody,
                hoveredComet,
                hoveredSun,
                hoveredGalacticObject,
                sunX: centerX,
                sunY: centerY,
            });
        }

        if (objectFocus.target && objectFocus.progress > 0.001) {
            activeFocusCandidate = drawFocusScene(context, {
                width,
                height,
                objectFocus,
                focusedPlanet,
                bodies,
                viewportCenterX,
                viewportCenterY,
                localSphereGrowth,
                planetSceneFocus,
                seconds,
                rotationHours: elapsedRotationHours,
                reducedMotion,
                pointer,
                camera,
                localPointerX,
                localPointerY,
                showHoverVisuals,
                solveMoonOrbit: solveFocusedMoonOrbit,
                moonElapsedDays: focusedMoonElapsedDays,
            });
        }
        const currentSecond = Math.floor(frameTime / 1000);
        const cameraStatsTick = Math.floor(frameTime / 100);
        if (cameraStatsTick !== lastCameraStatsTick) {
            updateCameraStats();
            lastCameraStatsTick = cameraStatsTick;
        }
        if (clock && currentSecond !== lastClockSecond) {
            if (cosmicZoom.current > 0.5) {
                clock.textContent = `GALACTIC EPOCH / ${formatGalacticEpoch(elapsedGalacticYears)}`;
            } else {
                const clockMode = orbitClock.active && !orbitClock.returning ? ' SIM' : '';
                clock.textContent = formatLocalDateTime(now) + clockMode;
            }
            lastClockSecond = currentSecond;
        }
        scheduleRender();
    }

    bindOrreryInteractions({
        canvas,
        system,
        focusReturn,
        zoomInput,
        zoomStatus,
        solarSimulationSpeed,
        galacticSimulationSpeed,
        rotationSimulationSpeed,
        pointer,
        camera,
        galaxyCamera,
        objectFocus,
        easterEgg,
        cosmicZoom,
        orbitClock,
        galacticClock,
        rotationClock,
        getActiveFocusCandidate: () => activeFocusCandidate,
        getOrbitDate,
        getGalacticElapsedYears,
        getRotationElapsedHours,
        beginObjectFocus: (target) => focusController.begin(target),
        beginChildFocus: (target) => focusController.beginChild(target),
        leaveObjectFocus: () => focusController.leave(),
        setZoomLocation,
        onInteract: () => {
            introController.skip();
            system.classList.remove('is-intro-running');
            solarHeading?.classList.remove('is-intro-running');
        },
    });

    scheduleRender();
}
