export const ATLAS_GLYPHS = [
    '.',
    ':',
    '*',
    '+',
    "'",
    '-',
    '=',
    '|',
    '/',
    '\\',
    '@',
    '#',
    '%',
    'o',
    'O',
    '[',
    ']',
    '(',
    ')',
    '{',
    '}',
    '~',
] as const;

type GlyphAtlasEntry = {
    canvas: HTMLCanvasElement;
    tileWidth: number;
    tileHeight: number;
    tileWidthPixels: number;
    tileHeightPixels: number;
    glyphs: Map<string, number>;
};

export type GlyphDrawer = (context: CanvasRenderingContext2D, glyph: string, x: number, y: number) => void;

const atlasCache = new Map<string, GlyphAtlasEntry>();
const drawerCache = new Map<string, GlyphDrawer>();
let fontReadyInvalidationScheduled = false;

export const normalizeGlyphFont = (font: string) =>
    font.replace(/(\d+(?:\.\d+)?)px/, (_, size: string) => `${Math.round(Number(size) * 2) / 2}px`);

const fontSizeFrom = (font: string) => {
    const match = font.match(/(\d+(?:\.\d+)?)px/);
    return match ? Number(match[1]) : 16;
};

const scheduleFontReadyInvalidation = () => {
    if (fontReadyInvalidationScheduled || typeof document === 'undefined' || !document.fonts) return;
    fontReadyInvalidationScheduled = true;
    void document.fonts.ready.then(() => {
        atlasCache.clear();
        drawerCache.clear();
    });
};

const createAtlas = (font: string, color: string, pixelRatio: number): GlyphAtlasEntry => {
    const canvas = document.createElement('canvas');
    const measureContext = canvas.getContext('2d');
    if (!measureContext) throw new Error('Unable to create a glyph atlas context');

    measureContext.font = font;
    const fontSize = fontSizeFrom(font);
    const tileWidth = Math.ceil(Math.max(...ATLAS_GLYPHS.map((glyph) => measureContext.measureText(glyph).width)) + 4);
    const tileHeight = Math.ceil(fontSize * 1.6 + 4);
    const columns = 8;
    const rows = Math.ceil(ATLAS_GLYPHS.length / columns);
    const tileWidthPixels = Math.ceil(tileWidth * pixelRatio);
    const tileHeightPixels = Math.ceil(tileHeight * pixelRatio);

    canvas.width = columns * tileWidthPixels;
    canvas.height = rows * tileHeightPixels;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create a glyph atlas context');
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = font;
    context.fillStyle = color;

    const glyphs = new Map<string, number>();
    for (let index = 0; index < ATLAS_GLYPHS.length; index++) {
        const glyph = ATLAS_GLYPHS[index];
        const column = index % columns;
        const row = Math.floor(index / columns);
        context.fillText(glyph, column * tileWidth + tileWidth / 2, row * tileHeight + tileHeight / 2);
        glyphs.set(glyph, index);
    }

    return { canvas, tileWidth, tileHeight, tileWidthPixels, tileHeightPixels, glyphs };
};

export const getGlyphDrawer = (font: string, color: string, pixelRatio: number): GlyphDrawer => {
    if (!Number.isFinite(pixelRatio)) {
        return (context, glyph, x, y) => {
            context.font = font;
            context.fillStyle = color;
            context.fillText(glyph, x, y);
        };
    }

    scheduleFontReadyInvalidation();
    const normalizedFont = normalizeGlyphFont(font);
    const normalizedPixelRatio = Math.round(pixelRatio * 100) / 100;
    const key = `${normalizedFont}|${color}|${normalizedPixelRatio}`;
    const cachedDrawer = drawerCache.get(key);
    if (cachedDrawer) return cachedDrawer;

    let atlas = atlasCache.get(key);
    if (!atlas) {
        atlas = createAtlas(normalizedFont, color, normalizedPixelRatio);
        atlasCache.set(key, atlas);
    }

    const columns = 8;
    const drawer: GlyphDrawer = (context, glyph, x, y) => {
        if (glyph.length !== 1) {
            context.font = font;
            context.fillStyle = color;
            context.fillText(glyph, x, y);
            return;
        }

        const glyphIndex = atlas!.glyphs.get(glyph);
        if (glyphIndex === undefined) {
            context.font = font;
            context.fillStyle = color;
            context.fillText(glyph, x, y);
            return;
        }

        const sourceX = (glyphIndex % columns) * atlas!.tileWidthPixels;
        const sourceY = Math.floor(glyphIndex / columns) * atlas!.tileHeightPixels;
        context.drawImage(
            atlas!.canvas,
            sourceX,
            sourceY,
            atlas!.tileWidthPixels,
            atlas!.tileHeightPixels,
            x - atlas!.tileWidth / 2,
            y - atlas!.tileHeight / 2,
            atlas!.tileWidth,
            atlas!.tileHeight,
        );
    };
    drawerCache.set(key, drawer);
    return drawer;
};
