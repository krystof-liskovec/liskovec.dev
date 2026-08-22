import { randomUnit, smoothstep } from './math';

type FocusedCometOptions = {
    x: number;
    y: number;
    scale: number;
    opacity: number;
    transitionProgress: number;
    seconds: number;
    longitude: number;
    latitude: number;
    reducedMotion: boolean;
    compact: boolean;
};

const HALLEY_TAIL_PARTICLES = Array.from({ length: 210 }, (_, index) => {
    const progress = Math.pow(randomUnit(index + 5101), 0.72);
    return {
        progress,
        spread: (randomUnit(index + 5201) + randomUnit(index + 5301) - 1) * (0.08 + progress * 0.28),
        phase: randomUnit(index + 5401) * Math.PI * 2,
        glyph: index % 29 === 0 ? '*' : index % 7 === 0 ? ':' : index % 3 === 0 ? '~' : '.',
    };
});

export const drawFocusedHalley = (context: CanvasRenderingContext2D, options: FocusedCometOptions) => {
    const { x, y, scale, opacity, transitionProgress, seconds, longitude, latitude, reducedMotion, compact } = options;
    const radius = (compact ? 105 : 150) * scale;
    const orientation = longitude * 0.45 - 0.18;
    const tailDepth = 0.72 + Math.cos(latitude) * 0.18;
    const comaDepth = 0.68 + Math.cos(latitude) * 0.12;
    const cosine = Math.cos(orientation);
    const sine = Math.sin(orientation);
    const pulse = reducedMotion ? 0.8 : 0.78 + Math.sin(seconds * 0.7) * 0.08;
    const tailReveal = reducedMotion ? 1 : smoothstep((transitionProgress - 0.2) / 0.66);

    context.font = `bold ${(compact ? 7 : 9) * scale}px "DM Mono", monospace`;
    for (const particle of HALLEY_TAIL_PARTICLES) {
        const particleReveal = reducedMotion ? 1 : smoothstep((tailReveal - particle.progress) / 0.14);
        if (particleReveal <= 0.001) continue;
        const unfoldedProgress = particle.progress * tailReveal;
        const flow = reducedMotion ? 0 : ((seconds * 0.055 + particle.phase / (Math.PI * 2)) % 0.09) * tailReveal;
        const flowingProgress = Math.min(1, unfoldedProgress + flow);
        const tailX = -radius * flowingProgress * 2.12;
        const coherentWave = reducedMotion
            ? 0
            : Math.sin(seconds * 1.35 - flowingProgress * 8) * radius * (0.008 + flowingProgress * 0.045);
        const tailY = radius * particle.spread * tailReveal + coherentWave;
        const drift = reducedMotion ? 0 : Math.sin(seconds * 0.55 + particle.phase) * radius * 0.012;
        const rotatedX = tailX * cosine - (tailY + drift) * sine;
        const rotatedY = (tailX * sine + (tailY + drift) * cosine) * tailDepth;
        const flowingLight = reducedMotion ? 1 : 0.72 + Math.sin(seconds * 2.1 - flowingProgress * 13) * 0.28;
        context.globalAlpha = opacity * pulse * particleReveal * flowingLight * (0.12 + (1 - particle.progress) * 0.34);
        context.fillStyle = particle.glyph === '*' ? '#ebdbb2' : particle.glyph === '~' ? '#83a598' : '#458588';
        context.fillText(particle.glyph, x + rotatedX, y + rotatedY);
    }

    const artFontSize = (compact ? 9 : 12) * scale;
    context.font = `bold ${artFontSize}px "DM Mono", monospace`;
    context.strokeStyle = '#1d2021';
    context.lineWidth = Math.max(1.5, artFontSize * 0.14);
    const characterWidth = context.measureText('M').width * 0.72;
    const columns = compact ? 25 : 29;
    const rows = compact ? 13 : 15;
    const middleColumn = (columns - 1) / 2;
    const middleRow = (rows - 1) / 2;
    const longitudeCosine = Math.cos(longitude);
    const longitudeSine = Math.sin(longitude);
    const latitudeCosine = Math.cos(latitude);
    const latitudeSine = Math.sin(latitude);
    for (let row = 0; row < rows; row++) {
        const rawY = (row - middleRow) / middleRow;
        for (let column = 0; column < columns; column++) {
            const rawX = (column - middleColumn) / middleColumn;
            const polarAngle = Math.atan2(rawY, rawX);
            const irregularEdge = 1 + Math.sin(polarAngle * 3 + 0.7) * 0.045 + Math.cos(polarAngle * 5) * 0.025;
            const radialDistance = Math.hypot(rawX, rawY);
            if (radialDistance > irregularEdge) continue;

            const surfaceX = rawX / irregularEdge;
            const surfaceY = rawY / irregularEdge;
            const surfaceZ = Math.sqrt(Math.max(0, 1 - surfaceX * surfaceX - surfaceY * surfaceY));
            const yawedX = surfaceX * longitudeCosine + surfaceZ * longitudeSine;
            const yawedZ = -surfaceX * longitudeSine + surfaceZ * longitudeCosine;
            const pitchedY = surfaceY * latitudeCosine - yawedZ * latitudeSine;
            const pitchedZ = surfaceY * latitudeSine + yawedZ * latitudeCosine;
            const light = Math.max(0, -yawedX * 0.3 - pitchedY * 0.38 + pitchedZ * 0.82);
            const terrain =
                Math.sin(yawedX * 15 + pitchedZ * 5.5) * Math.cos(pitchedY * 13 - pitchedZ * 3) +
                Math.sin((yawedX + pitchedY) * 23) * 0.35;
            const edge = radialDistance / irregularEdge > 0.86;
            const glyph = edge
                ? Math.abs(rawX) > Math.abs(rawY)
                    ? '|'
                    : '-'
                : terrain > 0.65
                  ? '@'
                  : terrain < -0.62
                    ? ':'
                    : '#';
            const localX = (column - middleColumn) * characterWidth + rawY * latitudeSine * artFontSize * 0.7;
            const localY = (row - middleRow) * artFontSize * 0.78;
            context.globalAlpha = opacity * (0.62 + light * 0.38);
            context.fillStyle = light > 0.68 ? '#bdae93' : light > 0.3 ? '#928374' : '#665c54';
            context.strokeText(glyph, x + localX, y + localY);
            context.fillText(glyph, x + localX, y + localY);
        }
    }

    context.font = `bold ${(compact ? 7 : 9) * scale}px "DM Mono", monospace`;
    for (let sample = 0; sample < 72; sample++) {
        const angle = (sample / 72) * Math.PI * 2;
        const comaRadius = radius * (0.22 + (sample % 4) * 0.035);
        const localX = Math.cos(angle) * comaRadius;
        const localY = Math.sin(angle) * comaRadius * comaDepth;
        const rotatedX = localX * cosine - localY * sine;
        const rotatedY = localX * sine + localY * cosine;
        context.globalAlpha = opacity * (0.16 + (sample % 5) * 0.045);
        context.fillStyle = sample % 9 === 0 ? '#ebdbb2' : '#83a598';
        context.fillText(sample % 8 === 0 ? ':' : '.', x + rotatedX, y + rotatedY);
    }
    context.globalAlpha = 1;
    return true;
};
