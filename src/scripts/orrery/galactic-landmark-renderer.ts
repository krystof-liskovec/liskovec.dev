import type { GalacticRenderOptions } from './galactic-renderer';

type ProjectionBasis = {
    yawCosine: number;
    yawSine: number;
    pitchCosine: number;
    pitchSine: number;
};

const createProjectionBasis = (longitude: number, latitude: number): ProjectionBasis => ({
    yawCosine: Math.cos(longitude),
    yawSine: Math.sin(longitude),
    pitchCosine: Math.cos(latitude),
    pitchSine: Math.sin(latitude),
});

const projectPoint = (
    x: number,
    y: number,
    z: number,
    basis: ProjectionBasis,
    target: { x: number; y: number; depth: number },
) => {
    const { yawCosine, yawSine, pitchCosine, pitchSine } = basis;
    const yawedX = x * yawCosine + z * yawSine;
    const yawedZ = -x * yawSine + z * yawCosine;
    target.x = yawedX;
    target.y = y * pitchCosine - yawedZ * pitchSine;
    target.depth = y * pitchSine + yawedZ * pitchCosine;
    return target;
};

const PROJECTED_POINT = { x: 0, y: 0, depth: 0 };
const PULSAR_STAR_ROWS = [3, 5, 7, 7, 7, 5, 3];
// Keep the beam visibly energetic while leaving each ASCII sweep readable.
const B1509_DISPLAY_ROTATIONS_PER_SECOND = 1.2;

const drawB1509Pulsar = (
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) => {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const yaw = longitude * 0.42;
    const pitch = 0.36 + latitude * 0.48;
    const rotationPhase =
        longitude + (reducedMotion ? 0.65 : seconds * Math.PI * 2 * B1509_DISPLAY_ROTATIONS_PER_SECOND);
    const magneticTilt = 0.56;
    const beamX = Math.sin(magneticTilt) * Math.cos(rotationPhase);
    const beamY = Math.cos(magneticTilt);
    const beamZ = Math.sin(magneticTilt) * Math.sin(rotationPhase);
    const projection = createProjectionBasis(yaw, pitch);

    // Paint the rear and front halves separately so the wind torus and beams
    // pass behind and in front of the neutron star as it rotates.
    for (let layer = 0; layer < 2; layer++) {
        context.font = `bold ${fontSize * 0.86}px "DM Mono", monospace`;
        for (let sample = 0; sample < 144; sample++) {
            const lane = sample % 3;
            const angle = (sample / 144) * Math.PI * 2 + (reducedMotion ? 0 : seconds * 0.045) + lane * 0.12;
            const localRadius = 0.38 + lane * 0.11;
            const point = projectPoint(
                Math.cos(angle) * localRadius,
                (lane - 1) * 0.025,
                Math.sin(angle) * localRadius,
                projection,
                PROJECTED_POINT,
            );
            if ((point.depth >= 0 ? 1 : 0) !== layer) continue;
            const depth = Math.max(-1, Math.min(1, point.depth / 0.6));
            context.globalAlpha = opacity * (layer ? 0.68 + depth * 0.28 : 0.38 - depth * 0.12);
            context.fillStyle = lane === 0 ? '#458588' : lane === 1 ? '#83a598' : '#b8bb26';
            context.fillText(
                sample % 5 === 0 ? '=' : sample % 2 ? '-' : '.',
                x + point.x * radius,
                y + point.y * radius * 0.72,
            );
        }

        context.font = `bold ${fontSize * 0.84}px "DM Mono", monospace`;
        for (let side = -1; side <= 1; side += 2) {
            for (let sample = 3; sample < 36; sample++) {
                const distance = sample / 36;
                const spread = ((sample % 4) - 1.5) * distance * 0.035;
                const point = projectPoint(
                    side * beamX * distance + spread,
                    side * beamY * distance,
                    side * beamZ * distance - spread,
                    projection,
                    PROJECTED_POINT,
                );
                if ((point.depth >= 0 ? 1 : 0) !== layer) continue;
                context.globalAlpha = opacity * (layer ? 0.55 + (1 - distance) * 0.4 : 0.3 + (1 - distance) * 0.3);
                context.fillStyle = side > 0 ? '#ebdbb2' : '#83a598';
                context.fillText(
                    sample % 6 === 0
                        ? '+'
                        : Math.abs(point.x) < Math.abs(point.y) * 0.25
                          ? '|'
                          : point.x * point.y > 0
                            ? '\\'
                            : '/',
                    x + point.x * radius * 1.18,
                    y + point.y * radius * 1.18,
                );
            }
        }

        if (layer === 0) {
            const starFontSize = fontSize * 1.1;
            context.font = `bold ${starFontSize}px "DM Mono", monospace`;
            PULSAR_STAR_ROWS.forEach((rowWidth, row) => {
                const first = (7 - rowWidth) / 2;
                const normalizedY = (row - 3) / 3.5;
                for (let cell = 0; cell < rowWidth; cell++) {
                    const column = first + cell;
                    const normalizedX = (column - 3) / 3.5;
                    const depth = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
                    const field = Math.sin(normalizedX * 8 + normalizedY * 5 + rotationPhase);
                    const contour =
                        cell === 0 || cell === rowWidth - 1 || row === 0 || row === PULSAR_STAR_ROWS.length - 1;
                    context.globalAlpha = opacity * (contour ? 0.86 : 0.58 + depth * 0.36);
                    context.fillStyle = field > 0.45 ? '#ebdbb2' : field < -0.45 ? '#458588' : '#83a598';
                    let glyph: string;
                    if (contour) {
                        if (row === 0) glyph = cell === 0 ? '/' : cell === rowWidth - 1 ? '\\' : '-';
                        else if (row === PULSAR_STAR_ROWS.length - 1)
                            glyph = cell === 0 ? '\\' : cell === rowWidth - 1 ? '/' : '-';
                        else glyph = cell === 0 ? '(' : ')';
                    } else glyph = field > 0.5 ? '*' : field < -0.5 ? ':' : 'o';
                    context.fillText(
                        glyph,
                        x + (column - 3) * starFontSize * 0.52,
                        y + (row - 3) * starFontSize * 0.52,
                    );
                }
            });
            context.globalAlpha = opacity;
            context.fillStyle = '#fabd2f';
            context.font = `bold ${fontSize * 0.88}px "DM Mono", monospace`;
            context.fillText('+', x, y);
        }
    }

    // A narrow axial jet sits inside the broader magnetic beams.
    context.font = `${fontSize * 0.5}px "DM Mono", monospace`;
    for (let side = -1; side <= 1; side += 2) {
        for (let sample = 4; sample < 22; sample++) {
            const distance = (sample / 22) * 0.72;
            const point = projectPoint(0, side * distance, 0, projection, PROJECTED_POINT);
            context.globalAlpha = opacity * (0.34 - sample * 0.009);
            context.fillStyle = '#b8bb26';
            context.fillText(sample % 4 === 0 ? ':' : '.', x + point.x * radius, y + point.y * radius);
        }
    }
    context.globalAlpha = 1;
};

export const drawAdditionalGalacticObject = (
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) => {
    if (options.name === 'PSR B1509-58') drawB1509Pulsar(context, options, radius, fontSize);
    else return false;
    return true;
};
