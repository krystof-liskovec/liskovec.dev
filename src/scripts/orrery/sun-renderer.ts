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

const SURFACE = [
  '    .---.    ',
  "  .'~~~~~'.  ",
  ' /~:*:::*:~\\ ',
  '/:*:o:*:o:*:\\',
  '|:*:o(@)o:*:|',
  '\\:*:o:*:o:*:/' ,
  ' \\~:*:::*:~/ ',
  "  '.~~~~~.'  ",
  "    '---'    ",
];

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
  SURFACE.forEach((line, index) => {
    context.globalAlpha = opacity * (.94 + Math.sin(seconds * 1.1 + index * 1.7) * (reducedMotion ? 0 : .025));
    context.fillStyle = index === 3 ? '#fe8019' : '#fabd2f';
    context.fillText(line, 0, (index - 4) * lineHeight);
  });

  context.restore();
}
