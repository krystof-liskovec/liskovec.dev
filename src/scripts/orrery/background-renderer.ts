import {
    GALACTIC_DISK,
    GALACTIC_DUST_LANES,
    GALACTIC_NEBULAE,
    GALAXY_STARS,
    LOCAL_ARM_STARS,
    STARS,
} from './scene-data';
import { galacticPatternPhase, moveGalacticMaterial } from './galactic-simulation';
import { getGlyphDrawer, type GlyphDrawer } from './glyph-atlas';

type Offset = { x: number; y: number };
type GalacticOffset = (x: number, y: number, radius: number, target: Offset) => Offset;

const STAR_GLYPHS = ['.', '*', '+'] as const;
const offsetScratch = { x: 0, y: 0 };

const projectPatternPoint = (
    x: number,
    y: number,
    patternCosine: number,
    patternSine: number,
    radius: number,
    projectOffset: GalacticOffset,
) => {
    const movedX = x * patternCosine + y * patternSine;
    const movedY = -x * patternSine + y * patternCosine;
    return projectOffset(movedX, movedY, radius, offsetScratch);
};

const projectMaterialPoint = (
    x: number,
    y: number,
    elapsedGalacticYears: number,
    radius: number,
    projectOffset: GalacticOffset,
) => {
    const moved = moveGalacticMaterial(x, y, elapsedGalacticYears, offsetScratch);
    return projectOffset(moved.x, moved.y, radius, offsetScratch);
};

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
    } = options;
    const parallaxX = pointerX * 8;
    const parallaxY = pointerY * 5;

    for (const glyph of STAR_GLYPHS) {
        const color = glyph === '+' ? '#fabd2f' : '#928374';
        const font = `${glyph === '+' ? 14 : 11}px "DM Mono", monospace`;
        const drawStarGlyph = getGlyphDrawer(font, color, pixelRatio);
        for (const star of STARS) {
            if (star.glyph !== glyph) continue;
            const pulse = reducedMotion ? 0.45 : 0.5 + 0.5 * Math.sin(seconds * star.speed * 2.2 + star.phase);
            context.globalAlpha = (0.16 + pulse * (glyph === '+' ? 0.82 : 0.46)) * opacity;
            const baseX = star.x * width + parallaxX;
            const baseY = star.y * height + parallaxY;
            for (let tileY = -1; tileY <= 1; tileY++) {
                const y = baseY + tileY * height;
                if (y < renderTop - 12 || y > renderBottom + 12) continue;
                for (let tileX = -1; tileX <= 1; tileX++) {
                    const x = baseX + tileX * width;
                    if (x < renderLeft - 12 || x > renderRight + 12) continue;
                    drawStarGlyph(context, glyph, x, y);
                }
            }
        }
    }
    context.globalAlpha = 1;
};

export const drawGalaxyBackdrop = (
    context: CanvasRenderingContext2D,
    options: {
        width: number;
        height: number;
        seconds: number;
        elapsedGalacticYears: number;
        reducedMotion: boolean;
        alpha: number;
        radius: number;
        coreX: number;
        coreY: number;
        projectOffset: GalacticOffset;
        renderLeft: number;
        renderTop: number;
        renderRight: number;
        renderBottom: number;
        pixelRatio: number;
    },
) => {
    const {
        width,
        seconds,
        elapsedGalacticYears,
        reducedMotion,
        alpha,
        radius,
        coreX,
        coreY,
        projectOffset,
        renderLeft,
        renderTop,
        renderRight,
        renderBottom,
        pixelRatio,
    } = options;
    if (alpha <= 0.001) return;

    const patternPhase = galacticPatternPhase(elapsedGalacticYears);
    const patternCosine = Math.cos(patternPhase);
    const patternSine = Math.sin(patternPhase);

    const diskFont = `${width < 600 ? 6.5 : 8}px "DM Mono", monospace`;
    const drawDiskGlyph = getGlyphDrawer(diskFont, '#665c54', pixelRatio);
    for (const particle of GALACTIC_DISK) {
        const offset = projectMaterialPoint(particle.x, particle.y, elapsedGalacticYears, radius, projectOffset);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < renderLeft - 10 || x > renderRight + 10 || y < renderTop - 10 || y > renderBottom + 10) continue;
        context.globalAlpha = alpha * particle.opacity;
        drawDiskGlyph(context, particle.glyph, x, y);
    }

    const nebulaFont = `${width < 600 ? 7 : 9}px "DM Mono", monospace`;
    const nebulaDrawers = new Map<string, GlyphDrawer>();
    for (const particle of GALACTIC_NEBULAE) {
        const offset = projectPatternPoint(particle.x, particle.y, patternCosine, patternSine, radius, projectOffset);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < renderLeft - 12 || x > renderRight + 12 || y < renderTop - 12 || y > renderBottom + 12) continue;
        const pulse = reducedMotion ? 0.82 : 0.8 + Math.sin(seconds * 0.34 + particle.phase) * 0.12;
        context.globalAlpha = alpha * particle.opacity * pulse;
        let drawNebulaGlyph = nebulaDrawers.get(particle.color);
        if (!drawNebulaGlyph) {
            drawNebulaGlyph = getGlyphDrawer(nebulaFont, particle.color, pixelRatio);
            nebulaDrawers.set(particle.color, drawNebulaGlyph);
        }
        drawNebulaGlyph(context, particle.glyph, x, y);
    }

    const starFont = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
    const starDrawers = new Map<string, GlyphDrawer>();
    const compact = width < 600;
    for (let index = 0; index < GALAXY_STARS.length; index++) {
        const star = GALAXY_STARS[index];
        if (compact && !star.mobileVisible) continue;
        const offset = projectPatternPoint(star.x, star.y, patternCosine, patternSine, radius, projectOffset);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < renderLeft - 12 || x > renderRight + 12 || y < renderTop - 12 || y > renderBottom + 12) continue;
        const twinkle = reducedMotion ? 0.7 : 0.68 + Math.sin(seconds * 0.9 + star.phase) * 0.22;
        context.globalAlpha = alpha * star.opacity * twinkle * (0.5 + (1 - star.radius) * 0.42 + star.strength * 0.16);
        const color =
            star.radius < 0.2 ? '#ebdbb2' : star.glyph === '+' ? '#d3869b' : star.glyph === '*' ? '#b8bb26' : '#928374';
        let drawStarGlyph = starDrawers.get(color);
        if (!drawStarGlyph) {
            drawStarGlyph = getGlyphDrawer(starFont, color, pixelRatio);
            starDrawers.set(color, drawStarGlyph);
        }
        drawStarGlyph(context, star.glyph, x, y);
    }

    const dustFont = `${width < 600 ? 7 : 9}px "DM Mono", monospace`;
    const drawDustGlyph = getGlyphDrawer(dustFont, '#1d2021', pixelRatio);
    for (const dust of GALACTIC_DUST_LANES) {
        const offset = projectPatternPoint(dust.x, dust.y, patternCosine, patternSine, radius, projectOffset);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < renderLeft - 10 || x > renderRight + 10 || y < renderTop - 10 || y > renderBottom + 10) continue;
        context.globalAlpha = alpha * dust.opacity;
        drawDustGlyph(context, dust.glyph, x, y);
    }

    const localArmDrawers = new Map<string, GlyphDrawer>();
    for (const star of LOCAL_ARM_STARS) {
        const offset = projectPatternPoint(star.x, star.y, patternCosine, patternSine, radius, projectOffset);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < renderLeft - 12 || x > renderRight + 12 || y < renderTop - 12 || y > renderBottom + 12) continue;
        const twinkle = reducedMotion ? 0.72 : 0.72 + Math.sin(seconds + star.phase) * 0.18;
        context.globalAlpha = alpha * twinkle * 0.92;
        const color = star.glyph === '*' ? '#b8bb26' : '#a89984';
        let drawLocalArmGlyph = localArmDrawers.get(color);
        if (!drawLocalArmGlyph) {
            drawLocalArmGlyph = getGlyphDrawer(dustFont, color, pixelRatio);
            localArmDrawers.set(color, drawLocalArmGlyph);
        }
        drawLocalArmGlyph(context, star.glyph, x, y);
    }

    context.globalAlpha = alpha;
    context.fillStyle = '#fabd2f';
    context.font = `${width < 600 ? 10 : 13}px "DM Mono", monospace`;
    context.fillText('{:*:::*:}', coreX, coreY);
    context.globalAlpha = 1;
};
