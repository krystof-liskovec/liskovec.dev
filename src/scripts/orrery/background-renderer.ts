import {
    GALACTIC_DISK,
    GALACTIC_DUST_LANES,
    GALACTIC_NEBULAE,
    GALAXY_STARS,
    LOCAL_ARM_STARS,
} from './galaxy-scene-data';
import { STARS } from './solar-scene-data';
import { galacticPatternPhase, moveGalacticMaterial } from './galactic-simulation';
import { createParticleGlyphDrawer, type ParticleGlyphDrawer } from './particle-glyph';
import type { GalaxyParticleTransform, WebGLParticleRenderer } from './webgl-particle-renderer';

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
        particleRenderer?: WebGLParticleRenderer | null;
        galaxyTransform?: GalaxyParticleTransform;
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
        particleRenderer,
        galaxyTransform,
    } = options;
    if (alpha <= 0.001) return;

    const patternPhase = galacticPatternPhase(elapsedGalacticYears);
    const patternCosine = Math.cos(patternPhase);
    const patternSine = Math.sin(patternPhase);
    const galaxyRenderer = particleRenderer && galaxyTransform ? particleRenderer : null;

    const diskFont = `${width < 600 ? 6.5 : 8}px "DM Mono", monospace`;
    const drawDiskGlyph = galaxyRenderer?.getGalaxyGlyphDrawer({
        fieldKey: 'galactic-disk',
        font: diskFont,
        kind: 'material',
        transform: galaxyTransform!,
    });
    if (drawDiskGlyph) {
        for (const particle of GALACTIC_DISK) {
            drawDiskGlyph(particle.glyph, particle.x, particle.y, particle.radius, 0, 0, particle.opacity, '#665c54');
        }
    } else {
        const drawDiskGlyphFallback = createParticleGlyphDrawer(
            context,
            particleRenderer,
            diskFont,
            '#665c54',
            pixelRatio,
        );
        for (const particle of GALACTIC_DISK) {
            const offset = projectMaterialPoint(particle.x, particle.y, elapsedGalacticYears, radius, projectOffset);
            const x = coreX + offset.x;
            const y = coreY + offset.y;
            if (x < renderLeft - 10 || x > renderRight + 10 || y < renderTop - 10 || y > renderBottom + 10) continue;
            drawDiskGlyphFallback(particle.glyph, x, y, alpha * particle.opacity);
        }
    }

    const nebulaFont = `${width < 600 ? 7 : 9}px "DM Mono", monospace`;
    const drawNebulaGlyph = galaxyRenderer?.getGalaxyGlyphDrawer({
        fieldKey: 'galactic-nebulae',
        font: nebulaFont,
        kind: 'nebula',
        transform: galaxyTransform!,
    });
    if (drawNebulaGlyph) {
        for (const particle of GALACTIC_NEBULAE) {
            drawNebulaGlyph(
                particle.glyph,
                particle.x,
                particle.y,
                0,
                particle.phase,
                0,
                particle.opacity,
                particle.color,
            );
        }
    } else {
        const nebulaDrawers = new Map<string, ParticleGlyphDrawer>();
        for (const particle of GALACTIC_NEBULAE) {
            const offset = projectPatternPoint(
                particle.x,
                particle.y,
                patternCosine,
                patternSine,
                radius,
                projectOffset,
            );
            const x = coreX + offset.x;
            const y = coreY + offset.y;
            if (x < renderLeft - 12 || x > renderRight + 12 || y < renderTop - 12 || y > renderBottom + 12) continue;
            const pulse = reducedMotion ? 0.82 : 0.8 + Math.sin(seconds * 0.34 + particle.phase) * 0.12;
            let drawNebulaGlyphFallback = nebulaDrawers.get(particle.color);
            if (!drawNebulaGlyphFallback) {
                drawNebulaGlyphFallback = createParticleGlyphDrawer(
                    context,
                    particleRenderer,
                    nebulaFont,
                    particle.color,
                    pixelRatio,
                );
                nebulaDrawers.set(particle.color, drawNebulaGlyphFallback);
            }
            drawNebulaGlyphFallback(particle.glyph, x, y, alpha * particle.opacity * pulse);
        }
    }

    const starFont = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
    const compact = width < 600;
    const drawStarGlyph = galaxyRenderer?.getGalaxyGlyphDrawer({
        fieldKey: `galaxy-stars-${compact ? 'compact' : 'full'}`,
        font: starFont,
        kind: 'star',
        transform: galaxyTransform!,
    });
    if (drawStarGlyph) {
        for (let index = 0; index < GALAXY_STARS.length; index++) {
            const star = GALAXY_STARS[index];
            if (compact && !star.mobileVisible) continue;
            const color =
                star.radius < 0.2
                    ? '#ebdbb2'
                    : star.glyph === '+'
                      ? '#d3869b'
                      : star.glyph === '*'
                        ? '#b8bb26'
                        : '#928374';
            drawStarGlyph(star.glyph, star.x, star.y, star.radius, star.phase, star.strength, star.opacity, color);
        }
    } else {
        const starDrawers = new Map<string, ParticleGlyphDrawer>();
        for (let index = 0; index < GALAXY_STARS.length; index++) {
            const star = GALAXY_STARS[index];
            if (compact && !star.mobileVisible) continue;
            const offset = projectPatternPoint(star.x, star.y, patternCosine, patternSine, radius, projectOffset);
            const x = coreX + offset.x;
            const y = coreY + offset.y;
            if (x < renderLeft - 12 || x > renderRight + 12 || y < renderTop - 12 || y > renderBottom + 12) continue;
            const twinkle = reducedMotion ? 0.7 : 0.68 + Math.sin(seconds * 0.9 + star.phase) * 0.22;
            const color =
                star.radius < 0.2
                    ? '#ebdbb2'
                    : star.glyph === '+'
                      ? '#d3869b'
                      : star.glyph === '*'
                        ? '#b8bb26'
                        : '#928374';
            let drawStarGlyphFallback = starDrawers.get(color);
            if (!drawStarGlyphFallback) {
                drawStarGlyphFallback = createParticleGlyphDrawer(
                    context,
                    particleRenderer,
                    starFont,
                    color,
                    pixelRatio,
                );
                starDrawers.set(color, drawStarGlyphFallback);
            }
            drawStarGlyphFallback(
                star.glyph,
                x,
                y,
                alpha * star.opacity * twinkle * (0.5 + (1 - star.radius) * 0.42 + star.strength * 0.16),
            );
        }
    }

    const dustFont = `${width < 600 ? 7 : 9}px "DM Mono", monospace`;
    const drawDustGlyph = galaxyRenderer?.getGalaxyGlyphDrawer({
        fieldKey: 'galactic-dust',
        font: dustFont,
        kind: 'dust',
        transform: galaxyTransform!,
    });
    if (drawDustGlyph) {
        for (const dust of GALACTIC_DUST_LANES) {
            drawDustGlyph(dust.glyph, dust.x, dust.y, 0, 0, 0, dust.opacity, '#1d2021');
        }
    } else {
        const drawDustGlyphFallback = createParticleGlyphDrawer(
            context,
            particleRenderer,
            dustFont,
            '#1d2021',
            pixelRatio,
        );
        for (const dust of GALACTIC_DUST_LANES) {
            const offset = projectPatternPoint(dust.x, dust.y, patternCosine, patternSine, radius, projectOffset);
            const x = coreX + offset.x;
            const y = coreY + offset.y;
            if (x < renderLeft - 10 || x > renderRight + 10 || y < renderTop - 10 || y > renderBottom + 10) continue;
            drawDustGlyphFallback(dust.glyph, x, y, alpha * dust.opacity);
        }
    }

    const drawLocalArmGlyph = galaxyRenderer?.getGalaxyGlyphDrawer({
        fieldKey: 'local-arm-stars',
        font: dustFont,
        kind: 'local-arm',
        transform: galaxyTransform!,
    });
    if (drawLocalArmGlyph) {
        for (const star of LOCAL_ARM_STARS) {
            const color = star.glyph === '*' ? '#b8bb26' : '#a89984';
            drawLocalArmGlyph(star.glyph, star.x, star.y, 0, star.phase, 0, 1, color);
        }
    } else {
        const localArmDrawers = new Map<string, ParticleGlyphDrawer>();
        for (const star of LOCAL_ARM_STARS) {
            const offset = projectPatternPoint(star.x, star.y, patternCosine, patternSine, radius, projectOffset);
            const x = coreX + offset.x;
            const y = coreY + offset.y;
            if (x < renderLeft - 12 || x > renderRight + 12 || y < renderTop - 12 || y > renderBottom + 12) continue;
            const twinkle = reducedMotion ? 0.72 : 0.72 + Math.sin(seconds + star.phase) * 0.18;
            const color = star.glyph === '*' ? '#b8bb26' : '#a89984';
            let drawLocalArmGlyphFallback = localArmDrawers.get(color);
            if (!drawLocalArmGlyphFallback) {
                drawLocalArmGlyphFallback = createParticleGlyphDrawer(
                    context,
                    particleRenderer,
                    dustFont,
                    color,
                    pixelRatio,
                );
                localArmDrawers.set(color, drawLocalArmGlyphFallback);
            }
            drawLocalArmGlyphFallback(star.glyph, x, y, alpha * twinkle * 0.92);
        }
    }

    context.globalAlpha = alpha;
    context.fillStyle = '#fabd2f';
    context.font = `${width < 600 ? 10 : 13}px "DM Mono", monospace`;
    context.fillText('{:*:::*:}', coreX, coreY);
    context.globalAlpha = 1;
};
