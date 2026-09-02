import { PLANETS } from './catalog';
import type { MajorMoon } from './catalog';
import { drawGalaxyBackdrop, drawLocalStarfield } from './background-renderer';
import { drawFocusScene } from './focus-scene';
import type { FocusController } from './focus-controller';
import { updateFocusRotation, updateGalaxyCamera, updateSolarCamera } from './frame-state';
import { galacticPatternPhase, moveGalacticMaterial } from './galactic-simulation';
import { GalaxyObjectRenderer, drawSolMarker } from './galaxy-object-renderer';
import type { OrreryIntroController } from './intro-controller';
import { DEG, J2000, smoothstep, solveKeplerOrbit, visualTransitionProgress } from './math';
import {
    type CameraState,
    type CosmicZoomState,
    type EasterEggState,
    type GalaxyCameraState,
    type OrbitClockState,
    type PointerState,
} from './runtime-state';
import { createFocusCandidate, drawHoverReadouts, resolveFocusHit } from './scene-ui';
import { GALACTIC_SOL } from './scene-data';
import type { RenderMetrics } from './render-metrics';
import { SolarSystemModel } from './solar-system-model';
import { SolarSystemSceneRenderer } from './solar-system-scene';
import { formatGalacticEpoch, formatLocalDateTime } from './time-formatters';
import type { FocusState, FocusTarget, Vec3 } from './types';
import type { WebGLParticleRenderer } from './webgl-particle-renderer';

// Keep the scene fluid on high-refresh displays while bounding work above 120Hz.
const MAX_RENDER_FPS = 120;
export const MIN_RENDER_INTERVAL = 1000 / MAX_RENDER_FPS;
const MAX_BACKGROUND_FPS = 60;
const MIN_BACKGROUND_INTERVAL = 1000 / MAX_BACKGROUND_FPS;
const MAX_CANVAS_DPR = 2;

export type OrreryFrameState = {
    animationFrame: number;
    renderTimer: number;
    lastFrameAt: number;
    lastClockSecond: number;
    lastCameraStatsTick: number;
    galaxyBackdropCacheValid: boolean;
    lastGalaxyBackdropAt: number;
    reducedMotion: boolean;
    particleRenderer: WebGLParticleRenderer | null;
    activeFocusCandidate: FocusTarget | null;
    getFocusCandidateAt: (clientX: number, clientY: number) => FocusTarget | null;
};

export type SceneFrameRendererOptions = {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    backgroundCanvas: HTMLCanvasElement;
    backgroundContext: CanvasRenderingContext2D | null;
    system: HTMLElement;
    solarHeading: HTMLElement | null;
    clock: HTMLElement | null;
    pointer: PointerState;
    camera: CameraState;
    galaxyCamera: GalaxyCameraState;
    objectFocus: FocusState;
    easterEgg: EasterEggState;
    cosmicZoom: CosmicZoomState;
    orbitClock: OrbitClockState;
    introController: OrreryIntroController;
    focusController: FocusController;
    renderMetrics: RenderMetrics;
    updateRenderMetrics: () => void;
    solarSystemModel: SolarSystemModel;
    galaxyObjectRenderer: GalaxyObjectRenderer;
    solarSystemRenderer: SolarSystemSceneRenderer;
    frameState: OrreryFrameState;
    isSystemVisible: () => boolean;
    isPageVisible: () => boolean;
    focusedMoonEpoch: number;
    getOrbitDate: (frameTime: number) => number;
    getGalacticElapsedYears: (frameTime: number) => number;
    getRotationElapsedHours: (frameTime: number) => number;
    updateCameraStats: () => void;
    scheduleRender: () => void;
    scheduleParticleRenderer: (immediate?: boolean) => void;
};

export const createSceneFrameRenderer = (options: SceneFrameRendererOptions) => {
    const {
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
        isSystemVisible,
        isPageVisible,
        focusedMoonEpoch,
        getOrbitDate,
        getGalacticElapsedYears,
        getRotationElapsedHours,
        updateCameraStats,
        scheduleRender,
        scheduleParticleRenderer,
    } = options;
    const { bodies, farMarks, nearMarks } = solarSystemModel;
    type ProjectedPoint = Vec3 & { scale: number };
    const finalSolOffsetScratch = { x: 0, y: 0 };
    const currentSolOffsetScratch = { x: 0, y: 0 };
    const simulatedSolScratch = { x: 0, y: 0 };

    function render(frameTime: number) {
        // Gate the frame and prepare both canvas layers.
        const reducedMotion = frameState.reducedMotion;
        frameState.animationFrame = 0;
        if (!isSystemVisible() || !isPageVisible()) return;
        if (frameState.lastFrameAt && frameTime - frameState.lastFrameAt < MIN_RENDER_INTERVAL) {
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
        const viewportGlyphScale = Math.min(1, Math.max(0.61, width / 700));
        const innerPlanetScale = width < 600 ? 0.84 : 1;
        const mobileSunProgress = Math.max(0, Math.min(1, (width - 430) / 270));
        const viewportSunScale = 0.52 + mobileSunProgress * 0.48;
        const dpr = Math.min(MAX_CANVAS_DPR, Math.max(1, window.devicePixelRatio || 1));
        const pixelWidth = Math.max(1, Math.round(renderWidth * dpr));
        const pixelHeight = Math.max(1, Math.round(renderHeight * dpr));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
            frameState.galaxyBackdropCacheValid = false;
        }
        if (backgroundCanvas.width !== pixelWidth || backgroundCanvas.height !== pixelHeight) {
            backgroundCanvas.width = pixelWidth;
            backgroundCanvas.height = pixelHeight;
            frameState.galaxyBackdropCacheValid = false;
        }
        const activeParticleRenderer = frameState.particleRenderer?.available ? frameState.particleRenderer : null;
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

        // Advance intro, interaction, focus, and simulation state together so
        // every scene layer uses the same point in time.
        const intro = introController.update(frameTime, reducedMotion);
        if (!introController.running) {
            system.classList.remove('is-intro-running');
            solarHeading?.classList.remove('is-intro-running');
        }

        pointer.x += (pointer.targetX - pointer.x) * 0.055;
        pointer.y += (pointer.targetY - pointer.y) * 0.055;
        const seconds = frameTime / 1000;
        const frameDelta = Math.min(40, frameState.lastFrameAt ? frameTime - frameState.lastFrameAt : 16.67);
        frameState.lastFrameAt = frameTime;
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

        // Derive the shared solar and galactic camera transforms once per frame.
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

        // Paint the background, reusing a stable galaxy bitmap when possible.
        const drawGalaxy = (targetContext: CanvasRenderingContext2D) => {
            drawGalaxyBackdrop(targetContext, {
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
            !activeParticleRenderer &&
            galaxyProgress > 0.98 &&
            !objectFocus.target &&
            !camera.dragging &&
            !galaxyCamera.resetting;
        if (canCacheGalaxyBackdrop && backgroundContext) {
            if (
                !frameState.galaxyBackdropCacheValid ||
                frameTime - frameState.lastGalaxyBackdropAt >= MIN_BACKGROUND_INTERVAL
            ) {
                backgroundContext.setTransform(pixelWidth / renderWidth, 0, 0, pixelHeight / renderHeight, 0, 0);
                backgroundContext.imageSmoothingEnabled = false;
                backgroundContext.clearRect(0, 0, renderWidth, renderHeight);
                backgroundContext.translate(canvasOriginX, canvasOriginY);
                backgroundContext.textAlign = 'center';
                backgroundContext.textBaseline = 'middle';
                drawGalaxy(backgroundContext);
                frameState.galaxyBackdropCacheValid = true;
                frameState.lastGalaxyBackdropAt = frameTime;
            }
            context.drawImage(backgroundCanvas, -canvasOriginX, -canvasOriginY, renderWidth, renderHeight);
        } else {
            frameState.galaxyBackdropCacheValid = false;
            drawGalaxy(context);
        }

        // Project all interactive objects before resolving hover state.
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
        const showHoverVisuals = pointer.showsHover;
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
        const hoveredBody = currentFocusHit.hoveredBody;
        const hoveredComet = currentFocusHit.hoveredComet;
        const hoveredSun = currentFocusHit.hoveredSun;
        const hoveredGalacticObject = currentFocusHit.hoveredGalacticObject;
        frameState.getFocusCandidateAt = (clientX, clientY) => {
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

        frameState.activeFocusCandidate = createFocusCandidate({
            hoveredBody,
            hoveredComet,
            hoveredSun,
            hoveredGalacticObject,
            sunX: centerX,
            sunY: centerY,
        });

        // Paint the local system, galactic landmarks, and any focused detail.
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
            frameState.activeFocusCandidate = drawFocusScene(context, {
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

        // Commit lightweight text updates and hand the next frame back to the loop.
        const currentSecond = Math.floor(frameTime / 1000);
        const cameraStatsTick = Math.floor(frameTime / 100);
        if (cameraStatsTick !== frameState.lastCameraStatsTick) {
            updateCameraStats();
            frameState.lastCameraStatsTick = cameraStatsTick;
        }
        if (clock && currentSecond !== frameState.lastClockSecond) {
            if (cosmicZoom.current > 0.5) {
                clock.textContent = `GALACTIC EPOCH / ${formatGalacticEpoch(elapsedGalacticYears)}`;
            } else {
                const clockMode = orbitClock.active && !orbitClock.returning ? ' SIM' : '';
                clock.textContent = formatLocalDateTime(now) + clockMode;
            }
            frameState.lastClockSecond = currentSecond;
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

    return { render };
};
