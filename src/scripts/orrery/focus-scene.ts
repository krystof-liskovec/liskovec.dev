import { FOCUSED_ART, MAJOR_MOON_SYSTEMS } from './catalog';
import type { MajorMoon } from './catalog';
import { drawReadout } from './canvas-ui';
import { drawFocusedGalacticObject } from './galactic-renderer';
import { drawFocusedIss } from './iss-renderer';
import { DEG, J2000, randomUnit, rotateX, rotateY, rotateZ, smoothstep, solveKeplerOrbit } from './math';
import { drawFocusedMoon } from './moon-renderer';
import { focusedRotation, planetSurfaceGlyph } from './planet-textures';
import type { CameraState, PointerState } from './runtime-state';
import type { FocusState, FocusTarget, Planet, ProjectedBody } from './types';

type MoonOrbit = { angle: number; distance: number };

type FocusSceneOptions = {
    width: number;
    height: number;
    objectFocus: FocusState;
    focusedPlanet: Planet | null;
    bodies: ProjectedBody[];
    viewportCenterX: number;
    viewportCenterY: number;
    localSphereGrowth: number;
    planetSceneFocus: number;
    seconds: number;
    reducedMotion: boolean;
    pointer: PointerState;
    camera: CameraState;
    localPointerX: number;
    localPointerY: number;
    showHoverVisuals: boolean;
    solveMoonOrbit: (moon: MajorMoon) => MoonOrbit;
};

export const drawFocusScene = (context: CanvasRenderingContext2D, options: FocusSceneOptions): FocusTarget | null => {
    const {
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
    } = options;
    let activeFocusCandidate: FocusTarget | null = null;
    if (objectFocus.target && objectFocus.progress > 0.001) {
        const target = objectFocus.target;
        const focusEase = smoothstep(objectFocus.progress);
        const focusedPlanetBody = focusedPlanet ? bodies.find((body) => body.planet === focusedPlanet) : null;
        const isLocalDestination = (target.kind === 'planet' && !!focusedPlanetBody) || target.kind === 'star';
        const focusCenterX = focusedPlanetBody?.x ?? target.originX + (viewportCenterX - target.originX) * focusEase;
        const focusCenterY = focusedPlanetBody?.y ?? target.originY + (viewportCenterY - target.originY) * focusEase;
        const localFocusStartScale = target.kind === 'star' ? 0.24 : 0.1;
        const focusScale = isLocalDestination
            ? localFocusStartScale + localSphereGrowth * (1 - localFocusStartScale)
            : 0.18 + focusEase * 0.82;
        const objectReveal = isLocalDestination ? smoothstep((planetSceneFocus - 0.06) / 0.3) : focusEase;
        if (!isLocalDestination) {
            context.globalAlpha = focusEase;
            context.fillStyle = '#1d2021';
            context.fillRect(0, 0, width, height);
        }
        context.globalAlpha = objectReveal;

        const drawFocusField = (radius: number, count: number, glyphs = ['.', ':', '*']) => {
            context.font = `${Math.max(5, (width < 600 ? 7 : 9) * focusScale)}px "DM Mono", monospace`;
            for (let index = 0; index < count; index++) {
                const baseAngle = (index / count) * Math.PI * 2 + objectFocus.longitude;
                const spread = 0.48 + randomUnit(index + target.name.length * 37) * 0.55;
                const fieldRadius = radius * spread * focusScale;
                const x = focusCenterX + Math.cos(baseAngle) * fieldRadius;
                const y =
                    focusCenterY + Math.sin(baseAngle) * fieldRadius * (0.32 + Math.cos(objectFocus.latitude) * 0.3);
                context.globalAlpha = objectReveal * (0.12 + randomUnit(index + 33) * 0.32);
                context.fillStyle = index % 17 === 0 ? target.color : '#665c54';
                context.fillText(glyphs[index % glyphs.length], x, y);
            }
        };

        const focusedSphereColumns = width < 600 ? 37 : 49;
        const focusedSphereRows = width < 600 ? 19 : 25;
        const focusedSphereFontSize = (width < 600 ? 10 : 12.5) * focusScale;

        const drawFocusedSphere = () => {
            const columns = focusedSphereColumns;
            const rows = focusedSphereRows;
            const fontSize = focusedSphereFontSize;
            context.font = `bold ${fontSize}px "DM Mono", monospace`;
            const characterWidth = context.measureText('M').width * 0.76;
            const lineHeight = fontSize * 0.82;
            const spin = focusedRotation(target.name, seconds, reducedMotion) + objectFocus.longitude;
            const latitudeTilt = objectFocus.latitude;
            const sphereWidth = columns * characterWidth;
            const sphereHeight = rows * lineHeight;
            const drawPlanetRings = (foreground: boolean) => {
                if (target.name !== 'Saturn' && target.name !== 'Uranus') return;
                const isUranus = target.name === 'Uranus';
                const ringTilt = isUranus ? 72 * DEG + objectFocus.longitude * 0.12 : objectFocus.longitude * 0.22;
                const bands = isUranus
                    ? [{ x: 0.78, y: 0.12, alpha: 0.58, color: target.color, glyph: '.' }]
                    : [
                          { x: 0.82, y: 0.205, alpha: 0.5, color: '#d79921', glyph: '-' },
                          { x: 0.93, y: 0.238, alpha: 0.72, color: '#fabd2f', glyph: '=' },
                          { x: 1.055, y: 0.274, alpha: 0.48, color: '#bdae93', glyph: '-' },
                          { x: 1.16, y: 0.3, alpha: 0.68, color: '#d79921', glyph: '=' },
                      ];
                for (const band of bands) {
                    for (let sample = 0; sample < 112; sample++) {
                        const angle = (sample / 112) * Math.PI * 2;
                        const inFront = Math.sin(angle) >= 0;
                        if (inFront !== foreground) continue;
                        const ringX = Math.cos(angle) * sphereWidth * band.x;
                        const ringY = Math.sin(angle) * sphereHeight * band.y;
                        const tiltedX = ringX * Math.cos(ringTilt) - ringY * Math.sin(ringTilt);
                        const tiltedY =
                            (ringX * Math.sin(ringTilt) + ringY * Math.cos(ringTilt)) * Math.cos(latitudeTilt * 0.45);
                        context.globalAlpha = objectReveal * band.alpha * (foreground ? 1 : 0.42);
                        context.fillStyle = foreground ? band.color : '#665c54';
                        const glyph = isUranus && sample % 4 === 0 ? '-' : band.glyph;
                        context.fillText(glyph, focusCenterX + tiltedX, focusCenterY + tiltedY);
                    }
                }
            };
            drawPlanetRings(false);
            for (let row = 0; row < rows; row++) {
                const normalizedY = (row + 0.5 - rows / 2) / (rows / 2);
                const lineY = focusCenterY + (row - (rows - 1) / 2) * lineHeight;
                for (let column = 0; column < columns; column++) {
                    const normalizedX = (column + 0.5 - columns / 2) / (columns / 2);
                    if (normalizedX ** 2 + normalizedY ** 2 > 1) continue;
                    const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
                    const latitudeY = normalizedY * Math.cos(latitudeTilt) + sphereZ * Math.sin(latitudeTilt);
                    const latitudeZ = -normalizedY * Math.sin(latitudeTilt) + sphereZ * Math.cos(latitudeTilt);
                    const longitude = Math.atan2(normalizedX, latitudeZ) + spin;
                    const latitude = Math.asin(-latitudeY);
                    const character = planetSurfaceGlyph(target.name, longitude, latitude);
                    context.globalAlpha = objectReveal * (0.62 + sphereZ * 0.38);
                    context.fillStyle =
                        target.name === 'Earth'
                            ? character === '#'
                                ? '#b8bb26'
                                : character === '%'
                                  ? '#d79921'
                                  : character === '*'
                                    ? '#ebdbb2'
                                    : '#83a598'
                            : target.kind === 'star'
                              ? character === '@'
                                  ? '#d65d0e'
                                  : character === '*' || character === '~'
                                    ? '#fe8019'
                                    : character === ':' || character === '.'
                                      ? '#d79921'
                                      : '#fabd2f'
                              : target.name === 'Jupiter' && (character === '@' || character === 'o')
                                ? '#fe8019'
                                : target.name === 'Saturn' && character === 'o'
                                  ? '#d79921'
                                  : target.color;
                    context.fillText(character, focusCenterX + (column + 0.5 - columns / 2) * characterWidth, lineY);
                }
            }
            drawPlanetRings(true);
        };

        const earthSatelliteReveal = target.name === 'Earth' ? smoothstep((planetSceneFocus - 0.28) / 0.45) : 0;
        const focusedEarthRadius = (focusedSphereRows * focusedSphereFontSize * 0.82) / 2;
        const focusedOrbitOffset = (angle: number, radius: number, inclination: number, node: number) => {
            let point: Vec3 = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 };
            point = rotateX(point, inclination);
            point = rotateZ(point, node);
            point = rotateY(point, -objectFocus.longitude);
            return rotateX(point, objectFocus.latitude);
        };
        const focusedMoonRadius =
            width < 600
                ? Math.min(focusedEarthRadius * 1.55, width * 0.42)
                : Math.min(focusedEarthRadius * 1.65, height * 0.38);
        const focusedMoonAngle =
            ((Date.now() - J2000) / 86400000 / 27.321661) * Math.PI * 2 + (reducedMotion ? 0 : seconds * 0.014);
        const focusedMoonOffset = focusedOrbitOffset(focusedMoonAngle, focusedMoonRadius, 50 * DEG, -18 * DEG);
        const focusedIssRadius = focusedEarthRadius * 1.13;
        const focusedIssAngle = 1.2 + (reducedMotion ? 0 : seconds * ((Math.PI * 2) / 70));
        const focusedIssOffset = focusedOrbitOffset(focusedIssAngle, focusedIssRadius, 44 * DEG, 24 * DEG);
        const focusedMoonPosition = { x: focusCenterX + focusedMoonOffset.x, y: focusCenterY + focusedMoonOffset.y };
        const focusedIssPosition = { x: focusCenterX + focusedIssOffset.x, y: focusCenterY + focusedIssOffset.y };
        const hoveredFocusedEarthObject =
            earthSatelliteReveal > 0.35 && pointer.active && !camera.dragging && !objectFocus.child
                ? [
                      { id: 'moon' as const, ...focusedMoonPosition },
                      { id: 'iss' as const, ...focusedIssPosition },
                  ].reduce<{ id: 'moon' | 'iss'; x: number; y: number } | null>((closest, object) => {
                      const distance = Math.hypot(object.x - localPointerX, object.y - localPointerY);
                      const closestDistance = closest
                          ? Math.hypot(closest.x - localPointerX, closest.y - localPointerY)
                          : Infinity;
                      return distance < 30 && distance < closestDistance ? object : closest;
                  }, null)
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
            const drawOrbit = (
                radius: number,
                inclination: number,
                node: number,
                samples: number,
                color: string,
                alpha: number,
            ) => {
                context.font = `${Math.max(5, (width < 600 ? 7 : 8) * focusScale)}px "DM Mono", monospace`;
                context.fillStyle = color;
                for (let sample = 0; sample < samples; sample += 2) {
                    const offset = focusedOrbitOffset((sample / samples) * Math.PI * 2, radius, inclination, node);
                    if (offset.z >= 0 !== foreground) continue;
                    const next = focusedOrbitOffset(((sample + 1) / samples) * Math.PI * 2, radius, inclination, node);
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
                const moonFontSize = Math.max(5, (width < 600 ? 7 : 9) * focusScale);
                context.globalAlpha = earthSatelliteReveal;
                context.fillStyle = '#bdae93';
                context.strokeStyle = '#1d2021';
                context.lineWidth = 2;
                context.font = `bold ${moonFontSize}px "DM Mono", monospace`;
                [' .-. ', '(.:)', " '-' "].forEach((line, index) => {
                    const lineY = focusedMoonPosition.y + (index - 1) * moonFontSize * 0.76;
                    context.strokeText(line, focusedMoonPosition.x, lineY);
                    context.fillText(line, focusedMoonPosition.x, lineY);
                });
                if (showHoverVisuals && hoveredFocusedEarthObject?.id === 'moon') {
                    context.fillStyle = '#ebdbb2';
                    context.fillText('[', focusedMoonPosition.x - 22 * focusScale, focusedMoonPosition.y);
                    context.fillText(']', focusedMoonPosition.x + 22 * focusScale, focusedMoonPosition.y);
                }
            }
            if (focusedIssOffset.z >= 0 === foreground) {
                const issFontSize = Math.max(5, (width < 600 ? 7 : 9) * focusScale);
                context.globalAlpha = earthSatelliteReveal;
                context.fillStyle = '#8ec07c';
                context.strokeStyle = '#1d2021';
                context.lineWidth = 2;
                context.font = `bold ${issFontSize}px "DM Mono", monospace`;
                context.strokeText('=-[ISS]-=', focusedIssPosition.x, focusedIssPosition.y);
                context.fillText('=-[ISS]-=', focusedIssPosition.x, focusedIssPosition.y);
                if (showHoverVisuals && hoveredFocusedEarthObject?.id === 'iss') {
                    context.fillStyle = '#ebdbb2';
                    context.fillText('[', focusedIssPosition.x - 38 * focusScale, focusedIssPosition.y);
                    context.fillText(']', focusedIssPosition.x + 38 * focusScale, focusedIssPosition.y);
                }
            }
            context.globalAlpha = 1;
        };

        const majorMoonSystem = MAJOR_MOON_SYSTEMS[target.name];
        const majorMoonReveal = majorMoonSystem ? smoothstep((planetSceneFocus - 0.26) / 0.48) : 0;
        const focusedParentRadius = (focusedSphereRows * focusedSphereFontSize * 0.82) / 2;
        const focusedMajorMoonOffset = (moon: MajorMoon, angle: number, radius: number) => {
            if (!majorMoonSystem) return { x: 0, y: 0, z: 0 };
            let point: Vec3 = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 };
            point = rotateX(point, moon.inclination);
            point = rotateZ(point, moon.node);
            point = rotateX(point, majorMoonSystem.inclination);
            point = rotateZ(point, majorMoonSystem.node);
            point = rotateY(point, -objectFocus.longitude);
            return rotateX(point, objectFocus.latitude);
        };
        const majorMoons = (majorMoonSystem?.moons ?? []).map((moon) => {
            const orbit = solveMoonOrbit(moon);
            const offset = focusedMajorMoonOffset(
                moon,
                orbit.angle,
                focusedParentRadius * moon.radius * orbit.distance,
            );
            return { ...moon, offset, x: focusCenterX + offset.x, y: focusCenterY + offset.y };
        });
        const hoveredMajorMoon =
            majorMoonReveal > 0.35 && pointer.active && !camera.dragging && !objectFocus.child
                ? majorMoons.reduce<(typeof majorMoons)[number] | null>((closest, moon) => {
                      const distance = Math.hypot(moon.x - localPointerX, moon.y - localPointerY);
                      const closestDistance = closest
                          ? Math.hypot(closest.x - localPointerX, closest.y - localPointerY)
                          : Infinity;
                      return distance < 26 && distance < closestDistance ? moon : closest;
                  }, null)
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
            for (const moon of majorMoons) {
                context.font = `${Math.max(5, (width < 600 ? 6.5 : 8) * focusScale)}px "DM Mono", monospace`;
                context.fillStyle = '#665c54';
                for (let sample = 0; sample < 96; sample += 2) {
                    const sampledOrbit = solveKeplerOrbit((sample / 96) * Math.PI * 2, moon.eccentricity);
                    const sampledAngle = sampledOrbit.angle + moon.periapsis * DEG;
                    const offset = focusedMajorMoonOffset(
                        moon,
                        sampledAngle,
                        focusedParentRadius * moon.radius * sampledOrbit.distance,
                    );
                    if (offset.z >= 0 !== foreground) continue;
                    const nextOrbit = solveKeplerOrbit(((sample + 1) / 96) * Math.PI * 2, moon.eccentricity);
                    const nextAngle = nextOrbit.angle + moon.periapsis * DEG;
                    const next = focusedMajorMoonOffset(
                        moon,
                        nextAngle,
                        focusedParentRadius * moon.radius * nextOrbit.distance,
                    );
                    const dx = next.x - offset.x;
                    const dy = next.y - offset.y;
                    const slope = Math.abs(dy / (dx || 0.001));
                    const glyph = slope > 2.2 ? '|' : slope > 0.6 ? (dx * dy > 0 ? '\\' : '/') : '-';
                    context.globalAlpha = majorMoonReveal * 0.5;
                    context.fillText(glyph, focusCenterX + offset.x, focusCenterY + offset.y);
                }
                if (moon.offset.z >= 0 !== foreground) continue;
                context.globalAlpha = majorMoonReveal;
                context.fillStyle = moon.color;
                context.strokeStyle = '#1d2021';
                context.lineWidth = 2;
                context.font = `bold ${Math.max(7, (moon.name === 'Ganymede' || moon.name === 'Titan' ? 12 : 9) * focusScale)}px "DM Mono", monospace`;
                context.strokeText(moon.glyph, moon.x, moon.y);
                context.fillText(moon.glyph, moon.x, moon.y);
                if (showHoverVisuals && moon === hoveredMajorMoon) {
                    const bracketOffset = Math.max(
                        11,
                        (moon.name === 'Ganymede' || moon.name === 'Titan' ? 17 : 13) * focusScale,
                    );
                    context.fillStyle = '#ebdbb2';
                    context.font = `bold ${Math.max(8, 10 * focusScale)}px "DM Mono", monospace`;
                    context.fillText('[', moon.x - bracketOffset, moon.y);
                    context.fillText(']', moon.x + bracketOffset, moon.y);
                }
            }
            context.globalAlpha = 1;
        };

        if (target.kind === 'star' || target.kind === 'planet' || target.kind === 'moon') {
            drawFocusField(
                width < 600 ? 145 : 225,
                target.kind === 'star'
                    ? 12
                    : target.name === 'Earth'
                      ? 28
                      : target.name === 'Jupiter' || target.name === 'Saturn'
                        ? 18
                        : 24,
                ['.', ':'],
            );
            if (target.name === 'Earth') drawFocusedEarthSatellites(false);
            drawFocusedMajorMoons(false);
            drawFocusedSphere();
            if (target.name === 'Earth') drawFocusedEarthSatellites(true);
            drawFocusedMajorMoons(true);
        } else {
            drawFocusField(
                width < 600 ? 145 : 235,
                target.kind === 'galactic' ? 32 : 62,
                target.kind === 'galactic' ? ['.', ':', '*'] : ['.', '-'],
            );
            const renderedGalacticObject =
                target.kind === 'galactic' &&
                drawFocusedGalacticObject(context, {
                    name: target.name,
                    x: focusCenterX,
                    y: focusCenterY,
                    scale: focusScale,
                    opacity: objectReveal,
                    seconds,
                    longitude: objectFocus.longitude,
                    latitude: objectFocus.latitude,
                    reducedMotion,
                    compact: width < 600,
                });
            if (!renderedGalacticObject) {
                const lines = FOCUSED_ART[target.name] ?? [target.name];
                const artFontSize = (width < 600 ? 14 : 22) * focusScale;
                context.font = `bold ${artFontSize}px "DM Mono", monospace`;
                context.fillStyle = target.color;
                context.globalAlpha = objectReveal;
                lines.forEach((line, index) => {
                    const parallax = Math.sin(objectFocus.longitude + index * 0.7) * artFontSize * 0.55;
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
                    '[ click to zoom ]',
                ],
                anchorX: hoveredMajorMoon.x,
                anchorY: hoveredMajorMoon.y,
                viewportWidth: width,
                viewportHeight: height,
                titleColor: hoveredMajorMoon.color,
                width: 224,
                openAwayFromCenter: true,
                opacity: majorMoonReveal,
            });
        }

        if (showHoverVisuals && hoveredFocusedEarthObject) {
            const isMoon = hoveredFocusedEarthObject.id === 'moon';
            drawReadout(context, {
                lines: isMoon
                    ? ['[ MOON ]', 'natural satellite', 'mean r  384,400 km', 'sidereal 27.3 days', '[ click to zoom ]']
                    : ['[ ISS ]', 'orbital laboratory', 'alt     ~400 km', 'period  ~90 min', '[ click to zoom ]'],
                anchorX: hoveredFocusedEarthObject.x,
                anchorY: hoveredFocusedEarthObject.y,
                viewportWidth: width,
                viewportHeight: height,
                titleColor: isMoon ? '#bdae93' : '#8ec07c',
                width: 218,
                openAwayFromCenter: true,
                opacity: earthSatelliteReveal,
            });
        }

        const infoY = Math.min(height - 72, focusCenterY + (width < 600 ? 150 : 205) * focusScale);
        const infoReveal = isLocalDestination ? smoothstep((planetSceneFocus - 0.45) / 0.4) : focusEase;
        context.globalAlpha = infoReveal;
        context.fillStyle = target.color;
        context.font = `bold ${width < 600 ? 11 : 13}px "DM Mono", monospace`;
        context.fillText(`[ ${target.name.toUpperCase()} ]`, viewportCenterX, infoY);
        context.fillStyle = '#a89984';
        context.font = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
        context.fillText(`${target.subtitle} · ${target.detail}`, viewportCenterX, infoY + 21);
        context.fillText('drag to inspect · double-click to reset orientation', viewportCenterX, infoY + 42);

        if (objectFocus.child && objectFocus.childProgress > 0.001) {
            const child = objectFocus.child;
            const childVisualProgress = objectFocus.childExiting
                ? Math.max(0, (objectFocus.childProgress - 0.06) / 0.94)
                : objectFocus.childProgress;
            const childEase = smoothstep(childVisualProgress);
            const childGrowth = smoothstep((childEase - 0.08) / 0.92) ** 1.45;
            const childScale = 0.1 + childGrowth * 0.9;
            const childReveal = smoothstep((childEase - 0.06) / 0.3);
            const childCenterX = child.originX + (viewportCenterX - child.originX) * childEase;
            const childCenterY = child.originY + (viewportCenterY - child.originY) * childEase;
            context.globalAlpha = childEase;
            context.fillStyle = '#1d2021';
            context.fillRect(0, 0, width, height);

            const childFieldCount = child.kind === 'station' ? 34 : 58;
            context.font = `${Math.max(5, (width < 600 ? 7 : 9) * childScale)}px "DM Mono", monospace`;
            for (let index = 0; index < childFieldCount; index++) {
                const angle = (index / childFieldCount) * Math.PI * 2 + objectFocus.childLongitude;
                const radius = (width < 600 ? 155 : 245) * (0.48 + randomUnit(index + 2101) * 0.55) * childScale;
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
                        longitude: objectFocus.childLongitude,
                        latitude: objectFocus.childLatitude,
                        seconds,
                        reducedMotion,
                        compact: width < 600,
                    });
                } else {
                    const columns = width < 600 ? 37 : 49;
                    const rows = width < 600 ? 19 : 25;
                    const fontSize = (width < 600 ? 10 : 12.5) * childScale;
                    context.font = `bold ${fontSize}px "DM Mono", monospace`;
                    const characterWidth = context.measureText('M').width * 0.76;
                    const lineHeight = fontSize * 0.82;
                    const spin = focusedRotation(child.name, seconds, reducedMotion) + objectFocus.childLongitude;
                    for (let row = 0; row < rows; row++) {
                        const normalizedY = (row + 0.5 - rows / 2) / (rows / 2);
                        const lineY = childCenterY + (row - (rows - 1) / 2) * lineHeight;
                        for (let column = 0; column < columns; column++) {
                            const normalizedX = (column + 0.5 - columns / 2) / (columns / 2);
                            if (normalizedX ** 2 + normalizedY ** 2 > 1) continue;
                            const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
                            const latitudeY =
                                normalizedY * Math.cos(objectFocus.childLatitude) +
                                sphereZ * Math.sin(objectFocus.childLatitude);
                            const latitudeZ =
                                -normalizedY * Math.sin(objectFocus.childLatitude) +
                                sphereZ * Math.cos(objectFocus.childLatitude);
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
                    longitude: objectFocus.childLongitude,
                    latitude: objectFocus.childLatitude,
                    compact: width < 600,
                });
            }

            const childInfoY = Math.min(height - 72, childCenterY + (width < 600 ? 150 : 205) * childScale);
            const childInfoReveal = smoothstep((childEase - 0.45) / 0.4);
            context.globalAlpha = childInfoReveal;
            context.fillStyle = child.color;
            context.font = `bold ${width < 600 ? 11 : 13}px "DM Mono", monospace`;
            context.fillText(`[ ${child.name.toUpperCase()} ]`, viewportCenterX, childInfoY);
            context.fillStyle = '#a89984';
            context.font = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
            context.fillText(`${child.subtitle} · ${child.detail}`, viewportCenterX, childInfoY + 21);
            context.fillText('drag to inspect · double-click to reset orientation', viewportCenterX, childInfoY + 42);
        }
        context.globalAlpha = 1;
    }

    return activeFocusCandidate;
};
