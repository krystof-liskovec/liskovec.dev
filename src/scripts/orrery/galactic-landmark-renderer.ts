import { randomUnit } from './math';
import type { GalacticRenderOptions } from './galactic-renderer';

type EtaParticle = { x: number; y: number; z: number; lobe: number; energy: number };
type ShellParticle = { x: number; y: number; z: number; energy: number; phase: number };
type ClusterStar = { x: number; y: number; z: number; energy: number; phase: number };
type ProjectionBasis = {
    yawCosine: number;
    yawSine: number;
    pitchCosine: number;
    pitchSine: number;
};

const ETA_PARTICLES: EtaParticle[] = Array.from({ length: 240 }, (_, index) => {
    const lobe = index % 2 ? 1 : -1;
    const progress = 0.08 + randomUnit(index + 11) * 0.92;
    const azimuth = randomUnit(index + 41) * Math.PI * 2;
    const shellRadius = Math.sin(progress * Math.PI) ** 0.72 * (0.25 + randomUnit(index + 71) * 0.12);
    return {
        x: lobe * (0.1 + progress * 0.88),
        y: Math.cos(azimuth) * shellRadius,
        z: Math.sin(azimuth) * shellRadius,
        lobe,
        energy: randomUnit(index + 101),
    };
});

const CASSIOPEIA_SHELL: ShellParticle[] = Array.from({ length: 330 }, (_, index) => {
    const z = randomUnit(index + 17) * 2 - 1;
    const azimuth = randomUnit(index + 53) * Math.PI * 2;
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const shell = 0.72 + randomUnit(index + 89) * 0.22;
    return {
        x: Math.cos(azimuth) * radial * shell,
        y: Math.sin(azimuth) * radial * shell,
        z: z * shell,
        energy: randomUnit(index + 127),
        phase: randomUnit(index + 163) * Math.PI * 2,
    };
});

const OMEGA_STARS: ClusterStar[] = Array.from({ length: 430 }, (_, index) => {
    const z = randomUnit(index + 23) * 2 - 1;
    const azimuth = randomUnit(index + 59) * Math.PI * 2;
    const radial = Math.sqrt(Math.max(0, 1 - z * z));
    const distance = 0.08 + randomUnit(index + 97) ** 2.15 * 0.92;
    return {
        x: Math.cos(azimuth) * radial * distance,
        y: Math.sin(azimuth) * radial * distance,
        z: z * distance,
        energy: randomUnit(index + 131),
        phase: randomUnit(index + 179) * Math.PI * 2,
    };
});

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
const B1509_DISPLAY_ROTATIONS_PER_SECOND = 3.5;

const drawEtaCarinae = (
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) => {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const rotation = longitude * 0.28 - 0.38;
    const tilt = latitude * 0.55 + 0.2;
    const projection = createProjectionBasis(tilt, longitude * 0.16);
    context.font = `bold ${fontSize * 0.72}px "DM Mono", monospace`;

    for (let layer = 0; layer < 2; layer++) {
        for (const particle of ETA_PARTICLES) {
            const point = projectPoint(particle.x, particle.y, particle.z, projection, PROJECTED_POINT);
            if ((point.depth >= 0 ? 1 : 0) !== layer) continue;
            const screenX = point.x * Math.cos(rotation) - point.y * Math.sin(rotation);
            const screenY = point.x * Math.sin(rotation) + point.y * Math.cos(rotation);
            const shimmer = reducedMotion ? 0 : Math.sin(seconds * 0.62 + particle.energy * 9) * 0.08;
            context.globalAlpha = opacity * (layer ? 0.48 + particle.energy * 0.38 : 0.2 + particle.energy * 0.22);
            context.fillStyle =
                particle.lobe > 0
                    ? particle.energy > 0.66
                        ? '#fabd2f'
                        : '#d79921'
                    : particle.energy > 0.66
                      ? '#83a598'
                      : '#458588';
            context.fillText(
                particle.energy > 0.82 ? '*' : particle.energy > 0.46 ? ':' : '.',
                x + screenX * radius * (1 + shimmer),
                y + screenY * radius * (1 + shimmer),
            );
        }

        if (layer === 0) {
            context.globalAlpha = opacity;
            context.fillStyle = '#ebdbb2';
            context.font = `bold ${fontSize * 1.45}px "DM Mono", monospace`;
            context.fillText('{+}', x, y);
            context.fillStyle = '#fe8019';
            context.font = `bold ${fontSize * 0.82}px "DM Mono", monospace`;
            context.fillText('*', x, y);
            context.font = `${fontSize * 0.64}px "DM Mono", monospace`;
        }
    }

    context.font = `${fontSize * 0.62}px "DM Mono", monospace`;
    for (let sample = 0; sample < 58; sample++) {
        const angle = (sample / 58) * Math.PI * 2 + longitude * 0.25;
        context.globalAlpha = opacity * (0.28 + (sample % 4) * 0.08);
        context.fillStyle = sample % 3 ? '#d79921' : '#83a598';
        context.fillText('-', x + Math.cos(angle) * radius * 0.19, y + Math.sin(angle) * radius * 0.055);
    }
    context.globalAlpha = 1;
};

const drawCassiopeia = (
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) => {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const expansion = reducedMotion ? 1 : 1 + Math.sin(seconds * 0.18) * 0.012;
    const projection = createProjectionBasis(longitude * 0.22, latitude * 0.48);
    context.font = `bold ${fontSize * 0.7}px "DM Mono", monospace`;

    for (let layer = 0; layer < 2; layer++) {
        for (const particle of CASSIOPEIA_SHELL) {
            const point = projectPoint(particle.x, particle.y, particle.z, projection, PROJECTED_POINT);
            if ((point.depth >= 0 ? 1 : 0) !== layer) continue;
            const pulse = reducedMotion ? 0 : Math.sin(seconds * 0.74 + particle.phase) * 0.09;
            context.globalAlpha =
                opacity * (layer ? 0.38 + particle.energy * 0.52 + pulse : 0.16 + particle.energy * 0.2);
            context.fillStyle =
                particle.energy > 0.86
                    ? '#ebdbb2'
                    : particle.energy > 0.62
                      ? '#fe8019'
                      : particle.energy > 0.3
                        ? '#d65d0e'
                        : '#83a598';
            context.fillText(
                particle.energy > 0.82 ? '*' : particle.energy > 0.48 ? ':' : '.',
                x + point.x * radius * expansion,
                y + point.y * radius * expansion,
            );
        }
        if (layer === 0) {
            context.globalAlpha = opacity * 0.82;
            context.fillStyle = '#1d2021';
            context.font = `bold ${fontSize * 2.1}px "DM Mono", monospace`;
            context.fillText('(     )', x, y);
            context.fillStyle = '#d65d0e';
            context.font = `bold ${fontSize * 0.9}px "DM Mono", monospace`;
            context.fillText(':+:', x, y);
            context.font = `bold ${fontSize * 0.7}px "DM Mono", monospace`;
        }
    }
    context.globalAlpha = 1;
};

const drawOmegaCentauri = (
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) => {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const projection = createProjectionBasis(longitude * 0.2, latitude * 0.3);
    context.font = `bold ${fontSize * 0.68}px "DM Mono", monospace`;

    for (let layer = 0; layer < 2; layer++) {
        for (const star of OMEGA_STARS) {
            const point = projectPoint(star.x, star.y, star.z, projection, PROJECTED_POINT);
            if ((point.depth >= 0 ? 1 : 0) !== layer) continue;
            const perspective = 1 + point.depth * 0.14;
            const twinkle = reducedMotion ? 0 : Math.sin(seconds * 0.8 + star.phase) * 0.1;
            const central = 1 - Math.min(1, Math.hypot(star.x, star.y, star.z));
            context.globalAlpha = opacity * (layer ? 0.4 + central * 0.45 + twinkle : 0.16 + central * 0.25);
            context.fillStyle =
                star.energy > 0.9
                    ? '#ebdbb2'
                    : star.energy > 0.68
                      ? '#fabd2f'
                      : star.energy > 0.35
                        ? '#d5c4a1'
                        : '#a89984';
            context.fillText(
                star.energy > 0.88 ? '*' : star.energy > 0.58 ? 'o' : '.',
                x + point.x * radius * perspective,
                y + point.y * radius * perspective,
            );
        }
        if (layer === 0) {
            context.globalAlpha = opacity * 0.9;
            context.fillStyle = '#ebdbb2';
            context.font = `bold ${fontSize * 1.15}px "DM Mono", monospace`;
            context.fillText('***', x, y);
            context.font = `bold ${fontSize * 0.68}px "DM Mono", monospace`;
        }
    }
    context.globalAlpha = 1;
};

const drawB1509Pulsar = (
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) => {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const yaw = longitude * 0.42;
    const pitch = latitude * 0.48;
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
        context.font = `bold ${fontSize * 0.62}px "DM Mono", monospace`;
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
            context.globalAlpha = opacity * (layer ? 0.38 + depth * 0.34 : 0.16 - depth * 0.08);
            context.fillStyle = lane === 0 ? '#458588' : lane === 1 ? '#83a598' : '#b8bb26';
            context.fillText(
                sample % 5 === 0 ? '=' : sample % 2 ? '-' : '.',
                x + point.x * radius,
                y + point.y * radius * 0.72,
            );
        }

        context.font = `${fontSize * 0.56}px "DM Mono", monospace`;
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
                context.globalAlpha = opacity * (layer ? 0.28 + (1 - distance) * 0.44 : 0.1 + (1 - distance) * 0.2);
                context.fillStyle = side > 0 ? '#ebdbb2' : '#83a598';
                context.fillText(
                    sample % 6 === 0 ? '*' : sample % 3 === 0 ? ':' : '.',
                    x + point.x * radius * 1.18,
                    y + point.y * radius * 1.18,
                );
            }
        }

        if (layer === 0) {
            const starFontSize = fontSize * 0.72;
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
    if (options.name === 'Eta Carinae') drawEtaCarinae(context, options, radius, fontSize);
    else if (options.name === 'Cassiopeia A') drawCassiopeia(context, options, radius, fontSize);
    else if (options.name === 'Omega Centauri') drawOmegaCentauri(context, options, radius, fontSize);
    else if (options.name === 'PSR B1509-58') drawB1509Pulsar(context, options, radius, fontSize);
    else return false;
    return true;
};
