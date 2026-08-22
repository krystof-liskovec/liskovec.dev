import { randomUnit } from './math';

type GalacticRenderOptions = {
  name: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  seconds: number;
  longitude: number;
  latitude: number;
  reducedMotion: boolean;
  compact: boolean;
};

type GlyphPoint = { x: number; y: number; glyph: string; color: string; alpha: number; size?: number };

const paintPoints = (context: CanvasRenderingContext2D, points: GlyphPoint[], baseSize: number, opacity: number) => {
  for (const point of points) {
    context.globalAlpha = opacity * point.alpha;
    context.fillStyle = point.color;
    context.font = `bold ${point.size ?? baseSize}px "DM Mono", monospace`;
    context.fillText(point.glyph, point.x, point.y);
  }
};

const radialGlyph = (angle: number) => Math.abs(Math.cos(angle)) > .82
  ? '-'
  : Math.abs(Math.sin(angle)) > .82 ? '|' : Math.sin(angle) * Math.cos(angle) > 0 ? '\\' : '/';

function drawSagittarius(context: CanvasRenderingContext2D, options: GalacticRenderOptions, radius: number, fontSize: number) {
  const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
  const spin = longitude * .32 + (reducedMotion ? 0 : seconds * .035);
  const tilt = .2 + Math.cos(latitude) * .13;
  const far: GlyphPoint[] = [];
  const near: GlyphPoint[] = [];

  for (let index = 0; index < 280; index++) {
    const angle = index / 280 * Math.PI * 2 + spin;
    const lane = index % 4;
    const localRadius = radius * (.43 + lane * .145 + randomUnit(index + 91) * .075);
    const point = {
      x: x + Math.cos(angle) * localRadius,
      y: y + Math.sin(angle) * localRadius * tilt,
      glyph: lane === 1 ? '=' : lane === 2 ? '~' : randomUnit(index + 8) > .55 ? '-' : '.',
      color: lane === 0 ? '#d79921' : lane === 1 ? '#fe8019' : lane === 2 ? '#fabd2f' : '#bdae93',
      alpha: .3 + randomUnit(index + 17) * .55,
      size: fontSize * (.78 + randomUnit(index + 23) * .26),
    };
    (Math.sin(angle) < 0 ? far : near).push(point);
  }

  paintPoints(context, far, fontSize, opacity);

  // The inner photon ring remains continuous while the accretion flow passes
  // behind and in front of the shadow.
  for (let sample = 0; sample < 96; sample++) {
    const angle = sample / 96 * Math.PI * 2 + spin * .35;
    context.globalAlpha = opacity * (.48 + sample % 5 * .08);
    context.fillStyle = sample % 6 === 0 ? '#ebdbb2' : sample % 2 ? '#fabd2f' : '#fe8019';
    context.font = `bold ${fontSize * .72}px "DM Mono", monospace`;
    context.fillText(radialGlyph(angle + Math.PI / 2), x + Math.cos(angle) * radius * .36, y + Math.sin(angle) * radius * .1);
  }

  context.globalAlpha = opacity;
  context.font = `bold ${fontSize * 1.05}px "DM Mono", monospace`;
  context.fillStyle = '#665c54';
  ['   .-=======-.   ', ' /==           ==\\ ', '|==     (@)     ==|', ' \\==           ==/ ', "   '-=======-'   "].forEach((line, row) => {
    context.fillText(line, x + Math.sin(longitude + row * .8) * fontSize * .22, y + (row - 2) * fontSize * .72);
  });
  context.fillStyle = '#1d2021';
  context.font = `bold ${fontSize * 1.45}px "DM Mono", monospace`;
  context.fillText('((     ))', x, y);
  context.fillStyle = '#d65d0e';
  context.font = `bold ${fontSize * .9}px "DM Mono", monospace`;
  context.fillText('@', x, y);
  paintPoints(context, near, fontSize, opacity);

  for (let side = -1; side <= 1; side += 2) {
    for (let arc = 0; arc < 46; arc++) {
      const angle = Math.PI + arc / 45 * Math.PI;
      context.globalAlpha = opacity * (.15 + Math.sin(arc * .9) * .045);
      context.fillStyle = side < 0 ? '#bdae93' : '#665c54';
      context.font = `${fontSize * .68}px "DM Mono", monospace`;
      context.fillText(radialGlyph(angle + Math.PI / 2), x + Math.cos(angle) * radius * .43, y + side * radius * .235 + Math.sin(angle) * radius * .105 * side);
    }
  }

  const hotspotAngle = longitude + (reducedMotion ? .4 : seconds * .22);
  context.globalAlpha = opacity * .92;
  context.fillStyle = '#ebdbb2';
  context.font = `bold ${fontSize * .86}px "DM Mono", monospace`;
  context.fillText('*', x + Math.cos(hotspotAngle) * radius * .48, y + Math.sin(hotspotAngle) * radius * tilt * .48);
  context.globalAlpha = 1;
}

function drawOrion(context: CanvasRenderingContext2D, options: GalacticRenderOptions, radius: number, fontSize: number) {
  const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
  const points: GlyphPoint[] = [];
  const rotation = longitude * .12;
  for (let index = 0; index < 260; index++) {
    const angle = randomUnit(index + 120) * Math.PI * 2 + rotation;
    const distance = Math.sqrt(randomUnit(index + 420));
    const lobe = 1 + Math.cos(angle * 2 - .7) * .28 + Math.sin(angle * 3.1) * .12;
    const localX = Math.cos(angle) * radius * distance * lobe;
    const localY = Math.sin(angle) * radius * distance * (.48 + Math.cos(latitude) * .12);
    const dustLane = Math.abs(localY + localX * .18) < radius * .055 && localX > -radius * .5;
    if (dustLane && index % 4 !== 0) continue;
    const energy = randomUnit(index + 31);
    const shimmer = reducedMotion ? 0 : Math.sin(seconds * .65 + index * 2.3) * .08;
    points.push({
      x: x + localX,
      y: y + localY,
      glyph: energy > .91 ? '*' : energy > .7 ? ':' : energy > .42 ? '.' : '~',
      color: energy > .82 ? '#fabd2f' : energy > .56 ? '#d3869b' : energy > .28 ? '#83a598' : '#928374',
      alpha: .14 + (1 - distance) * .48 + shimmer,
      size: fontSize * (.65 + energy * .48),
    });
  }
  paintPoints(context, points, fontSize, opacity);

  const trapezium = [[-.12, -.04], [.08, -.09], [.13, .08], [-.04, .12]];
  trapezium.forEach(([offsetX, offsetY], index) => {
    const pulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 1.1 + index * 1.7) * .12;
    context.globalAlpha = opacity;
    context.fillStyle = index === 1 ? '#ebdbb2' : '#fabd2f';
    context.font = `bold ${fontSize * 1.35 * pulse}px "DM Mono", monospace`;
    context.fillText(index === 1 ? '+' : '*', x + offsetX * radius, y + offsetY * radius);
  });
  context.globalAlpha = 1;
}

function drawCygnus(context: CanvasRenderingContext2D, options: GalacticRenderOptions, radius: number, fontSize: number) {
  const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
  const starX = x - radius * .48;
  const holeX = x + radius * .45;
  const starRows = [5, 9, 11, 11, 11, 9, 5];
  starRows.forEach((rowWidth, row) => {
    const first = (11 - rowWidth) / 2;
    for (let cell = 0; cell < rowWidth; cell++) {
      const column = first + cell;
      const surface = Math.sin(column * 2.1 + row * 1.4 + (reducedMotion ? 0 : seconds * .45));
      const contour = cell === 0 || cell === rowWidth - 1 || row === 0 || row === starRows.length - 1;
      context.globalAlpha = opacity * (contour ? .9 : .62 + Math.abs(surface) * .25);
      context.fillStyle = contour ? '#83a598' : surface > .4 ? '#8ec07c' : surface < -.45 ? '#458588' : '#83a598';
      context.font = `bold ${fontSize * .86}px "DM Mono", monospace`;
      context.fillText(contour ? (row === 0 ? '-' : row === starRows.length - 1 ? "'" : cell === 0 ? '(' : ')') : surface > .55 ? '*' : 'o', starX + (column - 5) * fontSize * .5, y + (row - 3) * fontSize * .68);
    }
  });

  for (let sample = 0; sample < 74; sample++) {
    const progress = sample / 73;
    const streamX = starX + radius * .16 + progress * (holeX - starX - radius * .24);
    const streamY = y - Math.sin(progress * Math.PI) * radius * (.25 + Math.sin(latitude) * .06);
    context.globalAlpha = opacity * (.24 + progress * .55);
    context.fillStyle = progress > .7 ? '#fe8019' : '#83a598';
    context.font = `${fontSize * .7}px "DM Mono", monospace`;
    context.fillText(sample % 5 === 0 ? ':' : '.', streamX, streamY);
  }

  const diskSpin = longitude * .35 + (reducedMotion ? 0 : seconds * .08);
  for (let sample = 0; sample < 96; sample++) {
    const angle = sample / 96 * Math.PI * 2 + diskSpin;
    const diskRadius = radius * (.2 + (sample % 3) * .065);
    context.globalAlpha = opacity * (.35 + (sample % 4) * .13);
    context.fillStyle = sample % 3 === 0 ? '#fabd2f' : '#fe8019';
    context.font = `bold ${fontSize * .72}px "DM Mono", monospace`;
    context.fillText(radialGlyph(angle + Math.PI / 2), holeX + Math.cos(angle) * diskRadius, y + Math.sin(angle) * diskRadius * .22);
  }
  context.globalAlpha = opacity;
  context.fillStyle = '#1d2021';
  context.font = `bold ${fontSize * 1.5}px "DM Mono", monospace`;
  context.fillText('(@)', holeX, y);
  context.fillStyle = '#d65d0e';
  context.font = `bold ${fontSize}px "DM Mono", monospace`;
  context.fillText('@', holeX, y);
  context.globalAlpha = 1;
}

function drawCrab(context: CanvasRenderingContext2D, options: GalacticRenderOptions, radius: number, fontSize: number) {
  const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
  const points: GlyphPoint[] = [];
  const expansion = reducedMotion ? 0 : Math.sin(seconds * .22) * .012;
  for (let filament = 0; filament < 7; filament++) {
    for (let sample = 0; sample < 46; sample++) {
      const angle = sample / 46 * Math.PI * 2 + filament * .83 + longitude * .12;
      const wave = Math.sin(angle * (2 + filament % 3) + filament * 1.7) * .1;
      const localRadius = radius * (.46 + filament * .065 + wave + expansion);
      points.push({
        x: x + Math.cos(angle) * localRadius,
        y: y + Math.sin(angle) * localRadius * (.62 + Math.cos(latitude) * .08),
        glyph: radialGlyph(angle + Math.PI / 2),
        color: filament % 3 === 0 ? '#fb4934' : filament % 3 === 1 ? '#d3869b' : '#fe8019',
        alpha: .24 + randomUnit(sample + filament * 53) * .55,
        size: fontSize * (.62 + randomUnit(sample + filament * 17) * .35),
      });
    }
  }
  paintPoints(context, points, fontSize, opacity);

  for (let wisp = 0; wisp < 42; wisp++) {
    const angle = wisp / 42 * Math.PI * 2 + (reducedMotion ? 0 : seconds * .025);
    context.globalAlpha = opacity * (.18 + wisp % 4 * .07);
    context.fillStyle = '#83a598';
    context.font = `${fontSize * .62}px "DM Mono", monospace`;
    context.fillText(wisp % 3 ? '.' : ':', x + Math.cos(angle) * radius * .28, y + Math.sin(angle) * radius * .17);
  }
  context.globalAlpha = opacity;
  context.fillStyle = '#ebdbb2';
  context.font = `bold ${fontSize * 1.2}px "DM Mono", monospace`;
  context.fillText('{+}', x, y);
  context.fillStyle = '#83a598';
  context.font = `bold ${fontSize * .82}px "DM Mono", monospace`;
  context.fillText('-----', x, y - radius * .05);
  context.fillText('|', x, y - radius * .23);
  context.fillText('|', x, y + radius * .23);
  context.globalAlpha = 1;
}

export function drawFocusedGalacticObject(context: CanvasRenderingContext2D, options: GalacticRenderOptions) {
  const radius = (options.compact ? 112 : 190) * options.scale;
  const fontSize = (options.compact ? 8 : 11) * options.scale;
  if (options.name === 'Sagittarius A*') drawSagittarius(context, options, radius, fontSize);
  else if (options.name === 'Orion Nebula') drawOrion(context, options, radius, fontSize);
  else if (options.name === 'Cygnus X-1') drawCygnus(context, options, radius, fontSize);
  else if (options.name === 'Crab Nebula') drawCrab(context, options, radius, fontSize);
  else return false;
  return true;
}
