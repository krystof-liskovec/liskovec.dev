import { localize } from './orrery/i18n';
import { MAJOR_MOON_SYSTEMS, PLANETS } from './orrery/catalog';
import type { MajorMoon } from './orrery/catalog';
import { drawLocalStarfield } from './orrery/local-background-renderer';
import { FocusController } from './orrery/focus-controller';
import { updateFocusRotation, updateGalaxyCamera, updateSolarCamera } from './orrery/frame-state';
import { galacticPatternPhase, moveGalacticMaterial } from './orrery/galactic-simulation';
import { GalaxyObjectRenderer, drawSolMarker } from './orrery/galaxy-object-renderer';
import { bindOrreryInteractions } from './orrery/interactions';
import { OrreryIntroController } from './orrery/intro-controller';
import {
    DEG,
    J2000,
    exponentialResponse,
    rotateX,
    rotateY,
    rotateZ,
    smoothstep,
    solveKeplerOrbit,
    visualTransitionProgress,
} from './orrery/math';
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
import { drawSunGlow } from './orrery/sun-renderer';
import { formatGalacticEpoch, formatLocalDateTime, signedDegrees } from './orrery/time-formatters';
import { createTypewriter } from './orrery/typewriter';
import type { FocusTarget, Vec3 } from './orrery/types';
import type { WebGLParticleRenderer } from './orrery/webgl-particle-renderer';

type DrawGalaxyBackdrop = typeof import('./orrery/background-renderer').drawGalaxyBackdrop;
type DrawGalaxyArmsGlow = typeof import('./orrery/background-renderer').drawGalaxyArmsGlow;
type DrawGalaxyCoreGlow = typeof import('./orrery/background-renderer').drawGalaxyCoreGlow;
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
const EARTH_MOON_PERIOD_DAYS = 27.321661;
// Keep the ISS animation legible at 6x slower than its real orbital period.
const ISS_ORBIT_PERIOD_DAYS = (92.68 / 1440) * 6;

const canvasElement = document.querySelector<HTMLCanvasElement>('#solar-canvas');
const gpuCanvasElement = document.querySelector<HTMLCanvasElement>('#solar-gpu-canvas');
const glowCanvasElement = document.querySelector<HTMLCanvasElement>('#galaxy-glow-canvas');
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
    const glowContext = glowCanvasElement?.getContext('2d');
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
    let objectFocusClassActive = false;
    let sceneExpansionClassActive = false;
    const renderMetricsController = createRenderMetrics(canvas, system, () => {
        galaxyBackdropCacheValid = false;
    });
    const { metrics: renderMetrics, update: updateRenderMetrics } = renderMetricsController;
    const syncSceneViewportBleed = () => {
        if (!system.classList.contains('is-canvas-expanded')) {
            system.style.removeProperty('--focus-viewport-bleed-top');
            system.style.removeProperty('--focus-viewport-bleed-bottom');
            return;
        }
        const bounds = system.getBoundingClientRect();
        const viewportHeight = document.documentElement.clientHeight;
        system.style.setProperty('--focus-viewport-bleed-top', `${Math.max(0, Math.ceil(bounds.top))}px`);
        system.style.setProperty(
            '--focus-viewport-bleed-bottom',
            `${Math.max(0, Math.ceil(viewportHeight - bounds.bottom))}px`,
        );
    };
    let systemVisible = true;
    let pageVisible = !document.hidden;
    const focusedMoonEpoch = Date.now();

    const zoomLocationWriter = zoomLocation ? createTypewriter(zoomLocation, () => reducedMotion) : null;

    type ProjectedPoint = Vec3 & { scale: number };
    const finalSolOffsetScratch = { x: 0, y: 0 };
    const currentSolOffsetScratch = { x: 0, y: 0 };
    const simulatedSolScratch = { x: 0, y: 0 };
    const focusedChildOffsetScratch: Vec3 = { x: 0, y: 0, z: 0 };
    const focusedChildOrbitScratch = { angle: 0, distance: 1 };
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
    let galaxyArmsGlowRenderer: DrawGalaxyArmsGlow | null = null;
    let galaxyCoreGlowRenderer: DrawGalaxyCoreGlow | null = null;
    let galaxyBackdropLoadPromise: Promise<DrawGalaxyBackdrop | null> | null = null;
    const loadGalaxyBackdrop = () => {
        if (galaxyBackdropRenderer) return Promise.resolve(galaxyBackdropRenderer);
        if (!galaxyBackdropLoadPromise) {
            galaxyBackdropLoadPromise = import('./orrery/background-renderer')
                .then(({ drawGalaxyArmsGlow, drawGalaxyBackdrop, drawGalaxyCoreGlow }) => {
                    galaxyBackdropRenderer = drawGalaxyBackdrop;
                    galaxyArmsGlowRenderer = drawGalaxyArmsGlow;
                    galaxyCoreGlowRenderer = drawGalaxyCoreGlow;
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
        zoomLocationWriter?.setText(localize(copy));
    };

    const updateCameraStats = () => {
        if (!cameraStats) return;

        if (objectFocus.target && objectFocus.progress > 0.5) {
            const pitch = objectFocus.child ? objectFocus.childLatitude : objectFocus.latitude;
            const yaw = objectFocus.child ? objectFocus.childLongitude : objectFocus.longitude;
            cameraStats.textContent = localize(`PITCH ${signedDegrees(pitch)} · YAW ${signedDegrees(yaw)} · ROLL +0.0°`);
            return;
        }

        if (cosmicZoom.current > 0.5) {
            const projectedTilt = Math.max(-1, Math.min(1, 0.58 * galaxyCamera.tilt));
            cameraStats.textContent = localize(`PITCH ${signedDegrees(Math.asin(projectedTilt))} · YAW +0.0° · ROLL ${signedDegrees(galaxyCamera.rotation)}`);
            return;
        }

        cameraStats.textContent = localize(`PITCH ${signedDegrees(camera.renderedPitch)} · YAW ${signedDegrees(camera.renderedYaw)} · ROLL ${signedDegrees(camera.renderedRoll)}`);
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
        const elapsedMs = lastFrameAt ? frameTime - lastFrameAt : 1000 / 60;
        const frameDelta = Math.min(40, elapsedMs);
        lastFrameAt = frameTime;
        // Scene expansion toggles the canvas bleed class. Apply that state
        // before reading the canvas bounds so the first frame of every zoom
        // transition uses one coherent origin instead of painting once with
        // the previous geometry.
        focusController.update(elapsedMs, reducedMotion);
        // Do not toggle this class in the pointer event that begins focus. Its
        // wider CSS canvas would stretch the old backing bitmap until this RAF.
        // Changing it here lets resize and redraw happen in the same paint.
        system.classList.toggle('is-object-focus', Boolean(objectFocus.target));
        system.classList.toggle(
            'is-canvas-expanded',
            Boolean(objectFocus.target) || cosmicZoom.current > 0.001 || cosmicZoom.target > 0.001,
        );
        const nextObjectFocusClassActive = system.classList.contains('is-object-focus');
        const nextSceneExpansionClassActive = system.classList.contains('is-canvas-expanded');
        if (
            renderMetrics.dirty ||
            nextObjectFocusClassActive !== objectFocusClassActive ||
            nextSceneExpansionClassActive !== sceneExpansionClassActive
        ) {
            syncSceneViewportBleed();
            updateRenderMetrics();
        }
        objectFocusClassActive = nextObjectFocusClassActive;
        sceneExpansionClassActive = nextSceneExpansionClassActive;
        // The bitmap has an overflow-safe bleed around the hero, while all
        // projection and scale math remains tied to the original system box.
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
            starfieldBleedX,
            starfieldBleedTop,
            starfieldBleedBottom,
        } = renderMetrics;
        const isFullscreen = document.fullscreenElement === system || system.classList.contains('is-fullscreen');
        const fullscreenPhoneLayout = isFullscreen && Math.min(width, height) < 600;
        const fullscreenSolarSystemScale = fullscreenPhoneLayout ? 0.9 : 1;
        const fullscreenGalaxyGlyphScale = fullscreenPhoneLayout ? 0.8 : 1;
        const fullscreenGalaxyRenderScale = fullscreenSolarSystemScale * fullscreenGalaxyGlyphScale;
        const compactViewport = width < 600 || fullscreenPhoneLayout;
        const objectViewportWidth = fullscreenPhoneLayout ? Math.min(width, height) : width;
        // Orbital spacing has to contract on a phone so Neptune remains visible.
        // Scale the ASCII bodies with it, instead of leaving desktop-sized glyphs
        // crowded into the smaller scene. Fullscreen uses the same multiplier for
        // orbital spacing, body glyphs, masks, and Sol so the scene scales as one
        // unit rather than only moving the orbits inward.
        const viewportGlyphScale =
            (isOgPreview ? 1.6 : Math.min(1, Math.max(0.61, objectViewportWidth / 700))) * fullscreenSolarSystemScale;
        const innerPlanetScale = compactViewport ? 0.84 : 1;
        const mobileSunProgress = Math.max(0, Math.min(1, (objectViewportWidth - 430) / 270));
        const viewportSunScale = (0.52 + mobileSunProgress * 0.48) * fullscreenSolarSystemScale;
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

        // Keep diffuse galaxy light beneath both the GPU stars and 2D artwork.
        // Clear even when the galaxy is hidden, so no glow survives a close-up.
        if (glowCanvasElement && glowContext) {
            if (glowCanvasElement.width !== pixelWidth || glowCanvasElement.height !== pixelHeight) {
                glowCanvasElement.width = pixelWidth;
                glowCanvasElement.height = pixelHeight;
            }
            glowContext.setTransform(pixelWidth / renderWidth, 0, 0, pixelHeight / renderHeight, 0, 0);
            glowContext.clearRect(0, 0, renderWidth, renderHeight);
            glowContext.translate(canvasOriginX, canvasOriginY);
        }

        const intro = introController.update(frameTime, reducedMotion);
        if (!introController.running) {
            system.classList.remove('is-intro-running');
            solarHeading?.classList.remove('is-intro-running');
        }

        pointer.x += (pointer.targetX - pointer.x) * 0.055;
        pointer.y += (pointer.targetY - pointer.y) * 0.055;
        const seconds = frameTime / 1000;
        cosmicZoom.current +=
            (cosmicZoom.target - cosmicZoom.current) * (reducedMotion ? 1 : exponentialResponse(elapsedMs, 0.0034));
        const outwardZoom = Math.max(0, cosmicZoom.current);
        const focusedPlanet =
            objectFocus.target?.kind === 'planet'
                ? (PLANETS.find((planet) => planet.name === objectFocus.target?.name) ?? null)
                : null;
        const focusedSun = objectFocus.target?.kind === 'star';
        const focusedComet = objectFocus.target?.kind === 'comet';
        // Exit completes at 6%, so map that outgoing tail to an exact zero. This
        // keeps the final world scale, centering, and scene opacity continuous
        // when focus clears.
        const visualFocusProgress = visualTransitionProgress(objectFocus.progress, objectFocus.exiting);
        const localFocusProgress = visualFocusProgress;
        const localSceneFocus = smoothstep((localFocusProgress - 0.06) / 0.94);
        const planetSceneFocus = focusedPlanet || focusedSun || focusedComet ? localSceneFocus : 0;
        const localSphereGrowth = smoothstep((planetSceneFocus - 0.08) / 0.92) ** 1.45;
        const childVisualProgress = objectFocus.child
            ? visualTransitionProgress(objectFocus.childProgress, objectFocus.childExiting)
            : 0;
        const childSceneEase = smoothstep(childVisualProgress);
        const childSceneGrowth = smoothstep((childSceneEase - 0.08) / 0.92) ** 1.45;
        const childSceneScale = objectFocus.child ? 1 + childSceneGrowth * 2.4 : 1;
        // Keep the parent solar scene on the parent focus rotation. Child
        // turns are applied only to the child anchor/detail view below, so
        // rotating a moon does not rotate its planet with it.
        const focusCameraLongitude = objectFocus.longitude * planetSceneFocus;
        const focusCameraLatitude = objectFocus.latitude * planetSceneFocus;
        const childFocusCameraLongitude =
            (objectFocus.longitude + (objectFocus.child ? objectFocus.childLongitude * childSceneEase : 0)) *
            planetSceneFocus;
        const childFocusCameraLatitude =
            (objectFocus.latitude + (objectFocus.child ? objectFocus.childLatitude * childSceneEase : 0)) *
            planetSceneFocus;
        const focusedSunDetailReveal = focusedSun ? smoothstep((planetSceneFocus - 0.06) / 0.3) : 0;
        const focusedSunBridgeScale = focusedSun ? (0.24 + localSphereGrowth * 0.76) / 0.24 : 1;
        const galaxyProgress = smoothstep((outwardZoom - 0.24) / 0.76);
        const galaxyVisibility = smoothstep((outwardZoom - 0.46) / 0.42);
        const localDetailOpacity = 1 - smoothstep((outwardZoom - 0.2) / 0.26);
        const solarSystemScale = Math.pow(0.055, Math.min(1, outwardZoom / 0.7));
        const renderedSunScale = solarSystemScale * viewportSunScale ** 2;
        // Resume the ambient camera as soon as the return transition starts,
        // letting its motion blend into the zoom-out instead of starting only
        // after the focused scene has disappeared.
        const pausePassiveCameraRotation = Boolean(objectFocus.target && !objectFocus.exiting);
        updateSolarCamera({
            camera,
            pointer,
            seconds,
            frameTime,
            frameDelta,
            reducedMotion,
            pausePassiveRotation: pausePassiveCameraRotation,
        });
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
        const viewportCenterX = compactViewport
            ? width * 0.52
            : Math.max(0, Math.min(width, window.innerWidth / 2 - systemLeft));
        const desktopCenterY = window.innerHeight / 2 - (systemTop + window.scrollY);
        const viewportCenterY = compactViewport
            ? height * 0.38
            : Math.max(height * 0.18, Math.min(height * 0.5, desktopCenterY));
        const usesMobileCanvasBleed = compactViewport && !system.classList.contains('is-fullscreen');
        // Desktop galaxy zooms paint across the viewport, so frame the disk
        // against that space rather than the narrower portfolio hero box.
        const usesDesktopGalaxyViewport = !compactViewport && !isOgPreview && window.innerWidth > 700;
        const galaxyViewportWidth = usesMobileCanvasBleed
            ? renderWidth
            : usesDesktopGalaxyViewport
              ? window.innerWidth
              : width;
        const galaxyViewportHeight = usesMobileCanvasBleed
            ? renderHeight
            : usesDesktopGalaxyViewport
              ? window.innerHeight
              : height;
        const fullscreenGalaxyScale = fullscreenPhoneLayout ? 0.7 : 1;
        const finalGalaxyRadius = Math.min(
            galaxyViewportWidth * 0.48 * fullscreenGalaxyScale,
            galaxyViewportHeight * 0.62 * fullscreenGalaxyScale,
        );
        const distantGalaxyRadius = Math.max(galaxyViewportWidth, galaxyViewportHeight) * 2.2 * fullscreenGalaxyScale;
        const galaxyRadius = finalGalaxyRadius + (distantGalaxyRadius - finalGalaxyRadius) * (1 - galaxyProgress) ** 2;
        updateGalaxyCamera({
            galaxyCamera,
            solarCamera: camera,
            frameTime,
            frameDelta,
            reducedMotion,
            pausePassiveRotation: pausePassiveCameraRotation,
        });
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
        // Keep the local solar-system stars present but subordinate to the
        // planets and the later Milky Way layers.
        const solarSkyOpacity = (1 - smoothstep((cosmicZoom.current - 0.06) / 0.24)) * 0.84;
        // Keep a sparse field of foreground stars behind the Milky Way. The
        // galaxy has its own stars in the disk and arms, but those do not fill
        // the surrounding sky once the local field fades out.
        const galacticSkyOpacity = smoothstep((outwardZoom - 0.28) / 0.36) * 0.28;
        const localSkyOpacity = Math.max(solarSkyOpacity, galacticSkyOpacity) * backgroundSceneOpacity;
        if (
            !galaxyBackdropRenderer &&
            (cosmicZoom.current > 0.05 || cosmicZoom.target > 0.05 || objectFocus.target?.kind === 'galactic')
        ) {
            void loadGalaxyBackdrop();
        }
        // Leave enough room for Neptune even at the nearest point in the projection.
        const baseWorldScale =
            (compactViewport ? Math.min(width / 116, height / 54) : Math.min(width / 104, height / 50)) *
            (isOgPreview ? 1.1 : 1);
        // Move the system camera toward every local focus target at the same
        // rate. The detailed focused sphere is scaled independently in
        // focus-scene, but its surrounding scene still needs the full camera
        // approach so outer planets do not appear to enlarge in place.
        const focusedSceneScaleTarget = 25;
        const focusedSceneScale =
            focusedPlanet || focusedSun || focusedComet ? 1 + planetSceneFocus * (focusedSceneScaleTarget - 1) : 1;
        let worldScale =
            baseWorldScale *
            fullscreenSolarSystemScale *
            (1 - plutoReveal * 0.11) *
            solarSystemScale *
            focusedSceneScale;
        const cameraDistance = 145;
        const cameraRollCosine = Math.cos(camera.renderedRoll);
        const cameraRollSine = Math.sin(camera.renderedRoll);
        const cameraPitchCosine = Math.cos(camera.renderedPitch);
        const cameraPitchSine = Math.sin(camera.renderedPitch);
        const cameraYawCosine = Math.cos(camera.renderedYaw);
        const cameraYawSine = Math.sin(camera.renderedYaw);
        const focusYawCosine = Math.cos(-focusCameraLongitude);
        const focusYawSine = Math.sin(-focusCameraLongitude);
        const focusPitchCosine = Math.cos(focusCameraLatitude);
        const focusPitchSine = Math.sin(focusCameraLatitude);
        const planetRotationOffset = camera.renderedRoll + 12 * DEG;
        const planetTiltOffset = camera.renderedPitch - 58 * DEG;
        const planetYawOffset = camera.renderedYaw;

        const cameraProjection = (world: Vec3, target: ProjectedPoint): ProjectedPoint => {
            const rolledX = world.x * cameraRollCosine - world.y * cameraRollSine;
            const rolledY = world.x * cameraRollSine + world.y * cameraRollCosine;
            const pitchedY = rolledY * cameraPitchCosine - world.z * cameraPitchSine;
            const pitchedZ = rolledY * cameraPitchSine + world.z * cameraPitchCosine;
            const yawedX = rolledX * cameraYawCosine + pitchedZ * cameraYawSine;
            const yawedZ = -rolledX * cameraYawSine + pitchedZ * cameraYawCosine;
            // During local focus, the drag angles orbit the camera around the
            // selected body. Applying that rotation after the normal solar
            // camera keeps every orbit and neighbouring body in the same view.
            const focusedX = yawedX * focusYawCosine + yawedZ * focusYawSine;
            const focusedYawZ = -yawedX * focusYawSine + yawedZ * focusYawCosine;
            const focusedY = pitchedY * focusPitchCosine - focusedYawZ * focusPitchSine;
            const focusedZ = pitchedY * focusPitchSine + focusedYawZ * focusPitchCosine;
            const perspective = cameraDistance / (cameraDistance - focusedZ);
            target.x = focusedX * worldScale * perspective;
            target.y = focusedY * worldScale * perspective;
            target.z = focusedZ;
            target.scale = perspective;
            return target;
        };
        const focusedCometOffset = focusedComet ? solarSystemRenderer.projectHalley(now, cameraProjection) : null;
        let focusedPlanetCenterX = viewportCenterX;
        let focusedPlanetCenterY = viewportCenterY;
        if (focusedPlanet) {
            const focusedOffset = solarSystemModel.projectFocusedPlanet(focusedPlanet, now, cameraProjection);
            const focusedCentering = 1 - (1 - planetSceneFocus) / focusedSceneScale;
            centerX += (viewportCenterX - (centerX + focusedOffset.x)) * focusedCentering;
            centerY += (viewportCenterY - (centerY + focusedOffset.y)) * focusedCentering;
            focusedPlanetCenterX = centerX + focusedOffset.x;
            focusedPlanetCenterY = centerY + focusedOffset.y;
        } else if (focusedCometOffset) {
            const focusedCentering = 1 - (1 - planetSceneFocus) / focusedSceneScale;
            centerX += (viewportCenterX - (centerX + focusedCometOffset.x)) * focusedCentering;
            centerY += (viewportCenterY - (centerY + focusedCometOffset.y)) * focusedCentering;
        }
        const focusedSunDistance = focusedPlanet ? solarSystemModel.focusedDistanceFromSun() : 0;
        const focusedSunApparentScale = focusedPlanet
            ? Math.max(0.62, Math.min(2.3, 24 / Math.max(1, focusedSunDistance)))
            : 1;
        const surroundingSunScale = 1 + (focusedSunApparentScale - 1) * planetSceneFocus;
        const sunGlowScale =
            (focusedSun
                ? renderedSunScale + (Math.max(1.55, renderedSunScale) - renderedSunScale) * planetSceneFocus
                : renderedSunScale) *
            surroundingSunScale ** 2;
        if (objectFocus.child && focusedPlanet) {
            // Continue the parent camera's projection into the selected moon or
            // station. Recompute that anchor from the live simulated orbit so
            // the camera follows the object rather than the original click point.
            const parentFocusScale = 0.1 + localSphereGrowth * 0.9;
            const parentRows = compactViewport ? 19 : 25;
            const parentFontSize = (compactViewport ? 10 : 12.5) * parentFocusScale;
            const parentRadius = (parentRows * parentFontSize * 0.82) / 2;
            const orientChildOffset = (inclination: number, node: number) => {
                rotateX(focusedChildOffsetScratch, inclination, focusedChildOffsetScratch);
                rotateZ(focusedChildOffsetScratch, node, focusedChildOffsetScratch);
                rotateY(focusedChildOffsetScratch, -childFocusCameraLongitude, focusedChildOffsetScratch);
                return rotateX(focusedChildOffsetScratch, childFocusCameraLatitude, focusedChildOffsetScratch);
            };
            focusedChildOffsetScratch.x = 0;
            focusedChildOffsetScratch.y = 0;
            focusedChildOffsetScratch.z = 0;
            if (focusedPlanet.name === 'Earth' && objectFocus.child.id === 'moon') {
                const moonRadius = compactViewport
                    ? Math.min(parentRadius * 1.55, width * 0.42)
                    : Math.min(parentRadius * 1.65, height * 0.38);
                const moonAngle = (focusedMoonElapsedDays / EARTH_MOON_PERIOD_DAYS) * Math.PI * 2;
                focusedChildOffsetScratch.x = Math.cos(moonAngle) * moonRadius;
                focusedChildOffsetScratch.y = Math.sin(moonAngle) * moonRadius;
                orientChildOffset(50 * DEG, -18 * DEG);
            } else if (focusedPlanet.name === 'Earth' && objectFocus.child.id === 'iss') {
                const issAngle =
                    1.2 +
                    (reducedMotion
                        ? 0
                        : ((focusedMoonElapsedDays % ISS_ORBIT_PERIOD_DAYS) / ISS_ORBIT_PERIOD_DAYS) * Math.PI * 2);
                focusedChildOffsetScratch.x = Math.cos(issAngle) * parentRadius * 1.13;
                focusedChildOffsetScratch.y = Math.sin(issAngle) * parentRadius * 1.13;
                orientChildOffset(44 * DEG, 24 * DEG);
            } else {
                const moonSystem = MAJOR_MOON_SYSTEMS[focusedPlanet.name];
                const moon = moonSystem?.moons.find((candidate) => candidate.name === objectFocus.child?.name);
                if (moon && moonSystem) {
                    const orbit = solveFocusedMoonOrbit(moon, focusedChildOrbitScratch);
                    const radius = parentRadius * moon.radius * orbit.distance;
                    focusedChildOffsetScratch.x = Math.cos(orbit.angle) * radius;
                    focusedChildOffsetScratch.y = Math.sin(orbit.angle) * radius;
                    rotateX(focusedChildOffsetScratch, moon.inclination, focusedChildOffsetScratch);
                    rotateZ(focusedChildOffsetScratch, moon.node, focusedChildOffsetScratch);
                    rotateX(focusedChildOffsetScratch, moonSystem.inclination, focusedChildOffsetScratch);
                    rotateZ(focusedChildOffsetScratch, moonSystem.node, focusedChildOffsetScratch);
                    rotateY(focusedChildOffsetScratch, -childFocusCameraLongitude, focusedChildOffsetScratch);
                    rotateX(focusedChildOffsetScratch, childFocusCameraLatitude, focusedChildOffsetScratch);
                }
            }
            const childAnchorX = focusedPlanetCenterX + focusedChildOffsetScratch.x;
            const childAnchorY = focusedPlanetCenterY + focusedChildOffsetScratch.y;
            const childCenterX = childAnchorX + (viewportCenterX - childAnchorX) * childSceneEase;
            const childCenterY = childAnchorY + (viewportCenterY - childAnchorY) * childSceneEase;
            worldScale *= childSceneScale;
            centerX = childCenterX + (centerX - childAnchorX) * childSceneScale;
            centerY = childCenterY + (centerY - childAnchorY) * childSceneScale;
            objectFocus.child.originX = childAnchorX;
            objectFocus.child.originY = childAnchorY;
        }
        const cameraTransform = (world: Vec3, target: ProjectedPoint): ProjectedPoint => {
            cameraProjection(world, target);
            target.x += centerX;
            target.y += centerY;
            return target;
        };
        // Project local objects before compositing the glow and scene. This
        // lets every layer use the same camera-space depth while a planet,
        // moon, ISS, or comet is being inspected.
        solarSystemModel.projectBodies({
            cameraTransform,
            now,
            plutoUnlocked: easterEgg.unlocked,
            plutoReveal,
            introProgress: intro.bodies,
        });
        const projectedHalley = solarSystemRenderer.projectHalley(now, cameraTransform);
        const focusedBodyForOcclusion = focusedPlanet
            ? (bodies.find((body) => body.planet === focusedPlanet) ?? null)
            : null;
        // Larger z values are closer to the viewer. Once the close-up is
        // established, bodies in front of the focused depth are removed even
        // when they are no longer screen-overlapping it. Bodies behind the
        // focus remain as spatial context.
        const focusOcclusionDepth =
            planetSceneFocus > 0.15
                ? (focusedBodyForOcclusion?.z ?? (focusedSun ? 0 : focusedComet ? projectedHalley.z : null))
                : null;
        const sunPassesFocusOcclusion = focusOcclusionDepth === null || focusedSun || 0 <= focusOcclusionDepth;
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

        const solarCameraLongitude = camera.renderedYaw + focusCameraLongitude;
        const solarCameraLatitude = camera.renderedPitch - 58 * DEG + focusCameraLatitude;
        const solarCameraRoll = camera.renderedRoll + 12 * DEG;
        const galacticCameraLatitude = Math.asin(Math.max(-1, Math.min(1, 0.58 * galaxyCamera.tilt))) - Math.asin(0.58);
        const targetStarfieldCameraLongitude = solarCameraLongitude * (1 - galaxyProgress);
        const targetStarfieldCameraLatitude =
            solarCameraLatitude * (1 - galaxyProgress) + galacticCameraLatitude * galaxyProgress;
        const targetStarfieldCameraRoll =
            solarCameraRoll * (1 - galaxyProgress) + galaxyCamera.rotation * galaxyProgress;
        // Let the solar system turn fully while the distant starfield only
        // acknowledges the movement. A partial turn keeps it alive without
        // making it read as a physically accurate skybox.
        const starfieldCameraInfluence = 0.2;
        const starfieldCameraLongitude = targetStarfieldCameraLongitude * starfieldCameraInfluence;
        const starfieldCameraLatitude = targetStarfieldCameraLatitude * starfieldCameraInfluence;
        const starfieldCameraRoll = targetStarfieldCameraRoll * starfieldCameraInfluence;

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
                compact: compactViewport,
                sceneScale: fullscreenGalaxyRenderScale,
            });
        };

        if (glowContext) {
            galaxyArmsGlowRenderer?.(glowContext, {
                coreX: galaxyCoreX,
                coreY: galaxyCoreY,
                radius: galaxyRadius,
                verticalProjection: galacticProjectedTilt,
                rotation: galaxyCamera.rotation - patternPhase,
                alpha: galaxyAlpha,
            });
            galaxyCoreGlowRenderer?.(glowContext, {
                coreX: galaxyCoreX,
                coreY: galaxyCoreY,
                radius: galaxyRadius,
                alpha: galaxyAlpha,
            });
            const surroundingSunGlowReveal = 1 - planetSceneFocus * 0.72;
            drawSunGlow(glowContext, {
                x: centerX,
                y: centerY,
                scale: sunGlowScale,
                opacity:
                    intro.sun *
                    (focusedSun ? 1 : localDetailOpacity * surroundingSunGlowReveal) *
                    (sunPassesFocusOcclusion ? 1 : 0),
            });
        }

        drawLocalStarfield(context, {
            width,
            height,
            pointerX: pointer.x,
            pointerY: pointer.y,
            cameraLongitude: starfieldCameraLongitude,
            cameraLatitude: starfieldCameraLatitude,
            cameraRoll: starfieldCameraRoll,
            seconds,
            reducedMotion,
            opacity: localSkyOpacity * intro.stars,
            starDensity: compactViewport ? 0.52 : 1,
            starScale: compactViewport ? 0.78 : 1,
            renderLeft: -starfieldBleedX,
            renderTop: -starfieldBleedTop,
            renderRight: width + starfieldBleedX,
            renderBottom: height + starfieldBleedBottom,
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
            bounds: renderMetrics,
            plutoUnlocked: easterEgg.unlocked,
            plutoReveal,
            localDetailOpacity,
            planetSceneFocus,
            focusedPlanetName: focusedPlanet?.name ?? null,
            focusOcclusionDepth,
            introProgress: intro.orbits,
            compact: compactViewport,
        });

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
        const visibleHoveredBody =
            hoveredBody &&
            (focusOcclusionDepth === null ||
                hoveredBody === focusedBodyForOcclusion ||
                hoveredBody.z <= focusOcclusionDepth)
                ? hoveredBody
                : null;
        const visibleHoveredComet =
            hoveredComet && (focusOcclusionDepth === null || focusedComet || projectedHalley.z <= focusOcclusionDepth)
                ? hoveredComet
                : null;
        const visibleHoveredSun =
            hoveredSun && (focusOcclusionDepth === null || focusedSun || 0 <= focusOcclusionDepth) ? hoveredSun : false;
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
            hoveredBody: visibleHoveredBody,
            hoveredComet: visibleHoveredComet,
            hoveredSun: visibleHoveredSun,
            hoveredGalacticObject,
            sunX: centerX,
            sunY: centerY,
        });

        const hasVisibleObjectFocus = Boolean(objectFocus.target && objectFocus.progress > 0.001);
        const drawFocusLayer = () => {
            if (!focusSceneRenderer) return;
            activeFocusCandidate = focusSceneRenderer(context, {
                width,
                height,
                objectFocus,
                focusedPlanet,
                projectedComet: projectedHalley,
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
                childSceneScale,
            });
        };
        solarSystemRenderer.draw(context, {
            farMarks,
            nearMarks,
            renderLeft,
            renderTop,
            renderRight,
            renderBottom,
            bodies,
            cameraTransform,
            solveMoonOrbit: solveSolarMoonOrbit,
            moonElapsedDays: solarMoonElapsedDays,
            focusedPlanet,
            focusedSun,
            focusedSunDetailReveal,
            focusedSunBridgeScale,
            hoveredBody: visibleHoveredBody,
            hoveredComet: visibleHoveredComet,
            hoveredSun: visibleHoveredSun,
            showHoverVisuals,
            centerX,
            centerY,
            sunX: centerX,
            sunY: centerY,
            renderedSunScale,
            now,
            seconds,
            reducedMotion,
            solarSystemScale,
            viewportGlyphScale,
            innerPlanetScale,
            surroundingSunScale,
            compact: compactViewport,
            asteroidBeltOpacity: compactViewport && !isFullscreen ? 0.45 : 1,
            asteroidBeltSampleStride: compactViewport ? (isFullscreen ? 2 : 3) : 1,
            localDetailOpacity,
            planetSceneFocus,
            introSunOpacity: intro.sun,
            introDetailOpacity: intro.details,
            pixelRatio: pixelWidth / renderWidth,
            particleRenderer: activeParticleRenderer,
            particleTransform,
            planetRotationOffset,
            planetTiltOffset,
            planetYawOffset,
            isOgPreview,
            width,
            height,
            focusOcclusionDepth,
            focusedComet,
            // Focused detail is composited after the whole solar system below,
            // so no other body can cross in front of the object being viewed.
            drawFocusedLayer: undefined,
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
            compact: compactViewport,
            sceneScale: fullscreenGalaxyRenderScale,
        });
        drawSolMarker(context, {
            alpha: galaxyAlpha,
            localDetailOpacity,
            galaxyProgress,
            x: centerX,
            y: centerY,
            scale: fullscreenGalaxyRenderScale,
        });

        if (showHoverVisuals) {
            drawHoverReadouts(context, {
                width,
                height,
                hoveredBody: visibleHoveredBody,
                hoveredComet: visibleHoveredComet,
                hoveredSun: visibleHoveredSun,
                hoveredGalacticObject,
                sunX: centerX,
                sunY: centerY,
                compact: compactViewport && !isFullscreen,
            });
        }

        if (hasVisibleObjectFocus) {
            if (focusSceneRenderer) drawFocusLayer();
            else {
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
                clock.textContent = localize(`GALACTIC EPOCH / ${formatGalacticEpoch(elapsedGalacticYears)}`);
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
