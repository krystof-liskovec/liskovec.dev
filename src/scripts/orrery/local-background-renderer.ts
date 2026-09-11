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
        cameraLongitude: number;
        cameraLatitude: number;
        cameraRoll: number;
        seconds: number;
        reducedMotion: boolean;
        opacity: number;
        starDensity: number;
        starScale: number;
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
        cameraLongitude,
        cameraLatitude,
        cameraRoll,
        seconds,
        reducedMotion,
        opacity,
        starDensity,
        starScale,
        renderLeft,
        renderTop,
        renderRight,
        renderBottom,
        pixelRatio,
        particleRenderer,
    } = options;
    // Keep the nearby starfield attached to the camera during both solar-system
    // and planetary close-up movement. These offsets are deliberately stronger
    // than the pointer parallax: camera turns are scene motion, not decoration.
    const cameraParallaxX = cameraLongitude * Math.min(150, Math.max(52, width * 0.13));
    const cameraParallaxY = cameraLatitude * Math.min(100, Math.max(36, height * 0.13));
    const parallaxX = pointerX * 8 + cameraParallaxX;
    const parallaxY = pointerY * 5 + cameraParallaxY;
    const rollCosine = Math.cos(cameraRoll);
    const rollSine = Math.sin(cameraRoll);

    for (const glyph of STAR_GLYPHS) {
        const color = glyph === '+' ? '#fabd2f' : '#928374';
        const font = `${(glyph === '+' ? 14 : 11) * starScale}px "DM Mono", monospace`;
        const drawStarGlyph = createParticleGlyphDrawer(context, particleRenderer, font, color, pixelRatio);
        for (let starIndex = 0; starIndex < STARS.length; starIndex++) {
            if (starIndex >= Math.ceil(STARS.length * starDensity)) continue;
            const star = STARS[starIndex];
            if (star.glyph !== glyph) continue;
            const pulse = reducedMotion ? 0.45 : 0.5 + 0.5 * Math.sin(seconds * star.speed * 2.2 + star.phase);
            const glyphAlpha = (0.16 + pulse * (glyph === '+' ? 0.82 : 0.46)) * opacity;
            for (let tileY = -1; tileY <= 1; tileY++) {
                const baseY = star.y * height + tileY * height;
                for (let tileX = -1; tileX <= 1; tileX++) {
                    const baseX = star.x * width + tileX * width;
                    const relativeX = baseX - width / 2;
                    const relativeY = baseY - height / 2;
                    const x = width / 2 + relativeX * rollCosine - relativeY * rollSine + parallaxX;
                    const y = height / 2 + relativeX * rollSine + relativeY * rollCosine + parallaxY;
                    if (y < renderTop - 12 || y > renderBottom + 12) continue;
                    if (x < renderLeft - 12 || x > renderRight + 12) continue;
                    drawStarGlyph(glyph, x, y, glyphAlpha);
                }
            }
        }
    }
    context.globalAlpha = 1;
};
