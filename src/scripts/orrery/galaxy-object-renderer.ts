import { GALACTIC_OBJECTS } from './catalog';
import { smoothstep } from './math';
import { galacticPositionFromSun } from './scene-data';
import { galacticPatternPhase, moveGalacticMaterial, rotateGalacticPoint } from './galactic-simulation';

export type ProjectedGalacticObject = {
    object: (typeof GALACTIC_OBJECTS)[number];
    x: number;
    y: number;
};

type Offset = { x: number; y: number };
type GalacticOffset = (x: number, y: number, radius: number, target: Offset) => Offset;

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
        },
    ) {
        const {
            width,
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
            const spriteReveal = smoothstep((galaxyProgress - 0.58) / 0.28);
            const spriteFontSize = (isHovered ? 8.8 : 7.8) * pulse * viewportScale;
            context.fillStyle = galacticObject.object.color;
            context.globalAlpha = opacity * (1 - spriteReveal);
            context.font = `bold ${(isHovered ? 13 : 11) * pulse * viewportScale}px "DM Mono", monospace`;
            context.fillText(galacticObject.object.glyph, galacticObject.x, galacticObject.y);
            context.globalAlpha = opacity * spriteReveal;
            context.font = `bold ${spriteFontSize}px "DM Mono", monospace`;
            context.strokeStyle = '#1d2021';
            context.lineWidth = Math.max(1.25, spriteFontSize * 0.16);

            galacticObject.object.sprite.forEach((line, row) => {
                const rowSpacing = galacticObject.object.name === 'Sagittarius A*' ? 0.9 : 0.76;
                const lineY =
                    galacticObject.y +
                    (row - (galacticObject.object.sprite.length - 1) / 2) * spriteFontSize * rowSpacing;
                context.strokeText(line, galacticObject.x, lineY);
                context.fillText(line, galacticObject.x, lineY);
                if (galacticObject.object.name === 'Sagittarius A*' && row === 2) {
                    context.fillStyle = '#1d2021';
                    context.strokeStyle = '#fabd2f';
                    context.lineWidth = Math.max(1, spriteFontSize * 0.12);
                    context.strokeText('@', galacticObject.x, lineY);
                    context.fillText('@', galacticObject.x, lineY);
                    context.fillStyle = galacticObject.object.color;
                    context.strokeStyle = '#1d2021';
                    context.lineWidth = Math.max(1.25, spriteFontSize * 0.16);
                } else if (galacticObject.object.name === 'Cygnus X-1' && row === 1) {
                    const lineWidth = context.measureText(line).width;
                    const characterWidth = context.measureText('M').width;
                    context.fillStyle = '#8ec07c';
                    context.strokeText('O', galacticObject.x - lineWidth / 2 + characterWidth * 2.5, lineY);
                    context.fillText('O', galacticObject.x - lineWidth / 2 + characterWidth * 2.5, lineY);
                    const blackHole = '(@)';
                    const blackHoleWidth = context.measureText(blackHole).width;
                    context.fillStyle = '#fe8019';
                    context.strokeText(blackHole, galacticObject.x + lineWidth / 2 - blackHoleWidth / 2, lineY);
                    context.fillText(blackHole, galacticObject.x + lineWidth / 2 - blackHoleWidth / 2, lineY);
                    context.fillStyle = galacticObject.object.color;
                }
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
