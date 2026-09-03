import { STARS } from './solar-scene-data';
import { createParticleGlyphDrawer } from './particle-glyph';
import type { WebGLParticleRenderer } from './webgl-particle-renderer';

const STAR_GLYPHS = ['.', '*', '+'] as const;

export const drawLocalStarfield = (
    context: CanvasRenderingContext2D,
    options: {
        width: number;
        height: number;
        pointerX: number;
        pointerY: number;
        seconds: number;
        reducedMotion: boolean;
        opacity: number;
        renderLeft: number;
        renderTop: number;
        renderRight: number;
        renderBottom: number;
        pixelRatio: number;
        particleRenderer?: WebGLParticleRenderer | null;
    },
) => {
    const {
        width,
        height,
        pointerX,
        pointerY,
        seconds,
        reducedMotion,
        opacity,
        renderLeft,
        renderTop,
        renderRight,
        renderBottom,
        pixelRatio,
        particleRenderer,
    } = options;
    const parallaxX = pointerX * 8;
    const parallaxY = pointerY * 5;

    for (const glyph of STAR_GLYPHS) {
        const color = glyph === '+' ? '#fabd2f' : '#928374';
        const font = `${glyph === '+' ? 14 : 11}px "DM Mono", monospace`;
        const drawStarGlyph = createParticleGlyphDrawer(context, particleRenderer, font, color, pixelRatio);
        for (const star of STARS) {
            if (star.glyph !== glyph) continue;
            const pulse = reducedMotion ? 0.45 : 0.5 + 0.5 * Math.sin(seconds * star.speed * 2.2 + star.phase);
            const glyphAlpha = (0.16 + pulse * (glyph === '+' ? 0.82 : 0.46)) * opacity;
            const baseX = star.x * width + parallaxX;
            const baseY = star.y * height + parallaxY;
            for (let tileY = -1; tileY <= 1; tileY++) {
                const y = baseY + tileY * height;
                if (y < renderTop - 12 || y > renderBottom + 12) continue;
                for (let tileX = -1; tileX <= 1; tileX++) {
                    const x = baseX + tileX * width;
                    if (x < renderLeft - 12 || x > renderRight + 12) continue;
                    drawStarGlyph(glyph, x, y, glyphAlpha);
                }
            }
        }
    }
    context.globalAlpha = 1;
};
