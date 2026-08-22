import { drawReadout } from './canvas-ui';
import type { ProjectedGalacticObject } from './galaxy-object-renderer';
import { COMPACT_PLANET_GRIDS } from './solar-body-renderer';
import type { FocusTarget, ProjectedBody } from './types';

export const findHoveredBody = (options: {
    bodies: ProjectedBody[];
    pointerX: number;
    pointerY: number;
    solarSystemScale: number;
    viewportGlyphScale: number;
}): ProjectedBody | null => {
    const { bodies, pointerX, pointerY, solarSystemScale, viewportGlyphScale } = options;
    let frontmost: ProjectedBody | null = null;

    for (const body of bodies) {
        if (body.reveal <= 0.35) continue;
        const perspectiveScale = Math.max(0.68, Math.min(1.55, body.scale));
        const depthScale = 0.75 + perspectiveScale * 0.25;
        const glyphScale = Math.max(0.3, Math.sqrt(solarSystemScale)) * viewportGlyphScale;
        const fontSize =
            (body.planet.easterEgg ? 16 : Math.max(6.2, 12.5 * body.planet.size * depthScale)) * glyphScale;
        const usesSingleGlyph = Boolean(body.planet.easterEgg || (fontSize < 9 && solarSystemScale < 0.45));
        const compactGrid =
            solarSystemScale >= 0.45 && !body.planet.easterEgg ? COMPACT_PLANET_GRIDS[body.planet.name] : null;
        const compactFontSize = compactGrid ? fontSize * compactGrid.fontScale : fontSize;
        const compactSphereWidth = compactGrid ? compactGrid.columns * compactFontSize * 0.6 : 0;
        const ringWidth =
            body.planet.name === 'Saturn'
                ? compactSphereWidth * 0.88
                : body.planet.name === 'Uranus'
                  ? compactSphereWidth * 0.74
                  : 0;
        const compactRows =
            body.planet.name === 'Jupiter' || body.planet.name === 'Uranus' || body.planet.name === 'Neptune';
        let maximumLineLength = usesSingleGlyph ? 1 : 0;
        if (!usesSingleGlyph) {
            for (const line of body.planet.sprite) maximumLineLength = Math.max(maximumLineLength, line.length);
        }
        const lineCount = usesSingleGlyph ? 1 : body.planet.sprite.length;
        const halfWidth = compactGrid
            ? Math.max(compactSphereWidth / 2, ringWidth) + 6
            : maximumLineLength * fontSize * 0.31 + 6;
        const halfHeight = compactGrid
            ? (compactGrid.rows * compactFontSize * 0.72) / 2 + 7
            : (lineCount * fontSize * (compactRows ? 0.68 : 0.78)) / 2 + 6;
        const normalizedDistance = ((body.x - pointerX) / halfWidth) ** 2 + ((body.y - pointerY) / halfHeight) ** 2;
        if (normalizedDistance <= 1 && (!frontmost || body.z > frontmost.z)) frontmost = body;
    }

    return frontmost;
};

export const createFocusCandidate = (options: {
    hoveredBody: ProjectedBody | null;
    hoveredSun: boolean;
    hoveredGalacticObject: ProjectedGalacticObject | null;
    sunX: number;
    sunY: number;
}): FocusTarget | null => {
    const { hoveredBody, hoveredSun, hoveredGalacticObject, sunX, sunY } = options;
    if (hoveredBody) {
        return {
            id: `planet:${hoveredBody.planet.name}`,
            name: hoveredBody.planet.name,
            kind: 'planet',
            color: hoveredBody.planet.color,
            subtitle: hoveredBody.planet.easterEgg ? 'dwarf planet' : 'planet',
            detail: `${hoveredBody.position.distance.toFixed(3)} au from Sol`,
            originX: hoveredBody.x,
            originY: hoveredBody.y,
        };
    }
    if (hoveredSun) {
        return {
            id: 'star:Sol',
            name: 'Sol',
            kind: 'star',
            color: '#fabd2f',
            subtitle: 'G-type main-sequence star',
            detail: '1.000 solar mass / system barycentre',
            originX: sunX,
            originY: sunY,
        };
    }
    if (!hoveredGalacticObject) return null;
    return {
        id: `galactic:${hoveredGalacticObject.object.name}`,
        name: hoveredGalacticObject.object.name,
        kind: 'galactic',
        color: hoveredGalacticObject.object.color,
        subtitle: hoveredGalacticObject.object.kind,
        detail: `${hoveredGalacticObject.object.distance} / ${hoveredGalacticObject.object.detail}`,
        originX: hoveredGalacticObject.x,
        originY: hoveredGalacticObject.y,
    };
};

export const drawHoverReadouts = (
    context: CanvasRenderingContext2D,
    options: {
        width: number;
        height: number;
        hoveredBody: ProjectedBody | null;
        hoveredSun: boolean;
        hoveredGalacticObject: ProjectedGalacticObject | null;
        sunX: number;
        sunY: number;
    },
) => {
    const { width, height, hoveredBody, hoveredSun, hoveredGalacticObject, sunX, sunY } = options;
    if (hoveredBody) {
        drawReadout(context, {
            lines: [
                `[ ${hoveredBody.planet.name.toUpperCase()} ]`,
                `lon  ${hoveredBody.position.longitude.toFixed(2).padStart(6)} deg`,
                `lat  ${`${hoveredBody.position.latitude >= 0 ? '+' : '-'}${Math.abs(hoveredBody.position.latitude).toFixed(2)}`.padStart(6)} deg`,
                `r    ${hoveredBody.position.distance.toFixed(3).padStart(6)} au`,
                '[ click to zoom ]',
            ],
            anchorX: hoveredBody.x,
            anchorY: hoveredBody.y,
            viewportWidth: width,
            viewportHeight: height,
            titleColor: hoveredBody.planet.color,
            width: 174,
        });
    }
    if (hoveredSun) {
        drawReadout(context, {
            lines: [
                '[ SOL ]',
                'G-type main-sequence star',
                'mass  1.000 M☉',
                'age   ~4.6 billion years',
                '[ click to zoom ]',
            ],
            anchorX: sunX,
            anchorY: sunY,
            viewportWidth: width,
            viewportHeight: height,
            titleColor: '#fabd2f',
            width: 220,
        });
    }
    if (hoveredGalacticObject) {
        drawReadout(context, {
            lines: [
                `[ ${hoveredGalacticObject.object.name.toUpperCase()} ]`,
                hoveredGalacticObject.object.kind,
                `dist  ${hoveredGalacticObject.object.distance}`,
                hoveredGalacticObject.object.detail,
                '[ click to zoom ]',
            ],
            anchorX: hoveredGalacticObject.x,
            anchorY: hoveredGalacticObject.y,
            viewportWidth: width,
            viewportHeight: height,
            titleColor: hoveredGalacticObject.object.color,
        });
    }
};
