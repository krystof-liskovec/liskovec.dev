import { GALACTIC_OBJECTS, MAJOR_MOON_SYSTEMS, PLANETARY_MOON_SYSTEMS, PLANETS } from './orrery/catalog';
import type { MajorMoon } from './orrery/catalog';
import { drawReadout } from './orrery/canvas-ui';
import { drawFocusScene } from './orrery/focus-scene';
import { bindOrreryInteractions } from './orrery/interactions';
import {
    DEG,
    J2000,
    heliocentricPosition,
    orbitalPoint,
    rotateX,
    rotateZ,
    smoothstep,
    solveKeplerOrbit,
    solveOrbit,
} from './orrery/math';
import { createRuntimeState, getOrbitDate as resolveOrbitDate } from './orrery/runtime-state';
import {
    ASTEROID_BELT,
    GALACTIC_DISK,
    GALACTIC_DUST_LANES,
    GALACTIC_NEBULAE,
    GALACTIC_SOL,
    GALAXY_STARS,
    ORBIT_POINTS,
    ORBIT_SAMPLES,
    ORION_SPUR_STARS,
    STARS,
    galacticPositionFromSun,
} from './orrery/scene-data';
import { COMPACT_PLANET_GRIDS, drawSolarBody } from './orrery/solar-body-renderer';
import { drawSun } from './orrery/sun-renderer';
import type { FocusTarget, ProjectedBody, Vec3 } from './orrery/types';

const canvasElement = document.querySelector<HTMLCanvasElement>('#solar-canvas');
const systemElement = document.querySelector<HTMLElement>('#solar-system');
const clock = document.querySelector<HTMLElement>('#solar-time');
const zoomInput = document.querySelector<HTMLInputElement>('#cosmic-zoom');
const zoomStatus = document.querySelector<HTMLOutputElement>('#cosmic-zoom-status');
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
    const { pointer, camera, galaxyCamera, objectFocus, easterEgg, cosmicZoom, orbitClock } = createRuntimeState();
    let activeFocusCandidate: FocusTarget | null = null;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reducedMotionQuery.matches;
    let lastClockSecond = -1;
    let lastFrameAt = 0;
    let zoomLocationState = 'solar';
    let zoomLocationTimer = 0;
    let animationFrame = 0;
    let systemVisible = true;
    let pageVisible = !document.hidden;

    type ProjectedPoint = Vec3 & { scale: number };
    type OrbitMark = ProjectedPoint & { glyph: string; alpha: number; reveal: number };

    const orbitProjection = { x: 0, y: 0, z: 0, scale: 1 };
    const nextOrbitProjection = { x: 0, y: 0, z: 0, scale: 1 };
    const galacticOffsetScratch = { x: 0, y: 0 };
    const finalSolOffsetScratch = { x: 0, y: 0 };
    const currentSolOffsetScratch = { x: 0, y: 0 };
    const galacticPositionScratch = { x: 0, y: 0 };
    const moonOffsetScratch = { x: 0, y: 0, z: 0 };
    const moonWorldScratch = { x: 0, y: 0, z: 0 };
    const moonProjectionScratch = { x: 0, y: 0, z: 0, scale: 1 };
    const moonOrbitScratch = { angle: 0, distance: 1 };
    const asteroidPointScratch = { x: 0, y: 0, z: 0 };
    const asteroidProjectionScratch = { x: 0, y: 0, z: 0, scale: 1 };
    const focusedOrbitScratch = { angle: 0, distance: 1 };
    const focusedWorldScratch = { x: 0, y: 0, z: 0 };
    const focusedProjectionScratch = { x: 0, y: 0, z: 0, scale: 1 };
    const orbitSolutionPool = PLANETS.map(() => ({ angle: 0, distance: 1 }));
    const bodyPool: ProjectedBody[] = PLANETS.map((planet) => ({
        planet,
        world: { x: 0, y: 0, z: 0 },
        reveal: 1,
        position: { longitude: 0, latitude: 0, distance: 0 },
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
    }));
    const bodies: ProjectedBody[] = [];
    type ProjectedGalacticObject = { object: (typeof GALACTIC_OBJECTS)[number]; x: number; y: number };
    const galacticObjectPool: ProjectedGalacticObject[] = GALACTIC_OBJECTS.map((object) => ({ object, x: 0, y: 0 }));
    const galacticObjects: ProjectedGalacticObject[] = [];
    const orbitMarkPool: OrbitMark[] = Array.from({ length: PLANETS.length * ORBIT_SAMPLES }, () => ({
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
        glyph: '-',
        alpha: 0,
        reveal: 1,
    }));
    const farMarks: OrbitMark[] = [];
    const nearMarks: OrbitMark[] = [];

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

    const beginObjectFocus = (target: FocusTarget) => {
        objectFocus.target = target;
        objectFocus.progress = 0;
        objectFocus.exiting = false;
        objectFocus.child = null;
        objectFocus.childProgress = 0;
        objectFocus.childExiting = false;
        objectFocus.longitude = 0;
        objectFocus.latitude = 0;
        objectFocus.resetting = false;
        activeFocusCandidate = null;
        system.classList.add('is-object-focus');
        if (focusReturn) {
            focusReturn.hidden = false;
            focusReturn.classList.remove('is-transitioning');
            focusReturn.textContent = '[ ← return ]';
        }
        if (zoomInput) zoomInput.disabled = true;
        setZoomLocation(
            `focus:${target.id}`,
            target.name === 'Earth' ? 'on planet Earth.' : target.kind === 'star' ? 'at Sol.' : `near ${target.name}.`,
        );
    };

    const leaveObjectFocus = () => {
        if (objectFocus.child && !objectFocus.childExiting) {
            objectFocus.childExiting = true;
            camera.dragging = false;
            system.classList.remove('is-dragging');
            if (focusReturn) {
                focusReturn.disabled = true;
                focusReturn.classList.add('is-transitioning');
            }
            return;
        }
        if (!objectFocus.target || objectFocus.exiting) return;
        objectFocus.exiting = true;
        camera.dragging = false;
        system.classList.remove('is-dragging');
        if (focusReturn) {
            focusReturn.disabled = true;
            focusReturn.hidden = true;
        }
    };

    const beginChildFocus = (target: FocusTarget) => {
        objectFocus.child = target;
        objectFocus.childProgress = 0;
        objectFocus.childExiting = false;
        objectFocus.childLongitude = 0;
        objectFocus.childLatitude = 0;
        activeFocusCandidate = null;
        if (focusReturn) {
            focusReturn.classList.remove('is-transitioning');
            focusReturn.textContent = '[ ← return ]';
        }
        setZoomLocation(`focus:${target.id}`, target.kind === 'moon' ? `near ${target.name}.` : 'aboard the ISS.');
    };

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

    function render(frameTime: number) {
        animationFrame = 0;
        if (!systemVisible || !pageVisible) return;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        // Orbital spacing has to contract on a phone so Neptune remains visible.
        // Scale the ASCII bodies with it, instead of leaving desktop-sized glyphs
        // crowded into the smaller scene.
        const viewportGlyphScale = Math.min(1, Math.max(0.68, width / 700));
        const mobileSunProgress = Math.max(0, Math.min(1, (width - 430) / 270));
        const viewportSunScale = 0.58 + mobileSunProgress * 0.42;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const pixelWidth = Math.max(1, Math.round(width * dpr));
        const pixelHeight = Math.max(1, Math.round(height * dpr));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }
        // Use the canvas's real backing-store ratio. CSS grid sizing can produce
        // fractional dimensions, and a nominal DPR transform leaves that bitmap
        // fractionally stretched by the browser, softening small ASCII glyphs.
        context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
        context.clearRect(0, 0, width, height);
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        pointer.x += (pointer.targetX - pointer.x) * 0.055;
        pointer.y += (pointer.targetY - pointer.y) * 0.055;
        const seconds = frameTime / 1000;
        const frameDelta = Math.min(40, lastFrameAt ? frameTime - lastFrameAt : 16.67);
        lastFrameAt = frameTime;
        if (objectFocus.target) {
            const focusTarget = objectFocus.exiting ? 0 : 1;
            const focusResponse = objectFocus.target.kind === 'galactic' && !objectFocus.exiting ? 0.0044 : 0.0034;
            objectFocus.progress +=
                (focusTarget - objectFocus.progress) * (reducedMotion ? 1 : Math.min(0.11, frameDelta * focusResponse));
            // Finish once the eased focus layer is visually gone; waiting for the
            // asymptotic tail makes the restored scene feel like it is still loading.
            if (objectFocus.exiting && objectFocus.progress < 0.06) {
                objectFocus.target = null;
                objectFocus.progress = 0;
                objectFocus.exiting = false;
                system.classList.remove('is-object-focus');
                if (focusReturn) {
                    focusReturn.hidden = true;
                    focusReturn.disabled = false;
                }
                if (zoomInput) zoomInput.disabled = false;
                if (cosmicZoom.target >= 0.5) setZoomLocation('milky-way', 'in the Milky Way.');
                else setZoomLocation('solar', 'in the solar system.');
            }
        }
        if (objectFocus.child) {
            const childTarget = objectFocus.childExiting ? 0 : 1;
            objectFocus.childProgress +=
                (childTarget - objectFocus.childProgress) * (reducedMotion ? 1 : Math.min(0.11, frameDelta * 0.0034));
            // At 6% linear progress, smoothstep leaves under 1.1% of the child scene
            // visible. Complete here so the controls match the perceived end of the zoom.
            if (objectFocus.childExiting && objectFocus.childProgress < 0.06) {
                objectFocus.child = null;
                objectFocus.childProgress = 0;
                objectFocus.childExiting = false;
                if (focusReturn) {
                    focusReturn.disabled = false;
                    focusReturn.textContent = '[ ← return ]';
                    focusReturn.classList.remove('is-transitioning');
                }
                const parent = objectFocus.target;
                if (parent) {
                    setZoomLocation(
                        `focus:${parent.id}`,
                        parent.name === 'Earth' ? 'on planet Earth.' : `near ${parent.name}.`,
                    );
                }
            }
        }
        cosmicZoom.current += (cosmicZoom.target - cosmicZoom.current) * (reducedMotion ? 1 : 0.055);
        const outwardZoom = Math.max(0, cosmicZoom.current);
        const focusedPlanet =
            objectFocus.target?.kind === 'planet'
                ? (PLANETS.find((planet) => planet.name === objectFocus.target?.name) ?? null)
                : null;
        const focusedSun = objectFocus.target?.kind === 'star';
        // Exit completes at 6%, so map that outgoing tail to an exact zero. This
        // keeps the final world scale and centering continuous when focus clears.
        const localFocusProgress = objectFocus.exiting
            ? Math.max(0, (objectFocus.progress - 0.06) / 0.94)
            : objectFocus.progress;
        const planetSceneFocus = focusedPlanet || focusedSun ? smoothstep(localFocusProgress) : 0;
        const localSphereGrowth = smoothstep((planetSceneFocus - 0.08) / 0.92) ** 1.45;
        const focusedSunDetailReveal = focusedSun ? smoothstep((planetSceneFocus - 0.06) / 0.3) : 0;
        const focusedSunBridgeScale = focusedSun ? (0.24 + localSphereGrowth * 0.76) / 0.24 : 1;
        const galaxyProgress = smoothstep((outwardZoom - 0.24) / 0.76);
        const galaxyVisibility = smoothstep((outwardZoom - 0.46) / 0.42);
        const localDetailOpacity = 1 - smoothstep((outwardZoom - 0.2) / 0.26);
        const solarSystemScale = Math.pow(0.055, Math.min(1, outwardZoom / 0.7));
        const renderedSunScale = solarSystemScale * viewportSunScale ** 2;
        if (camera.manual && !camera.dragging && !camera.resetting && !reducedMotion) {
            camera.roll += 0.000035 * frameDelta;
        }
        const revealProgress = easterEgg.unlocked
            ? Math.min(1, (frameTime - easterEgg.revealedAt) / (reducedMotion ? 1 : 1200))
            : 0;
        const plutoReveal = 1 - (1 - revealProgress) ** 3;
        const drift = reducedMotion ? 0 : seconds * 0.035;
        const automaticPitch = (58 + Math.sin(seconds * 0.18) * 4 + pointer.y * 10) * DEG;
        const automaticYaw = (Math.sin(seconds * 0.11) * 8 + pointer.x * 14) * DEG;
        const automaticRoll = -12 * DEG + drift;
        let cameraPitch = camera.manual ? camera.pitch : automaticPitch;
        let cameraYaw = camera.manual ? camera.yaw : automaticYaw;
        let cameraRoll = camera.manual ? camera.roll : automaticRoll;
        if (camera.resetting) {
            const progress = Math.min(1, (frameTime - camera.resetStartedAt) / 900);
            const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
            const interpolateAngle = (from: number, to: number) => {
                const difference = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                return from + difference * eased;
            };
            cameraPitch = camera.resetPitch + (automaticPitch - camera.resetPitch) * eased;
            cameraYaw = interpolateAngle(camera.resetYaw, automaticYaw);
            cameraRoll = interpolateAngle(camera.resetRoll, automaticRoll);
            if (progress === 1) camera.resetting = false;
        }
        camera.renderedPitch = cameraPitch;
        camera.renderedYaw = cameraYaw;
        camera.renderedRoll = cameraRoll;
        const now = getOrbitDate(frameTime);
        const solveMoonOrbit = (moon: MajorMoon, target = { angle: 0, distance: 1 }) => {
            // Start from the moon's current astronomical phase, then advance a
            // modest visual clock. At wall-clock speed even Io moves too little
            // to register, while this still preserves every moon's real period,
            // eccentricity, inclination, and relative orbital speed.
            const visualElapsedDays = reducedMotion ? 0 : seconds * 0.005;
            const elapsedDays = (now - J2000) / 86400000 + visualElapsedDays;
            const meanAnomaly = (moon.meanAnomaly + (elapsedDays / moon.periodDays) * 360) * DEG;
            solveKeplerOrbit(meanAnomaly, moon.eccentricity, target);
            target.angle += moon.periapsis * DEG;
            return target;
        };
        const viewportCenterX = width * 0.52;
        const viewportCenterY = height * 0.38;
        const finalGalaxyRadius = Math.min(width * 0.48, height * 0.62);
        const distantGalaxyRadius = Math.max(width, height) * 2.2;
        const galaxyRadius = finalGalaxyRadius + (distantGalaxyRadius - finalGalaxyRadius) * (1 - galaxyProgress) ** 2;
        if (!(camera.dragging && camera.dragMode === 'galaxy') && !galaxyCamera.resetting && !reducedMotion) {
            galaxyCamera.rotation += 0.000025 * frameDelta;
        }
        if (galaxyCamera.resetting) {
            const progress = Math.min(1, (frameTime - galaxyCamera.resetStartedAt) / 900);
            const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
            const rotationDifference = ((-galaxyCamera.resetRotation + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            galaxyCamera.rotation = galaxyCamera.resetRotation + rotationDifference * eased;
            galaxyCamera.tilt = galaxyCamera.resetTilt + (1 - galaxyCamera.resetTilt) * eased;
            if (progress === 1) {
                galaxyCamera.rotation = 0;
                galaxyCamera.tilt = 1;
                galaxyCamera.resetting = false;
            }
        }
        if (objectFocus.resetting) {
            const progress = Math.min(1, (frameTime - objectFocus.resetStartedAt) / 700);
            const eased = 1 - (1 - progress) ** 3;
            const longitudeDifference = ((-objectFocus.resetLongitude + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            objectFocus.longitude = objectFocus.resetLongitude + longitudeDifference * eased;
            objectFocus.latitude = objectFocus.resetLatitude * (1 - eased);
            if (progress === 1) {
                objectFocus.longitude = 0;
                objectFocus.latitude = 0;
                objectFocus.resetting = false;
            }
        }
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
        const finalSolOffset = galacticOffset(GALACTIC_SOL.x, GALACTIC_SOL.y, finalGalaxyRadius, finalSolOffsetScratch);
        const currentSolOffset = galacticOffset(GALACTIC_SOL.x, GALACTIC_SOL.y, galaxyRadius, currentSolOffsetScratch);
        let centerX = viewportCenterX + finalSolOffset.x * galaxyProgress;
        let centerY = viewportCenterY + finalSolOffset.y * galaxyProgress;
        const galaxyCoreX = centerX - currentSolOffset.x;
        const galaxyCoreY = centerY - currentSolOffset.y;
        // Once a galactic close-up covers the scene, stop painting the hundreds of
        // Milky Way glyphs underneath it. The fade completes early enough that the
        // transition remains continuous while avoiding two full scenes per frame.
        const backgroundSceneOpacity =
            objectFocus.target?.kind === 'galactic' ? 1 - smoothstep((objectFocus.progress - 0.04) / 0.42) : 1;
        const galaxyAlpha = galaxyVisibility * backgroundSceneOpacity;
        const localSkyOpacity = (1 - smoothstep((cosmicZoom.current - 0.06) / 0.24)) * backgroundSceneOpacity;
        // Leave enough room for Neptune even at the nearest point in the projection.
        const baseWorldScale = width < 600 ? Math.min(width / 116, height / 54) : Math.min(width / 104, height / 50);
        const focusedSceneScale = 1 + planetSceneFocus * 13;
        const worldScale = baseWorldScale * (1 - plutoReveal * 0.11) * solarSystemScale * focusedSceneScale;
        const cameraDistance = 145;
        const cameraRollCosine = Math.cos(cameraRoll);
        const cameraRollSine = Math.sin(cameraRoll);
        const cameraPitchCosine = Math.cos(cameraPitch);
        const cameraPitchSine = Math.sin(cameraPitch);
        const cameraYawCosine = Math.cos(cameraYaw);
        const cameraYawSine = Math.sin(cameraYaw);

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
            const focusedOrbit = solveOrbit(focusedPlanet, now, focusedOrbitScratch);
            const focusedWorld = orbitalPoint(
                focusedPlanet,
                focusedOrbit.angle,
                focusedOrbit.distance,
                focusedWorldScratch,
            );
            const focusedOffset = cameraProjection(focusedWorld, focusedProjectionScratch);
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

        const starParallaxX = pointer.x * 8;
        const starParallaxY = pointer.y * 5;
        for (const glyph of ['.', '*', '+']) {
            context.fillStyle = glyph === '+' ? '#fabd2f' : '#928374';
            context.font = `${glyph === '+' ? 14 : 11}px "DM Mono", monospace`;
            for (const star of STARS) {
                if (star.glyph !== glyph) continue;
                const pulse = reducedMotion ? 0.45 : 0.5 + 0.5 * Math.sin(seconds * star.speed * 2.2 + star.phase);
                context.globalAlpha = (0.16 + pulse * (glyph === '+' ? 0.82 : 0.46)) * localSkyOpacity;
                context.fillText(glyph, star.x * width + starParallaxX, star.y * height + starParallaxY);
            }
        }
        context.globalAlpha = 1;

        if (galaxyAlpha > 0.001) {
            context.font = `${width < 600 ? 6.5 : 8}px "DM Mono", monospace`;
            context.fillStyle = '#665c54';
            for (const particle of GALACTIC_DISK) {
                const offset = galacticOffset(particle.x, particle.y, galaxyRadius, galacticOffsetScratch);
                const particleX = galaxyCoreX + offset.x;
                const particleY = galaxyCoreY + offset.y;
                if (particleX < -10 || particleX > width + 10 || particleY < -10 || particleY > height + 10) continue;
                context.globalAlpha = galaxyAlpha * particle.opacity;
                context.fillText(particle.glyph, particleX, particleY);
            }
            context.font = `${width < 600 ? 7 : 9}px "DM Mono", monospace`;
            for (const particle of GALACTIC_NEBULAE) {
                const offset = galacticOffset(particle.x, particle.y, galaxyRadius, galacticOffsetScratch);
                const particleX = galaxyCoreX + offset.x;
                const particleY = galaxyCoreY + offset.y;
                if (particleX < -12 || particleX > width + 12 || particleY < -12 || particleY > height + 12) continue;
                const pulse = reducedMotion ? 0.82 : 0.8 + Math.sin(seconds * 0.34 + particle.phase) * 0.12;
                context.globalAlpha = galaxyAlpha * particle.opacity * pulse;
                context.fillStyle = particle.color;
                context.fillText(particle.glyph, particleX, particleY);
            }
            context.font = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
            const galaxyStarStride = width < 600 ? 2 : 1;
            for (let starIndex = 0; starIndex < GALAXY_STARS.length; starIndex += galaxyStarStride) {
                const star = GALAXY_STARS[starIndex];
                const offset = galacticOffset(star.x, star.y, galaxyRadius, galacticOffsetScratch);
                const starX = galaxyCoreX + offset.x;
                const starY = galaxyCoreY + offset.y;
                if (starX < -12 || starX > width + 12 || starY < -12 || starY > height + 12) continue;
                const twinkle = reducedMotion ? 0.7 : 0.68 + Math.sin(seconds * 0.9 + star.phase) * 0.22;
                context.globalAlpha =
                    galaxyAlpha * star.opacity * twinkle * (0.5 + (1 - star.radius) * 0.42 + star.strength * 0.16);
                context.fillStyle =
                    star.radius < 0.2
                        ? '#ebdbb2'
                        : star.glyph === '+'
                          ? '#d3869b'
                          : star.glyph === '*'
                            ? '#b8bb26'
                            : '#928374';
                context.fillText(star.glyph, starX, starY);
            }
            context.font = `${width < 600 ? 7 : 9}px "DM Mono", monospace`;
            context.fillStyle = '#1d2021';
            for (const dust of GALACTIC_DUST_LANES) {
                const offset = galacticOffset(dust.x, dust.y, galaxyRadius, galacticOffsetScratch);
                const dustX = galaxyCoreX + offset.x;
                const dustY = galaxyCoreY + offset.y;
                if (dustX < -10 || dustX > width + 10 || dustY < -10 || dustY > height + 10) continue;
                context.globalAlpha = galaxyAlpha * dust.opacity;
                context.fillText(dust.glyph, dustX, dustY);
            }
            for (const star of ORION_SPUR_STARS) {
                const offset = galacticOffset(star.x, star.y, galaxyRadius, galacticOffsetScratch);
                const starX = galaxyCoreX + offset.x;
                const starY = galaxyCoreY + offset.y;
                if (starX < -12 || starX > width + 12 || starY < -12 || starY > height + 12) continue;
                const twinkle = reducedMotion ? 0.72 : 0.72 + Math.sin(seconds + star.phase) * 0.18;
                context.globalAlpha = galaxyAlpha * twinkle * 0.78;
                context.fillStyle = star.glyph === '*' ? '#b8bb26' : '#a89984';
                context.fillText(star.glyph, starX, starY);
            }
            context.globalAlpha = galaxyAlpha;
            context.fillStyle = '#fabd2f';
            context.font = `${width < 600 ? 10 : 13}px "DM Mono", monospace`;
            context.fillText('{:*:::*:}', galaxyCoreX, galaxyCoreY);
            context.globalAlpha = 1;
        }

        farMarks.length = 0;
        nearMarks.length = 0;
        let orbitMarkCount = 0;
        // The orbits are a stable spatial reference; motion belongs to the scene itself.
        const dashTravel = 0;

        PLANETS.forEach((planet, planetIndex) => {
            if (planet.easterEgg && !easterEgg.unlocked) return;
            for (let sample = 0; sample < ORBIT_SAMPLES; sample++) {
                if ((sample + dashTravel + planetIndex) % 3 === 0) continue;
                const projected = cameraTransform(ORBIT_POINTS[planetIndex][sample], orbitProjection);
                const next = cameraTransform(
                    ORBIT_POINTS[planetIndex][(sample + 1) % ORBIT_SAMPLES],
                    nextOrbitProjection,
                );
                const dx = next.x - projected.x;
                const dy = next.y - projected.y;
                const slope = Math.abs(dy / (dx || 0.001));
                const glyph = slope > 2.1 ? '|' : slope > 0.55 ? (dx * dy > 0 ? '\\' : '/') : '-';
                const mark = orbitMarkPool[orbitMarkCount++];
                mark.x = projected.x;
                mark.y = projected.y;
                mark.z = projected.z;
                mark.scale = projected.scale;
                mark.glyph = glyph;
                mark.alpha = 0.7 * localDetailOpacity * (1 - planetSceneFocus);
                mark.reveal = planet.easterEgg ? plutoReveal : 1;
                (projected.z < 0 ? farMarks : nearMarks).push(mark);
            }
        });

        const drawMarks = (marks: OrbitMark[]) => {
            context.font = '9px "DM Mono", monospace';
            for (const mark of marks) {
                context.globalAlpha = mark.alpha * mark.reveal;
                context.fillStyle = '#7c6f64';
                context.fillText(mark.glyph, mark.x, mark.y);
            }
            context.globalAlpha = 1;
        };

        bodies.length = 0;
        for (let planetIndex = 0; planetIndex < PLANETS.length; planetIndex++) {
            const planet = PLANETS[planetIndex];
            if (planet.easterEgg && !easterEgg.unlocked) continue;
            const body = bodyPool[planetIndex];
            const orbit = solveOrbit(planet, now, orbitSolutionPool[planetIndex]);
            orbitalPoint(planet, orbit.angle, orbit.distance, body.world);
            body.reveal = planet.easterEgg ? plutoReveal : 1;
            heliocentricPosition(planet, orbit.angle, orbit.distance, body.position);
            cameraTransform(body.world, body);
            bodies.push(body);
        }
        bodies.sort((first, second) => first.z - second.z);

        const canvasBounds = canvas.getBoundingClientRect();
        const localPointerX = pointer.clientX - canvasBounds.left;
        const localPointerY = pointer.clientY - canvasBounds.top;
        const showHoverVisuals = pointer.showsHover;
        const bodyHoverCandidate =
            pointer.active && !camera.dragging && !objectFocus.target && localDetailOpacity > 0.45
                ? bodies.reduce<(typeof bodies)[number] | null>((frontmost, body) => {
                      if (body.reveal <= 0.35) return frontmost;
                      const perspectiveScale = Math.max(0.68, Math.min(1.55, body.scale));
                      const depthScale = 0.75 + perspectiveScale * 0.25;
                      const glyphScale = Math.max(0.3, Math.sqrt(solarSystemScale)) * viewportGlyphScale;
                      const fontSize =
                          (body.planet.easterEgg ? 16 : Math.max(6.2, 12.5 * body.planet.size * depthScale)) *
                          glyphScale;
                      const lines =
                          body.planet.easterEgg || (fontSize < 9 && solarSystemScale < 0.45)
                              ? [body.planet.glyph]
                              : body.planet.sprite;
                      const compactGrid =
                          solarSystemScale >= 0.45 && !body.planet.easterEgg
                              ? COMPACT_PLANET_GRIDS[body.planet.name]
                              : null;
                      const compactFontSize = compactGrid ? fontSize * compactGrid.fontScale : fontSize;
                      const compactSphereWidth = compactGrid ? compactGrid.columns * compactFontSize * 0.6 : 0;
                      const ringWidth =
                          body.planet.name === 'Saturn'
                              ? compactSphereWidth * 0.88
                              : body.planet.name === 'Uranus'
                                ? compactSphereWidth * 0.74
                                : 0;
                      const compactRows =
                          body.planet.name === 'Jupiter' ||
                          body.planet.name === 'Uranus' ||
                          body.planet.name === 'Neptune';
                      let maximumLineLength = 0;
                      for (const line of lines) maximumLineLength = Math.max(maximumLineLength, line.length);
                      const halfWidth = compactGrid
                          ? Math.max(compactSphereWidth / 2, ringWidth) + 6
                          : maximumLineLength * fontSize * 0.31 + 6;
                      const halfHeight = compactGrid
                          ? (compactGrid.rows * compactFontSize * 0.72) / 2 + 7
                          : (lines.length * fontSize * (compactRows ? 0.68 : 0.78)) / 2 + 6;
                      const normalizedDistance =
                          ((body.x - localPointerX) / halfWidth) ** 2 + ((body.y - localPointerY) / halfHeight) ** 2;
                      if (normalizedDistance > 1) return frontmost;
                      return !frontmost || body.z > frontmost.z ? body : frontmost;
                  }, null)
                : null;
        const galaxyObjectOpacity = galaxyAlpha * smoothstep((galaxyProgress - 0.42) / 0.35);
        galacticObjects.length = 0;
        for (let objectIndex = 0; objectIndex < GALACTIC_OBJECTS.length; objectIndex++) {
            const object = GALACTIC_OBJECTS[objectIndex];
            const projectedObject = galacticObjectPool[objectIndex];
            const position = galacticPositionFromSun(
                object.galacticLongitude,
                object.galacticLatitude,
                object.heliocentricDistanceKpc,
                galacticPositionScratch,
            );
            galacticOffset(position.x, position.y, galaxyRadius, projectedObject);
            projectedObject.x += galaxyCoreX;
            projectedObject.y += galaxyCoreY;
            galacticObjects.push(projectedObject);
        }
        const hoveredGalacticObject =
            pointer.active && !camera.dragging && !objectFocus.target && galaxyObjectOpacity > 0.35
                ? galacticObjects.reduce<(typeof galacticObjects)[number] | null>((closest, object) => {
                      const distance = Math.hypot(object.x - localPointerX, object.y - localPointerY);
                      const closestDistance = closest
                          ? Math.hypot(closest.x - localPointerX, closest.y - localPointerY)
                          : Infinity;
                      return distance < 36 && distance < closestDistance ? object : closest;
                  }, null)
                : null;
        // Galactic objects are painted last, followed by the nearest planet. The
        // Sun is the background layer and is hoverable only where nothing covers it.
        const hoveredBody = hoveredGalacticObject ? null : bodyHoverCandidate;
        const hoveredSun =
            !hoveredGalacticObject &&
            !hoveredBody &&
            pointer.active &&
            !camera.dragging &&
            !objectFocus.target &&
            localDetailOpacity > 0.45 &&
            Math.hypot(centerX - localPointerX, centerY - localPointerY) <
                48 * Math.max(0.55, Math.sqrt(renderedSunScale));

        activeFocusCandidate = hoveredBody
            ? {
                  id: `planet:${hoveredBody.planet.name}`,
                  name: hoveredBody.planet.name,
                  kind: 'planet',
                  color: hoveredBody.planet.color,
                  subtitle: hoveredBody.planet.easterEgg ? 'dwarf planet' : 'planet',
                  detail: `${hoveredBody.position.distance.toFixed(3)} au from Sol`,
                  originX: hoveredBody.x,
                  originY: hoveredBody.y,
              }
            : hoveredSun
              ? {
                    id: 'star:Sol',
                    name: 'Sol',
                    kind: 'star',
                    color: '#fabd2f',
                    subtitle: 'G-type main-sequence star',
                    detail: '1.000 solar mass / system barycentre',
                    originX: centerX,
                    originY: centerY,
                }
              : hoveredGalacticObject
                ? {
                      id: `galactic:${hoveredGalacticObject.object.name}`,
                      name: hoveredGalacticObject.object.name,
                      kind: 'galactic',
                      color: hoveredGalacticObject.object.color,
                      subtitle: hoveredGalacticObject.object.kind,
                      detail: `${hoveredGalacticObject.object.distance} / ${hoveredGalacticObject.object.detail}`,
                      originX: hoveredGalacticObject.x,
                      originY: hoveredGalacticObject.y,
                  }
                : null;

        const drawPlanetarySystem = (body: (typeof bodies)[number], foreground: boolean) => {
            const system = PLANETARY_MOON_SYSTEMS[body.planet.name];
            if (!system || body.reveal < 0.35) return;
            const opacity = localDetailOpacity * (1 - planetSceneFocus);
            if (opacity <= 0.01) return;
            const isJupiter = body.planet.name === 'Jupiter';
            const isSaturn = body.planet.name === 'Saturn';
            const hasMajorMoons = isJupiter || isSaturn;
            const majorMoonSystem = MAJOR_MOON_SYSTEMS[body.planet.name];
            const systemGlyphSize = Math.max(
                hasMajorMoons ? 7 : 5.5,
                (hasMajorMoons ? 8.5 : 7) * Math.sqrt(solarSystemScale),
            );
            context.font = `${systemGlyphSize * viewportGlyphScale}px "DM Mono", monospace`;
            context.fillStyle = body.planet.name === 'Earth' ? '#bdae93' : '#928374';
            system.radii.forEach((radius, moonIndex) => {
                context.fillStyle = isJupiter ? '#665c54' : body.planet.name === 'Earth' ? '#bdae93' : '#928374';
                const majorMoon = majorMoonSystem?.moons[moonIndex];
                const solvedMoon = majorMoon ? solveMoonOrbit(majorMoon, moonOrbitScratch) : null;
                const moonAngle =
                    solvedMoon?.angle ??
                    seconds * system.speeds[moonIndex] + moonIndex * 1.73 + body.planet.displayRadius;
                const moonRadius = radius * (solvedMoon?.distance ?? 1);
                moonOffsetScratch.x = Math.cos(moonAngle) * moonRadius;
                moonOffsetScratch.y = Math.sin(moonAngle) * moonRadius;
                moonOffsetScratch.z = 0;
                if (majorMoon) {
                    rotateX(moonOffsetScratch, majorMoon.inclination, moonOffsetScratch);
                    rotateZ(moonOffsetScratch, majorMoon.node, moonOffsetScratch);
                }
                rotateX(moonOffsetScratch, system.tilt, moonOffsetScratch);
                moonWorldScratch.x = body.world.x + moonOffsetScratch.x;
                moonWorldScratch.y = body.world.y + moonOffsetScratch.y;
                moonWorldScratch.z = body.world.z + moonOffsetScratch.z;
                const moon = cameraTransform(moonWorldScratch, moonProjectionScratch);
                if (moon.z >= body.z !== foreground) return;
                context.globalAlpha = opacity * (hasMajorMoons ? 1 : 0.86);
                if (isJupiter) {
                    context.fillStyle = ['#fe8019', '#d5c4a1', '#bdae93', '#928374'][moonIndex];
                    context.fillText(['o', '·', 'O', 'o'][moonIndex], moon.x, moon.y);
                } else if (isSaturn) {
                    context.fillStyle = ['#ebdbb2', '#bdae93', '#d79921', '#928374'][moonIndex];
                    context.fillText(['·', 'o', 'O', 'o'][moonIndex], moon.x, moon.y);
                } else {
                    context.fillText(moonIndex > 1 ? 'o' : '.', moon.x, moon.y);
                }
            });
            context.globalAlpha = 1;
        };

        drawMarks(farMarks);
        drawMarks(nearMarks);

        context.font = `${Math.max(5.5, 7.5 * Math.sqrt(solarSystemScale))}px "DM Mono", monospace`;
        context.fillStyle = '#928374';
        for (const asteroid of ASTEROID_BELT) {
            const angle = asteroid.angle + (reducedMotion ? 0 : seconds * (0.0045 + asteroid.phase * 0.0015));
            asteroidPointScratch.x = Math.cos(angle) * asteroid.radius;
            asteroidPointScratch.y = Math.sin(angle) * asteroid.radius;
            asteroidPointScratch.z = 0;
            rotateX(asteroidPointScratch, asteroid.inclination, asteroidPointScratch);
            rotateZ(asteroidPointScratch, asteroid.node, asteroidPointScratch);
            const projected = cameraTransform(asteroidPointScratch, asteroidProjectionScratch);
            context.globalAlpha = localDetailOpacity * (1 - planetSceneFocus) * (0.14 + asteroid.phase * 0.28);
            context.fillText(asteroid.glyph, projected.x, projected.y);
        }
        context.globalAlpha = 1;

        drawSun(context, {
            x: centerX,
            y: centerY,
            scale: renderedSunScale * focusedSunBridgeScale ** 2,
            opacity: localDetailOpacity * (focusedSun ? 1 - focusedSunDetailReveal : 1 - planetSceneFocus),
            seconds,
            reducedMotion,
        });
        if (hoveredSun && showHoverVisuals) {
            context.globalAlpha = localDetailOpacity;
            context.fillStyle = '#ebdbb2';
            context.font = 'bold 12px "DM Mono", monospace';
            const bracketOffset = 54 * Math.max(0.55, Math.sqrt(renderedSunScale));
            context.fillText('[', centerX - bracketOffset, centerY);
            context.fillText(']', centerX + bracketOffset, centerY);
            context.globalAlpha = 1;
        }

        // Keep every body visible so each of the eight orbit lanes has a clear owner.
        bodies.forEach((body) => {
            drawPlanetarySystem(body, false);
            drawSolarBody(context, body, {
                focusedPlanet,
                seconds,
                reducedMotion,
                solarSystemScale,
                viewportGlyphScale,
                localDetailOpacity,
                planetSceneFocus,
                isHovered: body === hoveredBody && showHoverVisuals,
            });
            drawPlanetarySystem(body, true);
        });
        if (galaxyObjectOpacity > 0.001) {
            for (const galacticObject of galacticObjects) {
                if (
                    galacticObject.x < -30 ||
                    galacticObject.x > width + 30 ||
                    galacticObject.y < -30 ||
                    galacticObject.y > height + 30
                )
                    continue;
                const isHovered = galacticObject === hoveredGalacticObject && showHoverVisuals;
                const pulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 1.4 + galacticObject.x) * 0.08;
                const spriteReveal = smoothstep((galaxyProgress - 0.58) / 0.28);
                const spriteFontSize = (isHovered ? 8.8 : 7.8) * pulse;
                context.fillStyle = galacticObject.object.color;
                context.globalAlpha = galaxyObjectOpacity * (1 - spriteReveal);
                context.font = `bold ${Math.round((isHovered ? 13 : 11) * pulse)}px "DM Mono", monospace`;
                context.fillText(galacticObject.object.glyph, galacticObject.x, galacticObject.y);
                context.globalAlpha = galaxyObjectOpacity * spriteReveal;
                context.font = `bold ${spriteFontSize}px "DM Mono", monospace`;
                context.strokeStyle = '#1d2021';
                context.lineWidth = Math.max(1.25, spriteFontSize * 0.16);
                galacticObject.object.sprite.forEach((line, row) => {
                    const lineY =
                        galacticObject.y +
                        (row - (galacticObject.object.sprite.length - 1) / 2) * spriteFontSize * 0.76;
                    context.strokeText(line, galacticObject.x, lineY);
                    context.fillText(line, galacticObject.x, lineY);
                    if (galacticObject.object.name === 'Cygnus X-1' && row === 1) {
                        const lineWidth = context.measureText(line).width;
                        const characterWidth = context.measureText('M').width;
                        context.fillStyle = '#8ec07c';
                        context.strokeText('O', galacticObject.x - lineWidth / 2 + characterWidth * 2.5, lineY);
                        context.fillText('O', galacticObject.x - lineWidth / 2 + characterWidth * 2.5, lineY);
                        const blackHole = '(@)';
                        const blackHoleWidth = context.measureText(blackHole).width;
                        context.fillStyle = '#fe8019';
                        context.strokeText(blackHole, galacticObject.x + lineWidth / 2 - blackHoleWidth / 2, lineY);
                        context.fillText(blackHole, galacticObject.x + lineWidth / 2 - blackHoleWidth / 2, lineY);
                        context.fillStyle = galacticObject.object.color;
                    }
                });
                if (isHovered) {
                    let glyphWidth = 0;
                    for (const line of galacticObject.object.sprite) {
                        glyphWidth = Math.max(glyphWidth, context.measureText(line).width);
                    }
                    context.fillStyle = '#ebdbb2';
                    context.font = 'bold 11px "DM Mono", monospace';
                    context.fillText('[', galacticObject.x - glyphWidth / 2 - 8, galacticObject.y);
                    context.fillText(']', galacticObject.x + glyphWidth / 2 + 8, galacticObject.y);
                }
            }
            context.globalAlpha = 1;
        }

        if (galaxyAlpha > 0.001) {
            const markerAlpha = galaxyAlpha * (1 - localDetailOpacity * 0.75);
            context.globalAlpha = markerAlpha;
            context.fillStyle = '#fabd2f';
            context.font = 'bold 12px "DM Mono", monospace';
            context.fillText('+', centerX, centerY);
            if (galaxyProgress > 0.62) {
                context.globalAlpha = markerAlpha * smoothstep((galaxyProgress - 0.62) / 0.25);
                context.font = '9px "DM Mono", monospace';
                context.fillText('[ SOL / YOU ARE HERE ]', centerX, centerY + 18);
            }
            context.globalAlpha = 1;
        }

        if (hoveredBody && showHoverVisuals) {
            drawReadout(context, {
                lines: [
                    `[ ${hoveredBody.planet.name.toUpperCase()} ]`,
                    `lon  ${hoveredBody.position.longitude.toFixed(2).padStart(6)} deg`,
                    `lat  ${`${hoveredBody.position.latitude >= 0 ? '+' : '-'}${Math.abs(hoveredBody.position.latitude).toFixed(2)}`.padStart(6)} deg`,
                    `r    ${hoveredBody.position.distance.toFixed(3).padStart(6)} au`,
                    '[ click to zoom ]',
                ],
                anchorX: hoveredBody.x,
                anchorY: hoveredBody.y,
                viewportWidth: width,
                viewportHeight: height,
                titleColor: hoveredBody.planet.color,
                width: 174,
            });
        }

        if (hoveredSun && showHoverVisuals) {
            drawReadout(context, {
                lines: [
                    '[ SOL ]',
                    'G-type main-sequence star',
                    'mass  1.000 M☉',
                    'age   ~4.6 billion years',
                    '[ click to zoom ]',
                ],
                anchorX: centerX,
                anchorY: centerY,
                viewportWidth: width,
                viewportHeight: height,
                titleColor: '#fabd2f',
                width: 220,
            });
        }

        if (hoveredGalacticObject && showHoverVisuals) {
            drawReadout(context, {
                lines: [
                    `[ ${hoveredGalacticObject.object.name.toUpperCase()} ]`,
                    hoveredGalacticObject.object.kind,
                    `dist  ${hoveredGalacticObject.object.distance}`,
                    hoveredGalacticObject.object.detail,
                    '[ click to zoom ]',
                ],
                anchorX: hoveredGalacticObject.x,
                anchorY: hoveredGalacticObject.y,
                viewportWidth: width,
                viewportHeight: height,
                titleColor: hoveredGalacticObject.object.color,
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
                reducedMotion,
                pointer,
                camera,
                localPointerX,
                localPointerY,
                showHoverVisuals,
                solveMoonOrbit,
            });
        }
        const currentSecond = Math.floor(frameTime / 1000);
        if (clock && currentSecond !== lastClockSecond) {
            const clockMode = orbitClock.active && !orbitClock.returning ? ' · SIM 12H/S' : ' UTC';
            clock.textContent = new Date(now).toISOString().replace('T', ' / ').slice(0, 22) + clockMode;
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
        pointer,
        camera,
        galaxyCamera,
        objectFocus,
        easterEgg,
        cosmicZoom,
        orbitClock,
        getActiveFocusCandidate: () => activeFocusCandidate,
        getOrbitDate,
        beginObjectFocus,
        beginChildFocus,
        leaveObjectFocus,
        setZoomLocation,
    });

    scheduleRender();
}
