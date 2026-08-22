type ReadoutOptions = {
    lines: string[];
    anchorX: number;
    anchorY: number;
    viewportWidth: number;
    viewportHeight: number;
    titleColor: string;
    width?: number;
    openAwayFromCenter?: boolean;
    opacity?: number;
};

export function drawReadout(context: CanvasRenderingContext2D, options: ReadoutOptions) {
    const {
        lines,
        anchorX,
        anchorY,
        viewportWidth,
        viewportHeight,
        titleColor,
        openAwayFromCenter = false,
        opacity = 1,
    } = options;
    const width = Math.min(options.width ?? 224, viewportWidth - 16);
    const height = lines.length * 16 + 18;
    const rightX = anchorX + 25;
    const leftX = anchorX - width - 25;
    const preferredX = openAwayFromCenter
        ? anchorX < viewportWidth / 2
            ? leftX >= 8
                ? leftX
                : rightX
            : rightX + width <= viewportWidth - 8
              ? rightX
              : leftX
        : rightX + width <= viewportWidth - 8
          ? rightX
          : leftX;
    const x = Math.min(viewportWidth - width - 8, Math.max(8, preferredX));
    const y = Math.min(viewportHeight - height - 8, Math.max(8, anchorY - height / 2));

    context.save();
    context.globalAlpha = 0.94 * opacity;
    context.fillStyle = '#1d2021';
    context.fillRect(x, y, width, height);
    context.strokeStyle = '#665c54';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    context.globalAlpha = opacity;
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.font = '12px "DM Mono", monospace';
    lines.forEach((line, index) => {
        context.fillStyle = index === 0 ? titleColor : index === lines.length - 1 ? '#fabd2f' : '#a89984';
        context.fillText(line, x + 11, y + 10 + index * 16);
    });
    context.restore();
}
