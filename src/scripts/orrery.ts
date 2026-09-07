import { PLANETS } from './orrery/catalog';
import type { MajorMoon } from './orrery/catalog';
import { drawLocalStarfield } from './orrery/local-background-renderer';
import { FocusController } from './orrery/focus-controller';
import { updateFocusRotation, updateGalaxyCamera, updateSolarCamera } from './orrery/frame-state';
import { galacticPatternPhase, moveGalacticMaterial } from './orrery/galactic-simulation';
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
import { createFocusCandidate, drawHoverReadouts, resolveFocusHit } from './orrery/scene-ui';
import { GALACTIC_SOL } from './orrery/galaxy-model';
import { createRenderMetrics } from './orrery/render-metrics';
import { SolarSystemModel } from './orrery/solar-system-model';
import { SolarSystemSceneRenderer } from './orrery/solar-system-scene';
import { formatGalacticEpoch, formatLocalDateTime, signedDegrees } from './orrery/time-formatters';
import { createTypewriter } from './orrery/typewriter';
import type { FocusTarget, Vec3 } from './orrery/types';
import type { WebGLParticleRenderer } from './orrery/webgl-particle-renderer';

type DrawGalaxyBackdrop = typeof import('./orrery/background-renderer').drawGalaxyBackdrop;
type DrawFocusScene = typeof import('./orrery/focus-scene').drawFocusScene;

// Keep the scene fluid on high-refresh displays while bounding work above 120Hz.
const MAX_RENDER_FPS = 120;
const MIN_RENDER_INTERVAL = 1000 / MAX_RENDER_FPS;
const MAX_BACKGROUND_FPS = 60;
const MIN_BACKGROUND_INTERVAL = 1000 / MAX_BACKGROUND_FPS;
// Let the first lightweight 2D scene settle before fetching and initializing
// the optional GPU particle layer. Interaction can still promote this sooner.
const PARTICLE_RENDERER_DELAY = 2200;
// Rendering at a phone's full 3x/4x DPR multiplies both glyph rasterization and
// canvas compositing cost without adding useful detail to the pixelated output.
const MAX_CANVAS_DPR = 2;

const canvasElement = document.querySelector<HTMLCanvasElement>('#solar-canvas');
const gpuCanvasElement = document.querySelector<HTMLCanvasElement>('#solar-gpu-canvas');
const systemElement = document.querySelector<HTMLElement>('#solar-system');
const clock = document.querySelector<HTMLElement>('#solar-time');
const cameraStats = document.querySelector<HTMLElement>('#camera-stats');
const zoomInput = document.querySelector<HTMLInputElement>('#cosmic-zoom');
const zoomSwitch = document.querySelector<HTMLInputElement>('#cosmic-zoom-switch');
const zoomStatus = document.querySelector<HTMLOutputElement>('#cosmic-zoom-status');
const solarSimulationSpeed = document.querySelector<HTMLButtonElement>('#solar-simulation-speed');
const galacticSimulationSpeed = document.querySelector<HTMLButtonElement>('#galactic-simulation-speed');
const rotationSimulationSpeed = document.querySelector<HTMLButtonElement>('#rotation-simulation-speed');
const zoomLocation = document.querySelector<HTMLElement>('#zoom-location');
const focusReturn = document.querySelector<HTMLButtonElement>('#object-focus-return');
const mobileFullscreenToggle = document.querySelector<HTMLButtonElement>('#mobile-fullscreen-toggle');
const canvasContext = canvasElement?.getContext('2d');

if (canvasElement && systemElement && canvasContext) {
    // Stable non-null aliases are safe to retain inside animation callbacks.
    // TypeScript intentionally forgets narrowing for the outer DOM lookups.
    const canvas = canvasElement;
    const system = systemElement;
    const context = canvasContext;
    const isOgPreview = system.dataset.ogPreview === 'true';
    const backgroundCanvas = document.createElement('canvas');
    const backgroundContext = backgroundCanvas.getContext('2d');
    let particleRenderer: WebGLParticleRenderer | null = null;
    const {
        pointer,
        camera,
        galaxyCamera,
        objectFocus,
        keyboardNavigation,
        easterEgg,
        cosmicZoom,
        orbitClock,
        galacticClock,
        rotationClock,
    } = createRuntimeState();
    let activeFocusCandidate: FocusTarget | null = null;
    let getFocusCandidateAt = (_clientX: number, _clientY: number): FocusTarget | null => null;
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
    let animationFrame = 0;
    let renderTimer = 0;
    let galaxyBackdropCacheValid = false;
    let lastGalaxyBackdropAt = -Infinity;
    let lastSceneGlowX = '';
    let lastSceneGlowY = '';
    const renderMetricsController = createRenderMetrics(canvas, system, () => {
        galaxyBackdropCacheValid = false;
    });
    const { metrics: renderMetrics, update: updateRenderMetrics } = renderMetricsController;
    let systemVisible = true;
    let pageVisible = !document.hidden;
    const focusedMoonEpoch = Date.now();

    const zoomLocationWriter = zoomLocation ? createTypewriter(zoomLocation, () => reducedMotion) : null;

    type ProjectedPoint = Vec3 & { scale: number };
    const finalSolOffsetScratch = { x: 0, y: 0 };
    const currentSolOffsetScratch = { x: 0, y: 0 };
    const simulatedSolScratch = { x: 0, y: 0 };
    const solarSystemModel = new SolarSystemModel();
    const { bodies, farMarks, nearMarks } = solarSystemModel;
    const galaxyObjectRenderer = new GalaxyObjectRenderer();
    const solarSystemRenderer = new SolarSystemSceneRenderer();

    const scheduleRender = () => {
        if (animationFrame || renderTimer || !systemVisible || !pageVisible) return;
        const waitForFrame = lastFrameAt ? MIN_RENDER_INTERVAL - (performance.now() - lastFrameAt) : 0;
        if (waitForFrame > 1) {
            renderTimer = window.setTimeout(() => {
                renderTimer = 0;
                if (!systemVisible || !pageVisible) return;
                animationFrame = requestAnimationFrame(render);
            }, waitForFrame);
            return;
        }
        animationFrame = requestAnimationFrame(render);
    };

    let galaxyBackdropRenderer: DrawGalaxyBackdrop | null = null;
    let galaxyBackdropLoadPromise: Promise<DrawGalaxyBackdrop | null> | null = null;
    const loadGalaxyBackdrop = () => {
        if (galaxyBackdropRenderer) return Promise.resolve(galaxyBackdropRenderer);
        if (!galaxyBackdropLoadPromise) {
            galaxyBackdropLoadPromise = import('./orrery/background-renderer')
                .then(({ drawGalaxyBackdrop }) => {
                    galaxyBackdropRenderer = drawGalaxyBackdrop;
                    scheduleRender();
                    return drawGalaxyBackdrop;
                })
                .catch(() => null);
        }
        return galaxyBackdropLoadPromise;
    };

    let focusSceneRenderer: DrawFocusScene | null = null;
    let focusSceneLoadPromise: Promise<DrawFocusScene | null> | null = null;
    const loadFocusScene = () => {
        if (focusSceneRenderer) return Promise.resolve(focusSceneRenderer);
        if (!focusSceneLoadPromise) {
            focusSceneLoadPromise = import('./orrery/focus-scene')
                .then(({ drawFocusScene }) => {
                    focusSceneRenderer = drawFocusScene;
                    scheduleRender();
                    return drawFocusScene;
                })
                .catch(() => null);
        }
        return focusSceneLoadPromise;
    };

    let particleRendererLoadScheduled = false;
    let particleRendererLoadStarted = false;
    let particleRendererLoadTimer = 0;
    const scheduleParticleRenderer = (immediate = false) => {
        if (!gpuCanvasElement || particleRendererLoadStarted) return;

        const loadParticleRenderer = () => {
            if (particleRendererLoadStarted) return;
            particleRendererLoadStarted = true;
            void import('./orrery/webgl-particle-renderer')
                .then(({ WebGLParticleRenderer }) => {
                    if (!gpuCanvasElement) return;
                    particleRenderer = new WebGLParticleRenderer(gpuCanvasElement);
                    scheduleRender();
                })
                .catch(() => {
                    // The 2D renderer remains a complete fallback when WebGL2
                    // or the deferred renderer chunk is unavailable.
                });
        };

        if (immediate) {
            if (particleRendererLoadTimer) {
                window.clearTimeout(particleRendererLoadTimer);
                particleRendererLoadTimer = 0;
            }
            loadParticleRenderer();
            return;
        }
        if (particleRendererLoadScheduled) return;
        particleRendererLoadScheduled = true;
        particleRendererLoadTimer = window.setTimeout(() => {
            particleRendererLoadTimer = 0;
            const idleWindow = window as Window & {
                requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
            };
            if (idleWindow.requestIdleCallback) {
                idleWindow.requestIdleCallback(loadParticleRenderer, { timeout: 800 });
                return;
            }
            loadParticleRenderer();
        }, PARTICLE_RENDERER_DELAY);
    };

    const cancelScheduledRender = () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        }
        if (renderTimer) {
            window.clearTimeout(renderTimer);
            renderTimer = 0;
        }
    };

    const setZoomLocation = (state: string, copy: string) => {
        if (!zoomLocation || state === zoomLocationState) return;
        zoomLocationState = state;
        zoomLocationWriter?.setText(copy);
    };

    const updateCameraStats = () => {
        if (!cameraStats) return;

        if (objectFocus.target && objectFocus.progress > 0.5) {
            const pitch = objectFocus.child ? objectFocus.childLatitude : objectFocus.latitude;
            const yaw = objectFocus.child ? objectFocus.childLongitude : objectFocus.longitude;
            cameraStats.textContent = `PITCH ${signedDegrees(pitch)} · YAW ${signedDegrees(yaw)} · ROLL +0.0°`;
            return;
        }

        if (cosmicZoom.current > 0.5) {
            const projectedTilt = Math.max(-1, Math.min(1, 0.58 * galaxyCamera.tilt));
            cameraStats.textContent = `PITCH ${signedDegrees(Math.asin(projectedTilt))} · YAW +0.0° · ROLL ${signedDegrees(galaxyCamera.rotation)}`;
            return;
        }

        cameraStats.textContent = `PITCH ${signedDegrees(camera.renderedPitch)} · YAW ${signedDegrees(camera.renderedYaw)} · ROLL ${signedDegrees(camera.renderedRoll)}`;
    };

    const focusController = new FocusController(
        objectFocus,
        system,
        focusReturn,
        zoomInput,
        zoomSwitch,
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
        } else {
            cancelScheduledRender();
        }
    });
    visibilityObserver.observe(system);

    document.addEventListener('visibilitychange', () => {
        pageVisible = !document.hidden;
        if (pageVisible) {
            lastFrameAt = 0;
            scheduleRender();
        } else {
            cancelScheduledRender();
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

    function render(frameTime: number) {
        animationFrame = 0;
        if (!systemVisible || !pageVisible) return;
        if (lastFrameAt && frameTime - lastFrameAt < MIN_RENDER_INTERVAL) {
            scheduleRender();
            return;
        }
        // The bitmap has an overflow-safe bleed around the hero, while all
        // projection and scale math remains tied to the original system box.
        if (renderMetrics.dirty) updateRenderMetrics();
        const {
            width,
            height,
            renderWidth,
            renderHeight,
            systemLeft,
            systemTop,
            canvasOriginX,
            canvasOriginY,
            renderLeft,
            renderTop,
            renderRight,
            renderBottom,
        } = renderMetrics;
        // Orbital spacing has to contract on a phone so Neptune remains visible.
        // Scale the ASCII bodies with it, instead of leaving desktop-sized glyphs
        // crowded into the smaller scene.
        const viewportGlyphScale = isOgPreview ? 1.6 : Math.min(1, Math.max(0.61, width / 700));
        const innerPlanetScale = width < 600 ? 0.84 : 1;
        const mobileSunProgress = Math.max(0, Math.min(1, (width - 430) / 270));
        const viewportSunScale = 0.52 + mobileSunProgress * 0.48;
        const dpr = Math.min(MAX_CANVAS_DPR, Math.max(1, window.devicePixelRatio || 1));
        const pixelWidth = Math.max(1, Math.round(renderWidth * dpr));
        const pixelHeight = Math.max(1, Math.round(renderHeight * dpr));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
            galaxyBackdropCacheValid = false;
        }
        if (backgroundCanvas.width !== pixelWidth || backgroundCanvas.height !== pixelHeight) {
            backgroundCanvas.width = pixelWidth;
            backgroundCanvas.height = pixelHeight;
            galaxyBackdropCacheValid = false;
        }
        const activeParticleRenderer = particleRenderer?.available ? particleRenderer : null;
        activeParticleRenderer?.begin({
            renderWidth,
            renderHeight,
            pixelWidth,
            pixelHeight,
            pixelRatio: pixelWidth / renderWidth,
            originX: canvasOriginX,
            originY: canvasOriginY,
        });
        // Use the canvas's real backing-store ratio. CSS grid sizing can produce
        // fractional dimensions, and a nominal DPR transform leaves that bitmap
        // fractionally stretched by the browser, softening small ASCII glyphs.
        context.setTransform(pixelWidth / renderWidth, 0, 0, pixelHeight / renderHeight, 0, 0);
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, renderWidth, renderHeight);
        context.translate(canvasOriginX, canvasOriginY);
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const intro = introController.update(frameTime, reducedMotion);
        if (intro.sun > 0.001 && !system.classList.contains('is-sun-visible')) {
            system.classList.add('is-sun-visible');
        }
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
        // Center desktop scenes against the visible landing viewport instead of
        // the full scene box, which can extend below the fold on shorter laptops.
        // The compact phone layout intentionally keeps the scene slightly higher
        // so the heading and controls have room around it.
        const compactViewport = width < 600;
        const viewportCenterX = compactViewport
            ? width * 0.52
            : Math.max(0, Math.min(width, window.innerWidth / 2 - systemLeft));
        const desktopCenterY = window.innerHeight / 2 - (systemTop + window.scrollY);
        const viewportCenterY = compactViewport
            ? height * 0.38
            : Math.max(height * 0.18, Math.min(height * 0.5, desktopCenterY));
        // The glow pseudo-element extends by the canvas bleed, so use its local
        // pixel coordinates instead of percentages based on the larger box.
        const sceneGlowX = `${viewportCenterX}px`;
        const sceneGlowY = `${viewportCenterY}px`;
        if (sceneGlowX !== lastSceneGlowX || sceneGlowY !== lastSceneGlowY) {
            system.style.setProperty('--scene-glow-x', sceneGlowX);
            system.style.setProperty('--scene-glow-y', sceneGlowY);
            lastSceneGlowX = sceneGlowX;
            lastSceneGlowY = sceneGlowY;
        }
        const usesMobileCanvasBleed = width < 600 && !system.classList.contains('is-fullscreen');
        const galaxyViewportWidth = usesMobileCanvasBleed ? renderWidth : width;
        const galaxyViewportHeight = usesMobileCanvasBleed ? renderHeight : height;
        const finalGalaxyRadius = Math.min(galaxyViewportWidth * 0.48, galaxyViewportHeight * 0.62);
        const distantGalaxyRadius = Math.max(galaxyViewportWidth, galaxyViewportHeight) * 2.2;
        const galaxyRadius = finalGalaxyRadius + (distantGalaxyRadius - finalGalaxyRadius) * (1 - galaxyProgress) ** 2;
        updateGalaxyCamera({ galaxyCamera, solarCamera: camera, frameTime, frameDelta, reducedMotion });
        updateFocusRotation(objectFocus, frameTime);
        // Cache the camera transform once per frame. Galactic layers contain
        // thousands of glyphs, so repeating trigonometry for every point is a
        // substantial and unnecessary cost.
        const galacticRotationCosine = Math.cos(galaxyCamera.rotation);
        const galacticRotationSine = Math.sin(galaxyCamera.rotation);
        const galacticProjectedTilt = 0.58 * galaxyCamera.tilt;
        const patternPhase = galacticPatternPhase(elapsedGalacticYears);
        const galacticPatternCosine = Math.cos(patternPhase);
        const galacticPatternSine = Math.sin(patternPhase);
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
        if (
            !galaxyBackdropRenderer &&
            (cosmicZoom.current > 0.05 || cosmicZoom.target > 0.05 || objectFocus.target?.kind === 'galactic')
        ) {
            void loadGalaxyBackdrop();
        }
        // Leave enough room for Neptune even at the nearest point in the projection.
        const baseWorldScale =
            (width < 600 ? Math.min(width / 116, height / 54) : Math.min(width / 104, height / 50)) *
            (isOgPreview ? 1.1 : 1);
        const focusedSceneScale = 1 + planetSceneFocus * 13;
        const worldScale = baseWorldScale * (1 - plutoReveal * 0.11) * solarSystemScale * focusedSceneScale;
        const cameraDistance = 145;
        const cameraRollCosine = Math.cos(camera.renderedRoll);
        const cameraRollSine = Math.sin(camera.renderedRoll);
        const cameraPitchCosine = Math.cos(camera.renderedPitch);
        const cameraPitchSine = Math.sin(camera.renderedPitch);
        const cameraYawCosine = Math.cos(camera.renderedYaw);
        const cameraYawSine = Math.sin(camera.renderedYaw);
        const planetRotationOffset = camera.renderedRoll + 12 * DEG;
        const planetTiltOffset = camera.renderedPitch - 58 * DEG;

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
        const particleTransform = {
            centerX: centerX + canvasOriginX,
            centerY: centerY + canvasOriginY,
            worldScale,
            cameraDistance,
            rollCosine: cameraRollCosine,
            rollSine: cameraRollSine,
            pitchCosine: cameraPitchCosine,
            pitchSine: cameraPitchSine,
            yawCosine: cameraYawCosine,
            yawSine: cameraYawSine,
        };
        const galaxyParticleTransform = {
            coreX: galaxyCoreX + canvasOriginX,
            coreY: galaxyCoreY + canvasOriginY,
            radius: galaxyRadius,
            verticalProjection: galacticProjectedTilt,
            rotationCosine: galacticRotationCosine,
            rotationSine: galacticRotationSine,
            patternCosine: galacticPatternCosine,
            patternSine: galacticPatternSine,
            elapsedGalacticYears,
            seconds,
            reducedMotion,
            alpha: galaxyAlpha,
        };

        const drawGalaxy = (targetContext: CanvasRenderingContext2D) => {
            galaxyBackdropRenderer?.(targetContext, {
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
                pixelRatio: pixelWidth / renderWidth,
                particleRenderer: activeParticleRenderer,
                galaxyTransform: galaxyParticleTransform,
            });
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
            pixelRatio: pixelWidth / renderWidth,
            particleRenderer: activeParticleRenderer,
        });
        const canCacheGalaxyBackdrop =
            Boolean(backgroundContext) &&
            Boolean(galaxyBackdropRenderer) &&
            !activeParticleRenderer &&
            galaxyProgress > 0.98 &&
            !objectFocus.target &&
            !camera.dragging &&
            !galaxyCamera.resetting;
        if (canCacheGalaxyBackdrop && backgroundContext) {
            if (!galaxyBackdropCacheValid || frameTime - lastGalaxyBackdropAt >= MIN_BACKGROUND_INTERVAL) {
                backgroundContext.setTransform(pixelWidth / renderWidth, 0, 0, pixelHeight / renderHeight, 0, 0);
                backgroundContext.imageSmoothingEnabled = false;
                backgroundContext.clearRect(0, 0, renderWidth, renderHeight);
                backgroundContext.translate(canvasOriginX, canvasOriginY);
                backgroundContext.textAlign = 'center';
                backgroundContext.textBaseline = 'middle';
                drawGalaxy(backgroundContext);
                galaxyBackdropCacheValid = true;
                lastGalaxyBackdropAt = frameTime;
            }
            context.drawImage(backgroundCanvas, -canvasOriginX, -canvasOriginY, renderWidth, renderHeight);
        } else {
            galaxyBackdropCacheValid = false;
            drawGalaxy(context);
        }

        solarSystemModel.projectOrbits({
            cameraTransform,
            plutoUnlocked: easterEgg.unlocked,
            plutoReveal,
            localDetailOpacity,
            planetSceneFocus,
            introProgress: intro.orbits,
            compact: width < 600,
        });
        solarSystemModel.projectBodies({
            cameraTransform,
            now,
            plutoUnlocked: easterEgg.unlocked,
            plutoReveal,
            introProgress: intro.bodies,
        });
        const projectedHalley = solarSystemRenderer.projectHalley(now, cameraTransform);

        const localPointerX = pointer.clientX - systemLeft;
        const localPointerY = pointer.clientY - systemTop;
        const showHoverVisuals = pointer.showsHover || keyboardNavigation.mode !== 'camera';
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
        const resolveHitAt = (x: number, y: number, forceActive = false) =>
            resolveFocusHit({
                x,
                y,
                forceActive,
                pointerActive: pointer.active,
                cameraDragging: camera.dragging,
                hasObjectFocus: Boolean(objectFocus.target),
                bodies,
                solarSystemScale,
                viewportGlyphScale,
                innerPlanetScale,
                localDetailOpacity,
                introDetailOpacity: intro.details,
                galaxyObjectOpacity,
                projectedComet: projectedHalley,
                centerX,
                centerY,
                renderedSunScale,
                introSunOpacity: intro.sun,
                findHoveredGalacticObject: (pointerX, pointerY) => galaxyObjectRenderer.findHovered(pointerX, pointerY),
            });
        const currentFocusHit = resolveHitAt(localPointerX, localPointerY);
        const keyboardSelectedBody =
            keyboardNavigation.mode === 'planet-selection'
                ? (bodies.find((body) => body.planet.name === keyboardNavigation.selectedId) ?? null)
                : null;
        const hoveredBody =
            keyboardNavigation.mode === 'planet-selection' ? keyboardSelectedBody : currentFocusHit.hoveredBody;
        const hoveredComet = keyboardNavigation.mode === 'planet-selection' ? null : currentFocusHit.hoveredComet;
        const hoveredSun =
            keyboardNavigation.mode === 'planet-selection'
                ? keyboardNavigation.selectedId === 'star:Sol'
                : currentFocusHit.hoveredSun;
        const hoveredGalacticObject =
            keyboardNavigation.mode === 'planet-selection' ? null : currentFocusHit.hoveredGalacticObject;
        const isFullscreen = document.fullscreenElement === system || system.classList.contains('is-fullscreen');
        getFocusCandidateAt = (clientX, clientY) => {
            const hit = resolveHitAt(clientX - systemLeft, clientY - systemTop, true);
            return createFocusCandidate({
                hoveredBody: hit.hoveredBody,
                hoveredComet: hit.hoveredComet,
                hoveredSun: hit.hoveredSun,
                hoveredGalacticObject: hit.hoveredGalacticObject,
                sunX: centerX,
                sunY: centerY,
            });
        };

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
            innerPlanetScale,
            compact: width < 600,
            localDetailOpacity,
            planetSceneFocus,
            introSunOpacity: intro.sun,
            introDetailOpacity: intro.details,
            pixelRatio: pixelWidth / renderWidth,
            particleRenderer: activeParticleRenderer,
            particleTransform,
            planetRotationOffset,
            planetTiltOffset,
            isOgPreview,
            width,
            height,
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
            isOgPreview,
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
                compact: width < 600 && !isFullscreen,
            });
        }

        if (objectFocus.target && objectFocus.progress > 0.001) {
            if (focusSceneRenderer) {
                activeFocusCandidate = focusSceneRenderer(context, {
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
                    isFullscreen,
                    localPointerX,
                    localPointerY,
                    showHoverVisuals,
                    keyboardSelectionId:
                        keyboardNavigation.mode === 'child-selection' ? keyboardNavigation.selectedId : null,
                    solveMoonOrbit: solveFocusedMoonOrbit,
                    moonElapsedDays: focusedMoonElapsedDays,
                });
            } else {
                activeFocusCandidate = null;
                void loadFocusScene();
            }
        }
        system.classList.toggle(
            'is-focus-target-hovered',
            Boolean(activeFocusCandidate && showHoverVisuals && !camera.dragging),
        );
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
        activeParticleRenderer?.flush();
        // Keep the static scene visible until both canvas layers have been
        // initialized and the first complete frame is on screen. This avoids
        // exposing an uninitialized WebGL buffer during a refresh.
        if (!system.classList.contains('is-canvas-ready')) {
            system.classList.add('is-canvas-ready');
            scheduleParticleRenderer();
        }
        scheduleRender();
    }

    bindOrreryInteractions({
        canvas,
        system,
        focusReturn,
        mobileFullscreenToggle,
        zoomInput,
        zoomSwitch,
        zoomStatus,
        solarSimulationSpeed,
        galacticSimulationSpeed,
        rotationSimulationSpeed,
        pointer,
        camera,
        galaxyCamera,
        objectFocus,
        keyboardNavigation,
        easterEgg,
        cosmicZoom,
        orbitClock,
        galacticClock,
        rotationClock,
        getActiveFocusCandidate: () => activeFocusCandidate,
        getFocusCandidateAt: (clientX, clientY) => getFocusCandidateAt(clientX, clientY),
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
            scheduleParticleRenderer(true);
        },
    });

    scheduleRender();
}
