import { drawReadout } from './canvas-ui';
import type { ProjectedGalacticObject } from './galaxy-object-renderer';
import type { ProjectedComet } from './solar-system-scene';
import { COMPACT_PLANET_GRIDS, solarBodyViewportScale } from './solar-body-renderer';
import type { FocusTarget, ProjectedBody } from './types';

export const findHoveredBody = (options: {
    bodies: ProjectedBody[];
    pointerX: number;
    pointerY: number;
    solarSystemScale: number;
    viewportGlyphScale: number;
    innerPlanetScale: number;
}): ProjectedBody | null => {
    const { bodies, pointerX, pointerY, solarSystemScale, viewportGlyphScale, innerPlanetScale } = options;
    let frontmost: ProjectedBody | null = null;

    for (const body of bodies) {
        if (body.reveal <= 0.35) continue;
        const perspectiveScale = Math.max(0.68, Math.min(1.55, body.scale));
        const depthScale = 0.75 + perspectiveScale * 0.25;
        const glyphScale =
            Math.max(0.3, Math.sqrt(solarSystemScale)) *
            solarBodyViewportScale(body.planet.name, viewportGlyphScale, innerPlanetScale);
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

export const findHoveredComet = (comet: ProjectedComet, pointerX: number, pointerY: number): ProjectedComet | null =>
    Math.hypot(comet.x - pointerX, comet.y - pointerY) <= 22 ? comet : null;

export type FocusHit = {
    hoveredBody: ProjectedBody | null;
    hoveredComet: ProjectedComet | null;
    hoveredSun: boolean;
    hoveredGalacticObject: ProjectedGalacticObject | null;
};

export const resolveFocusHit = (options: {
    x: number;
    y: number;
    forceActive?: boolean;
    pointerActive: boolean;
    cameraDragging: boolean;
    hasObjectFocus: boolean;
    bodies: ProjectedBody[];
    solarSystemScale: number;
    viewportGlyphScale: number;
    innerPlanetScale: number;
    localDetailOpacity: number;
    introDetailOpacity: number;
    galaxyObjectOpacity: number;
    projectedComet: ProjectedComet;
    centerX: number;
    centerY: number;
    renderedSunScale: number;
    introSunOpacity: number;
    findHoveredGalacticObject: (x: number, y: number) => ProjectedGalacticObject | null;
}): FocusHit => {
    const {
        x,
        y,
        forceActive = false,
        pointerActive,
        cameraDragging,
        hasObjectFocus,
        bodies,
        solarSystemScale,
        viewportGlyphScale,
        innerPlanetScale,
        localDetailOpacity,
        introDetailOpacity,
        galaxyObjectOpacity,
        projectedComet,
        centerX,
        centerY,
        renderedSunScale,
        introSunOpacity,
        findHoveredGalacticObject,
    } = options;
    const pointerInsideSun = Math.hypot(centerX - x, centerY - y) < 48 * Math.max(0.55, Math.sqrt(renderedSunScale));
    const canHit = (pointerActive || forceActive) && !cameraDragging && !hasObjectFocus;
    const rawBodyHoverCandidate =
        canHit && localDetailOpacity > 0.45
            ? findHoveredBody({
                  bodies,
                  pointerX: x,
                  pointerY: y,
                  solarSystemScale,
                  viewportGlyphScale,
                  innerPlanetScale,
              })
            : null;
    const bodyHoverCandidate =
        rawBodyHoverCandidate && (rawBodyHoverCandidate.z >= 0 || !pointerInsideSun) ? rawBodyHoverCandidate : null;
    const rawCometHoverCandidate =
        canHit && localDetailOpacity > 0.45 && introDetailOpacity > 0.4 ? findHoveredComet(projectedComet, x, y) : null;
    const cometHoverCandidate =
        rawCometHoverCandidate && (projectedComet.z >= 0 || !pointerInsideSun) ? rawCometHoverCandidate : null;
    const hoveredGalacticObject = canHit && galaxyObjectOpacity > 0.35 ? findHoveredGalacticObject(x, y) : null;
    // Galactic objects are painted last. Within the local scene, the comet
    // and planets compete by depth; the Sun only wins uncovered pixels.
    const hoveredComet =
        !hoveredGalacticObject &&
        cometHoverCandidate &&
        (!bodyHoverCandidate || projectedComet.z >= bodyHoverCandidate.z)
            ? cometHoverCandidate
            : null;
    const hoveredBody = hoveredGalacticObject || hoveredComet ? null : bodyHoverCandidate;
    const hoveredSun =
        !hoveredGalacticObject &&
        !hoveredComet &&
        !hoveredBody &&
        canHit &&
        localDetailOpacity > 0.45 &&
        introSunOpacity > 0.55 &&
        pointerInsideSun;
    return { hoveredBody, hoveredComet, hoveredSun, hoveredGalacticObject };
};

export const createFocusCandidate = (options: {
    hoveredBody: ProjectedBody | null;
    hoveredComet: ProjectedComet | null;
    hoveredSun: boolean;
    hoveredGalacticObject: ProjectedGalacticObject | null;
    sunX: number;
    sunY: number;
}): FocusTarget | null => {
    const { hoveredBody, hoveredComet, hoveredSun, hoveredGalacticObject, sunX, sunY } = options;
    if (hoveredBody) {
        return {
            id: `planet:${hoveredBody.planet.name}`,
            name: hoveredBody.planet.name,
            kind: 'planet',
            color: hoveredBody.planet.color,
            subtitle: hoveredBody.planet.kind,
            detail: hoveredBody.planet.detail,
            fact: hoveredBody.planet.fact,
            originX: hoveredBody.x,
            originY: hoveredBody.y,
        };
    }
    if (hoveredComet) {
        return {
            id: 'comet:1P-Halley',
            name: "Halley's Comet",
            kind: 'comet',
            color: '#83a598',
            subtitle: 'periodic comet / 1P',
            detail: 'q 0.586 AU / retrograde orbit',
            fact: 'next perihelion: 2061',
            originX: hoveredComet.x,
            originY: hoveredComet.y,
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
            fact: 'contains 99.8% of system mass',
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
        fact: hoveredGalacticObject.object.fact,
        sourceSprite: hoveredGalacticObject.object.sprite,
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
        hoveredComet: ProjectedComet | null;
        hoveredSun: boolean;
        hoveredGalacticObject: ProjectedGalacticObject | null;
        sunX: number;
        sunY: number;
        compact: boolean;
    },
) => {
    const { width, height, hoveredBody, hoveredComet, hoveredSun, hoveredGalacticObject, sunX, sunY, compact } =
        options;
    if (hoveredBody) {
        drawReadout(context, {
            lines: [
                `[ ${hoveredBody.planet.name.toUpperCase()} ]`,
                ...(compact ? [] : [hoveredBody.planet.kind, hoveredBody.planet.detail, hoveredBody.planet.fact]),
                `lon  ${hoveredBody.position.longitude.toFixed(2).padStart(6)} deg`,
                `lat  ${`${hoveredBody.position.latitude >= 0 ? '+' : '-'}${Math.abs(hoveredBody.position.latitude).toFixed(2)}`.padStart(6)} deg`,
                `r    ${hoveredBody.position.distance.toFixed(3).padStart(6)} au`,
            ],
            anchorX: hoveredBody.x,
            anchorY: hoveredBody.y,
            viewportWidth: width,
            viewportHeight: height,
            titleColor: hoveredBody.planet.color,
            width: 260,
        });
    }
    if (hoveredComet) {
        drawReadout(context, {
            lines: [
                "[ HALLEY'S COMET ]",
                'periodic comet / 1P',
                `r    ${hoveredComet.distanceAu.toFixed(2).padStart(6)} au`,
                'retrograde orbit / ~75.3-year period',
                'next perihelion: 2061',
            ],
            anchorX: hoveredComet.x,
            anchorY: hoveredComet.y,
            viewportWidth: width,
            viewportHeight: height,
            titleColor: '#83a598',
            width: 270,
        });
    }
    if (hoveredSun) {
        drawReadout(context, {
            lines: compact
                ? ['[ SOL ]']
                : [
                      '[ SOL ]',
                      'G-type main-sequence star',
                      'contains 99.8% of system mass',
                      'mass  1.000 M☉',
                      'age   ~4.6 billion years',
                  ],
            anchorX: sunX,
            anchorY: sunY,
            viewportWidth: width,
            viewportHeight: height,
            titleColor: '#fabd2f',
            width: 260,
        });
    }
    if (hoveredGalacticObject) {
        drawReadout(context, {
            lines: [
                `[ ${hoveredGalacticObject.object.name.toUpperCase()} ]`,
                hoveredGalacticObject.object.kind,
                `dist  ${hoveredGalacticObject.object.distance}`,
                hoveredGalacticObject.object.detail,
                hoveredGalacticObject.object.fact,
            ],
            anchorX: hoveredGalacticObject.x,
            anchorY: hoveredGalacticObject.y,
            viewportWidth: width,
            viewportHeight: height,
            titleColor: hoveredGalacticObject.object.color,
            width: 260,
        });
    }
};
