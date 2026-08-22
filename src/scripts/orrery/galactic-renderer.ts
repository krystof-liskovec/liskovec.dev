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

type GlyphPoint = { x: number; y: number; glyph: string; color: string; alpha: number };

const paintPoints = (context: CanvasRenderingContext2D, points: GlyphPoint[], baseSize: number, opacity: number) => {
    // Font parsing is considerably more expensive than changing colour/alpha.
    // Keep particle fields on one font state instead of rebuilding it hundreds
    // of times per frame; variation still comes from glyph, colour and opacity.
    context.font = `bold ${baseSize}px "DM Mono", monospace`;
    for (const point of points) {
        context.globalAlpha = opacity * point.alpha;
        context.fillStyle = point.color;
        context.fillText(point.glyph, point.x, point.y);
    }
};

const radialGlyph = (angle: number) =>
    Math.abs(Math.cos(angle)) > 0.82
        ? '-'
        : Math.abs(Math.sin(angle)) > 0.82
          ? '|'
          : Math.sin(angle) * Math.cos(angle) > 0
            ? '\\'
            : '/';

// These structures do not change between frames. Precomputing their seeded
// noise avoids thousands of Math.sin calls while a detailed object is open.
const SAGITTARIUS_PARTICLES = Array.from({ length: 280 }, (_, index) => {
    const lane = index % 4;
    return {
        angle: (index / 280) * Math.PI * 2,
        radius: 0.43 + lane * 0.145 + randomUnit(index + 91) * 0.075,
        glyph: lane === 1 ? '=' : lane === 2 ? '~' : randomUnit(index + 8) > 0.55 ? '-' : '.',
        color: lane === 0 ? '#d79921' : lane === 1 ? '#fe8019' : lane === 2 ? '#fabd2f' : '#bdae93',
        alpha: 0.3 + randomUnit(index + 17) * 0.55,
    };
});

const ORION_PARTICLES = Array.from({ length: 260 }, (_, index) => ({
    angle: randomUnit(index + 120) * Math.PI * 2,
    distance: Math.sqrt(randomUnit(index + 420)),
    energy: randomUnit(index + 31),
    phase: index * 2.3,
}));

const CRAB_PARTICLE_ALPHA = Array.from({ length: 7 * 46 }, (_, index) => 0.24 + randomUnit(index * 1.37 + 53) * 0.55);

function drawSagittarius(
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const spin = longitude * 0.32 + (reducedMotion ? 0 : seconds * 0.035);
    const tilt = 0.2 + Math.cos(latitude) * 0.13;
    const far: GlyphPoint[] = [];
    const near: GlyphPoint[] = [];

    for (const particle of SAGITTARIUS_PARTICLES) {
        const angle = particle.angle + spin;
        const localRadius = radius * particle.radius;
        const point = {
            x: x + Math.cos(angle) * localRadius,
            y: y + Math.sin(angle) * localRadius * tilt,
            glyph: particle.glyph,
            color: particle.color,
            alpha: particle.alpha,
        };
        (Math.sin(angle) < 0 ? far : near).push(point);
    }

    paintPoints(context, far, fontSize, opacity);

    // The inner photon ring remains continuous while the accretion flow passes
    // behind and in front of the shadow.
    context.font = `bold ${fontSize * 0.72}px "DM Mono", monospace`;
    for (let sample = 0; sample < 96; sample++) {
        const angle = (sample / 96) * Math.PI * 2 + spin * 0.35;
        context.globalAlpha = opacity * (0.48 + (sample % 5) * 0.08);
        context.fillStyle = sample % 6 === 0 ? '#ebdbb2' : sample % 2 ? '#fabd2f' : '#fe8019';
        context.fillText(
            radialGlyph(angle + Math.PI / 2),
            x + Math.cos(angle) * radius * 0.36,
            y + Math.sin(angle) * radius * 0.1,
        );
    }

    context.globalAlpha = opacity;
    context.font = `bold ${fontSize * 1.05}px "DM Mono", monospace`;
    context.fillStyle = '#665c54';
    [
        '   .-=======-.   ',
        ' /==           ==\\ ',
        '|==     (@)     ==|',
        ' \\==           ==/ ',
        "   '-=======-'   ",
    ].forEach((line, row) => {
        context.fillText(line, x + Math.sin(longitude + row * 0.8) * fontSize * 0.22, y + (row - 2) * fontSize * 0.72);
    });
    context.fillStyle = '#1d2021';
    context.font = `bold ${fontSize * 1.45}px "DM Mono", monospace`;
    context.fillText('((     ))', x, y);
    context.fillStyle = '#d65d0e';
    context.font = `bold ${fontSize * 0.9}px "DM Mono", monospace`;
    context.fillText('@', x, y);
    paintPoints(context, near, fontSize, opacity);

    context.font = `${fontSize * 0.68}px "DM Mono", monospace`;
    for (let side = -1; side <= 1; side += 2) {
        for (let arc = 0; arc < 46; arc++) {
            const angle = Math.PI + (arc / 45) * Math.PI;
            context.globalAlpha = opacity * (0.15 + Math.sin(arc * 0.9) * 0.045);
            context.fillStyle = side < 0 ? '#bdae93' : '#665c54';
            context.fillText(
                radialGlyph(angle + Math.PI / 2),
                x + Math.cos(angle) * radius * 0.43,
                y + side * radius * 0.235 + Math.sin(angle) * radius * 0.105 * side,
            );
        }
    }

    const hotspotAngle = longitude + (reducedMotion ? 0.4 : seconds * 0.22);
    context.globalAlpha = opacity * 0.92;
    context.fillStyle = '#ebdbb2';
    context.font = `bold ${fontSize * 0.86}px "DM Mono", monospace`;
    context.fillText(
        '*',
        x + Math.cos(hotspotAngle) * radius * 0.48,
        y + Math.sin(hotspotAngle) * radius * tilt * 0.48,
    );
    context.globalAlpha = 1;
}

function drawOrion(
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const points: GlyphPoint[] = [];
    const rotation = longitude * 0.12;
    for (let index = 0; index < ORION_PARTICLES.length; index++) {
        const particle = ORION_PARTICLES[index];
        const angle = particle.angle + rotation;
        const distance = particle.distance;
        const lobe = 1 + Math.cos(angle * 2 - 0.7) * 0.28 + Math.sin(angle * 3.1) * 0.12;
        const localX = Math.cos(angle) * radius * distance * lobe;
        const localY = Math.sin(angle) * radius * distance * (0.48 + Math.cos(latitude) * 0.12);
        const dustLane = Math.abs(localY + localX * 0.18) < radius * 0.055 && localX > -radius * 0.5;
        if (dustLane && index % 4 !== 0) continue;
        const energy = particle.energy;
        const shimmer = reducedMotion ? 0 : Math.sin(seconds * 0.65 + particle.phase) * 0.08;
        points.push({
            x: x + localX,
            y: y + localY,
            glyph: energy > 0.91 ? '*' : energy > 0.7 ? ':' : energy > 0.42 ? '.' : '~',
            color: energy > 0.82 ? '#fabd2f' : energy > 0.56 ? '#d3869b' : energy > 0.28 ? '#83a598' : '#928374',
            alpha: 0.14 + (1 - distance) * 0.48 + shimmer,
        });
    }
    paintPoints(context, points, fontSize, opacity);

    const trapezium = [
        [-0.12, -0.04],
        [0.08, -0.09],
        [0.13, 0.08],
        [-0.04, 0.12],
    ];
    trapezium.forEach(([offsetX, offsetY], index) => {
        const pulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 1.1 + index * 1.7) * 0.12;
        context.globalAlpha = opacity;
        context.fillStyle = index === 1 ? '#ebdbb2' : '#fabd2f';
        context.font = `bold ${fontSize * 1.35 * pulse}px "DM Mono", monospace`;
        context.fillText(index === 1 ? '+' : '*', x + offsetX * radius, y + offsetY * radius);
    });
    context.globalAlpha = 1;
}

function drawCygnus(
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const starX = x - radius * 0.48;
    const holeX = x + radius * 0.45;
    const starRows = [5, 9, 11, 11, 11, 9, 5];
    context.font = `bold ${fontSize * 0.86}px "DM Mono", monospace`;
    starRows.forEach((rowWidth, row) => {
        const first = (11 - rowWidth) / 2;
        for (let cell = 0; cell < rowWidth; cell++) {
            const column = first + cell;
            const surface = Math.sin(column * 2.1 + row * 1.4 + (reducedMotion ? 0 : seconds * 0.45));
            const contour = cell === 0 || cell === rowWidth - 1 || row === 0 || row === starRows.length - 1;
            context.globalAlpha = opacity * (contour ? 0.9 : 0.62 + Math.abs(surface) * 0.25);
            context.fillStyle = contour
                ? '#83a598'
                : surface > 0.4
                  ? '#8ec07c'
                  : surface < -0.45
                    ? '#458588'
                    : '#83a598';
            context.fillText(
                contour
                    ? row === 0
                        ? '-'
                        : row === starRows.length - 1
                          ? "'"
                          : cell === 0
                            ? '('
                            : ')'
                    : surface > 0.55
                      ? '*'
                      : 'o',
                starX + (column - 5) * fontSize * 0.5,
                y + (row - 3) * fontSize * 0.68,
            );
        }
    });

    context.font = `${fontSize * 0.7}px "DM Mono", monospace`;
    for (let sample = 0; sample < 74; sample++) {
        const progress = sample / 73;
        const streamX = starX + radius * 0.16 + progress * (holeX - starX - radius * 0.24);
        const streamY = y - Math.sin(progress * Math.PI) * radius * (0.25 + Math.sin(latitude) * 0.06);
        context.globalAlpha = opacity * (0.24 + progress * 0.55);
        context.fillStyle = progress > 0.7 ? '#fe8019' : '#83a598';
        context.fillText(sample % 5 === 0 ? ':' : '.', streamX, streamY);
    }

    const diskSpin = longitude * 0.35 + (reducedMotion ? 0 : seconds * 0.08);
    context.font = `bold ${fontSize * 0.72}px "DM Mono", monospace`;
    for (let sample = 0; sample < 96; sample++) {
        const angle = (sample / 96) * Math.PI * 2 + diskSpin;
        const diskRadius = radius * (0.2 + (sample % 3) * 0.065);
        context.globalAlpha = opacity * (0.35 + (sample % 4) * 0.13);
        context.fillStyle = sample % 3 === 0 ? '#fabd2f' : '#fe8019';
        context.fillText(
            radialGlyph(angle + Math.PI / 2),
            holeX + Math.cos(angle) * diskRadius,
            y + Math.sin(angle) * diskRadius * 0.22,
        );
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
    const expansion = reducedMotion ? 0 : Math.sin(seconds * 0.22) * 0.012;
    for (let filament = 0; filament < 7; filament++) {
        for (let sample = 0; sample < 46; sample++) {
            const angle = (sample / 46) * Math.PI * 2 + filament * 0.83 + longitude * 0.12;
            const wave = Math.sin(angle * (2 + (filament % 3)) + filament * 1.7) * 0.1;
            const localRadius = radius * (0.46 + filament * 0.065 + wave + expansion);
            points.push({
                x: x + Math.cos(angle) * localRadius,
                y: y + Math.sin(angle) * localRadius * (0.62 + Math.cos(latitude) * 0.08),
                glyph: radialGlyph(angle + Math.PI / 2),
                color: filament % 3 === 0 ? '#fb4934' : filament % 3 === 1 ? '#d3869b' : '#fe8019',
                alpha: CRAB_PARTICLE_ALPHA[filament * 46 + sample],
            });
        }
    }
    paintPoints(context, points, fontSize, opacity);

    context.font = `${fontSize * 0.62}px "DM Mono", monospace`;
    for (let wisp = 0; wisp < 42; wisp++) {
        const angle = (wisp / 42) * Math.PI * 2 + (reducedMotion ? 0 : seconds * 0.025);
        context.globalAlpha = opacity * (0.18 + (wisp % 4) * 0.07);
        context.fillStyle = '#83a598';
        context.fillText(
            wisp % 3 ? '.' : ':',
            x + Math.cos(angle) * radius * 0.28,
            y + Math.sin(angle) * radius * 0.17,
        );
    }
    context.globalAlpha = opacity;
    context.fillStyle = '#ebdbb2';
    context.font = `bold ${fontSize * 1.2}px "DM Mono", monospace`;
    context.fillText('{+}', x, y);
    context.fillStyle = '#83a598';
    context.font = `bold ${fontSize * 0.82}px "DM Mono", monospace`;
    context.fillText('-----', x, y - radius * 0.05);
    context.fillText('|', x, y - radius * 0.23);
    context.fillText('|', x, y + radius * 0.23);
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
