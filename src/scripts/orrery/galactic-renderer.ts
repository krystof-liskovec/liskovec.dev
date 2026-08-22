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
const createGlyphPointPool = (length: number): GlyphPoint[] =>
    Array.from({ length }, () => ({ x: 0, y: 0, glyph: '.', color: '#928374', alpha: 1 }));
const SAGITTARIUS_POINT_POOL = createGlyphPointPool(SAGITTARIUS_PARTICLES.length);
const SAGITTARIUS_FAR: GlyphPoint[] = [];
const SAGITTARIUS_NEAR: GlyphPoint[] = [];
const ORION_POINT_POOL = createGlyphPointPool(ORION_PARTICLES.length);
const ORION_POINTS: GlyphPoint[] = [];
const CRAB_POINT_POOL = createGlyphPointPool(CRAB_PARTICLE_ALPHA.length);
const CRAB_POINTS: GlyphPoint[] = [];
const SAGITTARIUS_ART = [
    '   .-=======-.   ',
    ' /==           ==\\ ',
    '|==     (@)     ==|',
    ' \\==           ==/ ',
    "   '-=======-'   ",
];
const ORION_TRAPEZIUM = [
    [-0.12, -0.04],
    [0.08, -0.09],
    [0.13, 0.08],
    [-0.04, 0.12],
];
const CYGNUS_STAR_ROWS = [7, 11, 13, 15, 15, 15, 13, 11, 7];
const CYGNUS_STAR_COLUMNS = 15;
const CYGNUS_DISK_SAMPLES = 128;
const CYGNUS_DISK_POINT = { x: 0, y: 0, depth: 0 };

const projectCygnusDiskPoint = (angle: number, radius: number, inclination: number, positionAngle: number) => {
    const planeX = Math.cos(angle) * radius;
    const planeY = Math.sin(angle) * radius * Math.sin(inclination);
    CYGNUS_DISK_POINT.x = planeX * Math.cos(positionAngle) - planeY * Math.sin(positionAngle);
    CYGNUS_DISK_POINT.y = planeX * Math.sin(positionAngle) + planeY * Math.cos(positionAngle);
    CYGNUS_DISK_POINT.depth = Math.sin(angle) * radius * Math.cos(inclination);
    return CYGNUS_DISK_POINT;
};

const drawCygnusDiskLayer = (
    context: CanvasRenderingContext2D,
    holeX: number,
    holeY: number,
    radius: number,
    fontSize: number,
    opacity: number,
    spin: number,
    inclination: number,
    positionAngle: number,
    foreground: boolean,
) => {
    context.font = `bold ${fontSize * 0.7}px "DM Mono", monospace`;
    for (let sample = 0; sample < CYGNUS_DISK_SAMPLES; sample++) {
        const lane = sample % 4;
        const angle = (sample / CYGNUS_DISK_SAMPLES) * Math.PI * 2 + spin + lane * 0.17;
        const diskRadius = radius * (0.19 + lane * 0.052);
        const point = projectCygnusDiskPoint(angle, diskRadius, inclination, positionAngle);
        if (point.depth >= 0 !== foreground) continue;
        const depth = Math.max(-1, Math.min(1, point.depth / (radius * 0.35)));
        context.globalAlpha = opacity * (foreground ? 0.52 + depth * 0.24 : 0.25 - depth * 0.08);
        context.fillStyle = lane === 0 ? '#ebdbb2' : lane === 1 ? '#fabd2f' : lane === 2 ? '#fe8019' : '#d65d0e';
        context.fillText(radialGlyph(angle + positionAngle + Math.PI / 2), holeX + point.x, holeY + point.y);
    }
};

function drawSagittarius(
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const spin = longitude * 0.32 + (reducedMotion ? 0 : seconds * 0.035);
    const tilt = 0.2 + Math.cos(latitude) * 0.13;
    SAGITTARIUS_FAR.length = 0;
    SAGITTARIUS_NEAR.length = 0;

    for (let index = 0; index < SAGITTARIUS_PARTICLES.length; index++) {
        const particle = SAGITTARIUS_PARTICLES[index];
        const angle = particle.angle + spin;
        const localRadius = radius * particle.radius;
        const point = SAGITTARIUS_POINT_POOL[index];
        point.x = x + Math.cos(angle) * localRadius;
        point.y = y + Math.sin(angle) * localRadius * tilt;
        point.glyph = particle.glyph;
        point.color = particle.color;
        point.alpha = particle.alpha;
        (Math.sin(angle) < 0 ? SAGITTARIUS_FAR : SAGITTARIUS_NEAR).push(point);
    }

    paintPoints(context, SAGITTARIUS_FAR, fontSize, opacity);

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
    SAGITTARIUS_ART.forEach((line, row) => {
        context.fillText(line, x + Math.sin(longitude + row * 0.8) * fontSize * 0.22, y + (row - 2) * fontSize * 0.72);
    });
    context.fillStyle = '#1d2021';
    context.font = `bold ${fontSize * 1.45}px "DM Mono", monospace`;
    context.fillText('((     ))', x, y);
    context.fillStyle = '#d65d0e';
    context.font = `bold ${fontSize * 0.9}px "DM Mono", monospace`;
    context.fillText('@', x, y);
    paintPoints(context, SAGITTARIUS_NEAR, fontSize, opacity);

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
    ORION_POINTS.length = 0;
    let pointIndex = 0;
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
        const point = ORION_POINT_POOL[pointIndex++];
        point.x = x + localX;
        point.y = y + localY;
        point.glyph = energy > 0.91 ? '*' : energy > 0.7 ? ':' : energy > 0.42 ? '.' : '~';
        point.color = energy > 0.82 ? '#fabd2f' : energy > 0.56 ? '#d3869b' : energy > 0.28 ? '#83a598' : '#928374';
        point.alpha = 0.14 + (1 - distance) * 0.48 + shimmer;
        ORION_POINTS.push(point);
    }
    paintPoints(context, ORION_POINTS, fontSize, opacity);

    ORION_TRAPEZIUM.forEach(([offsetX, offsetY], index) => {
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
    const starX = x - radius * 0.5;
    const holeX = x + radius * 0.43;
    const starSpin = longitude * 0.55 + (reducedMotion ? 0 : seconds * 0.16);
    const starPulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 0.7) * 0.018;
    const starFontSize = fontSize * 0.78 * starPulse;
    const starRowHeight = starFontSize * 0.7;
    const starColumnWidth = starFontSize * 0.52;
    context.font = `bold ${starFontSize}px "DM Mono", monospace`;
    CYGNUS_STAR_ROWS.forEach((rowWidth, row) => {
        const first = (CYGNUS_STAR_COLUMNS - rowWidth) / 2;
        const normalizedY = (row - (CYGNUS_STAR_ROWS.length - 1) / 2) / (CYGNUS_STAR_ROWS.length / 2);
        for (let cell = 0; cell < rowWidth; cell++) {
            const column = first + cell;
            const normalizedX = (column - (CYGNUS_STAR_COLUMNS - 1) / 2) / (CYGNUS_STAR_COLUMNS / 2);
            const sphereDepth = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
            const surface =
                Math.sin((normalizedX + starSpin) * 7.2 + normalizedY * 3.1) +
                Math.sin(normalizedY * 8.4 - starSpin * 2.3) * 0.45;
            const contour = cell === 0 || cell === rowWidth - 1 || row === 0 || row === CYGNUS_STAR_ROWS.length - 1;
            const light = Math.max(0, Math.min(1, 0.24 + sphereDepth * 0.58 + normalizedX * 0.2));
            context.globalAlpha = opacity * (contour ? 0.72 + sphereDepth * 0.16 : 0.42 + light * 0.5);
            context.fillStyle = contour
                ? normalizedX > 0.25
                    ? '#8ec07c'
                    : '#458588'
                : light > 0.75 && surface > -0.2
                  ? '#b8bb26'
                  : surface > 0.4
                    ? '#8ec07c'
                    : light < 0.43 || surface < -0.65
                      ? '#458588'
                      : '#83a598';
            let glyph: string;
            if (contour) {
                if (row === 0) glyph = cell === 0 ? '/' : cell === rowWidth - 1 ? '\\' : '-';
                else if (row === CYGNUS_STAR_ROWS.length - 1)
                    glyph = cell === 0 ? '\\' : cell === rowWidth - 1 ? '/' : '-';
                else glyph = cell === 0 ? '(' : ')';
            } else if (light > 0.78) glyph = '*';
            else if (surface > 0.45) glyph = 'o';
            else if (surface < -0.55) glyph = ':';
            else glyph = '.';
            context.fillText(
                glyph,
                starX + (column - (CYGNUS_STAR_COLUMNS - 1) / 2) * starColumnWidth,
                y + (row - (CYGNUS_STAR_ROWS.length - 1) / 2) * starRowHeight,
            );
        }
    });

    // Two offset strands make the Roche-lobe stream read as a ribbon instead of
    // a flat dotted line. It narrows and brightens as it falls into the disk.
    context.font = `${fontSize * 0.66}px "DM Mono", monospace`;
    for (let strand = -1; strand <= 1; strand += 2) {
        for (let sample = 0; sample < 68; sample++) {
            const progress = sample / 67;
            const streamX = starX + radius * 0.18 + progress * (holeX - starX - radius * 0.2);
            const arc = Math.sin(progress * Math.PI);
            const perspective = Math.sin(progress * Math.PI * 1.15 + longitude * 0.28);
            const streamY =
                y -
                arc * radius * (0.22 + Math.sin(latitude) * 0.045) +
                perspective * radius * 0.035 +
                strand * fontSize * (0.46 - progress * 0.32);
            context.globalAlpha = opacity * (strand < 0 ? 0.18 + progress * 0.34 : 0.28 + progress * 0.5);
            context.fillStyle = progress > 0.72 ? '#fe8019' : progress > 0.42 ? '#b8bb26' : '#83a598';
            context.fillText(sample % 7 === 0 ? '~' : sample % 3 === 0 ? ':' : '.', streamX, streamY);
        }
    }

    const diskSpin = longitude * 0.42 + (reducedMotion ? 0 : seconds * 0.1);
    const diskInclination = Math.max(0.18, Math.min(0.62, 0.38 + latitude * 0.2));
    const diskPositionAngle = -0.08 + Math.sin(longitude * 0.3) * 0.18;

    // Jets follow the projected disk normal. The dim side sits behind the disk;
    // the brighter side points toward the viewer.
    const jetNormalX = -Math.sin(diskPositionAngle) * Math.cos(diskInclination);
    const jetNormalY = Math.cos(diskPositionAngle) * Math.cos(diskInclination);
    context.font = `${fontSize * 0.56}px "DM Mono", monospace`;
    for (let sample = 3; sample < 24; sample++) {
        const distance = radius * (0.018 * sample + sample ** 1.16 * 0.0025);
        const spread = ((sample % 3) - 1) * fontSize * sample * 0.018;
        context.globalAlpha = opacity * (0.34 - sample * 0.009);
        context.fillStyle = '#458588';
        context.fillText(
            sample % 4 === 0 ? ':' : '.',
            holeX - jetNormalX * distance + jetNormalY * spread,
            y - jetNormalY * distance - jetNormalX * spread,
        );
    }

    drawCygnusDiskLayer(
        context,
        holeX,
        y,
        radius,
        fontSize,
        opacity,
        diskSpin,
        diskInclination,
        diskPositionAngle,
        false,
    );

    // The shadow and photon ring sit between the rear and front halves of the
    // accretion flow, which is the primary depth cue for the black hole.
    context.font = `bold ${fontSize * 0.62}px "DM Mono", monospace`;
    for (let sample = 0; sample < 56; sample++) {
        const angle = (sample / 56) * Math.PI * 2;
        context.globalAlpha = opacity * (0.48 + (sample % 4) * 0.1);
        context.fillStyle = sample % 5 === 0 ? '#ebdbb2' : sample % 2 ? '#fabd2f' : '#d65d0e';
        context.fillText(
            radialGlyph(angle + Math.PI / 2),
            holeX + Math.cos(angle) * radius * 0.125,
            y + Math.sin(angle) * radius * 0.125,
        );
    }
    context.globalAlpha = opacity;
    context.fillStyle = '#1d2021';
    context.font = `bold ${fontSize * 1.42}px "DM Mono", monospace`;
    context.fillText('((     ))', holeX, y);
    context.font = `bold ${fontSize * 1.58}px "DM Mono", monospace`;
    context.fillText('(@)', holeX, y);
    context.fillStyle = '#d65d0e';
    context.font = `bold ${fontSize * 0.92}px "DM Mono", monospace`;
    context.fillText('@', holeX, y);

    drawCygnusDiskLayer(
        context,
        holeX,
        y,
        radius,
        fontSize,
        opacity,
        diskSpin,
        diskInclination,
        diskPositionAngle,
        true,
    );

    context.font = `${fontSize * 0.58}px "DM Mono", monospace`;
    for (let sample = 3; sample < 20; sample++) {
        const distance = radius * (0.018 * sample + sample ** 1.16 * 0.0025);
        const spread = ((sample % 3) - 1) * fontSize * sample * 0.018;
        context.globalAlpha = opacity * (0.5 - sample * 0.013);
        context.fillStyle = '#83a598';
        context.fillText(
            sample % 4 === 0 ? ':' : '.',
            holeX + jetNormalX * distance + jetNormalY * spread,
            y + jetNormalY * distance - jetNormalX * spread,
        );
    }
    context.globalAlpha = 1;
}

function drawCrab(context: CanvasRenderingContext2D, options: GalacticRenderOptions, radius: number, fontSize: number) {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    CRAB_POINTS.length = 0;
    let pointIndex = 0;
    const expansion = reducedMotion ? 0 : Math.sin(seconds * 0.22) * 0.012;
    for (let filament = 0; filament < 7; filament++) {
        for (let sample = 0; sample < 46; sample++) {
            const angle = (sample / 46) * Math.PI * 2 + filament * 0.83 + longitude * 0.12;
            const wave = Math.sin(angle * (2 + (filament % 3)) + filament * 1.7) * 0.1;
            const localRadius = radius * (0.46 + filament * 0.065 + wave + expansion);
            const point = CRAB_POINT_POOL[pointIndex++];
            point.x = x + Math.cos(angle) * localRadius;
            point.y = y + Math.sin(angle) * localRadius * (0.62 + Math.cos(latitude) * 0.08);
            point.glyph = radialGlyph(angle + Math.PI / 2);
            point.color = filament % 3 === 0 ? '#fb4934' : filament % 3 === 1 ? '#d3869b' : '#fe8019';
            point.alpha = CRAB_PARTICLE_ALPHA[filament * 46 + sample];
            CRAB_POINTS.push(point);
        }
    }
    paintPoints(context, CRAB_POINTS, fontSize, opacity);

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
