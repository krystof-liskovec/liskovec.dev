import { GALACTIC_OBJECTS } from './catalog';
import { smoothstep } from './math';
import { galacticPositionFromSun } from './galaxy-model';
import { galacticPatternPhase, moveGalacticMaterial, rotateGalacticPoint } from './galactic-simulation';
import { sceneMaskColor } from './scene-mask';

export type ProjectedGalacticObject = {
    object: (typeof GALACTIC_OBJECTS)[number];
    x: number;
    y: number;
};

type Offset = { x: number; y: number };
type GalacticOffset = (x: number, y: number, radius: number, target: Offset) => Offset;

const landmarkColor = (name: string, glyph: string, column: number, baseColor: string) => {
    if (glyph === '+' || glyph === '@' || glyph === '#') return '#ebdbb2';
    if (name === 'Cygnus X-1')
        return column < 6 ? (glyph === '*' ? '#ebdbb2' : '#83a598') : glyph === '=' ? '#fabd2f' : '#fe8019';
    if (name === 'Crab Nebula') return glyph === '~' ? '#83a598' : '#fb4934';
    if (name === 'Eta Carinae') return column < 5 ? '#83a598' : '#fabd2f';
    if (name === 'Cassiopeia A') return glyph === '*' ? '#fabd2f' : '#fe8019';
    if (name === 'Omega Centauri') return glyph === '*' ? '#ebdbb2' : glyph === 'o' ? '#fabd2f' : '#a89984';
    if (name === 'PSR B1509-58') return glyph === '=' ? '#b8bb26' : '#83a598';
    return baseColor;
};

const drawLandmarkSprite = (
    context: CanvasRenderingContext2D,
    options: {
        name: string;
        lines: string[];
        x: number;
        y: number;
        fontSize: number;
        rowSpacing: number;
        color: string;
        outlineColor: string;
        opacity: number;
    },
) => {
    const { name, lines, x, y, fontSize, rowSpacing, color, outlineColor, opacity } = options;
    if (name === 'Sagittarius A*') {
        // Use dense text to quiet the crowded galactic core behind the shadow.
        // The marker has no solid disk, matching the detailed ASCII renderer.
        context.globalAlpha = opacity;
        context.font = `bold ${fontSize}px "DM Mono", monospace`;
        context.strokeStyle = outlineColor;
        context.lineWidth = Math.max(1, fontSize * 0.35);
        for (let row = -1; row <= 1; row++) {
            const line = row === 0 ? '#@@@#' : ' ### ';
            const backdrop = row === 0 ? '#####' : ' ### ';
            const lineY = y + (row - 0.3) * fontSize * rowSpacing;
            context.fillStyle = outlineColor;
            context.strokeText(backdrop, x, lineY);
            context.fillText(backdrop, x, lineY);
            context.fillStyle = '#141617';
            context.fillText(line, x, lineY);
        }
        context.strokeStyle = outlineColor;
        context.lineWidth = Math.max(1, fontSize * 0.16);
        for (let row = 0; row < lines.length; row++) {
            const lineY = y + (row - (lines.length - 1) / 2) * fontSize * rowSpacing;
            context.fillStyle = row === 3 ? '#ebdbb2' : row < 2 ? '#fabd2f' : '#fe8019';
            context.strokeText(lines[row], x, lineY);
            context.fillText(lines[row], x, lineY);
        }
        return;
    }
    context.font = `bold ${fontSize}px "DM Mono", monospace`;
    context.strokeStyle = outlineColor;
    context.lineWidth = Math.max(1.1, fontSize * 0.18);
    const characterWidth = context.measureText('M').width;
    // Preserve the designed negative space and contours; these landmarks are
    // clouds, shells, and binaries, so a generic sphere obscures their identity.
    for (let row = 0; row < lines.length; row++) {
        const line = lines[row];
        const lineY = y + (row - (lines.length - 1) / 2) * fontSize * rowSpacing;
        for (let column = 0; column < line.length; column++) {
            const glyph = line[column];
            if (glyph === ' ') continue;
            const cellX = x + (column - (line.length - 1) / 2) * characterWidth;
            context.globalAlpha = opacity * (glyph === '.' ? 0.68 : 1);
            context.fillStyle = landmarkColor(name, glyph, column, color);
            context.strokeText(glyph, cellX, lineY);
            context.fillText(glyph, cellX, lineY);
        }
    }
};

export class GalaxyObjectRenderer {
    readonly objects: ProjectedGalacticObject[] = [];

    private readonly pool: ProjectedGalacticObject[] = GALACTIC_OBJECTS.map((object) => ({ object, x: 0, y: 0 }));
    private readonly positionScratch = { x: 0, y: 0, z: 0 };
    private readonly movedPositionScratch = { x: 0, y: 0 };

    project(options: {
        radius: number;
        coreX: number;
        coreY: number;
        verticalProjection: number;
        elapsedGalacticYears: number;
        projectOffset: GalacticOffset;
    }) {
        const { radius, coreX, coreY, verticalProjection, elapsedGalacticYears, projectOffset } = options;
        this.objects.length = 0;
        const patternPhase = galacticPatternPhase(elapsedGalacticYears);

        for (let index = 0; index < GALACTIC_OBJECTS.length; index++) {
            const object = GALACTIC_OBJECTS[index];
            const projected = this.pool[index];
            const position = galacticPositionFromSun(
                object.galacticLongitude,
                object.galacticLatitude,
                object.heliocentricDistanceKpc,
                this.positionScratch,
            );
            const movedPosition =
                object.name === 'Sagittarius A*'
                    ? position
                    : object.name === 'Omega Centauri'
                      ? moveGalacticMaterial(position.x, position.y, elapsedGalacticYears, this.movedPositionScratch)
                      : rotateGalacticPoint(position.x, position.y, patternPhase, this.movedPositionScratch);
            projectOffset(movedPosition.x, movedPosition.y, radius, projected);
            projected.x += coreX;
            projected.y += coreY - position.z * radius * verticalProjection;
            this.objects.push(projected);
        }
    }

    findHovered(pointerX: number, pointerY: number): ProjectedGalacticObject | null {
        let closest: ProjectedGalacticObject | null = null;
        let closestDistance = Infinity;
        for (const object of this.objects) {
            const distance = Math.hypot(object.x - pointerX, object.y - pointerY);
            if (distance < 36 && distance < closestDistance) {
                closest = object;
                closestDistance = distance;
            }
        }
        return closest;
    }

    findByName(name: string): ProjectedGalacticObject | null {
        for (const object of this.objects) {
            if (object.object.name === name) return object;
        }
        return null;
    }

    draw(
        context: CanvasRenderingContext2D,
        options: {
            width: number;
            height: number;
            seconds: number;
            reducedMotion: boolean;
            opacity: number;
            galaxyProgress: number;
            hovered: ProjectedGalacticObject | null;
            showHoverVisuals: boolean;
            renderLeft: number;
            renderTop: number;
            renderRight: number;
            renderBottom: number;
            isOgPreview: boolean;
        },
    ) {
        const {
            width,
            height,
            seconds,
            reducedMotion,
            opacity,
            galaxyProgress,
            hovered,
            showHoverVisuals,
            renderLeft,
            renderTop,
            renderRight,
            renderBottom,
            isOgPreview,
        } = options;
        if (opacity <= 0.001) return;
        // The galaxy contracts substantially on phones while the canvas glyphs
        // would otherwise retain their desktop pixel size. Scale landmarks with
        // the available width so nearby real-world positions stay legible.
        const viewportScale = width < 600 ? Math.max(0.54, Math.min(0.68, width / 680)) : 1;

        for (let index = 0; index < this.objects.length; index++) {
            const galacticObject = this.objects[index];
            if (
                galacticObject.x < renderLeft - 30 ||
                galacticObject.x > renderRight + 30 ||
                galacticObject.y < renderTop - 30 ||
                galacticObject.y > renderBottom + 30
            )
                continue;

            const isHovered = galacticObject === hovered && showHoverVisuals;
            // Keep animation phase in object space. Using a projected screen
            // coordinate here makes zooming scrub through the sine wave and
            // produces a rapid strobe, especially during fast slider movement.
            const pulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 0.8 + index * 1.73) * 0.045;
            const maskColor = sceneMaskColor(galacticObject.x, galacticObject.y, width, height, isOgPreview);
            const outlineColor = galacticObject.object.name === 'Sagittarius A*' ? '#1d2021' : maskColor;
            const spriteReveal = smoothstep((galaxyProgress - 0.58) / 0.28);
            const spriteFontSize = (isHovered ? 8.8 : 7.8) * pulse * viewportScale;
            context.globalAlpha = opacity * (1 - spriteReveal);
            context.font = `bold ${(isHovered ? 13 : 11) * pulse * viewportScale}px "DM Mono", monospace`;
            context.fillStyle = maskColor;
            context.fillText(galacticObject.object.glyph, galacticObject.x, galacticObject.y);
            context.strokeStyle = outlineColor;
            context.lineWidth = Math.max(
                1.1,
                (galacticObject.object.name === 'Sagittarius A*' ? 2.2 : 1.6) * viewportScale,
            );
            context.fillStyle = galacticObject.object.color;
            context.strokeText(galacticObject.object.glyph, galacticObject.x, galacticObject.y);
            context.fillText(galacticObject.object.glyph, galacticObject.x, galacticObject.y);
            context.globalAlpha = opacity * spriteReveal;
            const rowSpacing = 0.9;
            drawLandmarkSprite(context, {
                name: galacticObject.object.name,
                lines: galacticObject.object.sprite,
                x: galacticObject.x,
                y: galacticObject.y,
                fontSize: spriteFontSize,
                rowSpacing,
                color: galacticObject.object.color,
                outlineColor,
                opacity: opacity * spriteReveal,
            });

            if (isHovered) {
                let glyphWidth = 0;
                for (const line of galacticObject.object.sprite) {
                    glyphWidth = Math.max(glyphWidth, context.measureText(line).width);
                }
                context.fillStyle = '#ebdbb2';
                context.font = `bold ${11 * viewportScale}px "DM Mono", monospace`;
                context.fillText('[', galacticObject.x - glyphWidth / 2 - 8 * viewportScale, galacticObject.y);
                context.fillText(']', galacticObject.x + glyphWidth / 2 + 8 * viewportScale, galacticObject.y);
            }
        }
        context.globalAlpha = 1;
    }
}

export const drawSolMarker = (
    context: CanvasRenderingContext2D,
    options: { alpha: number; localDetailOpacity: number; galaxyProgress: number; x: number; y: number },
) => {
    const { alpha, localDetailOpacity, galaxyProgress, x, y } = options;
    if (alpha <= 0.001) return;

    const markerAlpha = alpha * (1 - localDetailOpacity * 0.75);
    context.globalAlpha = markerAlpha;
    context.fillStyle = '#fabd2f';
    context.font = 'bold 12px "DM Mono", monospace';
    context.fillText('+', x, y);
    if (galaxyProgress > 0.62) {
        context.globalAlpha = markerAlpha * smoothstep((galaxyProgress - 0.62) / 0.25);
        context.font = '9px "DM Mono", monospace';
        context.fillText('[ SOL / YOU ARE HERE ]', x, y + 18);
    }
    context.globalAlpha = 1;
};
