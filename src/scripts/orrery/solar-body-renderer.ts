import { DEG, smoothstep } from './math';
import { focusedRotation, planetSurfaceGlyph } from './planet-textures';
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

const compactSurfaceColor = (planet: Planet, glyph: string) => {
    if (planet.name === 'Earth') {
        return glyph === '#' ? '#b8bb26' : glyph === '%' ? '#d79921' : glyph === '*' ? '#ebdbb2' : '#83a598';
    }
    if (planet.name === 'Jupiter' && (glyph === '@' || glyph === 'o')) return '#fe8019';
    if (planet.name === 'Saturn' && glyph === 'o') return '#d79921';
    if (planet.name === 'Mars' && glyph === '*') return '#ebdbb2';
    if (planet.name === 'Venus' && glyph === '=') return '#fabd2f';
    if (planet.name === 'Neptune' && (glyph === 'O' || glyph === 'o')) return '#83a598';
    return planet.color;
};

type SolarBodyOptions = {
    focusedPlanet: Planet | null;
    seconds: number;
    reducedMotion: boolean;
    solarSystemScale: number;
    viewportGlyphScale: number;
    localDetailOpacity: number;
    planetSceneFocus: number;
    isHovered: boolean;
};

export const drawSolarBody = (context: CanvasRenderingContext2D, body: ProjectedBody, options: SolarBodyOptions) => {
    const {
        focusedPlanet,
        seconds,
        reducedMotion,
        solarSystemScale,
        viewportGlyphScale,
        localDetailOpacity,
        planetSceneFocus,
    } = options;
    const { planet } = body;
    const isFocusedPlanet = focusedPlanet === planet;
    const perspectiveScale = Math.max(0.68, Math.min(1.55, body.scale));
    const depthScale = 0.75 + perspectiveScale * 0.25;
    const isHovered = options.isHovered;
    const cosmicGlyphScale = Math.max(0.3, Math.sqrt(solarSystemScale)) * viewportGlyphScale;
    const fontSize =
        (planet.easterEgg ? 16 : Math.max(6.2, 12.5 * planet.size * depthScale) * (isHovered ? 1.14 : 1)) *
        cosmicGlyphScale;
    const lines = planet.easterEgg || (fontSize < 9 && solarSystemScale < 0.45) ? [planet.glyph] : planet.sprite;
    const compactGrid = solarSystemScale >= 0.45 && !planet.easterEgg ? COMPACT_PLANET_GRIDS[planet.name] : null;
    const hasCompactSphereRows = planet.name === 'Jupiter' || planet.name === 'Uranus' || planet.name === 'Neptune';
    const lineHeight = fontSize * (hasCompactSphereRows ? 0.68 : 0.78);
    const bodyOpacity = body.reveal * localDetailOpacity * (isFocusedPlanet ? 1 : 1 - planetSceneFocus);
    const focusedDetailReveal = isFocusedPlanet ? smoothstep((planetSceneFocus - 0.08) / 0.28) : 0;
    const focusedSpriteScale = isFocusedPlanet ? 1 + planetSceneFocus * 2 : 1;
    context.fillStyle = planet.color;
    context.shadowBlur = 0;
    context.strokeStyle = '#1d2021';
    context.lineJoin = 'round';
    context.globalAlpha = bodyOpacity * (1 - focusedDetailReveal);
    let spriteWidth = 0;

    if (compactGrid) {
        const compactFontSize = fontSize * compactGrid.fontScale * focusedSpriteScale;
        const compactLineHeight = compactFontSize * 0.72;
        context.font = `bold ${compactFontSize}px "DM Mono", monospace`;
        const characterWidth = context.measureText('M').width * 0.76;
        const sphereWidth = compactGrid.columns * characterWidth;
        const sphereHeight = compactGrid.rows * compactLineHeight;
        const spin = focusedRotation(planet.name, seconds, reducedMotion);
        spriteWidth = sphereWidth;

        const drawCompactRings = (foreground: boolean) => {
            if (planet.name !== 'Saturn' && planet.name !== 'Uranus') return;
            const isUranus = planet.name === 'Uranus';
            const tilt = isUranus ? 68 * DEG : -8 * DEG;
            const bands = isUranus
                ? [{ x: 0.74, y: 0.12, glyph: '-', color: '#83a598', alpha: 0.72 }]
                : [
                      { x: 0.69, y: 0.105, glyph: '-', color: '#bdae93', alpha: 0.5 },
                      { x: 0.79, y: 0.14, glyph: '=', color: '#fabd2f', alpha: 0.78 },
                      { x: 0.88, y: 0.175, glyph: '-', color: '#d79921', alpha: 0.58 },
                  ];
            for (const band of bands) {
                for (let sample = 0; sample < 48; sample += 2) {
                    const angle = (sample / 48) * Math.PI * 2;
                    if (Math.sin(angle) >= 0 !== foreground) continue;
                    const ringX = Math.cos(angle) * sphereWidth * band.x;
                    const ringY = Math.sin(angle) * sphereHeight * band.y;
                    const tiltedX = ringX * Math.cos(tilt) - ringY * Math.sin(tilt);
                    const tiltedY = ringX * Math.sin(tilt) + ringY * Math.cos(tilt);
                    context.globalAlpha =
                        bodyOpacity * (1 - focusedDetailReveal) * band.alpha * (foreground ? 1 : 0.48);
                    context.fillStyle = foreground ? band.color : '#665c54';
                    context.fillText(band.glyph, body.x + tiltedX, body.y + tiltedY);
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
                const longitude = Math.atan2(normalizedX, sphereZ) + spin;
                const latitude = Math.asin(-normalizedY);
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
                context.globalAlpha = bodyOpacity * (1 - focusedDetailReveal) * (0.66 + sphereZ * 0.34);
                context.fillStyle = isContour ? planet.color : compactSurfaceColor(planet, glyph);
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
