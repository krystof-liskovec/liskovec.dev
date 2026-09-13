import { decorativeRotation, planetSurfaceColor, planetSurfaceGlyph, sunSurfaceLight } from './planet-textures';
import { drawSoftSceneMask } from './scene-mask';
import { isOutsideRenderBounds } from './math';
import type { RenderBounds } from './render-metrics';

type SunRenderOptions = {
    bounds: RenderBounds;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    seconds: number;
    reducedMotion: boolean;
    planetRotationOffset: number;
    planetTiltOffset: number;
    detailReveal?: number;
    maskColor?: string;
};

const SURFACE_COLUMNS = 17;
const SURFACE_ROW_WIDTHS = [7, 13, 15, 17, 17, 17, 15, 13, 7];
const DETAILED_SURFACE_COLUMNS = 33;
const DETAILED_SURFACE_ROW_WIDTHS = [9, 15, 21, 25, 27, 29, 31, 33, 33, 33, 31, 29, 27, 25, 21, 15, 9];
// Match the center of the scene's subtle orange glow. The fill still acts as
// an opaque occlusion mask, but no longer reads as a darker patch behind Sol.
export const SUN_MASK_COLOR = '#2b2621';
const SUN_CAMERA_SURFACE_INFLUENCE = 0.35;
const SUN_CAMERA_SURFACE_SPEED = 2.4;

let smoothedCameraTilt: number | null = null;
let lastSurfaceSeconds = -1;

const approach = (current: number, target: number, maximumStep: number) => {
    const distance = target - current;
    return Math.abs(distance) <= maximumStep ? target : current + Math.sign(distance) * maximumStep;
};

const smoothCameraSurface = (rotation: number, tilt: number, seconds: number) => {
    const frameSeconds = lastSurfaceSeconds < 0 ? 0 : Math.min(0.05, Math.max(0, seconds - lastSurfaceSeconds));
    lastSurfaceSeconds = seconds;
    if (smoothedCameraTilt === null) {
        smoothedCameraTilt = tilt;
        return { rotation, tilt };
    }

    const maximumStep = frameSeconds * SUN_CAMERA_SURFACE_SPEED;
    smoothedCameraTilt = approach(smoothedCameraTilt, tilt, maximumStep);
    return { rotation, tilt: smoothedCameraTilt };
};

type SunAtmosphereOptions = {
    x: number;
    y: number;
    radiusX: number;
    radiusY: number;
    fontSize: number;
    opacity: number;
    seconds: number;
    reducedMotion: boolean;
    detailed: boolean;
};

const SUN_GLOW_TEXTURE_SIZE = 256;
const SUN_GLOW_TEXTURE_EXTENT = 1.5;
let sunGlowTexture: HTMLCanvasElement | null = null;

const createSunGlowTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SUN_GLOW_TEXTURE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const unit = SUN_GLOW_TEXTURE_SIZE / (SUN_GLOW_TEXTURE_EXTENT * 2);
    context.translate(SUN_GLOW_TEXTURE_SIZE / 2, SUN_GLOW_TEXTURE_SIZE / 2);
    context.scale(unit, unit);
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, 1.25);
    glow.addColorStop(0, 'rgba(214, 93, 14, 0.13)');
    glow.addColorStop(0.2, 'rgba(245, 154, 35, 0.095)');
    glow.addColorStop(0.5, 'rgba(255, 195, 77, 0.04)');
    glow.addColorStop(0.8, 'rgba(168, 153, 132, 0.012)');
    glow.addColorStop(1, 'rgba(168, 153, 132, 0)');
    context.fillStyle = glow;
    context.fillRect(-1.25, -1.25, 2.5, 2.5);
    return canvas;
};

/** Cached diffuse light that follows Sol's projected canvas position. */
export function drawSunGlow(
    context: CanvasRenderingContext2D,
    options: { x: number; y: number; scale: number; opacity: number },
) {
    if (options.opacity <= 0.001 || options.scale <= 0) return;
    sunGlowTexture ??= createSunGlowTexture();
    if (!sunGlowTexture) return;
    const fontSize = 8.9 * Math.max(0.3, Math.sqrt(options.scale));
    const radiusX = 17 * fontSize * 0.46 * 0.5;
    const radiusY = (9 * fontSize * 0.78) / 2;
    context.save();
    context.globalAlpha = options.opacity * 0.72;
    context.imageSmoothingEnabled = true;
    context.translate(options.x, options.y);
    // Keep the diffuse layer broad enough to reach the asteroid belt and the
    // inner Jupiter lane, matching the former scene-level halo's footprint.
    context.scale(radiusX * 8.2, radiusY * 8.2);
    context.drawImage(
        sunGlowTexture,
        -SUN_GLOW_TEXTURE_EXTENT,
        -SUN_GLOW_TEXTURE_EXTENT,
        SUN_GLOW_TEXTURE_EXTENT * 2,
        SUN_GLOW_TEXTURE_EXTENT * 2,
    );
    context.restore();
}

// A restrained, illustrative corona.
// Fixed samples keep the atmosphere stable between frames; motion only gently
// changes streamer length, with no random flickering.
export function drawSunAtmosphere(context: CanvasRenderingContext2D, options: SunAtmosphereOptions) {
    const { x, y, radiusX, radiusY, fontSize, opacity, seconds, reducedMotion, detailed } = options;
    if (opacity <= 0.001) return;
    const time = reducedMotion ? 0 : seconds;
    const samples = detailed ? 96 : 32;
    const layers = detailed ? 5 : 2;
    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `${fontSize * 0.8}px "DM Mono", monospace`;
    context.shadowBlur = 0;
    for (let sample = 0; sample < samples; sample++) {
        const angle = (sample / samples) * Math.PI * 2;
        const streamer = (0.5 + 0.5 * Math.sin(angle * 5 + Math.sin(angle * 3))) ** 3;
        const breath = Math.sin(time * 0.45 + angle * 3) * 0.015;
        for (let layer = 0; layer < layers; layer++) {
            const distance = 1.055 + layer * (0.042 + streamer * 0.055) + breath * layer;
            const curl = angle + Math.sin(angle * 7 + layer * 0.4) * layer * 0.005;
            context.globalAlpha = opacity * (0.23 - layer * 0.037) * (0.65 + streamer * 0.35);
            context.fillStyle = layer === 0 ? '#f59a23' : '#ffc34d';
            context.fillText(
                layer === 0 && sample % 3 === 0 ? ':' : '.',
                x + Math.cos(curl) * radiusX * distance,
                y + Math.sin(curl) * radiusY * distance,
            );
        }
    }
    context.restore();
}

export function drawSun(context: CanvasRenderingContext2D, options: SunRenderOptions) {
    const {
        x,
        y,
        scale,
        opacity,
        seconds,
        reducedMotion,
        planetRotationOffset,
        planetTiltOffset,
        detailReveal = 0,
    } = options;
    if (opacity <= 0.001) return;
    if (detailReveal > 0 && detailReveal < 1) {
        drawSun(context, { ...options, opacity: opacity * (1 - detailReveal), detailReveal: 0 });
        drawSun(context, { ...options, opacity: opacity * detailReveal, detailReveal: 1 });
        return;
    }
    const detailed = detailReveal >= 1;

    const pulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 1.35) * 0.018;
    const surfaceColumns = detailed ? DETAILED_SURFACE_COLUMNS : SURFACE_COLUMNS;
    const surfaceRowWidths = detailed ? DETAILED_SURFACE_ROW_WIDTHS : SURFACE_ROW_WIDTHS;
    const detailDensity = surfaceColumns / SURFACE_COLUMNS;
    const fontSize = (8.9 * pulse * Math.max(0.3, Math.sqrt(scale))) / detailDensity;
    const lineHeight = fontSize * 0.78;

    context.save();
    context.translate(x, y);
    // Monospace character cells are wider than this line spacing. Compressing
    // the x-axis keeps equal ASCII row/column radii visually circular.
    context.scale(0.9, 1);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `bold ${fontSize}px "DM Mono", monospace`;

    context.shadowBlur = 0;
    context.strokeStyle = '#1d2021';
    context.lineWidth = Math.max(1.2, fontSize * 0.15);
    const characterWidth = context.measureText('M').width * 0.76;
    // Keep the camera-driven longitude synchronous with the rest of the solar
    // system. Only ease tilt, where a small transition is less noticeable than
    // a lagging surface during a rapid horizontal rotation.
    const cameraSurface = smoothCameraSurface(
        planetRotationOffset * SUN_CAMERA_SURFACE_INFLUENCE,
        planetTiltOffset * SUN_CAMERA_SURFACE_INFLUENCE,
        seconds,
    );
    // Keep camera smoothing current while skipping hidden surface/corona work.
    // The outermost streamer reaches at most 1.503 times the sphere radius.
    if (
        isOutsideRenderBounds(
            x,
            y,
            surfaceColumns * characterWidth * 0.5 * 0.9 * 1.6 + fontSize * 2,
            surfaceRowWidths.length * lineHeight * 0.5 * 1.6 + fontSize * 2,
            options.bounds,
        )
    ) {
        context.restore();
        return;
    }
    const spin = decorativeRotation('Sol', seconds, reducedMotion) + cameraSurface.rotation;
    const tiltCosine = Math.cos(cameraSurface.tilt);
    const tiltSine = Math.sin(cameraSurface.tilt);
    const middleRow = (surfaceRowWidths.length - 1) / 2;

    drawSunAtmosphere(context, {
        x: 0,
        y: 0,
        radiusX: (surfaceColumns * characterWidth) / 2,
        radiusY: (surfaceRowWidths.length * lineHeight) / 2,
        fontSize,
        opacity,
        seconds,
        reducedMotion,
        detailed,
    });

    // The glyphs describe an opaque sphere. Mask the interior before drawing
    // them so orbit marks and bodies on the far side cannot show through the
    // whitespace between individual ASCII character cells.
    drawSoftSceneMask(context, {
        x: 0,
        y: 0,
        radiusX: surfaceColumns * characterWidth * 0.51,
        radiusY: surfaceRowWidths.length * lineHeight * 0.51,
        opacity,
        color: options.maskColor ?? SUN_MASK_COLOR,
    });

    surfaceRowWidths.forEach((rowWidth, row) => {
        const normalizedY = (row - middleRow) / (surfaceRowWidths.length / 2);
        const firstColumn = (surfaceColumns - rowWidth) / 2;
        const cellY = (row - middleRow) * lineHeight;
        for (let rowColumn = 0; rowColumn < rowWidth; rowColumn++) {
            const column = firstColumn + rowColumn;
            const normalizedX = (column - (surfaceColumns - 1) / 2) / (surfaceColumns / 2);
            const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
            const surfaceY = -normalizedY;
            const tiltedY = surfaceY * tiltCosine + sphereZ * tiltSine;
            const tiltedZ = -surfaceY * tiltSine + sphereZ * tiltCosine;
            const longitude = Math.atan2(normalizedX, tiltedZ) + spin;
            const latitude = Math.asin(Math.max(-1, Math.min(1, tiltedY)));
            const isFirst = rowColumn === 0;
            const isLast = rowColumn === rowWidth - 1;
            const isTop = row === 0;
            const isBottom = row === surfaceRowWidths.length - 1;
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
                    ? row < middleRow
                        ? '/'
                        : row > middleRow
                          ? '\\'
                          : '|'
                    : isLast
                      ? row < middleRow
                          ? '\\'
                          : row > middleRow
                            ? '/'
                            : '|'
                      : planetSurfaceGlyph('Sol', longitude, latitude);
            const cellX = (column - (surfaceColumns - 1) / 2) * characterWidth;
            context.globalAlpha = opacity * sunSurfaceLight(sphereZ);
            context.fillStyle = isContour ? '#f59a23' : planetSurfaceColor('Sol', glyph, '#ffc12e');
            context.strokeText(glyph, cellX, cellY);
            context.fillText(glyph, cellX, cellY);
        }
    });

    context.restore();
}
