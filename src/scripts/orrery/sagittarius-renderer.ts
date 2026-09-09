import type { GalacticRenderOptions } from './galactic-renderer';
import { randomUnit, smoothstep } from './math';

// Sample the light field on a fixed character grid. The image grows with the
// focus transition without changing its topology or allocating frame particles.
const COLUMNS = 96;
const ROWS = 50;
const CELL_WIDTH = 2.4 / COLUMNS;
const CELL_HEIGHT = 1.9 / ROWS;
const GRAIN = Float32Array.from({ length: COLUMNS * ROWS }, (_, index) => randomUnit(index + 830));
const RAMP = '.,:;~=+*#';
const COLORS = ['#665c54', '#9d512b', '#d65d0e', '#fe8019', '#fabd2f', '#ebdbb2', '#fbf1c7'];
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Artistic lensing model: a tilted disk, its bent far-side image, and a photon ring. */
export function drawSagittarius(context: CanvasRenderingContext2D, options: GalacticRenderOptions, radius: number) {
    const { x, y, opacity, longitude, latitude, reducedMotion, seconds } = options;
    if (opacity <= 0 || radius <= 0) return;
    radius *= 1.16;
    const time = reducedMotion ? 0 : seconds;
    const inclination = Math.max(0.12, Math.min(0.72, 0.25 + Math.sin(latitude) * 0.48));
    const roll = -0.08 + Math.sin(longitude * 0.5) * 0.16;
    const cosine = Math.cos(roll);
    const sine = Math.sin(roll);
    const spin = longitude + time * 0.16;
    const shadowRadius = 0.315;

    context.save();
    context.translate(x, y);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `bold ${radius * CELL_HEIGHT}px "DM Mono", monospace`;

    for (let row = 0; row < ROWS; row++) {
        const screenY = (row - (ROWS - 1) / 2) * CELL_HEIGHT;
        for (let column = 0; column < COLUMNS; column++) {
            const screenX = (column - (COLUMNS - 1) / 2) * CELL_WIDTH;
            const localX = screenX * cosine + screenY * sine;
            const localY = -screenX * sine + screenY * cosine;
            const distance = Math.hypot(localX, localY);
            const grain = GRAIN[row * COLUMNS + column];
            // A dense character field makes the shadow part of the same ASCII
            // image. Individual glyph strokes quiet the stars behind it without
            // introducing a solid geometric disk.
            if (distance < shadowRadius) {
                const shadowGlyph = distance < 0.19 ? '@' : '#';
                context.globalAlpha = opacity;
                context.strokeStyle = '#1d2021';
                context.lineWidth = radius * CELL_WIDTH * 0.5;
                context.strokeText(shadowGlyph, screenX * radius, screenY * radius);
                context.fillStyle = '#000000';
                context.fillText(shadowGlyph, screenX * radius, screenY * radius);
            }
            let light = 0;

            // The distant disk wraps over the shadow. A smaller, fainter image
            // below it gives the characteristic gravitational-lensing silhouette.
            const upper = localY < 0;
            const lensHeight = upper ? 0.94 : 0.76;
            const lensRadius = Math.hypot(localX, localY / lensHeight);
            const lensAngle = Math.atan2(localY / lensHeight, localX);
            const lensInner = 0.35;
            const lensOuter = 0.56;
            if (lensRadius > lensInner && lensRadius < lensOuter) {
                const envelope = Math.sin(((lensRadius - lensInner) / (lensOuter - lensInner)) * Math.PI);
                const strands = 0.65 + 0.35 * Math.sin(lensRadius * 190 + Math.sin(lensAngle * 3 - spin) * 1.8);
                const beaming = 0.66 - localX * 0.48;
                light = envelope * strands * beaming * (upper ? 1.35 : 0.62);
            }

            // Differential rotation shears the hot gas into fine concentric
            // filaments. The approaching (left) limb is brighter and warmer.
            const diskY = (localY - 0.055) / inclination;
            const diskRadius = Math.hypot(localX, diskY);
            const foreground = localY > 0.055;
            if (diskRadius > 0.4 && diskRadius < 1.13 && (distance > shadowRadius || foreground)) {
                const angle = Math.atan2(diskY, localX);
                const phase = angle - spin / Math.max(0.35, diskRadius ** 1.5);
                const filaments = Math.sin(diskRadius * 130 + Math.sin(phase * 3 + diskRadius * 12) * 2);
                const turbulence = Math.sin(phase * 7 + diskRadius * 23) * Math.sin(phase * 3 - diskRadius * 31);
                const innerFade = smoothstep((diskRadius - 0.4) / 0.09);
                const outerFade = 1 - smoothstep((diskRadius - 0.65) / 0.48);
                const heat = (0.62 + filaments * 0.19 + turbulence * 0.12) * innerFade * outerFade;
                const beaming = 0.85 - (localX / diskRadius) * 0.38;
                const hotArc = Math.max(0, Math.cos(phase - 1.2)) ** 16 * 0.22;
                const diskLight = (heat * beaming + hotArc * innerFade * outerFade) * (foreground ? 1.15 : 0.7);
                light = foreground ? Math.max(light * 0.3, diskLight) : Math.max(light, diskLight);
            }

            // Keep the upper shadow empty. A narrow photon ring traces its
            // circular edge independently of the disk's viewing inclination.
            if (distance < shadowRadius && !foreground) light = 0;
            const ring = Math.max(0, 1 - Math.abs(distance - 0.327) / 0.025);
            const ringLight = Math.sqrt(ring) * (0.9 - localX * 0.5);
            const isRing = ringLight > light && ring > 0.2;
            light = Math.max(light, ringLight);
            light *= 0.78 + grain * 0.34;
            if (light < 0.075 || (light < 0.18 && grain > light * 4)) continue;

            const energy = Math.sqrt(clamp(light));
            context.globalAlpha = opacity * clamp(0.18 + energy * 0.88);
            context.fillStyle = COLORS[Math.min(COLORS.length - 1, Math.floor(energy * COLORS.length))];
            context.fillText(
                isRing
                    ? Math.abs(screenY) > distance * 0.85
                        ? '-'
                        : Math.abs(screenX) > distance * 0.85
                          ? '|'
                          : screenX * screenY > 0
                            ? '/'
                            : '\\'
                    : RAMP[Math.min(RAMP.length - 1, Math.floor(energy * RAMP.length))],
                screenX * radius,
                screenY * radius,
            );
        }
    }
    context.restore();
}
