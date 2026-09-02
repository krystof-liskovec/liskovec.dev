import { getGlyphDrawer } from './glyph-atlas';
import type { WebGLParticleRenderer } from './webgl-particle-renderer';

export type ParticleGlyphDrawer = (glyph: string, x: number, y: number, alpha: number) => void;

export const createParticleGlyphDrawer = (
    context: CanvasRenderingContext2D,
    particleRenderer: WebGLParticleRenderer | null | undefined,
    font: string,
    color: string,
    pixelRatio: number,
): ParticleGlyphDrawer => {
    if (particleRenderer) return particleRenderer.getGlyphDrawer(font, color);

    const canvasDrawer = getGlyphDrawer(font, color, pixelRatio);
    return (glyph, x, y, alpha) => {
        context.globalAlpha = alpha;
        canvasDrawer(context, glyph, x, y);
    };
};
