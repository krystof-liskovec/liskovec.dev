import type { GalacticRenderOptions } from './galactic-renderer';
import { randomUnit } from './math';

type VolumePoint = { x: number; y: number; z: number; energy: number; cool: boolean; phase: number };
const VOLUMES = new Map<string, VolumePoint[]>();
const COLUMNS = 78;
const ROWS = 56;
const STEP_X = 2.4 / COLUMNS;
const STEP_Y = 2.4 / ROWS;
const DENSITY = new Float32Array(COLUMNS * ROWS);
const COOL = new Float32Array(COLUMNS * ROWS);
const DEPTH = new Float32Array(COLUMNS * ROWS);
const RAMP = '.,:~=+*#';
const WARM = ['#9d512b', '#d65d0e', '#fe8019', '#fabd2f', '#ebdbb2'];
const FILAMENTS = ['#9d512b', '#fb4934', '#fe8019', '#d3869b', '#fabd2f'];
const BLUE = ['#458588', '#83a598', '#8ec07c', '#d5c4a1', '#ebdbb2'];
const GOLD = ['#a89984', '#d5c4a1', '#fabd2f', '#ebdbb2', '#fbf1c7'];

// These are object-space volumes, not screen-space textures. Generate them
// once when first opened; every camera turn reprojects their actual XYZ points.
function volumeFor(name: string) {
    const cached = VOLUMES.get(name);
    if (cached) return cached;
    const points: VolumePoint[] = [];
    const cluster = name === 'Omega Centauri';
    const count = cluster ? 1200 : 3400;
    for (let index = 0; index < count; index++) {
        const a = randomUnit(index * 7 + 17);
        const b = randomUnit(index * 7 + 113);
        const c = randomUnit(index * 7 + 271);
        const d = randomUnit(index * 7 + 503);
        const azimuth = a * Math.PI * 2;
        const vertical = b * 2 - 1;
        const horizontal = Math.sqrt(1 - vertical * vertical);
        let x = Math.cos(azimuth) * horizontal;
        let y = vertical;
        let z = Math.sin(azimuth) * horizontal;
        let energy = 0.3 + d * 0.6;
        let cool = false;
        if (name === 'Eta Carinae') {
            const side = index % 2 ? 1 : -1;
            const progress = 0.04 + b * 0.96;
            const shell = Math.sin(progress * Math.PI) ** 0.75 * 0.4 * (0.84 + c * 0.16);
            x = side * (0.035 + progress * 0.94);
            y = Math.cos(azimuth) * shell;
            z = Math.sin(azimuth) * shell;
            energy *= 0.65 + Math.sin(progress * 32 + azimuth * 3) ** 2 * 0.55;
            cool = side < 0;
        } else if (cluster) {
            const r = 0.025 + c ** 1.8 * 0.96;
            x *= r;
            y *= r;
            z *= r;
            energy = 0.35 + d * 0.65;
        } else if (name === 'Crab Nebula') {
            const interior = index % 5 === 0;
            const r = interior ? c * 0.55 : 0.77 + c * 0.17 + Math.sin(azimuth * 5) * 0.06;
            // Bright, curved ribs lie within the three-dimensional ejecta.
            if (index % 3 === 0) {
                const rib = (Math.floor(a * 18) / 18) * Math.PI * 2 + vertical * 0.16;
                x = Math.cos(rib) * horizontal;
                z = Math.sin(rib) * horizontal;
                energy *= 1.4;
            }
            x *= r * 0.79;
            y *= r;
            z *= r * 0.72;
            cool = interior;
        } else {
            const r = 0.7 + c * 0.16 + Math.sin(azimuth * 5 + vertical * 3) * 0.045;
            if (x > 0.63 && y < 0.25 && y > -0.28 && d > 0.12) continue;
            x *= r;
            y *= r;
            z *= r;
            energy *= 0.65 + Math.sin(azimuth * 13 + vertical * 9) ** 2 * 0.6;
            cool = d > 0.84;
        }
        points.push({ x, y, z, energy, cool, phase: d * Math.PI * 2 });
    }
    VOLUMES.set(name, points);
    return points;
}

export function drawVolumetricNebula(
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
) {
    const { name, x, y, longitude, latitude, opacity, reducedMotion, seconds } = options;
    const points = volumeFor(name);
    const cluster = name === 'Omega Centauri';
    const eta = name === 'Eta Carinae';
    const crab = name === 'Crab Nebula';
    const time = reducedMotion ? 0 : seconds;
    const yawCos = Math.cos(longitude);
    const yawSin = Math.sin(longitude);
    const pitchCos = Math.cos(latitude);
    const pitchSin = Math.sin(latitude);
    const roll = eta ? -0.55 : crab ? -0.3 : 0;
    const rollCos = Math.cos(roll);
    const rollSin = Math.sin(roll);
    DENSITY.fill(0);
    COOL.fill(0);
    DEPTH.fill(-Infinity);

    for (const point of points) {
        const localX = point.x * rollCos - point.y * rollSin;
        const localY = point.x * rollSin + point.y * rollCos;
        const turnedX = localX * yawCos + point.z * yawSin;
        const turnedZ = -localX * yawSin + point.z * yawCos;
        const turnedY = localY * pitchCos - turnedZ * pitchSin;
        const depth = localY * pitchSin + turnedZ * pitchCos;
        const perspective = 1 / (1 - depth * 0.22);
        const column = Math.round((turnedX * perspective) / STEP_X + (COLUMNS - 1) / 2);
        const row = Math.round((turnedY * perspective) / STEP_Y + (ROWS - 1) / 2);
        if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) continue;
        const cell = row * COLUMNS + column;
        const shimmer = 1 + Math.sin(time * 0.55 + point.phase) * 0.08;
        const shell = name === 'Cassiopeia A' || (crab && !point.cool);
        const limb = shell ? 0.18 + 0.82 * (1 - Math.min(1, Math.abs(depth) / 0.95)) ** 1.5 : 1;
        const brightness = point.energy * shimmer * (0.78 + depth * 0.25) * limb;
        // Emission accumulates through the cloud; nearer structures receive
        // stronger lighting, retaining a clear front/back cue on the ASCII grid.
        DENSITY[cell] += brightness * (cluster ? 1 : 0.48);
        if (point.cool) COOL[cell] += brightness * 0.48;
        DEPTH[cell] = Math.max(DEPTH[cell], depth);
    }

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `bold ${radius * STEP_Y}px "DM Mono", monospace`;
    for (let row = 0; row < ROWS; row++) {
        for (let column = 0; column < COLUMNS; column++) {
            const cell = row * COLUMNS + column;
            const density = DENSITY[cell];
            if (density < 0.09) continue;
            const energy = Math.sqrt(1 - Math.exp(-density));
            const palette = cluster ? GOLD : COOL[cell] > density * 0.5 ? BLUE : crab ? FILAMENTS : WARM;
            context.globalAlpha = opacity * Math.min(1, 0.35 + energy * 0.55 + Math.max(-0.15, DEPTH[cell] * 0.15));
            context.fillStyle = palette[Math.min(palette.length - 1, Math.floor(energy * palette.length))];
            const glyph = cluster
                ? energy > 0.9
                    ? '*'
                    : energy > 0.72
                      ? '+'
                      : energy > 0.5
                        ? 'o'
                        : '.'
                : RAMP[Math.min(RAMP.length - 1, Math.floor(energy * RAMP.length))];
            context.fillText(
                glyph,
                x + (column - (COLUMNS - 1) / 2) * STEP_X * radius,
                y + (row - (ROWS - 1) / 2) * STEP_Y * radius,
            );
        }
    }

    context.globalAlpha = opacity;
    context.fillStyle = '#fbf1c7';
    context.strokeStyle = '#1d2021';
    context.lineWidth = radius * 0.012;
    context.font = `bold ${radius * 0.065}px "DM Mono", monospace`;
    if (eta || crab) {
        context.fillText(eta ? '*+*' : '+', x, y);
    }
    context.restore();
}
