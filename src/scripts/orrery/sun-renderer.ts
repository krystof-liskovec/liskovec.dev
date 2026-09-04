import { decorativeRotation, planetSurfaceGlyph } from './planet-textures';

type SunRenderOptions = {
    x: number;
    y: number;
    scale: number;
    opacity: number;
    seconds: number;
    reducedMotion: boolean;
    planetRotationOffset: number;
    planetTiltOffset: number;
};

const SURFACE_COLUMNS = 17;
const SURFACE_ROW_WIDTHS = [7, 13, 15, 17, 17, 17, 15, 13, 7];
// Match the center of the scene's subtle orange glow. The fill still acts as
// an opaque occlusion mask, but no longer reads as a darker patch behind Sol.
const SUN_MASK_COLOR = '#2b2621';
const SUN_CAMERA_SURFACE_INFLUENCE = 0.35;
const SUN_CAMERA_SURFACE_SPEED = 2.4;

let smoothedCameraRotation: number | null = null;
let smoothedCameraTilt: number | null = null;
let lastSurfaceSeconds = -1;

const approach = (current: number, target: number, maximumStep: number) => {
    const distance = target - current;
    return Math.abs(distance) <= maximumStep ? target : current + Math.sign(distance) * maximumStep;
};

const smoothCameraSurface = (rotation: number, tilt: number, seconds: number) => {
    const frameSeconds = lastSurfaceSeconds < 0 ? 0 : Math.min(0.05, Math.max(0, seconds - lastSurfaceSeconds));
    lastSurfaceSeconds = seconds;
    if (smoothedCameraRotation === null || smoothedCameraTilt === null) {
        smoothedCameraRotation = rotation;
        smoothedCameraTilt = tilt;
        return { rotation, tilt };
    }

    const maximumStep = frameSeconds * SUN_CAMERA_SURFACE_SPEED;
    smoothedCameraRotation = approach(smoothedCameraRotation, rotation, maximumStep);
    smoothedCameraTilt = approach(smoothedCameraTilt, tilt, maximumStep);
    return { rotation: smoothedCameraRotation, tilt: smoothedCameraTilt };
};

export function drawSun(context: CanvasRenderingContext2D, options: SunRenderOptions) {
    const { x, y, scale, opacity, seconds, reducedMotion, planetRotationOffset, planetTiltOffset } = options;
    if (opacity <= 0.001) return;

    const pulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 1.35) * 0.018;
    const fontSize = 8.9 * pulse * Math.max(0.3, Math.sqrt(scale));
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
    // Dragging can move the camera across several discrete ASCII texture cells
    // in one frame. Ease only the camera contribution so the surface follows
    // the scene without making its spots flash between glyphs.
    const cameraSurface = smoothCameraSurface(
        planetRotationOffset * SUN_CAMERA_SURFACE_INFLUENCE,
        planetTiltOffset * SUN_CAMERA_SURFACE_INFLUENCE,
        seconds,
    );
    const spin = decorativeRotation('Sol', seconds, reducedMotion) + cameraSurface.rotation;
    const tiltCosine = Math.cos(cameraSurface.tilt);
    const tiltSine = Math.sin(cameraSurface.tilt);
    const middleRow = (SURFACE_ROW_WIDTHS.length - 1) / 2;

    // The glyphs describe an opaque sphere. Mask the interior before drawing
    // them so orbit marks and bodies on the far side cannot show through the
    // whitespace between individual ASCII character cells.
    context.beginPath();
    context.ellipse(
        0,
        0,
        SURFACE_COLUMNS * characterWidth * 0.51,
        SURFACE_ROW_WIDTHS.length * lineHeight * 0.51,
        0,
        0,
        Math.PI * 2,
    );
    context.fillStyle = SUN_MASK_COLOR;
    context.globalAlpha = opacity;
    context.fill();

    SURFACE_ROW_WIDTHS.forEach((rowWidth, row) => {
        const normalizedY = (row - middleRow) / (SURFACE_ROW_WIDTHS.length / 2);
        const firstColumn = (SURFACE_COLUMNS - rowWidth) / 2;
        const cellY = (row - middleRow) * lineHeight;
        for (let rowColumn = 0; rowColumn < rowWidth; rowColumn++) {
            const column = firstColumn + rowColumn;
            const normalizedX = (column - (SURFACE_COLUMNS - 1) / 2) / (SURFACE_COLUMNS / 2);
            const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
            const surfaceY = -normalizedY;
            const tiltedY = surfaceY * tiltCosine + sphereZ * tiltSine;
            const tiltedZ = -surfaceY * tiltSine + sphereZ * tiltCosine;
            const longitude = Math.atan2(normalizedX, tiltedZ) + spin;
            const latitude = Math.asin(Math.max(-1, Math.min(1, tiltedY)));
            const isFirst = rowColumn === 0;
            const isLast = rowColumn === rowWidth - 1;
            const isTop = row === 0;
            const isBottom = row === SURFACE_ROW_WIDTHS.length - 1;
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
            const cellX = (column - (SURFACE_COLUMNS - 1) / 2) * characterWidth;
            context.globalAlpha =
                opacity * (0.72 + sphereZ * 0.26 + Math.sin(seconds * 1.1 + row * 1.7) * (reducedMotion ? 0 : 0.02));
            context.fillStyle = isContour
                ? '#fabd2f'
                : glyph === '@'
                  ? '#d65d0e'
                  : glyph === '*' || glyph === '~'
                    ? '#fe8019'
                    : glyph === ':' || glyph === '.'
                      ? '#d79921'
                      : '#fabd2f';
            context.strokeText(glyph, cellX, cellY);
            context.fillText(glyph, cellX, cellY);
        }
    });

    context.restore();
}
