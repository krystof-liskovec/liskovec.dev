import { GALACTIC_OBJECTS } from './catalog';
import { smoothstep } from './math';
import { galacticPositionFromSun } from './scene-data';

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

    project(options: {
        radius: number;
        coreX: number;
        coreY: number;
        verticalProjection: number;
        projectOffset: GalacticOffset;
    }) {
        const { radius, coreX, coreY, verticalProjection, projectOffset } = options;
        this.objects.length = 0;

        for (let index = 0; index < GALACTIC_OBJECTS.length; index++) {
            const object = GALACTIC_OBJECTS[index];
            const projected = this.pool[index];
            const position = galacticPositionFromSun(
                object.galacticLongitude,
                object.galacticLatitude,
                object.heliocentricDistanceKpc,
                this.positionScratch,
            );
            projectOffset(position.x, position.y, radius, projected);
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
        },
    ) {
        const { width, height, seconds, reducedMotion, opacity, galaxyProgress, hovered, showHoverVisuals } = options;
        if (opacity <= 0.001) return;

        for (const galacticObject of this.objects) {
            if (
                galacticObject.x < -30 ||
                galacticObject.x > width + 30 ||
                galacticObject.y < -30 ||
                galacticObject.y > height + 30
            )
                continue;

            const isHovered = galacticObject === hovered && showHoverVisuals;
            const pulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 1.4 + galacticObject.x) * 0.08;
            const spriteReveal = smoothstep((galaxyProgress - 0.58) / 0.28);
            const spriteFontSize = (isHovered ? 8.8 : 7.8) * pulse;
            context.fillStyle = galacticObject.object.color;
            context.globalAlpha = opacity * (1 - spriteReveal);
            context.font = `bold ${Math.round((isHovered ? 13 : 11) * pulse)}px "DM Mono", monospace`;
            context.fillText(galacticObject.object.glyph, galacticObject.x, galacticObject.y);
            context.globalAlpha = opacity * spriteReveal;
            context.font = `bold ${spriteFontSize}px "DM Mono", monospace`;
            context.strokeStyle = '#1d2021';
            context.lineWidth = Math.max(1.25, spriteFontSize * 0.16);

            galacticObject.object.sprite.forEach((line, row) => {
                const lineY =
                    galacticObject.y + (row - (galacticObject.object.sprite.length - 1) / 2) * spriteFontSize * 0.76;
                context.strokeText(line, galacticObject.x, lineY);
                context.fillText(line, galacticObject.x, lineY);
                if (galacticObject.object.name === 'Cygnus X-1' && row === 1) {
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
                context.font = 'bold 11px "DM Mono", monospace';
                context.fillText('[', galacticObject.x - glyphWidth / 2 - 8, galacticObject.y);
                context.fillText(']', galacticObject.x + glyphWidth / 2 + 8, galacticObject.y);
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
