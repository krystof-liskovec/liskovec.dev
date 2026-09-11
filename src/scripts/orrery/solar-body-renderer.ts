import { DEG, smoothstep } from './math';
import { decorativeRotation, planetSurfaceColor, planetSurfaceGlyph, planetSurfaceLight } from './planet-textures';
import type { Planet, ProjectedBody } from './types';

export const COMPACT_PLANET_GRIDS: Record<
    string,
    { columns: number; rows: number; rowWidths: number[]; fontScale: number }
> = {
    Mercury: { columns: 9, rows: 5, rowWidths: [5, 7, 9, 7, 5], fontScale: 0.62 },
    Venus: { columns: 9, rows: 5, rowWidths: [5, 7, 9, 7, 5], fontScale: 0.62 },
    Earth: { columns: 9, rows: 5, rowWidths: [5, 7, 9, 7, 5], fontScale: 0.62 },
    Mars: { columns: 9, rows: 5, rowWidths: [5, 7, 9, 7, 5], fontScale: 0.62 },
    Jupiter: { columns: 11, rows: 7, rowWidths: [5, 9, 11, 11, 11, 9, 5], fontScale: 0.78 },
    Saturn: { columns: 9, rows: 7, rowWidths: [3, 7, 9, 9, 9, 7, 3], fontScale: 0.82 },
    Uranus: { columns: 9, rows: 5, rowWidths: [5, 7, 9, 7, 5], fontScale: 0.86 },
    Neptune: { columns: 9, rows: 5, rowWidths: [5, 7, 9, 7, 5], fontScale: 0.86 },
};

const DETAILED_NEIGHBOR_GRIDS: Record<
    string,
    { columns: number; rows: number; rowWidths: number[]; fontScale: number }
> = {
    Mercury: { columns: 25, rows: 13, rowWidths: [9, 15, 19, 21, 23, 25, 25, 25, 23, 21, 19, 15, 9], fontScale: 0.223 },
    Venus: { columns: 25, rows: 13, rowWidths: [9, 15, 19, 21, 23, 25, 25, 25, 23, 21, 19, 15, 9], fontScale: 0.223 },
    Earth: { columns: 25, rows: 13, rowWidths: [9, 15, 19, 21, 23, 25, 25, 25, 23, 21, 19, 15, 9], fontScale: 0.223 },
    Mars: { columns: 25, rows: 13, rowWidths: [9, 15, 19, 21, 23, 25, 25, 25, 23, 21, 19, 15, 9], fontScale: 0.223 },
    Jupiter: {
        columns: 29,
        rows: 15,
        rowWidths: [9, 15, 19, 23, 25, 27, 29, 29, 29, 27, 25, 23, 19, 15, 9],
        fontScale: 0.296,
    },
    Saturn: {
        columns: 25,
        rows: 13,
        rowWidths: [9, 15, 19, 21, 23, 25, 25, 25, 23, 21, 19, 15, 9],
        fontScale: 0.295,
    },
    Uranus: { columns: 25, rows: 13, rowWidths: [9, 15, 19, 21, 23, 25, 25, 25, 23, 21, 19, 15, 9], fontScale: 0.31 },
    Neptune: { columns: 25, rows: 13, rowWidths: [9, 15, 19, 21, 23, 25, 25, 25, 23, 21, 19, 15, 9], fontScale: 0.31 },
};

const INNER_PLANETS = new Set(['Mercury', 'Venus', 'Earth', 'Mars']);

export const solarBodyViewportScale = (planetName: string, viewportGlyphScale: number, innerPlanetScale: number) =>
    viewportGlyphScale * (INNER_PLANETS.has(planetName) ? innerPlanetScale : 1);

type SolarBodyOptions = {
    focusedPlanet: Planet | null;
    seconds: number;
    reducedMotion: boolean;
    solarSystemScale: number;
    viewportGlyphScale: number;
    innerPlanetScale: number;
    apparentBodyScale: number;
    detailAppearanceReveal: number;
    lodOpacity?: number;
    localDetailOpacity: number;
    planetSceneFocus: number;
    isHovered: boolean;
    planetRotationOffset: number;
    planetTiltOffset: number;
    planetYawOffset: number;
};

export const drawSolarBody = (context: CanvasRenderingContext2D, body: ProjectedBody, options: SolarBodyOptions) => {
    const {
        focusedPlanet,
        seconds,
        reducedMotion,
        solarSystemScale,
        viewportGlyphScale,
        innerPlanetScale,
        apparentBodyScale,
        detailAppearanceReveal,
        localDetailOpacity,
        planetSceneFocus,
        planetRotationOffset,
        planetTiltOffset,
        planetYawOffset,
    } = options;
    if (detailAppearanceReveal > 0 && detailAppearanceReveal < 1) {
        const lodOpacity = options.lodOpacity ?? 1;
        drawSolarBody(context, body, {
            ...options,
            detailAppearanceReveal: 0,
            lodOpacity: lodOpacity * (1 - detailAppearanceReveal),
            isHovered: options.isHovered && detailAppearanceReveal < 0.5,
        });
        drawSolarBody(context, body, {
            ...options,
            detailAppearanceReveal: 1,
            lodOpacity: lodOpacity * detailAppearanceReveal,
            isHovered: options.isHovered && detailAppearanceReveal >= 0.5,
        });
        return;
    }
    const detailedAppearance = detailAppearanceReveal >= 1;
    const { planet } = body;
    const isFocusedPlanet = focusedPlanet === planet;
    const perspectiveScale = Math.max(0.68, Math.min(1.55, body.scale));
    const depthScale = 0.75 + perspectiveScale * 0.25;
    const isHovered = options.isHovered;
    const cosmicGlyphScale =
        Math.max(0.3, Math.sqrt(solarSystemScale)) *
        solarBodyViewportScale(planet.name, viewportGlyphScale, innerPlanetScale);
    const fontSize =
        (planet.easterEgg ? 16 : Math.max(6.2, 12.5 * planet.size * depthScale) * (isHovered ? 1.14 : 1)) *
        cosmicGlyphScale;
    const lines = planet.easterEgg || (fontSize < 9 && solarSystemScale < 0.45) ? [planet.glyph] : planet.sprite;
    const compactGrid =
        solarSystemScale >= 0.45 && !planet.easterEgg
            ? detailedAppearance
                ? DETAILED_NEIGHBOR_GRIDS[planet.name]
                : COMPACT_PLANET_GRIDS[planet.name]
            : null;
    const hasCompactSphereRows = planet.name === 'Jupiter' || planet.name === 'Uranus' || planet.name === 'Neptune';
    const lineHeight = fontSize * (hasCompactSphereRows ? 0.68 : 0.78);
    const surroundingBodyReveal = 1 - planetSceneFocus * 0.68;
    const lodBodyReveal = detailedAppearance ? 1 : surroundingBodyReveal;
    const bodyOpacity =
        body.reveal * localDetailOpacity * (isFocusedPlanet ? 1 : lodBodyReveal) * (options.lodOpacity ?? 1);
    const focusedDetailReveal = isFocusedPlanet ? smoothstep((planetSceneFocus - 0.08) / 0.28) : 0;
    const focusedSpriteScale = isFocusedPlanet ? 1 + planetSceneFocus * 2 : apparentBodyScale;
    context.fillStyle = planet.color;
    context.shadowBlur = 0;
    context.strokeStyle = '#1d2021';
    context.lineJoin = 'round';
    context.globalAlpha = bodyOpacity * (1 - focusedDetailReveal);
    let spriteWidth = 0;

    if (compactGrid) {
        const compactFontSize = fontSize * compactGrid.fontScale * focusedSpriteScale;
        // The high-resolution neighbour uses the same cell proportions as the
        // full focused sphere. The overview grid stays vertically compressed.
        const compactLineHeight = compactFontSize * (detailedAppearance ? 0.82 : 0.72);
        context.font = `bold ${compactFontSize}px "DM Mono", monospace`;
        const characterWidth = context.measureText('M').width * 0.76;
        const sphereWidth = compactGrid.columns * characterWidth;
        const sphereHeight = compactGrid.rows * compactLineHeight;
        const spin = decorativeRotation(planet.name, seconds, reducedMotion) + planetRotationOffset;
        const tiltCosine = Math.cos(planetTiltOffset);
        const tiltSine = Math.sin(planetTiltOffset);
        const yawCosine = Math.cos(planetYawOffset);
        const yawSine = Math.sin(planetYawOffset);
        spriteWidth = sphereWidth;

        const drawCompactRings = (foreground: boolean) => {
            if (planet.name !== 'Saturn' && planet.name !== 'Uranus') return;
            const isUranus = planet.name === 'Uranus';
            // The ring plane is attached to the planet, so it needs the same
            // camera orientation offsets as the surface texture. Keeping the
            // ring as a 3D ellipse also lets pitch change its apparent opening
            // instead of leaving it as a flat screen-space decoration.
            const ringBaseRotation = (isUranus ? 68 : -8) * DEG;
            const ringBaseRotationCosine = Math.cos(ringBaseRotation);
            const ringBaseRotationSine = Math.sin(ringBaseRotation);
            const defaultCameraPitch = 58 * DEG;
            const currentCameraPitch = defaultCameraPitch + planetTiltOffset;
            const defaultCameraPitchCosine = Math.cos(defaultCameraPitch);
            const defaultCameraPitchSine = Math.sin(defaultCameraPitch);
            const currentCameraPitchCosine = Math.cos(currentCameraPitch);
            const currentCameraPitchSine = Math.sin(currentCameraPitch);
            const systemRotationCosine = Math.cos(planetRotationOffset);
            const systemRotationSine = Math.sin(planetRotationOffset);
            const systemYawCosine = Math.cos(planetYawOffset);
            const systemYawSine = Math.sin(planetYawOffset);
            const bands = isUranus
                ? [{ x: 0.74, y: 0.12, glyph: '-', color: '#83a598', alpha: 0.72 }]
                : [
                      { x: 0.69, y: 0.105, glyph: '-', color: '#b0aa9b', alpha: 0.5 },
                      { x: 0.79, y: 0.14, glyph: '=', color: '#e5e0d3', alpha: 0.78 },
                      { x: 0.88, y: 0.175, glyph: '-', color: '#cec8ba', alpha: 0.58 },
                  ];
            const ringSamples = detailedAppearance ? 96 : 48;
            for (const band of bands) {
                const ringRadius = sphereWidth * band.x;
                const ringOpening = Math.min(0.95, (sphereHeight * band.y) / ringRadius);
                const ringDepthScale = Math.sqrt(1 - ringOpening ** 2);
                for (let sample = 0; sample < ringSamples; sample += 2) {
                    const angle = (sample / ringSamples) * Math.PI * 2;
                    const ringDepth = Math.sin(angle) * ringRadius * ringDepthScale;
                    const ringMajor = Math.cos(angle) * ringRadius;
                    const ringMinor = Math.sin(angle) * ringRadius * ringOpening;
                    // Start in the camera-relative pose used by the original
                    // ring art, then apply the same roll → pitch → yaw order
                    // as the system projection. Undoing the default pitch
                    // makes the transform continuous at the neutral camera.
                    const baseRingX = ringMajor * ringBaseRotationCosine - ringMinor * ringBaseRotationSine;
                    const baseRingY = ringMajor * ringBaseRotationSine + ringMinor * ringBaseRotationCosine;
                    const unpitchedY = baseRingY * defaultCameraPitchCosine + ringDepth * defaultCameraPitchSine;
                    const unpitchedZ = -baseRingY * defaultCameraPitchSine + ringDepth * defaultCameraPitchCosine;
                    const rolledX = baseRingX * systemRotationCosine - unpitchedY * systemRotationSine;
                    const rolledY = baseRingX * systemRotationSine + unpitchedY * systemRotationCosine;
                    const rolledZ = unpitchedZ;
                    const pitchedY = rolledY * currentCameraPitchCosine - rolledZ * currentCameraPitchSine;
                    const pitchedZ = rolledY * currentCameraPitchSine + rolledZ * currentCameraPitchCosine;
                    const tiltedZ = -rolledX * systemYawSine + pitchedZ * systemYawCosine;
                    if (tiltedZ >= 0 !== foreground) continue;
                    const rotatedX = rolledX * systemYawCosine + pitchedZ * systemYawSine;
                    const rotatedY = pitchedY;
                    if (!foreground && (rotatedX / (sphereWidth / 2)) ** 2 + (rotatedY / (sphereHeight / 2)) ** 2 < 1)
                        continue;
                    context.globalAlpha =
                        bodyOpacity * (1 - focusedDetailReveal) * band.alpha * (0.86 + (tiltedZ / ringRadius) * 0.14);
                    context.fillStyle = band.color;
                    context.fillText(band.glyph, body.x + rotatedX, body.y + rotatedY);
                }
            }
        };

        drawCompactRings(false);
        context.lineWidth = Math.max(1.25, compactFontSize * 0.16);
        for (let row = 0; row < compactGrid.rows; row++) {
            const normalizedY = (row - (compactGrid.rows - 1) / 2) / (compactGrid.rows / 2);
            const cellY = body.y + (row - (compactGrid.rows - 1) / 2) * compactLineHeight;
            const rowWidth = compactGrid.rowWidths[row];
            const firstColumn = (compactGrid.columns - rowWidth) / 2;
            for (let rowColumn = 0; rowColumn < rowWidth; rowColumn++) {
                const column = firstColumn + rowColumn;
                const normalizedX = (column - (compactGrid.columns - 1) / 2) / (compactGrid.columns / 2);
                const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
                const surfaceY = -normalizedY;
                const tiltedY = surfaceY * tiltCosine + sphereZ * tiltSine;
                const tiltedZ = -surfaceY * tiltSine + sphereZ * tiltCosine;
                const yawedX = normalizedX * yawCosine - tiltedZ * yawSine;
                const yawedZ = normalizedX * yawSine + tiltedZ * yawCosine;
                const longitude = Math.atan2(yawedX, yawedZ) + spin;
                const latitude = Math.asin(Math.max(-1, Math.min(1, tiltedY)));
                const isFirst = rowColumn === 0;
                const isLast = rowColumn === rowWidth - 1;
                const isTop = row === 0;
                const isBottom = row === compactGrid.rows - 1;
                const isContour = isFirst || isLast || isTop || isBottom;
                const glyph = isTop
                    ? isFirst
                        ? '.'
                        : isLast
                          ? '.'
                          : '-'
                    : isBottom
                      ? isFirst
                          ? "'"
                          : isLast
                            ? "'"
                            : '-'
                      : isFirst
                        ? row < (compactGrid.rows - 1) / 2
                            ? '/'
                            : row > (compactGrid.rows - 1) / 2
                              ? '\\'
                              : '|'
                        : isLast
                          ? row < (compactGrid.rows - 1) / 2
                              ? '\\'
                              : row > (compactGrid.rows - 1) / 2
                                ? '/'
                                : '|'
                          : planetSurfaceGlyph(planet.name, longitude, latitude);
                const cellX = body.x + (column - (compactGrid.columns - 1) / 2) * characterWidth;
                context.globalAlpha =
                    bodyOpacity *
                    (1 - focusedDetailReveal) *
                    (0.22 + planetSurfaceLight(normalizedX, normalizedY, sphereZ) * 0.78);
                context.fillStyle = isContour ? planet.color : planetSurfaceColor(planet.name, glyph, planet.color);
                context.strokeText(glyph, cellX, cellY);
                context.fillText(glyph, cellX, cellY);
            }
        }
        drawCompactRings(true);
    } else {
        context.font = `bold ${fontSize * focusedSpriteScale}px "DM Mono", monospace`;
        context.lineWidth = Math.max(2, fontSize * 0.2);
        lines.forEach((line, index) => {
            const lineY = body.y + (index - (lines.length - 1) / 2) * lineHeight * focusedSpriteScale;
            if (!planet.easterEgg) context.strokeText(line, body.x, lineY);
            context.fillText(line, body.x, lineY);
        });
        for (const line of lines) spriteWidth = Math.max(spriteWidth, context.measureText(line).width);
    }
    if (isHovered) {
        context.fillStyle = '#ebdbb2';
        context.font = `bold ${Math.max(9, fontSize * 0.72)}px "DM Mono", monospace`;
        const ringExpansion =
            planet.name === 'Saturn'
                ? spriteWidth * 0.88
                : planet.name === 'Uranus'
                  ? spriteWidth * 0.74
                  : spriteWidth / 2;
        context.fillText('[', body.x - ringExpansion - 7, body.y);
        context.fillText(']', body.x + ringExpansion + 7, body.y);
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1;
};
