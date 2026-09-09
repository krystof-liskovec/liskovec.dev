import { drawSagittarius } from './sagittarius-renderer';
import { drawAdditionalGalacticObject } from './galactic-landmark-renderer';
import { drawVolumetricNebula } from './galactic-volume-renderer';

export type GalacticRenderOptions = {
    name: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    seconds: number;
    longitude: number;
    latitude: number;
    reducedMotion: boolean;
    compact: boolean;
};

const CYGNUS_STAR_ROWS = [7, 11, 13, 15, 15, 15, 13, 11, 7];
const CYGNUS_STAR_COLUMNS = 15;

function drawCygnus(
    context: CanvasRenderingContext2D,
    options: GalacticRenderOptions,
    radius: number,
    fontSize: number,
) {
    const { x, y, opacity, seconds, longitude, latitude, reducedMotion } = options;
    const starX = x - radius * 0.5;
    const holeX = x + radius * 0.43;
    const starSpin = longitude * 0.55 + (reducedMotion ? 0 : seconds * 0.16);
    const starPulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 0.7) * 0.018;
    const starFontSize = fontSize * 1.18 * starPulse;
    const starRowHeight = starFontSize * 0.7;
    const starColumnWidth = starFontSize * 0.52;
    context.font = `bold ${starFontSize}px "DM Mono", monospace`;
    CYGNUS_STAR_ROWS.forEach((rowWidth, row) => {
        const first = (CYGNUS_STAR_COLUMNS - rowWidth) / 2;
        const normalizedY = (row - (CYGNUS_STAR_ROWS.length - 1) / 2) / (CYGNUS_STAR_ROWS.length / 2);
        for (let cell = 0; cell < rowWidth; cell++) {
            const column = first + cell;
            const normalizedX = (column - (CYGNUS_STAR_COLUMNS - 1) / 2) / (CYGNUS_STAR_COLUMNS / 2);
            const sphereDepth = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
            const surface =
                Math.sin((normalizedX + starSpin) * 7.2 + normalizedY * 3.1) +
                Math.sin(normalizedY * 8.4 - starSpin * 2.3) * 0.45;
            const contour = cell === 0 || cell === rowWidth - 1 || row === 0 || row === CYGNUS_STAR_ROWS.length - 1;
            const light = Math.max(0, Math.min(1, 0.24 + sphereDepth * 0.58 + normalizedX * 0.2));
            context.globalAlpha = opacity * (contour ? 0.72 + sphereDepth * 0.16 : 0.42 + light * 0.5);
            context.fillStyle = contour
                ? normalizedX > 0.25
                    ? '#8ec07c'
                    : '#458588'
                : light > 0.75 && surface > -0.2
                  ? '#b8bb26'
                  : surface > 0.4
                    ? '#8ec07c'
                    : light < 0.43 || surface < -0.65
                      ? '#458588'
                      : '#83a598';
            let glyph: string;
            if (contour) {
                if (row === 0) glyph = cell === 0 ? '/' : cell === rowWidth - 1 ? '\\' : '-';
                else if (row === CYGNUS_STAR_ROWS.length - 1)
                    glyph = cell === 0 ? '\\' : cell === rowWidth - 1 ? '/' : '-';
                else glyph = cell === 0 ? '(' : ')';
            } else if (light > 0.78) glyph = '*';
            else if (surface > 0.45) glyph = 'o';
            else if (surface < -0.55) glyph = ':';
            else glyph = '.';
            context.fillText(
                glyph,
                starX + (column - (CYGNUS_STAR_COLUMNS - 1) / 2) * starColumnWidth,
                y + (row - (CYGNUS_STAR_ROWS.length - 1) / 2) * starRowHeight,
            );
        }
    });

    // Two offset strands make the Roche-lobe stream read as a ribbon instead of
    // a flat dotted line. It narrows and brightens as it falls into the disk.
    context.font = `bold ${fontSize * 0.82}px "DM Mono", monospace`;
    for (let strand = -1; strand <= 1; strand += 2) {
        for (let sample = 0; sample < 40; sample++) {
            const progress = sample / 39;
            const streamX = starX + radius * 0.29 + progress * (holeX - starX - radius * 0.31);
            const arc = Math.sin(progress * Math.PI);
            const perspective = Math.sin(progress * Math.PI * 1.15 + longitude * 0.28);
            const streamY =
                y -
                arc * radius * (0.22 + Math.sin(latitude) * 0.045) +
                perspective * radius * 0.035 +
                strand * fontSize * (0.46 - progress * 0.32);
            context.globalAlpha = opacity * (strand < 0 ? 0.5 + progress * 0.25 : 0.65 + progress * 0.3);
            context.fillStyle = progress > 0.72 ? '#fe8019' : progress > 0.42 ? '#b8bb26' : '#83a598';
            context.fillText(sample % 5 === 0 ? '+' : sample % 2 ? '~' : '=', streamX, streamY);
        }
    }

    const diskInclination = Math.max(0.18, Math.min(0.62, 0.38 + latitude * 0.2));
    const diskPositionAngle = -0.08 + Math.sin(longitude * 0.3) * 0.18;

    // Jets follow the projected disk normal. The dim side sits behind the disk;
    // the brighter side points toward the viewer.
    const jetNormalX = -Math.sin(diskPositionAngle) * Math.cos(diskInclination);
    const jetNormalY = Math.cos(diskPositionAngle) * Math.cos(diskInclination);
    context.font = `${fontSize * 0.56}px "DM Mono", monospace`;
    for (let sample = 3; sample < 24; sample++) {
        const distance = radius * (0.018 * sample + sample ** 1.16 * 0.0025);
        const spread = ((sample % 3) - 1) * fontSize * sample * 0.018;
        context.globalAlpha = opacity * (0.34 - sample * 0.009);
        context.fillStyle = '#458588';
        context.fillText(
            sample % 4 === 0 ? ':' : '.',
            holeX - jetNormalX * distance + jetNormalY * spread,
            y - jetNormalY * distance - jetNormalX * spread,
        );
    }

    drawSagittarius(context, { ...options, x: holeX }, radius * 0.4, 2);

    context.font = `${fontSize * 0.58}px "DM Mono", monospace`;
    for (let sample = 3; sample < 20; sample++) {
        const distance = radius * (0.018 * sample + sample ** 1.16 * 0.0025);
        const spread = ((sample % 3) - 1) * fontSize * sample * 0.018;
        context.globalAlpha = opacity * (0.5 - sample * 0.013);
        context.fillStyle = '#83a598';
        context.fillText(
            sample % 4 === 0 ? ':' : '.',
            holeX + jetNormalX * distance + jetNormalY * spread,
            y + jetNormalY * distance - jetNormalX * spread,
        );
    }
    context.globalAlpha = 1;
}

export function drawFocusedGalacticObject(context: CanvasRenderingContext2D, options: GalacticRenderOptions) {
    const radius = (options.compact ? 112 : 190) * options.scale;
    const fontSize = (options.compact ? 8 : 11) * options.scale;
    if (options.name === 'Sagittarius A*') drawSagittarius(context, options, radius * (options.compact ? 1.3 : 1.45));
    else if (['Orion Nebula', 'Crab Nebula', 'Eta Carinae', 'Cassiopeia A', 'Omega Centauri'].includes(options.name))
        drawVolumetricNebula(context, options, radius);
    else if (options.name === 'Cygnus X-1') drawCygnus(context, options, radius, fontSize);
    else return drawAdditionalGalacticObject(context, options, radius, fontSize);
    return true;
}
