import { FOCUSED_ART, MAJOR_MOON_SYSTEMS } from './catalog';
import type { MajorMoon } from './catalog';
import { drawReadout } from './canvas-ui';
import { drawFocusedHalley } from './comet-renderer';
import { drawFocusedGalacticObject } from './galactic-renderer';
import { drawFocusedIss } from './iss-renderer';
import {
    DEG,
    randomUnit,
    rotateX,
    rotateY,
    rotateZ,
    smoothstep,
    solveKeplerOrbit,
    visualTransitionProgress,
} from './math';
import { drawFocusedMoon } from './moon-renderer';
import { drawFocusedNebulaGlow } from './galactic-volume-renderer';
import { drawPulsarGlow } from './galactic-landmark-renderer';
import {
    focusedRotation,
    planetSurfaceColor,
    planetSurfaceGlyph,
    planetSurfaceLight,
    sunSurfaceLight,
} from './planet-textures';
import { drawSagittariusGlow } from './sagittarius-renderer';
import { drawSoftSceneMask, sceneMaskColor } from './scene-mask';
import { SUN_MASK_COLOR, drawSunAtmosphere } from './sun-renderer';
import type { CameraState, PointerState } from './runtime-state';
import type { ProjectedComet } from './solar-system-scene';
import type { FocusState, FocusTarget, Planet, ProjectedBody, Vec3 } from './types';

type MoonOrbit = { angle: number; distance: number };

const focusedMoonOffsetScratch: Vec3 = { x: 0, y: 0, z: 0 };
const focusedIssOffsetScratch: Vec3 = { x: 0, y: 0, z: 0 };
const focusedOrbitOffsetScratch: Vec3 = { x: 0, y: 0, z: 0 };
const focusedOrbitNextScratch: Vec3 = { x: 0, y: 0, z: 0 };
const majorOrbitOffsetScratch: Vec3 = { x: 0, y: 0, z: 0 };
const majorOrbitNextScratch: Vec3 = { x: 0, y: 0, z: 0 };
const sampledOrbitScratch: MoonOrbit = { angle: 0, distance: 1 };
const nextSampledOrbitScratch: MoonOrbit = { angle: 0, distance: 1 };
const liveMoonOrbitScratch: MoonOrbit = { angle: 0, distance: 1 };
const LARGE_MOON_GLYPHS = new Set(['Ganymede', 'Titan', 'Titania', 'Triton', 'Charon']);
const EARTH_MOON_PERIOD_DAYS = 27.321661;
// Match the parent Earth view: the ISS close-up is intentionally 6x slower.
const ISS_ORBIT_PERIOD_DAYS = (92.68 / 1440) * 6;
type FocusSceneOptions = {
    width: number;
    height: number;
    objectFocus: FocusState;
    focusedPlanet: Planet | null;
    projectedComet: ProjectedComet;
    bodies: ProjectedBody[];
    viewportCenterX: number;
    viewportCenterY: number;
    localSphereGrowth: number;
    planetSceneFocus: number;
    seconds: number;
    rotationHours: number;
    moonElapsedDays: number;
    reducedMotion: boolean;
    pointer: PointerState;
    camera: CameraState;
    isFullscreen: boolean;
    localPointerX: number;
    localPointerY: number;
    showHoverVisuals: boolean;
    keyboardSelectionId: string | null;
    solveMoonOrbit: (moon: MajorMoon, target?: MoonOrbit) => MoonOrbit;
    childSceneScale: number;
};

export const drawFocusScene = (context: CanvasRenderingContext2D, options: FocusSceneOptions): FocusTarget | null => {
    const {
        width,
        height,
        objectFocus,
        focusedPlanet,
        projectedComet,
        bodies,
        viewportCenterX,
        viewportCenterY,
        localSphereGrowth,
        planetSceneFocus,
        seconds,
        rotationHours,
        moonElapsedDays,
        reducedMotion,
        pointer,
        camera,
        isFullscreen,
        localPointerX,
        localPointerY,
        showHoverVisuals,
        keyboardSelectionId,
        solveMoonOrbit,
        childSceneScale,
    } = options;
    const compactViewport = width < 600 || (isFullscreen && Math.min(width, height) < 600);
    let activeFocusCandidate: FocusTarget | null = null;
    const drawSoftMoonMask = (centerX: number, centerY: number, radiusX: number, radiusY: number, reveal: number) =>
        drawSoftSceneMask(context, {
            x: centerX,
            y: centerY,
            radiusX,
            radiusY,
            opacity: reveal,
            color: sceneMaskColor(centerX, centerY, width, height, false),
        });
    if (objectFocus.target && objectFocus.progress > 0.001) {
        const target = objectFocus.target;
        const focusProgress = visualTransitionProgress(objectFocus.progress, objectFocus.exiting);
        const focusEase = smoothstep(focusProgress);
        const childVisualProgress = objectFocus.child
            ? visualTransitionProgress(objectFocus.childProgress, objectFocus.childExiting)
            : 0;
        const childEase = smoothstep(childVisualProgress);
        const childGlyphHandoff = objectFocus.child ? smoothstep(childEase / 0.24) : 0;
        const focusedPlanetBody = focusedPlanet ? bodies.find((body) => body.planet === focusedPlanet) : null;
        const isLocalDestination =
            (target.kind === 'planet' && !!focusedPlanetBody) || target.kind === 'star' || target.kind === 'comet';
        // The parent detail remains on the parent focus rotation. A child
        // rotation belongs to the moon/ISS close-up and should not spin the
        // parent planet's surface, rings, or orbital context.
        const focusLongitude = isLocalDestination ? objectFocus.longitude * planetSceneFocus : objectFocus.longitude;
        const focusLatitude = isLocalDestination ? objectFocus.latitude * planetSceneFocus : objectFocus.latitude;
        const childFocusLongitude = isLocalDestination
            ? (objectFocus.longitude + (objectFocus.child ? objectFocus.childLongitude * childEase : 0)) *
              planetSceneFocus
            : objectFocus.longitude;
        const childFocusLatitude = isLocalDestination
            ? (objectFocus.latitude + (objectFocus.child ? objectFocus.childLatitude * childEase : 0)) *
              planetSceneFocus
            : objectFocus.latitude;
        const detailFocusLongitude = objectFocus.child ? childFocusLongitude : focusLongitude;
        const detailFocusLatitude = objectFocus.child ? childFocusLatitude : focusLatitude;
        const focusedComet = target.kind === 'comet' ? projectedComet : null;
        const focusCenterX =
            focusedPlanetBody?.x ?? focusedComet?.x ?? target.originX + (viewportCenterX - target.originX) * focusEase;
        const focusCenterY =
            focusedPlanetBody?.y ?? focusedComet?.y ?? target.originY + (viewportCenterY - target.originY) * focusEase;
        const localFocusStartScale = target.kind === 'star' ? 0.24 : 0.1;
        const galacticViewportScale = compactViewport ? Math.max(0.54, Math.min(0.68, width / 680)) : 1;
        const galacticSourceFontSize = 7.8 * galacticViewportScale;
        const galacticSourceWidth =
            (target.sourceSprite?.reduce((longest, line) => Math.max(longest, line.length), 1) ?? 1) *
            galacticSourceFontSize *
            0.31;
        const galacticSourceHeight = ((target.sourceSprite?.length ?? 1) * galacticSourceFontSize * 0.9) / 2;
        const galacticFocusedRadius = compactViewport ? 112 : 190;
        const galacticStartScale = Math.max(
            0.06,
            Math.min(0.22, Math.max(galacticSourceWidth, galacticSourceHeight) / galacticFocusedRadius),
        );
        const galacticBridgeGrowth = smoothstep((focusEase - 0.02) / 0.36);
        const galacticBridgeScale = 1 + galacticBridgeGrowth * 1.4;
        const galacticMatchedScale = galacticStartScale * galacticBridgeScale;
        const galacticDetailGrowth = smoothstep((focusEase - 0.4) / 0.6);
        const focusScale =
            (isLocalDestination
                ? localFocusStartScale + localSphereGrowth * (1 - localFocusStartScale)
                : target.kind === 'galactic'
                  ? galacticMatchedScale + galacticDetailGrowth * (1 - galacticMatchedScale)
                  : 0.18 + focusEase * 0.82) * (isLocalDestination && objectFocus.child ? childSceneScale : 1);
        const objectReveal = isLocalDestination
            ? smoothstep((planetSceneFocus - 0.06) / 0.3)
            : target.kind === 'galactic'
              ? smoothstep((focusEase - 0.08) / 0.32)
              : focusEase;
        // Keep the parent present as context during a moon/ISS handoff, but
        // let the selected child take visual priority once its close-up grows.
        const parentReveal = objectReveal * (1 - childEase * 0.67);
        // Galactic close-ups can use the page's identical #1d2021 background
        // directly. Painting another full-canvas layer is unnecessary and can
        // produce a one-frame compositing flash as that layer disappears.
        if (!isLocalDestination && target.kind !== 'galactic') {
            context.globalAlpha = focusEase;
            context.fillStyle = '#1d2021';
            context.fillRect(0, 0, width, height);
        }
        context.globalAlpha = objectReveal;

        const drawFocusField = (radius: number, count: number, glyphs = ['.', ':', '*']) => {
            context.font = `${Math.max(5, (compactViewport ? 7 : 9) * focusScale)}px "DM Mono", monospace`;
            for (let index = 0; index < count; index++) {
                const baseAngle = (index / count) * Math.PI * 2 + focusLongitude;
                const spread = 0.48 + randomUnit(index + target.name.length * 37) * 0.55;
                const fieldRadius = radius * spread * focusScale;
                const x = focusCenterX + Math.cos(baseAngle) * fieldRadius;
                const y = focusCenterY + Math.sin(baseAngle) * fieldRadius * (0.32 + Math.cos(focusLatitude) * 0.3);
                context.globalAlpha = parentReveal * (0.12 + randomUnit(index + 33) * 0.32);
                context.fillStyle = index % 17 === 0 ? target.color : '#665c54';
                context.fillText(glyphs[index % glyphs.length], x, y);
            }
        };

        const focusedSphereColumns = compactViewport ? 37 : 49;
        const focusedSphereRows = compactViewport ? 19 : 25;
        const parentDetailProgress = objectFocus.child ? childEase : 0;
        const focusedSphereFontSize = (compactViewport ? 10 : 12.5) * focusScale;
        const enhancedSphereColumns = compactViewport ? 61 : 81;
        const enhancedSphereRows = compactViewport ? 31 : 41;
        const enhancedDensityScale = Math.min(
            focusedSphereColumns / enhancedSphereColumns,
            focusedSphereRows / enhancedSphereRows,
        );

        const drawFocusedSphere = () => {
            const columns = focusedSphereColumns;
            const rows = focusedSphereRows;
            const fontSize = focusedSphereFontSize;
            context.font = `bold ${fontSize}px "DM Mono", monospace`;
            const spin = focusedRotation(target.name, rotationHours, reducedMotion) + focusLongitude;
            const latitudeTilt = focusLatitude;
            const latitudeCosine = Math.cos(latitudeTilt);
            const latitudeSine = Math.sin(latitudeTilt);
            const characterWidth = context.measureText('M').width * 0.76;
            const lineHeight = fontSize * 0.82;
            const sphereWidth = columns * characterWidth;
            const sphereHeight = rows * lineHeight;
            if (target.kind === 'star') {
                drawSunAtmosphere(context, {
                    x: focusCenterX,
                    y: focusCenterY,
                    radiusX: sphereWidth / 2,
                    radiusY: sphereHeight / 2,
                    fontSize,
                    opacity: parentReveal,
                    seconds,
                    reducedMotion,
                    detailed: true,
                });
            }
            const drawPlanetRings = (foreground: boolean) => {
                if (target.name !== 'Saturn' && target.name !== 'Uranus') return;
                const isUranus = target.name === 'Uranus';
                const ringBaseRotation = isUranus ? 72 * DEG : 0;
                const ringBaseRotationCosine = Math.cos(ringBaseRotation);
                const ringBaseRotationSine = Math.sin(ringBaseRotation);
                const longitudeCosine = Math.cos(focusLongitude);
                const longitudeSine = Math.sin(focusLongitude);
                const latitudeCosine = Math.cos(latitudeTilt);
                const latitudeSine = Math.sin(latitudeTilt);
                const bands = isUranus
                    ? [{ x: 0.78, y: 0.12, alpha: 0.58, color: target.color, glyph: '.' }]
                    : [
                          { x: 0.67, y: 0.173, alpha: 0.3, color: '#b0aa9b', glyph: '.' },
                          { x: 0.73, y: 0.189, alpha: 0.48, color: '#b0aa9b', glyph: ':' },
                          { x: 0.79, y: 0.204, alpha: 0.66, color: '#d5d0c3', glyph: '=' },
                          { x: 0.85, y: 0.22, alpha: 0.8, color: '#e5e0d3', glyph: '-' },
                          { x: 0.91, y: 0.235, alpha: 0.72, color: '#d5d0c3', glyph: '=' },
                          // Leave a visible dark division between the bright inner
                          // bands and the softer outer ring.
                          { x: 1.025, y: 0.265, alpha: 0.5, color: '#bcb6a8', glyph: '-' },
                          { x: 1.085, y: 0.28, alpha: 0.6, color: '#cec8ba', glyph: ':' },
                          { x: 1.145, y: 0.296, alpha: 0.45, color: '#bcb6a8', glyph: '-' },
                      ];
                for (const band of bands) {
                    const ringRadius = sphereWidth * band.x;
                    const ringOpening = Math.min(0.95, (sphereHeight * band.y) / ringRadius);
                    const ringDepthScale = Math.sqrt(1 - ringOpening ** 2);
                    for (let sample = 0; sample < 112; sample++) {
                        const angle = (sample / 112) * Math.PI * 2;
                        const ringDepth = Math.sin(angle) * ringRadius * ringDepthScale;
                        const ringMajor = Math.cos(angle) * ringRadius;
                        const ringMinor = Math.sin(angle) * ringRadius * ringOpening;
                        const baseRingX = ringMajor * ringBaseRotationCosine - ringMinor * ringBaseRotationSine;
                        const baseRingY = ringMajor * ringBaseRotationSine + ringMinor * ringBaseRotationCosine;
                        // Keep the detailed ring plane in the same 3D frame as
                        // the detailed moon orbits: longitude around Y, then
                        // latitude around X.
                        const rotatedX = baseRingX * longitudeCosine - ringDepth * longitudeSine;
                        const rotatedZ = baseRingX * longitudeSine + ringDepth * longitudeCosine;
                        const tiltedY = baseRingY * latitudeCosine - rotatedZ * latitudeSine;
                        const tiltedZ = baseRingY * latitudeSine + rotatedZ * latitudeCosine;
                        if (tiltedZ >= 0 !== foreground) continue;
                        if (
                            !foreground &&
                            (rotatedX / (sphereWidth / 2)) ** 2 + (tiltedY / (sphereHeight / 2)) ** 2 < 1
                        )
                            continue;
                        // The two passes control occlusion only. A continuous
                        // depth gradient avoids a color seam at their boundary.
                        context.globalAlpha = parentReveal * band.alpha * (0.86 + (tiltedZ / ringRadius) * 0.14);
                        context.fillStyle = band.color;
                        const glyph = isUranus && sample % 4 === 0 ? '-' : band.glyph;
                        context.fillText(glyph, focusCenterX + rotatedX, focusCenterY + tiltedY);
                    }
                }
            };
            drawPlanetRings(false);
            // The surface is made of separated glyphs, so give the detailed
            // sphere a matching opaque interior before painting those glyphs.
            // Rear rings stay behind the mask; front rings are drawn afterward.
            drawSoftSceneMask(context, {
                x: focusCenterX,
                y: focusCenterY,
                radiusX: sphereWidth * 0.505,
                radiusY: sphereHeight * 0.505,
                opacity: parentReveal,
                color: target.kind === 'star' ? SUN_MASK_COLOR : '#1d2021',
            });
            const drawSurface = (detailColumns: number, detailRows: number, detailFontSize: number, reveal: number) => {
                if (reveal <= 0.001) return;
                context.font = `bold ${detailFontSize}px "DM Mono", monospace`;
                const detailCharacterWidth = context.measureText('M').width * 0.76;
                const detailLineHeight = detailFontSize * 0.82;
                for (let row = 0; row < detailRows; row++) {
                    const normalizedY = (row + 0.5 - detailRows / 2) / (detailRows / 2);
                    const lineY = focusCenterY + (row - (detailRows - 1) / 2) * detailLineHeight;
                    for (let column = 0; column < detailColumns; column++) {
                        const normalizedX = (column + 0.5 - detailColumns / 2) / (detailColumns / 2);
                        if (normalizedX ** 2 + normalizedY ** 2 > 1) continue;
                        const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
                        const latitudeY = normalizedY * latitudeCosine + sphereZ * latitudeSine;
                        const latitudeZ = -normalizedY * latitudeSine + sphereZ * latitudeCosine;
                        const longitude = Math.atan2(normalizedX, latitudeZ) + spin;
                        const latitude = Math.asin(-latitudeY);
                        const character = planetSurfaceGlyph(target.name, longitude, latitude);
                        context.globalAlpha =
                            reveal *
                            (target.kind === 'star'
                                ? sunSurfaceLight(sphereZ)
                                : planetSurfaceLight(normalizedX, normalizedY, sphereZ));
                        context.fillStyle = planetSurfaceColor(target.name, character, target.color);
                        context.fillText(
                            character,
                            focusCenterX + (column + 0.5 - detailColumns / 2) * detailCharacterWidth,
                            lineY,
                        );
                    }
                }
            };
            drawSurface(columns, rows, fontSize, parentReveal * (1 - parentDetailProgress));
            drawSurface(
                enhancedSphereColumns,
                enhancedSphereRows,
                fontSize * enhancedDensityScale,
                parentReveal * parentDetailProgress,
            );
            drawPlanetRings(true);
        };

        const earthSatelliteReveal =
            target.name === 'Earth' ? smoothstep((planetSceneFocus - 0.28) / 0.45) * (1 - childEase * 0.67) : 0;
        const focusedEarthRadius = (focusedSphereRows * focusedSphereFontSize * 0.82) / 2;
        const focusedOrbitOffset = (angle: number, radius: number, inclination: number, node: number, target: Vec3) => {
            target.x = Math.cos(angle) * radius;
            target.y = Math.sin(angle) * radius;
            target.z = 0;
            rotateX(target, inclination, target);
            rotateZ(target, node, target);
            rotateY(target, -focusLongitude, target);
            return rotateX(target, focusLatitude, target);
        };
        const baseFocusedEarthRadius = focusedEarthRadius / (objectFocus.child ? childSceneScale : 1);
        const focusedMoonRadius =
            compactViewport
                ? Math.min(baseFocusedEarthRadius * 1.55, width * 0.42) * (objectFocus.child ? childSceneScale : 1)
                : Math.min(baseFocusedEarthRadius * 1.65, height * 0.38) * (objectFocus.child ? childSceneScale : 1);
        const focusedMoonAngle = (moonElapsedDays / EARTH_MOON_PERIOD_DAYS) * Math.PI * 2;
        const focusedMoonOffset = focusedOrbitOffset(
            focusedMoonAngle,
            focusedMoonRadius,
            50 * DEG,
            -18 * DEG,
            focusedMoonOffsetScratch,
        );
        const focusedIssRadius = focusedEarthRadius * 1.13;
        const focusedIssAngle =
            1.2 +
            (reducedMotion ? 0 : ((moonElapsedDays % ISS_ORBIT_PERIOD_DAYS) / ISS_ORBIT_PERIOD_DAYS) * Math.PI * 2);
        const focusedIssOffset = focusedOrbitOffset(
            focusedIssAngle,
            focusedIssRadius,
            44 * DEG,
            24 * DEG,
            focusedIssOffsetScratch,
        );
        const focusedMoonPosition = { x: focusCenterX + focusedMoonOffset.x, y: focusCenterY + focusedMoonOffset.y };
        const focusedIssPosition = { x: focusCenterX + focusedIssOffset.x, y: focusCenterY + focusedIssOffset.y };
        const earthSatelliteObjects = [
            { id: 'moon' as const, ...focusedMoonPosition },
            { id: 'iss' as const, ...focusedIssPosition },
        ];
        const hoveredFocusedEarthObject =
            earthSatelliteReveal > 0.35 && !camera.dragging && !objectFocus.child
                ? keyboardSelectionId
                    ? (earthSatelliteObjects.find((object) => object.id === keyboardSelectionId) ?? null)
                    : pointer.active
                      ? earthSatelliteObjects.reduce<{ id: 'moon' | 'iss'; x: number; y: number } | null>(
                            (closest, object) => {
                                const distance = Math.hypot(object.x - localPointerX, object.y - localPointerY);
                                const closestDistance = closest
                                    ? Math.hypot(closest.x - localPointerX, closest.y - localPointerY)
                                    : Infinity;
                                return distance < 30 && distance < closestDistance ? object : closest;
                            },
                            null,
                        )
                      : null
                : null;
        if (hoveredFocusedEarthObject) {
            const isMoon = hoveredFocusedEarthObject.id === 'moon';
            activeFocusCandidate = {
                id: hoveredFocusedEarthObject.id,
                name: isMoon ? 'Moon' : 'International Space Station',
                kind: isMoon ? 'moon' : 'station',
                color: isMoon ? '#bdae93' : '#8ec07c',
                subtitle: isMoon ? 'natural satellite' : 'orbital laboratory',
                detail: isMoon ? 'mean distance 384,400 km' : 'low Earth orbit / ~90 min period',
                originX: hoveredFocusedEarthObject.x,
                originY: hoveredFocusedEarthObject.y,
            };
        }

        const drawFocusedEarthSatellites = (foreground: boolean) => {
            if (earthSatelliteReveal <= 0.001) return;
            const satelliteDetailScale = Math.min(0.34, 0.22 * focusScale);
            const drawOrbit = (
                radius: number,
                inclination: number,
                node: number,
                samples: number,
                color: string,
                alpha: number,
            ) => {
                context.font = `${Math.max(5, (compactViewport ? 7 : 8) * focusScale)}px "DM Mono", monospace`;
                context.fillStyle = color;
                for (let sample = 0; sample < samples; sample += 2) {
                    const offset = focusedOrbitOffset(
                        (sample / samples) * Math.PI * 2,
                        radius,
                        inclination,
                        node,
                        focusedOrbitOffsetScratch,
                    );
                    if (offset.z >= 0 !== foreground) continue;
                    const next = focusedOrbitOffset(
                        ((sample + 1) / samples) * Math.PI * 2,
                        radius,
                        inclination,
                        node,
                        focusedOrbitNextScratch,
                    );
                    const dx = next.x - offset.x;
                    const dy = next.y - offset.y;
                    const slope = Math.abs(dy / (dx || 0.001));
                    const glyph = slope > 2.2 ? '|' : slope > 0.6 ? (dx * dy > 0 ? '\\' : '/') : '-';
                    context.globalAlpha = earthSatelliteReveal * alpha;
                    context.fillText(glyph, focusCenterX + offset.x, focusCenterY + offset.y);
                }
            };
            drawOrbit(focusedMoonRadius, 50 * DEG, -18 * DEG, 96, '#928374', 0.66);
            drawOrbit(focusedIssRadius, 44 * DEG, 24 * DEG, 72, '#665c54', 0.52);

            if (focusedMoonOffset.z >= 0 === foreground) {
                const moonFontSize = Math.max(5, (compactViewport ? 7 : 9) * focusScale);
                const selectedMoon = objectFocus.child?.id === 'moon';
                const moonCompactReveal =
                    earthSatelliteReveal *
                    (objectFocus.child ? (selectedMoon ? 1 - childGlyphHandoff : 1 - childEase) : 1);
                const moonDetailedReveal =
                    earthSatelliteReveal *
                    (objectFocus.child ? childEase * (selectedMoon ? 1 - childGlyphHandoff : 1) : 0);
                if (moonCompactReveal > 0.001) {
                    context.globalAlpha = moonCompactReveal;
                    context.fillStyle = '#bdae93';
                    context.strokeStyle = '#1d2021';
                    context.lineWidth = 2;
                    context.font = `bold ${moonFontSize}px "DM Mono", monospace`;
                    drawSoftMoonMask(
                        focusedMoonPosition.x,
                        focusedMoonPosition.y,
                        moonFontSize * 1.55,
                        moonFontSize * 1.15,
                        moonCompactReveal,
                    );
                    context.fillStyle = '#bdae93';
                    [' .-. ', '(.:)', " '-' "].forEach((line, index) => {
                        const lineY = focusedMoonPosition.y + (index - 1) * moonFontSize * 0.76;
                        context.strokeText(line, focusedMoonPosition.x, lineY);
                        context.fillText(line, focusedMoonPosition.x, lineY);
                    });
                }
                if (moonDetailedReveal > 0.001) {
                    drawFocusedMoon(context, {
                        centerX: focusedMoonPosition.x,
                        centerY: focusedMoonPosition.y,
                        scale: satelliteDetailScale,
                        reveal: moonDetailedReveal,
                        longitude: detailFocusLongitude,
                        latitude: detailFocusLatitude,
                        rotationHours,
                        reducedMotion,
                        compact: compactViewport,
                        maskColor: sceneMaskColor(focusedMoonPosition.x, focusedMoonPosition.y, width, height, false),
                    });
                }
                if (showHoverVisuals && hoveredFocusedEarthObject?.id === 'moon') {
                    context.fillStyle = '#ebdbb2';
                    context.fillText('[', focusedMoonPosition.x - 22 * focusScale, focusedMoonPosition.y);
                    context.fillText(']', focusedMoonPosition.x + 22 * focusScale, focusedMoonPosition.y);
                }
            }
            if (focusedIssOffset.z >= 0 === foreground) {
                const issFontSize = Math.max(5, (compactViewport ? 7 : 9) * focusScale);
                const selectedIss = objectFocus.child?.id === 'iss';
                const issCompactReveal =
                    earthSatelliteReveal *
                    (objectFocus.child ? (selectedIss ? 1 - childGlyphHandoff : 1 - childEase) : 1);
                const issDetailedReveal =
                    earthSatelliteReveal *
                    (objectFocus.child ? childEase * (selectedIss ? 1 - childGlyphHandoff : 1) : 0);
                if (issCompactReveal > 0.001) {
                    context.globalAlpha = issCompactReveal;
                    context.fillStyle = '#8ec07c';
                    context.strokeStyle = '#1d2021';
                    context.lineWidth = 2;
                    context.font = `bold ${issFontSize}px "DM Mono", monospace`;
                    context.strokeText('=-[ISS]-=', focusedIssPosition.x, focusedIssPosition.y);
                    context.fillText('=-[ISS]-=', focusedIssPosition.x, focusedIssPosition.y);
                }
                if (issDetailedReveal > 0.001) {
                    drawFocusedIss(context, {
                        centerX: focusedIssPosition.x,
                        centerY: focusedIssPosition.y,
                        scale: satelliteDetailScale,
                        reveal: issDetailedReveal,
                        longitude: detailFocusLongitude,
                        latitude: detailFocusLatitude,
                        compact: compactViewport,
                    });
                }
                if (showHoverVisuals && hoveredFocusedEarthObject?.id === 'iss') {
                    context.fillStyle = '#ebdbb2';
                    context.fillText('[', focusedIssPosition.x - 38 * focusScale, focusedIssPosition.y);
                    context.fillText(']', focusedIssPosition.x + 38 * focusScale, focusedIssPosition.y);
                }
            }
            context.globalAlpha = 1;
        };

        const majorMoonSystem = MAJOR_MOON_SYSTEMS[target.name];
        const majorMoonReveal = majorMoonSystem
            ? smoothstep((planetSceneFocus - 0.26) / 0.48) * (1 - childEase * 0.67)
            : 0;
        const focusedParentRadius = (focusedSphereRows * focusedSphereFontSize * 0.82) / 2;
        const focusedMajorMoonOffset = (moon: MajorMoon, angle: number, radius: number, target: Vec3) => {
            target.x = Math.cos(angle) * radius;
            target.y = Math.sin(angle) * radius;
            target.z = 0;
            if (!majorMoonSystem) return target;
            rotateX(target, moon.inclination, target);
            rotateZ(target, moon.node, target);
            rotateX(target, majorMoonSystem.inclination, target);
            rotateZ(target, majorMoonSystem.node, target);
            rotateY(target, -focusLongitude, target);
            return rotateX(target, focusLatitude, target);
        };
        const majorMoons = (majorMoonSystem?.moons ?? []).map((moon) => {
            const orbit = solveMoonOrbit(moon, liveMoonOrbitScratch);
            const offset = focusedMajorMoonOffset(
                moon,
                orbit.angle,
                focusedParentRadius * moon.radius * orbit.distance,
                { x: 0, y: 0, z: 0 },
            );
            return { ...moon, offset, x: focusCenterX + offset.x, y: focusCenterY + offset.y };
        });
        const hoveredMajorMoon =
            majorMoonReveal > 0.35 && !camera.dragging && !objectFocus.child
                ? keyboardSelectionId
                    ? (majorMoons.find((moon) => `moon:${target.name}:${moon.name}` === keyboardSelectionId) ?? null)
                    : pointer.active
                      ? majorMoons.reduce<(typeof majorMoons)[number] | null>((closest, moon) => {
                            const distance = Math.hypot(moon.x - localPointerX, moon.y - localPointerY);
                            const closestDistance = closest
                                ? Math.hypot(closest.x - localPointerX, closest.y - localPointerY)
                                : Infinity;
                            return distance < 26 && distance < closestDistance ? moon : closest;
                        }, null)
                      : null
                : null;
        if (hoveredMajorMoon && majorMoonSystem) {
            activeFocusCandidate = {
                id: `moon:${target.name}:${hoveredMajorMoon.name}`,
                name: hoveredMajorMoon.name,
                kind: 'moon',
                color: hoveredMajorMoon.color,
                subtitle: majorMoonSystem.subtitle,
                detail: `mean distance ${hoveredMajorMoon.distance} / period ${hoveredMajorMoon.period}`,
                originX: hoveredMajorMoon.x,
                originY: hoveredMajorMoon.y,
            };
        }

        const drawFocusedMajorMoons = (foreground: boolean) => {
            if (!majorMoonSystem || majorMoonReveal <= 0.001) return;
            const drawDetailedMajorMoon = (moon: (typeof majorMoons)[number], reveal: number) => {
                const isLargeMoon = LARGE_MOON_GLYPHS.has(moon.name);
                const detailScale = Math.min(1.35, focusScale);
                const columns = isLargeMoon ? 11 : 9;
                const rows = isLargeMoon ? 7 : 5;
                const fontSize = (isLargeMoon ? 6.3 : 5.3) * detailScale;
                context.font = `bold ${fontSize}px "DM Mono", monospace`;
                const characterWidth = context.measureText('M').width * 0.76;
                const lineHeight = fontSize * 0.82;
                const sphereWidth = columns * characterWidth;
                const sphereHeight = rows * lineHeight;
                const spin = focusedRotation(moon.name, rotationHours, reducedMotion) + focusLongitude;
                const latitudeCosine = Math.cos(focusLatitude);
                const latitudeSine = Math.sin(focusLatitude);

                drawSoftMoonMask(moon.x, moon.y, sphereWidth * 0.505, sphereHeight * 0.505, reveal);

                for (let row = 0; row < rows; row++) {
                    const normalizedY = (row + 0.5 - rows / 2) / (rows / 2);
                    const lineY = moon.y + (row - (rows - 1) / 2) * lineHeight;
                    for (let column = 0; column < columns; column++) {
                        const normalizedX = (column + 0.5 - columns / 2) / (columns / 2);
                        if (normalizedX ** 2 + normalizedY ** 2 > 1) continue;
                        const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
                        const latitudeY = normalizedY * latitudeCosine + sphereZ * latitudeSine;
                        const latitudeZ = -normalizedY * latitudeSine + sphereZ * latitudeCosine;
                        const longitude = Math.atan2(normalizedX, latitudeZ) + spin;
                        const latitude = Math.asin(-latitudeY);
                        const glyph = planetSurfaceGlyph(moon.name, longitude, latitude);
                        const light = Math.min(1, planetSurfaceLight(normalizedX, normalizedY, sphereZ));
                        context.globalAlpha = reveal * (0.4 + light * 0.6);
                        context.fillStyle = planetSurfaceColor(moon.name, glyph, moon.color);
                        context.fillText(glyph, moon.x + (column + 0.5 - columns / 2) * characterWidth, lineY);
                    }
                }
                context.globalAlpha = 1;
            };
            const drawCompactMajorMoon = (moon: (typeof majorMoons)[number], reveal: number) => {
                if (reveal <= 0.001) return;
                const isLargeMoon = LARGE_MOON_GLYPHS.has(moon.name);
                const moonFontSize = Math.max(7, (isLargeMoon ? 12 : 9) * focusScale);
                context.globalAlpha = reveal;
                context.fillStyle = moon.color;
                context.strokeStyle = '#1d2021';
                context.lineWidth = 2;
                context.font = `bold ${moonFontSize}px "DM Mono", monospace`;
                drawSoftMoonMask(moon.x, moon.y, moonFontSize * 0.58, moonFontSize * 0.58, reveal);
                context.fillStyle = moon.color;
                context.strokeText(moon.glyph, moon.x, moon.y);
                context.fillText(moon.glyph, moon.x, moon.y);
            };

            for (const moon of majorMoons) {
                context.font = `${Math.max(5, (compactViewport ? 6.5 : 8) * focusScale)}px "DM Mono", monospace`;
                context.fillStyle = '#665c54';
                for (let sample = 0; sample < 96; sample += 2) {
                    const sampledOrbit = solveKeplerOrbit(
                        (sample / 96) * Math.PI * 2,
                        moon.eccentricity,
                        sampledOrbitScratch,
                    );
                    const sampledAngle = sampledOrbit.angle + moon.periapsis * DEG;
                    const offset = focusedMajorMoonOffset(
                        moon,
                        sampledAngle,
                        focusedParentRadius * moon.radius * sampledOrbit.distance,
                        majorOrbitOffsetScratch,
                    );
                    if (offset.z >= 0 !== foreground) continue;
                    const nextOrbit = solveKeplerOrbit(
                        ((sample + 1) / 96) * Math.PI * 2,
                        moon.eccentricity,
                        nextSampledOrbitScratch,
                    );
                    const nextAngle = nextOrbit.angle + moon.periapsis * DEG;
                    const next = focusedMajorMoonOffset(
                        moon,
                        nextAngle,
                        focusedParentRadius * moon.radius * nextOrbit.distance,
                        majorOrbitNextScratch,
                    );
                    const dx = next.x - offset.x;
                    const dy = next.y - offset.y;
                    const slope = Math.abs(dy / (dx || 0.001));
                    const glyph = slope > 2.2 ? '|' : slope > 0.6 ? (dx * dy > 0 ? '\\' : '/') : '-';
                    context.globalAlpha = majorMoonReveal * 0.5;
                    context.fillText(glyph, focusCenterX + offset.x, focusCenterY + offset.y);
                }
                if (moon.offset.z >= 0 !== foreground) continue;
                const moonId = `moon:${target.name}:${moon.name}`;
                const selectedChild = objectFocus.child?.id === moonId;
                const compactReveal =
                    majorMoonReveal * (objectFocus.child ? (selectedChild ? 1 - childGlyphHandoff : 1 - childEase) : 1);
                const detailedReveal =
                    majorMoonReveal * (objectFocus.child ? childEase * (selectedChild ? 1 - childGlyphHandoff : 1) : 0);
                drawCompactMajorMoon(moon, compactReveal);
                if (detailedReveal > 0.001) drawDetailedMajorMoon(moon, detailedReveal);
                if (showHoverVisuals && moon === hoveredMajorMoon) {
                    const isLargeMoon = LARGE_MOON_GLYPHS.has(moon.name);
                    const bracketOffset = Math.max(11, (isLargeMoon ? 17 : 13) * focusScale);
                    context.fillStyle = '#ebdbb2';
                    context.font = `bold ${Math.max(8, 10 * focusScale)}px "DM Mono", monospace`;
                    context.fillText('[', moon.x - bracketOffset, moon.y);
                    context.fillText(']', moon.x + bracketOffset, moon.y);
                }
            }
            context.globalAlpha = 1;
        };

        if (target.kind === 'star' || target.kind === 'planet' || target.kind === 'moon') {
            if (target.kind !== 'star')
                drawFocusField(
                    compactViewport ? 145 : 225,
                    target.name === 'Earth' ? 28 : target.name === 'Jupiter' || target.name === 'Saturn' ? 18 : 24,
                    ['.', ':'],
                );
            if (target.name === 'Earth') drawFocusedEarthSatellites(false);
            drawFocusedMajorMoons(false);
            drawFocusedSphere();
            if (target.name === 'Earth') drawFocusedEarthSatellites(true);
            drawFocusedMajorMoons(true);
        } else {
            if (target.name === 'Sagittarius A*') {
                drawSagittariusGlow(context, {
                    x: focusCenterX,
                    y: focusCenterY,
                    radius: galacticFocusedRadius * focusScale,
                    opacity: objectReveal,
                });
            }
            if (target.kind === 'galactic') {
                drawFocusedNebulaGlow(context, {
                    name: target.name,
                    x: focusCenterX,
                    y: focusCenterY,
                    radius: galacticFocusedRadius * focusScale,
                    opacity: objectReveal,
                });
                if (target.name === 'PSR B1509-58') {
                    drawPulsarGlow(context, {
                        x: focusCenterX,
                        y: focusCenterY,
                        radius: galacticFocusedRadius * focusScale,
                        opacity: objectReveal,
                    });
                }
            }
            drawFocusField(
                compactViewport ? 145 : 235,
                target.kind === 'galactic' ? 32 : 62,
                target.kind === 'galactic' ? ['.', ':', '*'] : ['.', '-'],
            );
            if (target.kind === 'galactic' && target.sourceSprite) {
                // Carry the exact compact landmark away from its projected
                // Galactic coordinate before the detailed renderer takes over.
                // This is the equivalent of the compact-to-detailed bridge used
                // by planets, and reverses cleanly when returning to the galaxy.
                const bridgeReveal = smoothstep(focusEase / 0.1) * (1 - objectReveal);
                const bridgeFontSize = galacticSourceFontSize * galacticBridgeScale;
                context.globalAlpha = bridgeReveal;
                context.fillStyle = target.color;
                context.strokeStyle = '#1d2021';
                context.lineWidth = Math.max(1.25, bridgeFontSize * 0.16);
                context.font = `bold ${bridgeFontSize}px "DM Mono", monospace`;
                target.sourceSprite.forEach((line, row) => {
                    const lineY = focusCenterY + (row - (target.sourceSprite!.length - 1) / 2) * bridgeFontSize * 0.9;
                    context.strokeText(line, focusCenterX, lineY);
                    context.fillText(line, focusCenterX, lineY);
                });
            }
            const renderedGalacticObject =
                target.kind === 'galactic' &&
                drawFocusedGalacticObject(context, {
                    name: target.name,
                    x: focusCenterX,
                    y: focusCenterY,
                    scale: focusScale,
                    opacity: objectReveal,
                    seconds,
                    longitude: focusLongitude,
                    latitude: focusLatitude,
                    reducedMotion,
                    compact: compactViewport,
                });
            const renderedComet =
                target.kind === 'comet' &&
                drawFocusedHalley(context, {
                    x: focusCenterX,
                    y: focusCenterY,
                    scale: focusScale,
                    opacity: objectReveal,
                    transitionProgress: objectFocus.progress,
                    seconds,
                    longitude: focusLongitude,
                    latitude: focusLatitude,
                    reducedMotion,
                    compact: compactViewport,
                });
            if (!renderedGalacticObject && !renderedComet) {
                const lines = FOCUSED_ART[target.name] ?? [target.name];
                const artFontSize = (compactViewport ? 14 : 22) * focusScale;
                context.font = `bold ${artFontSize}px "DM Mono", monospace`;
                context.fillStyle = target.color;
                context.globalAlpha = objectReveal;
                lines.forEach((line, index) => {
                    const parallax = Math.sin(focusLongitude + index * 0.7) * artFontSize * 0.55;
                    context.fillText(
                        line,
                        focusCenterX + parallax,
                        focusCenterY + (index - (lines.length - 1) / 2) * artFontSize * 0.9,
                    );
                });
            }
        }

        if (showHoverVisuals && hoveredMajorMoon && majorMoonSystem) {
            drawReadout(context, {
                lines: [
                    `[ ${hoveredMajorMoon.name.toUpperCase()} ]`,
                    majorMoonSystem.subtitle,
                    `mean r  ${hoveredMajorMoon.distance}`,
                    `period  ${hoveredMajorMoon.period}`,
                ],
                anchorX: hoveredMajorMoon.x,
                anchorY: hoveredMajorMoon.y,
                viewportWidth: width,
                viewportHeight: height,
                titleColor: hoveredMajorMoon.color,
                openAwayFromCenter: true,
                opacity: majorMoonReveal,
            });
        }

        if (showHoverVisuals && hoveredFocusedEarthObject) {
            const isMoon = hoveredFocusedEarthObject.id === 'moon';
            drawReadout(context, {
                lines: isMoon
                    ? ['[ MOON ]', 'natural satellite', 'mean r  384,400 km', 'sidereal 27.3 days']
                    : ['[ ISS ]', 'orbital laboratory', 'alt     ~400 km', 'period  ~90 min'],
                anchorX: hoveredFocusedEarthObject.x,
                anchorY: hoveredFocusedEarthObject.y,
                viewportWidth: width,
                viewportHeight: height,
                titleColor: isMoon ? '#bdae93' : '#8ec07c',
                openAwayFromCenter: true,
                opacity: earthSatelliteReveal,
            });
        }

        const compact = compactViewport;
        const hideCompactDetails =
            compact &&
            !isFullscreen &&
            (target.kind === 'planet' || target.kind === 'star' || target.kind === 'galactic');
        const infoY = Math.min(
            height - (hideCompactDetails ? 30 : target.fact ? 93 : 72),
            focusCenterY + (compact ? 150 : 205) * focusScale,
        );
        const infoReveal =
            (isLocalDestination ? smoothstep((planetSceneFocus - 0.45) / 0.4) : focusEase) * (1 - childEase);
        context.globalAlpha = infoReveal;
        context.fillStyle = target.color;
        context.font = `bold ${compact ? 11 : 13}px "DM Mono", monospace`;
        context.fillText(`[ ${target.name.toUpperCase()} ]`, viewportCenterX, infoY);
        if (!hideCompactDetails) {
            context.fillStyle = '#a89984';
            context.font = '12px "DM Mono", monospace';
            context.fillText(`${target.subtitle} · ${target.detail}`, viewportCenterX, infoY + 21);
            if (target.fact) context.fillText(target.fact, viewportCenterX, infoY + 42);
        }
        if (objectFocus.child && objectFocus.childProgress > 0.001) {
            const child = objectFocus.child;
            const childGrowth = smoothstep((childEase - 0.08) / 0.92) ** 1.45;
            // The child renderer already has a viewport-sized detail pass. The
            // camera scale belongs to the parent scene behind it; applying it a
            // second time here would make the moon/ISS grow beyond the canvas.
            const childScale = 0.1 + childGrowth * 0.9;
            const childReveal = smoothstep((childEase - 0.06) / 0.3);
            const childCenterX = child.originX + (viewportCenterX - child.originX) * childEase;
            const childCenterY = child.originY + (viewportCenterY - child.originY) * childEase;
            // Keep the parent planet scene visible while the second focus grows.
            // Planet close-ups do not paint a full-canvas mask, and the child
            // focus should feel like the same camera continuing inward rather
            // than a separate panel hiding the dense orbital backdrop.

            const childFieldCount = child.kind === 'station' ? 34 : 58;
            context.font = `${Math.max(5, (compactViewport ? 7 : 9) * childScale)}px "DM Mono", monospace`;
            for (let index = 0; index < childFieldCount; index++) {
                const angle = (index / childFieldCount) * Math.PI * 2 + childFocusLongitude;
                const radius = (compactViewport ? 155 : 245) * (0.48 + randomUnit(index + 2101) * 0.55) * childScale;
                context.globalAlpha = childReveal * (0.12 + randomUnit(index + 2201) * 0.3);
                context.fillStyle = index % 19 === 0 ? child.color : '#665c54';
                context.fillText(
                    index % 11 === 0 ? '*' : '.',
                    childCenterX + Math.cos(angle) * radius,
                    childCenterY + Math.sin(angle) * radius * 0.58,
                );
            }

            if (child.kind === 'moon') {
                if (child.name === 'Moon') {
                    drawFocusedMoon(context, {
                        centerX: childCenterX,
                        centerY: childCenterY,
                        scale: childScale,
                        reveal: childReveal,
                        longitude: childFocusLongitude,
                        latitude: childFocusLatitude,
                        rotationHours,
                        reducedMotion,
                        compact: compactViewport,
                        maskColor: sceneMaskColor(childCenterX, childCenterY, width, height, false),
                    });
                } else {
                    const columns = compactViewport ? 37 : 49;
                    const rows = compactViewport ? 19 : 25;
                    const fontSize = (compactViewport ? 10 : 12.5) * childScale;
                    context.font = `bold ${fontSize}px "DM Mono", monospace`;
                    const characterWidth = context.measureText('M').width * 0.76;
                    const lineHeight = fontSize * 0.82;
                    const spin = focusedRotation(child.name, rotationHours, reducedMotion) + childFocusLongitude;
                    drawSoftMoonMask(
                        childCenterX,
                        childCenterY,
                        columns * characterWidth * 0.505,
                        rows * lineHeight * 0.505,
                        childReveal,
                    );
                    for (let row = 0; row < rows; row++) {
                        const normalizedY = (row + 0.5 - rows / 2) / (rows / 2);
                        const lineY = childCenterY + (row - (rows - 1) / 2) * lineHeight;
                        for (let column = 0; column < columns; column++) {
                            const normalizedX = (column + 0.5 - columns / 2) / (columns / 2);
                            if (normalizedX ** 2 + normalizedY ** 2 > 1) continue;
                            const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
                            const latitudeY =
                                normalizedY * Math.cos(childFocusLatitude) + sphereZ * Math.sin(childFocusLatitude);
                            const latitudeZ =
                                -normalizedY * Math.sin(childFocusLatitude) + sphereZ * Math.cos(childFocusLatitude);
                            const longitude = Math.atan2(normalizedX, latitudeZ) + spin;
                            const latitude = Math.asin(-latitudeY);
                            context.globalAlpha = childReveal * (0.6 + sphereZ * 0.4);
                            context.fillStyle = child.color;
                            context.fillText(
                                planetSurfaceGlyph(child.name, longitude, latitude),
                                childCenterX + (column + 0.5 - columns / 2) * characterWidth,
                                lineY,
                            );
                        }
                    }
                }
            } else {
                drawFocusedIss(context, {
                    centerX: childCenterX,
                    centerY: childCenterY,
                    scale: childScale,
                    reveal: childReveal,
                    longitude: childFocusLongitude,
                    latitude: childFocusLatitude,
                        compact: compactViewport,
                });
            }

            const childInfoY = Math.min(height - 72, childCenterY + (compactViewport ? 150 : 205) * childScale);
            const childInfoReveal = smoothstep((childEase - 0.45) / 0.4);
            context.globalAlpha = childInfoReveal;
            context.fillStyle = child.color;
            context.font = `bold ${compactViewport ? 11 : 13}px "DM Mono", monospace`;
            context.fillText(`[ ${child.name.toUpperCase()} ]`, viewportCenterX, childInfoY);
            context.fillStyle = '#a89984';
            context.font = '12px "DM Mono", monospace';
            context.fillText(`${child.subtitle} · ${child.detail}`, viewportCenterX, childInfoY + 21);
        }
        context.globalAlpha = 1;
    }

    return activeFocusCandidate;
};
