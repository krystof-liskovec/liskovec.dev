import {
    GALACTIC_DISK,
    GALACTIC_DUST_LANES,
    GALACTIC_NEBULAE,
    GALAXY_STARS,
    LOCAL_ARM_STARS,
    STARS,
} from './scene-data';

type Offset = { x: number; y: number };
type GalacticOffset = (x: number, y: number, radius: number, target: Offset) => Offset;

const STAR_GLYPHS = ['.', '*', '+'] as const;
const offsetScratch = { x: 0, y: 0 };

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
    },
) => {
    const { width, height, pointerX, pointerY, seconds, reducedMotion, opacity } = options;
    const parallaxX = pointerX * 8;
    const parallaxY = pointerY * 5;

    for (const glyph of STAR_GLYPHS) {
        context.fillStyle = glyph === '+' ? '#fabd2f' : '#928374';
        context.font = `${glyph === '+' ? 14 : 11}px "DM Mono", monospace`;
        for (const star of STARS) {
            if (star.glyph !== glyph) continue;
            const pulse = reducedMotion ? 0.45 : 0.5 + 0.5 * Math.sin(seconds * star.speed * 2.2 + star.phase);
            context.globalAlpha = (0.16 + pulse * (glyph === '+' ? 0.82 : 0.46)) * opacity;
            context.fillText(glyph, star.x * width + parallaxX, star.y * height + parallaxY);
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
        reducedMotion: boolean;
        alpha: number;
        radius: number;
        coreX: number;
        coreY: number;
        projectOffset: GalacticOffset;
    },
) => {
    const { width, height, seconds, reducedMotion, alpha, radius, coreX, coreY, projectOffset } = options;
    if (alpha <= 0.001) return;

    context.font = `${width < 600 ? 6.5 : 8}px "DM Mono", monospace`;
    context.fillStyle = '#665c54';
    for (const particle of GALACTIC_DISK) {
        const offset = projectOffset(particle.x, particle.y, radius, offsetScratch);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue;
        context.globalAlpha = alpha * particle.opacity;
        context.fillText(particle.glyph, x, y);
    }

    context.font = `${width < 600 ? 7 : 9}px "DM Mono", monospace`;
    for (const particle of GALACTIC_NEBULAE) {
        const offset = projectOffset(particle.x, particle.y, radius, offsetScratch);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < -12 || x > width + 12 || y < -12 || y > height + 12) continue;
        const pulse = reducedMotion ? 0.82 : 0.8 + Math.sin(seconds * 0.34 + particle.phase) * 0.12;
        context.globalAlpha = alpha * particle.opacity * pulse;
        context.fillStyle = particle.color;
        context.fillText(particle.glyph, x, y);
    }

    context.font = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
    const compact = width < 600;
    for (let index = 0; index < GALAXY_STARS.length; index++) {
        const star = GALAXY_STARS[index];
        if (compact && !star.mobileVisible) continue;
        const offset = projectOffset(star.x, star.y, radius, offsetScratch);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < -12 || x > width + 12 || y < -12 || y > height + 12) continue;
        const twinkle = reducedMotion ? 0.7 : 0.68 + Math.sin(seconds * 0.9 + star.phase) * 0.22;
        context.globalAlpha = alpha * star.opacity * twinkle * (0.5 + (1 - star.radius) * 0.42 + star.strength * 0.16);
        context.fillStyle =
            star.radius < 0.2 ? '#ebdbb2' : star.glyph === '+' ? '#d3869b' : star.glyph === '*' ? '#b8bb26' : '#928374';
        context.fillText(star.glyph, x, y);
    }

    context.font = `${width < 600 ? 7 : 9}px "DM Mono", monospace`;
    context.fillStyle = '#1d2021';
    for (const dust of GALACTIC_DUST_LANES) {
        const offset = projectOffset(dust.x, dust.y, radius, offsetScratch);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue;
        context.globalAlpha = alpha * dust.opacity;
        context.fillText(dust.glyph, x, y);
    }

    for (const star of LOCAL_ARM_STARS) {
        const offset = projectOffset(star.x, star.y, radius, offsetScratch);
        const x = coreX + offset.x;
        const y = coreY + offset.y;
        if (x < -12 || x > width + 12 || y < -12 || y > height + 12) continue;
        const twinkle = reducedMotion ? 0.72 : 0.72 + Math.sin(seconds + star.phase) * 0.18;
        context.globalAlpha = alpha * twinkle * 0.92;
        context.fillStyle = star.glyph === '*' ? '#b8bb26' : '#a89984';
        context.fillText(star.glyph, x, y);
    }

    context.globalAlpha = alpha;
    context.fillStyle = '#fabd2f';
    context.font = `${width < 600 ? 10 : 13}px "DM Mono", monospace`;
    context.fillText('{:*:::*:}', coreX, coreY);
    context.globalAlpha = 1;
};
