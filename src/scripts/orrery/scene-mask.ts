const SCENE_BACKGROUND = [29, 32, 33] as const;
const SCENE_GLOW = [254, 128, 25] as const;

export const sceneMaskColor = (x: number, y: number, width: number, height: number, isOgPreview: boolean) => {
    const glowX = width * 0.52;
    const glowY = height * 0.38;
    const glowOpacity = isOgPreview ? 0.12 : 0.06;
    const farthestCorner = Math.max(
        Math.hypot(glowX, glowY),
        Math.hypot(width - glowX, glowY),
        Math.hypot(glowX, height - glowY),
        Math.hypot(width - glowX, height - glowY),
    );
    const glowProgress = Math.min(1, Math.hypot(x - glowX, y - glowY) / (farthestCorner * 0.56));
    const alpha = glowOpacity * (1 - glowProgress);
    const channels = SCENE_BACKGROUND.map((channel, index) =>
        Math.round(channel + (SCENE_GLOW[index] - channel) * alpha),
    );
    return `rgb(${channels.join(', ')})`;
};

export const drawSoftSceneMask = (
    context: CanvasRenderingContext2D,
    options: {
        x: number;
        y: number;
        radiusX: number;
        radiusY: number;
        opacity: number;
        color: string;
    },
) => {
    if (options.opacity <= 0.001 || options.radiusX <= 0 || options.radiusY <= 0) return;
    context.save();
    context.translate(options.x, options.y);
    context.scale(options.radiusX, options.radiusY);
    const mask = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    mask.addColorStop(0, options.color);
    mask.addColorStop(0.78, options.color);
    mask.addColorStop(1, 'rgba(29, 32, 33, 0)');
    context.fillStyle = mask;
    context.globalAlpha = options.opacity;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
};
