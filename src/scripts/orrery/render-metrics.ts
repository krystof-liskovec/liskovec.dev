export type RenderMetrics = {
    width: number;
    height: number;
    renderWidth: number;
    renderHeight: number;
    systemLeft: number;
    systemTop: number;
    canvasOriginX: number;
    canvasOriginY: number;
    renderLeft: number;
    renderTop: number;
    renderRight: number;
    renderBottom: number;
    dirty: boolean;
};

export type RenderMetricsController = {
    metrics: RenderMetrics;
    invalidate: () => void;
    update: () => void;
    disconnect: () => void;
};

export const createRenderMetrics = (
    canvas: HTMLCanvasElement,
    system: HTMLElement,
    onInvalidated: () => void,
): RenderMetricsController => {
    const metrics: RenderMetrics = {
        width: 0,
        height: 0,
        renderWidth: 0,
        renderHeight: 0,
        systemLeft: 0,
        systemTop: 0,
        canvasOriginX: 0,
        canvasOriginY: 0,
        renderLeft: 0,
        renderTop: 0,
        renderRight: 0,
        renderBottom: 0,
        dirty: true,
    };

    const invalidate = () => {
        metrics.dirty = true;
        onInvalidated();
    };

    const update = () => {
        const canvasBounds = canvas.getBoundingClientRect();
        const systemBounds = system.getBoundingClientRect();
        metrics.width = system.clientWidth;
        metrics.height = system.clientHeight;
        metrics.renderWidth = canvas.clientWidth;
        metrics.renderHeight = canvas.clientHeight;
        metrics.systemLeft = systemBounds.left;
        metrics.systemTop = systemBounds.top;
        metrics.canvasOriginX = systemBounds.left - canvasBounds.left;
        metrics.canvasOriginY = systemBounds.top - canvasBounds.top;
        metrics.renderLeft = -metrics.canvasOriginX;
        metrics.renderTop = -metrics.canvasOriginY;
        metrics.renderRight = metrics.renderWidth - metrics.canvasOriginX;
        metrics.renderBottom = metrics.renderHeight - metrics.canvasOriginY;
        metrics.dirty = false;
    };

    const observer = new ResizeObserver(invalidate);
    observer.observe(system);
    observer.observe(canvas);
    window.addEventListener('resize', invalidate, { passive: true });
    window.addEventListener('scroll', invalidate, { passive: true });

    return {
        metrics,
        invalidate,
        update,
        disconnect: () => {
            observer.disconnect();
            window.removeEventListener('resize', invalidate);
            window.removeEventListener('scroll', invalidate);
        },
    };
};
