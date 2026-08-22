import { focusedRotation, planetSurfaceGlyph } from './planet-textures';

type SunRenderOptions = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  seconds: number;
  reducedMotion: boolean;
};

const CORONA_RAYS = [
  { x: 0, y: -4.45, glyph: '|' },
  { x: 3.7, y: -3.55, glyph: '/' },
  { x: 5.25, y: 0, glyph: '--' },
  { x: 3.7, y: 3.55, glyph: '\\' },
  { x: 0, y: 4.45, glyph: '|' },
  { x: -3.7, y: 3.55, glyph: '/' },
  { x: -5.25, y: 0, glyph: '--' },
  { x: -3.7, y: -3.55, glyph: '\\' },
];

const SURFACE_COLUMNS = 17;
const SURFACE_ROW_WIDTHS = [7, 13, 15, 17, 17, 17, 15, 13, 7];

export function drawSun(context: CanvasRenderingContext2D, options: SunRenderOptions) {
  const { x, y, scale, opacity, seconds, reducedMotion } = options;
  if (opacity <= .001) return;

  const pulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 1.35) * .018;
  const fontSize = 8.9 * pulse * Math.max(.3, Math.sqrt(scale));
  const lineHeight = fontSize * .78;
  const shimmer = reducedMotion ? 0 : Math.sin(seconds * 1.8) * .025;

  context.save();
  context.translate(x, y);
  // Monospace character cells are wider than this line spacing. Compressing
  // the x-axis keeps equal ASCII row/column radii visually circular.
  context.scale(.9, 1);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `bold ${fontSize}px "DM Mono", monospace`;

  context.fillStyle = '#d79921';
  context.shadowColor = '#fabd2f';
  context.shadowBlur = 2;
  CORONA_RAYS.forEach((ray, index) => {
    const flicker = reducedMotion ? 0 : Math.sin(seconds * 1.45 + index * 1.9) * .05;
    context.globalAlpha = opacity * (.56 + shimmer + flicker);
    context.fillText(ray.glyph, ray.x * fontSize, ray.y * fontSize);
  });

  context.shadowBlur = 0;
  context.strokeStyle = '#1d2021';
  context.lineWidth = Math.max(1.2, fontSize * .15);
  const characterWidth = context.measureText('M').width * .76;
  const spin = focusedRotation('Sol', seconds, reducedMotion);
  const middleRow = (SURFACE_ROW_WIDTHS.length - 1) / 2;

  SURFACE_ROW_WIDTHS.forEach((rowWidth, row) => {
    const normalizedY = (row - middleRow) / (SURFACE_ROW_WIDTHS.length / 2);
    const firstColumn = (SURFACE_COLUMNS - rowWidth) / 2;
    const cellY = (row - middleRow) * lineHeight;
    for (let rowColumn = 0; rowColumn < rowWidth; rowColumn++) {
      const column = firstColumn + rowColumn;
      const normalizedX = (column - (SURFACE_COLUMNS - 1) / 2) / (SURFACE_COLUMNS / 2);
      const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
      const longitude = Math.atan2(normalizedX, sphereZ) + spin;
      const latitude = Math.asin(-normalizedY);
      const isFirst = rowColumn === 0;
      const isLast = rowColumn === rowWidth - 1;
      const isTop = row === 0;
      const isBottom = row === SURFACE_ROW_WIDTHS.length - 1;
      const isContour = isFirst || isLast || isTop || isBottom;
      const glyph = isTop
        ? isFirst ? '.' : isLast ? '.' : '-'
        : isBottom
          ? isFirst ? "'" : isLast ? "'" : '-'
          : isFirst
            ? row < middleRow ? '/' : row > middleRow ? '\\' : '|'
            : isLast
              ? row < middleRow ? '\\' : row > middleRow ? '/' : '|'
              : planetSurfaceGlyph('Sol', longitude, latitude);
      const cellX = (column - (SURFACE_COLUMNS - 1) / 2) * characterWidth;
      context.globalAlpha = opacity * (.72 + sphereZ * .26 + Math.sin(seconds * 1.1 + row * 1.7) * (reducedMotion ? 0 : .02));
      context.fillStyle = isContour
        ? '#fabd2f'
        : glyph === '@' ? '#d65d0e'
          : glyph === '*' || glyph === '~' ? '#fe8019'
            : glyph === ':' || glyph === '.' ? '#d79921' : '#fabd2f';
      context.strokeText(glyph, cellX, cellY);
      context.fillText(glyph, cellX, cellY);
    }
  });

  context.restore();
}
