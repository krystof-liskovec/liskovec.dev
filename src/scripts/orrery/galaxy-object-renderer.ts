import { GALACTIC_OBJECTS } from './catalog';
import { smoothstep } from './math';
import { galacticPositionFromSun } from './galaxy-model';
import { galacticPatternPhase, moveGalacticMaterial, rotateGalacticPoint } from './galactic-simulation';
import { sceneMaskColor } from './scene-mask';
import { galacticSurfaceTexture } from './galaxy-textures';

export type ProjectedGalacticObject = {
    object: (typeof GALACTIC_OBJECTS)[number];
    x: number;
    y: number;
};

type Offset = { x: number; y: number };
type GalacticOffset = (x: number, y: number, radius: number, target: Offset) => Offset;

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

const shadeColor = (color: string, light: number) => {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    const factor = clamp(light, 0.38, 1.22);
    const channel = (value: number) => Math.round(clamp(value * factor, 0, 255));
    return `rgb(${channel(red)}, ${channel(green)}, ${channel(blue)})`;
};

const TEXTURE_GLYPHS = new Set(['.', ':', ',', '~']);

const surfaceLight = (normalizedX: number, normalizedY: number, sphereZ: number, lightX: number, lightY: number) =>
    0.58 + Math.max(0, normalizedX * lightX - normalizedY * lightY + sphereZ * 0.88) * 0.46 + sphereZ * 0.08;

const textureLongitude = (normalizedX: number, sphereZ: number, phase: number, seconds: number) =>
    Math.atan2(normalizedX, Math.max(0.001, sphereZ)) + phase + seconds * 0.055;

const drawTexturedSphere = (
    context: CanvasRenderingContext2D,
    options: {
        name: string;
        x: number;
        y: number;
        fontSize: number;
        rowSpacing: number;
        maximumColumns: number;
        color: string;
        maskColor: string;
        outlineColor: string;
        opacity: number;
        seconds: number;
        phase: number;
    },
) => {
    const {
        name,
        x,
        y,
        fontSize,
        rowSpacing,
        maximumColumns,
        color,
        maskColor,
        outlineColor,
        opacity,
        seconds,
        phase,
    } = options;
    const rows = Math.max(5, maximumColumns > 11 ? 7 : 5);
    const detailFontSize = fontSize * 0.7;
    const detailRowSpacing = rowSpacing * 0.92;
    const middleRow = (rows - 1) / 2;
    const halfRows = Math.max(1, middleRow);
    const halfColumns = Math.max(1, (maximumColumns - 1) / 2);
    const lightAngle = seconds * 0.16 + phase;
    const lightX = Math.cos(lightAngle) * 0.22 - 0.22;
    const lightY = Math.sin(lightAngle) * 0.12 - 0.42;
    const textureOpacity = opacity * 0.38;

    context.font = `bold ${detailFontSize}px "DM Mono", monospace`;
    const characterWidth = context.measureText('M').width * 0.76;
    context.globalAlpha = textureOpacity;
    context.fillStyle = maskColor;
    for (let row = 0; row < rows; row++) {
        const normalizedY = (row - middleRow) / halfRows;
        const rowWidth = Math.max(1, Math.round(maximumColumns * Math.sqrt(Math.max(0, 1 - normalizedY ** 2))));
        const firstColumn = (maximumColumns - rowWidth) / 2;
        const lineY = y + (row - middleRow) * detailFontSize * detailRowSpacing;
        for (let rowColumn = 0; rowColumn < rowWidth; rowColumn++) {
            const column = firstColumn + rowColumn;
            const normalizedX = (column - (maximumColumns - 1) / 2) / halfColumns;
            const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
            const texture = galacticSurfaceTexture(
                name,
                textureLongitude(normalizedX, sphereZ, phase, seconds),
                Math.asin(Math.max(-1, Math.min(1, -normalizedY))),
                color,
            );
            const cellX = x + (column - (maximumColumns - 1) / 2) * characterWidth;
            context.fillText(texture.glyph, cellX, lineY);
        }
    }

    context.strokeStyle = maskColor;
    context.strokeStyle = outlineColor;
    context.lineWidth = Math.max(1, detailFontSize * (name === 'Sagittarius A*' ? 0.18 : 0.12));
    for (let row = 0; row < rows; row++) {
        const normalizedY = (row - middleRow) / halfRows;
        const rowWidth = Math.max(1, Math.round(maximumColumns * Math.sqrt(Math.max(0, 1 - normalizedY ** 2))));
        const firstColumn = (maximumColumns - rowWidth) / 2;
        const lineY = y + (row - middleRow) * detailFontSize * detailRowSpacing;
        for (let rowColumn = 0; rowColumn < rowWidth; rowColumn++) {
            const column = firstColumn + rowColumn;
            const normalizedX = (column - (maximumColumns - 1) / 2) / halfColumns;
            const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
            const texture = galacticSurfaceTexture(
                name,
                textureLongitude(normalizedX, sphereZ, phase, seconds),
                Math.asin(Math.max(-1, Math.min(1, -normalizedY))),
                color,
            );
            const cellX = x + (column - (maximumColumns - 1) / 2) * characterWidth;
            const light = surfaceLight(normalizedX, normalizedY, sphereZ, lightX, lightY);
            context.globalAlpha = textureOpacity * (0.62 + sphereZ * 0.38);
            context.fillStyle = shadeColor(texture.color, light);
            context.strokeText(texture.glyph, cellX, lineY);
            context.fillText(texture.glyph, cellX, lineY);
        }
    }
};

const drawVolumetricSprite = (
    context: CanvasRenderingContext2D,
    options: {
        name: string;
        lines: string[];
        x: number;
        y: number;
        fontSize: number;
        rowSpacing: number;
        color: string;
        maskColor: string;
        outlineColor: string;
        opacity: number;
        seconds: number;
        phase: number;
    },
) => {
    const { name, lines, x, y, fontSize, rowSpacing, color, maskColor, outlineColor, opacity, seconds, phase } =
        options;
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
    const maximumColumns = Math.max(1, ...lines.map((line) => line.length));
    const lightAngle = seconds * 0.16 + phase;
    const lightX = Math.cos(lightAngle) * 0.22 - 0.22;
    const lightY = Math.sin(lightAngle) * 0.12 - 0.42;
    const middleRow = (lines.length - 1) / 2;
    const halfColumns = Math.max(1, (maximumColumns - 1) / 2);
    const halfRows = Math.max(1, middleRow);

    drawTexturedSphere(context, {
        name,
        x,
        y,
        fontSize,
        rowSpacing,
        maximumColumns,
        color,
        maskColor,
        outlineColor,
        opacity,
        seconds,
        phase,
    });

    context.font = `bold ${fontSize}px "DM Mono", monospace`;
    const characterWidth = context.measureText('M').width * 0.76;
    context.globalAlpha = opacity;
    context.fillStyle = maskColor;
    lines.forEach((line, row) => {
        const lineY = y + (row - middleRow) * fontSize * rowSpacing;
        context.fillText(line, x, lineY);
    });

    context.strokeStyle = maskColor;
    context.strokeStyle = outlineColor;
    context.lineWidth = Math.max(1.1, fontSize * (name === 'Sagittarius A*' ? 0.22 : 0.14));
    for (let row = 0; row < lines.length; row++) {
        const line = lines[row];
        const lineY = y + (row - middleRow) * fontSize * rowSpacing;
        const normalizedY = (row - middleRow) / halfRows;
        for (let column = 0; column < line.length; column++) {
            const glyph = line[column];
            if (glyph === ' ') continue;
            const normalizedX = (column - (maximumColumns - 1) / 2) / halfColumns;
            const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
            const light = surfaceLight(normalizedX, normalizedY, sphereZ, lightX, lightY);
            const surface = TEXTURE_GLYPHS.has(glyph)
                ? galacticSurfaceTexture(
                      name,
                      textureLongitude(normalizedX, sphereZ, phase, seconds),
                      Math.asin(Math.max(-1, Math.min(1, -normalizedY))),
                      color,
                  )
                : { glyph, color };
            const cellX = x + (column - (maximumColumns - 1) / 2) * characterWidth;
            context.globalAlpha = opacity * (0.72 + sphereZ * 0.28);
            context.fillStyle = shadeColor(surface.color, light);
            context.strokeText(surface.glyph, cellX, lineY);
            context.fillText(surface.glyph, cellX, lineY);
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
            const rowSpacing = galacticObject.object.name === 'Sagittarius A*' ? 0.9 : 0.76;
            drawVolumetricSprite(context, {
                name: galacticObject.object.name,
                lines: galacticObject.object.sprite,
                x: galacticObject.x,
                y: galacticObject.y,
                fontSize: spriteFontSize,
                rowSpacing,
                color: galacticObject.object.color,
                maskColor,
                outlineColor,
                opacity: opacity * spriteReveal,
                seconds: reducedMotion ? 0 : seconds,
                phase: index * 1.73,
            });

            const middleRowY =
                galacticObject.y + (2 - (galacticObject.object.sprite.length - 1) / 2) * spriteFontSize * rowSpacing;
            if (galacticObject.object.name === 'Cygnus X-1') {
                const line = galacticObject.object.sprite[1] ?? '';
                const lineWidth = context.measureText(line).width;
                const characterWidth = context.measureText('M').width;
                context.globalAlpha = opacity * spriteReveal;
                context.font = `bold ${spriteFontSize}px "DM Mono", monospace`;
                context.fillStyle = '#8ec07c';
                context.strokeStyle = maskColor;
                context.lineWidth = Math.max(1, spriteFontSize * 0.12);
                context.strokeText('O', galacticObject.x - lineWidth / 2 + characterWidth * 2.5, middleRowY);
                context.fillText('O', galacticObject.x - lineWidth / 2 + characterWidth * 2.5, middleRowY);
                const blackHole = '(@)';
                const blackHoleWidth = context.measureText(blackHole).width;
                context.fillStyle = '#fe8019';
                context.strokeText(blackHole, galacticObject.x + lineWidth / 2 - blackHoleWidth / 2, middleRowY);
                context.fillText(blackHole, galacticObject.x + lineWidth / 2 - blackHoleWidth / 2, middleRowY);
            }

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
