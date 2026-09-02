import { FocusController } from './orrery/focus-controller';
import { GalaxyObjectRenderer } from './orrery/galaxy-object-renderer';
import { createSceneFrameRenderer, MIN_RENDER_INTERVAL, type OrreryFrameState } from './orrery/frame-renderer';
import { bindOrreryInteractions } from './orrery/interactions';
import { OrreryIntroController } from './orrery/intro-controller';
import {
    createRuntimeState,
    getGalacticElapsedYears as resolveGalacticElapsedYears,
    getOrbitDate as resolveOrbitDate,
    getRotationElapsedHours as resolveRotationElapsedHours,
} from './orrery/runtime-state';
import { createRenderMetrics } from './orrery/render-metrics';
import { SolarSystemModel } from './orrery/solar-system-model';
import { SolarSystemSceneRenderer } from './orrery/solar-system-scene';
import { signedDegrees } from './orrery/time-formatters';
import { createTypewriter } from './orrery/typewriter';

// Let the first lightweight 2D scene settle before fetching and initializing
// the optional GPU particle layer. Interaction can still promote this sooner.
const PARTICLE_RENDERER_DELAY = 2200;
const canvasElement = document.querySelector<HTMLCanvasElement>('#solar-canvas');
const gpuCanvasElement = document.querySelector<HTMLCanvasElement>('#solar-gpu-canvas');
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
const mobileRotationGrip = document.querySelector<HTMLButtonElement>('#mobile-rotation-grip');
const mobileFullscreenToggle = document.querySelector<HTMLButtonElement>('#mobile-fullscreen-toggle');
const canvasContext = canvasElement?.getContext('2d');

if (canvasElement && systemElement && canvasContext) {
    // Stable non-null aliases are safe to retain inside animation callbacks.
    // TypeScript intentionally forgets narrowing for the outer DOM lookups.
    const canvas = canvasElement;
    const system = systemElement;
    const context = canvasContext;
    const backgroundCanvas = document.createElement('canvas');
    const backgroundContext = backgroundCanvas.getContext('2d');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
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
    const frameState: OrreryFrameState = {
        animationFrame: 0,
        renderTimer: 0,
        lastFrameAt: 0,
        lastClockSecond: -1,
        lastCameraStatsTick: -1,
        galaxyBackdropCacheValid: false,
        lastGalaxyBackdropAt: -Infinity,
        reducedMotion: reducedMotionQuery.matches,
        particleRenderer: null,
        activeFocusCandidate: null,
        getFocusCandidateAt: (_clientX, _clientY) => null,
    };
    let reducedMotion = frameState.reducedMotion;
    const introController = new OrreryIntroController(reducedMotion);
    const solarHeading = document.querySelector<HTMLElement>('.solar-heading');
    if (introController.running) {
        system.classList.add('is-intro-running');
        solarHeading?.classList.add('is-intro-running');
    }
    let zoomLocationState = 'solar';
    const renderMetricsController = createRenderMetrics(canvas, system, () => {
        frameState.galaxyBackdropCacheValid = false;
    });
    const { metrics: renderMetrics, update: updateRenderMetrics } = renderMetricsController;
    let systemVisible = true;
    let pageVisible = !document.hidden;
    const focusedMoonEpoch = Date.now();

    const zoomLocationWriter = zoomLocation ? createTypewriter(zoomLocation, () => reducedMotion) : null;

    const solarSystemModel = new SolarSystemModel();
    const galaxyObjectRenderer = new GalaxyObjectRenderer();
    const solarSystemRenderer = new SolarSystemSceneRenderer();
    let render: (frameTime: number) => void = () => {};

    const scheduleRender = () => {
        if (frameState.animationFrame || frameState.renderTimer || !systemVisible || !pageVisible) return;
        const waitForFrame = frameState.lastFrameAt
            ? MIN_RENDER_INTERVAL - (performance.now() - frameState.lastFrameAt)
            : 0;
        if (waitForFrame > 1) {
            frameState.renderTimer = window.setTimeout(() => {
                frameState.renderTimer = 0;
                if (!systemVisible || !pageVisible) return;
                frameState.animationFrame = requestAnimationFrame(render);
            }, waitForFrame);
            return;
        }
        frameState.animationFrame = requestAnimationFrame(render);
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
                    frameState.particleRenderer = new WebGLParticleRenderer(gpuCanvasElement);
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
        if (frameState.animationFrame) {
            cancelAnimationFrame(frameState.animationFrame);
            frameState.animationFrame = 0;
        }
        if (frameState.renderTimer) {
            window.clearTimeout(frameState.renderTimer);
            frameState.renderTimer = 0;
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
        cosmicZoom,
        camera,
        setZoomLocation,
        () => {
            frameState.activeFocusCandidate = null;
        },
    );

    reducedMotionQuery.addEventListener('change', (event) => {
        reducedMotion = event.matches;
        frameState.reducedMotion = reducedMotion;
    });

    const visibilityObserver = new IntersectionObserver(([entry]) => {
        systemVisible = entry.isIntersecting;
        if (systemVisible) {
            frameState.lastFrameAt = 0;
            scheduleRender();
        } else {
            cancelScheduledRender();
        }
    });
    visibilityObserver.observe(system);

    document.addEventListener('visibilitychange', () => {
        pageVisible = !document.hidden;
        if (pageVisible) {
            frameState.lastFrameAt = 0;
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

    const frameRenderer = createSceneFrameRenderer({
        canvas,
        context,
        backgroundCanvas,
        backgroundContext,
        system,
        solarHeading,
        clock,
        pointer,
        camera,
        galaxyCamera,
        objectFocus,
        easterEgg,
        cosmicZoom,
        orbitClock,
        introController,
        focusController,
        renderMetrics,
        updateRenderMetrics,
        solarSystemModel,
        galaxyObjectRenderer,
        solarSystemRenderer,
        frameState,
        isSystemVisible: () => systemVisible,
        isPageVisible: () => pageVisible,
        focusedMoonEpoch,
        getOrbitDate,
        getGalacticElapsedYears,
        getRotationElapsedHours,
        updateCameraStats,
        scheduleRender,
        scheduleParticleRenderer,
    });
    render = frameRenderer.render;

    bindOrreryInteractions({
        canvas,
        system,
        focusReturn,
        mobileRotationGrip,
        mobileFullscreenToggle,
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
        getActiveFocusCandidate: () => frameState.activeFocusCandidate,
        getFocusCandidateAt: (clientX, clientY) => frameState.getFocusCandidateAt(clientX, clientY),
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
