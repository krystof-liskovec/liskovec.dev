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
