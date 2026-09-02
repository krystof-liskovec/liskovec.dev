import { ATLAS_GLYPHS, normalizeGlyphFont } from './glyph-atlas';
import { GALACTIC_CENTER_DISTANCE_KPC, GALACTIC_SCENE_UNITS_PER_KPC } from './galaxy-model';
import type { SolarParticle } from './scene-data';

const FLOATS_PER_INSTANCE = 12;
const SOLAR_FLOATS_PER_INSTANCE = 8;
const GALAXY_FLOATS_PER_INSTANCE = 12;
const INITIAL_INSTANCE_CAPACITY = 256;

type TextureAtlas = {
    key: string;
    texture: WebGLTexture;
    tileWidth: number;
    tileHeight: number;
    columns: number;
    rows: number;
    glyphs: Map<string, number>;
};

type InstanceBatch = {
    atlas: TextureAtlas;
    data: Float32Array;
    floatCount: number;
};

export type SolarParticleTransform = {
    centerX: number;
    centerY: number;
    worldScale: number;
    cameraDistance: number;
    rollCosine: number;
    rollSine: number;
    pitchCosine: number;
    pitchSine: number;
    yawCosine: number;
    yawSine: number;
};

export type GalaxyParticleTransform = {
    coreX: number;
    coreY: number;
    radius: number;
    verticalProjection: number;
    rotationCosine: number;
    rotationSine: number;
    patternCosine: number;
    patternSine: number;
    elapsedGalacticYears: number;
    seconds: number;
    reducedMotion: boolean;
    alpha: number;
};

export type GalaxyParticleKind = 'material' | 'nebula' | 'star' | 'dust' | 'local-arm';

type SolarBatchSettings = {
    elapsedDays: number;
    opacity: number;
    baseAlpha: number;
    alphaVariation: number;
    innerRadius: number;
    outerRadius: number;
    innerPeriodDays: number;
    outerPeriodDays: number;
    color: [number, number, number];
    transform: SolarParticleTransform;
};

type SolarParticleBatch = {
    atlas: TextureAtlas;
    data: Float32Array;
    instanceCount: number;
    bufferOffset: number;
    bufferGeneration: number;
    active: boolean;
    settings: SolarBatchSettings;
};

type GalaxyBatchSettings = {
    kind: GalaxyParticleKind;
    font: string;
    transform: GalaxyParticleTransform;
};

type GalaxyParticleBatch = {
    atlas: TextureAtlas;
    data: Float32Array;
    floatCount: number;
    instanceCount: number;
    bufferOffset: number;
    bufferGeneration: number;
    initialized: boolean;
    active: boolean;
    settings: GalaxyBatchSettings;
};

export type WebGLGlyphDrawer = (glyph: string, x: number, y: number, alpha: number) => void;
export type WebGLGalaxyGlyphDrawer = (
    glyph: string,
    x: number,
    y: number,
    radius: number,
    phase: number,
    strength: number,
    opacity: number,
    color: string,
) => void;

const VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uAtlasGrid;

in vec2 aPosition;
in vec2 aSize;
in float aGlyphIndex;
in vec4 aColor;

out vec2 vUv;
out vec4 vColor;

const vec2 QUAD[4] = vec2[](
    vec2(-0.5, -0.5),
    vec2( 0.5, -0.5),
    vec2(-0.5,  0.5),
    vec2( 0.5,  0.5)
);

void main() {
    vec2 corner = QUAD[gl_VertexID];
    vec2 pixelPosition = aPosition + corner * aSize;
    vec2 clipPosition = vec2(
        pixelPosition.x / uResolution.x * 2.0 - 1.0,
        1.0 - pixelPosition.y / uResolution.y * 2.0
    );
    gl_Position = vec4(clipPosition, 0.0, 1.0);
    vec2 tileSize = 1.0 / uAtlasGrid;
    float column = mod(aGlyphIndex, uAtlasGrid.x);
    float row = floor(aGlyphIndex / uAtlasGrid.x);
    vec2 tileMin = vec2(column * tileSize.x, row * tileSize.y);
    vUv = mix(tileMin, tileMin + tileSize, corner + 0.5);
    vColor = aColor;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D uGlyphAtlas;

in vec2 vUv;
in vec4 vColor;
out vec4 outColor;

void main() {
    float glyphAlpha = texture(uGlyphAtlas, vUv).a;
    outColor = vec4(vColor.rgb, vColor.a * glyphAlpha);
}
`;

const SOLAR_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uAtlasGrid;
uniform vec2 uGlyphSize;
uniform float uElapsedDays;
uniform float uInnerRadius;
uniform float uOuterRadius;
uniform float uInnerPeriodDays;
uniform float uOuterPeriodDays;
uniform float uOpacity;
uniform float uBaseAlpha;
uniform float uAlphaVariation;
uniform vec2 uCenter;
uniform float uWorldScale;
uniform float uCameraDistance;
uniform vec2 uRoll;
uniform vec2 uPitch;
uniform vec2 uYaw;
uniform vec3 uColor;

in float aAngle;
in float aRadius;
in float aInclinationCosine;
in float aInclinationSine;
in float aNodeCosine;
in float aNodeSine;
in float aPhase;
in float aGlyphIndex;

out vec2 vUv;
out vec4 vColor;

const vec2 QUAD[4] = vec2[](
    vec2(-0.5, -0.5),
    vec2( 0.5, -0.5),
    vec2(-0.5,  0.5),
    vec2( 0.5,  0.5)
);

void main() {
    vec2 corner = QUAD[gl_VertexID];
    float radialProgress = clamp(
        (aRadius - uInnerRadius) / (uOuterRadius - uInnerRadius),
        0.0,
        1.0
    );
    float orbitalPeriodDays = mix(uInnerPeriodDays, uOuterPeriodDays, radialProgress);
    float angle = aAngle + (uElapsedDays / orbitalPeriodDays) * 6.28318530718;
    float orbitalX = cos(angle) * aRadius;
    float orbitalY = sin(angle) * aRadius;
    float worldX = orbitalX * aNodeCosine - orbitalY * aInclinationCosine * aNodeSine;
    float worldY = orbitalX * aNodeSine + orbitalY * aInclinationCosine * aNodeCosine;
    float worldZ = orbitalY * aInclinationSine;

    float rolledX = worldX * uRoll.x - worldY * uRoll.y;
    float rolledY = worldX * uRoll.y + worldY * uRoll.x;
    float pitchedY = rolledY * uPitch.x - worldZ * uPitch.y;
    float pitchedZ = rolledY * uPitch.y + worldZ * uPitch.x;
    float yawedX = rolledX * uYaw.x + pitchedZ * uYaw.y;
    float yawedZ = -rolledX * uYaw.y + pitchedZ * uYaw.x;
    float perspective = uCameraDistance / (uCameraDistance - yawedZ);
    vec2 particlePosition = vec2(
        yawedX * uWorldScale * perspective,
        pitchedY * uWorldScale * perspective
    ) + uCenter;
    vec2 pixelPosition = particlePosition + corner * uGlyphSize;
    vec2 clipPosition = vec2(
        pixelPosition.x / uResolution.x * 2.0 - 1.0,
        1.0 - pixelPosition.y / uResolution.y * 2.0
    );
    gl_Position = vec4(clipPosition, 0.0, 1.0);

    vec2 tileSize = 1.0 / uAtlasGrid;
    float column = mod(aGlyphIndex, uAtlasGrid.x);
    float row = floor(aGlyphIndex / uAtlasGrid.x);
    vec2 tileMin = vec2(column * tileSize.x, row * tileSize.y);
    vUv = mix(tileMin, tileMin + tileSize, corner + 0.5);
    vColor = vec4(uColor, uOpacity * (uBaseAlpha + aPhase * uAlphaVariation));
}
`;

const GALAXY_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uAtlasGrid;
uniform vec2 uGlyphSize;
uniform vec2 uCore;
uniform float uRadius;
uniform float uVerticalProjection;
uniform vec2 uRotation;
uniform vec2 uPatternRotation;
uniform float uElapsedGalacticYears;
uniform float uSeconds;
uniform float uReducedMotion;
uniform float uKind;
uniform float uAlpha;

in float aX;
in float aY;
in float aRadius;
in float aPhase;
in float aStrength;
in float aOpacity;
in float aGlyphIndex;
in vec3 aColor;

out vec2 vUv;
out vec4 vColor;

const vec2 QUAD[4] = vec2[](
    vec2(-0.5, -0.5),
    vec2( 0.5, -0.5),
    vec2(-0.5,  0.5),
    vec2( 0.5,  0.5)
);
const float TAU = 6.28318530718;
const float GALACTIC_CENTER_DISTANCE_KPC = ${GALACTIC_CENTER_DISTANCE_KPC};
const float GALACTIC_SCENE_UNITS_PER_KPC = ${GALACTIC_SCENE_UNITS_PER_KPC};
const float SOL_GALACTIC_PERIOD_YEARS = 230000000.0;

void main() {
    vec2 corner = QUAD[gl_VertexID];
    vec2 materialPosition = vec2(aX, aY);
    if (uKind < 0.5) {
        float radiusKpc = length(materialPosition) / GALACTIC_SCENE_UNITS_PER_KPC;
        if (radiusKpc >= 0.08) {
            float orbitalPeriod = SOL_GALACTIC_PERIOD_YEARS *
                (radiusKpc / GALACTIC_CENTER_DISTANCE_KPC);
            float phase = uElapsedGalacticYears / orbitalPeriod * TAU;
            float cosine = cos(phase);
            float sine = sin(phase);
            materialPosition = vec2(
                materialPosition.x * cosine + materialPosition.y * sine,
                -materialPosition.x * sine + materialPosition.y * cosine
            );
        }
    } else {
        materialPosition = vec2(
            materialPosition.x * uPatternRotation.x + materialPosition.y * uPatternRotation.y,
            -materialPosition.x * uPatternRotation.y + materialPosition.y * uPatternRotation.x
        );
    }

    vec2 rotatedPosition = vec2(
        materialPosition.x * uRotation.x - materialPosition.y * uRotation.y,
        materialPosition.x * uRotation.y + materialPosition.y * uRotation.x
    );
    vec2 particlePosition = uCore + vec2(
        rotatedPosition.x * uRadius,
        rotatedPosition.y * uVerticalProjection * uRadius
    );
    vec2 pixelPosition = particlePosition + corner * uGlyphSize;
    vec2 clipPosition = vec2(
        pixelPosition.x / uResolution.x * 2.0 - 1.0,
        1.0 - pixelPosition.y / uResolution.y * 2.0
    );
    gl_Position = vec4(clipPosition, 0.0, 1.0);

    vec2 tileSize = 1.0 / uAtlasGrid;
    float column = mod(aGlyphIndex, uAtlasGrid.x);
    float row = floor(aGlyphIndex / uAtlasGrid.x);
    vec2 tileMin = vec2(column * tileSize.x, row * tileSize.y);
    vUv = mix(tileMin, tileMin + tileSize, corner + 0.5);

    float pulse = 1.0;
    float brightness = 1.0;
    if (uKind > 0.5 && uKind < 1.5) {
        pulse = uReducedMotion > 0.5 ? 0.82 : 0.8 + sin(uSeconds * 0.34 + aPhase) * 0.12;
    } else if (uKind > 1.5 && uKind < 2.5) {
        pulse = uReducedMotion > 0.5 ? 0.7 : 0.68 + sin(uSeconds * 0.9 + aPhase) * 0.22;
        brightness = 0.5 + (1.0 - aRadius) * 0.42 + aStrength * 0.16;
    } else if (uKind > 3.5) {
        pulse = uReducedMotion > 0.5 ? 0.72 : 0.72 + sin(uSeconds + aPhase) * 0.18;
        brightness = 0.92;
    }
    vColor = vec4(aColor, uAlpha * (uKind > 0.5 && uKind < 1.5
        ? aOpacity * pulse
        : aOpacity * pulse * brightness));
}
`;

const fontSizeFrom = (font: string) => {
    const match = font.match(/(\d+(?:\.\d+)?)px/);
    return match ? Number(match[1]) : 16;
};

const hexColor = (color: string): [number, number, number] => {
    const normalized = color.trim().replace('#', '');
    if (normalized.length !== 6) return [1, 1, 1];
    return [
        Number.parseInt(normalized.slice(0, 2), 16) / 255,
        Number.parseInt(normalized.slice(2, 4), 16) / 255,
        Number.parseInt(normalized.slice(4, 6), 16) / 255,
    ];
};

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
    }
    return shader;
};

const createProgram = (
    gl: WebGL2RenderingContext,
    vertexSource: string = VERTEX_SHADER,
    fragmentSource: string = FRAGMENT_SHADER,
) => {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        return null;
    }
    return program;
};

export class WebGLParticleRenderer {
    readonly canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext | null;
    private program: WebGLProgram | null = null;
    private vertexArray: WebGLVertexArrayObject | null = null;
    private instanceBuffer: WebGLBuffer | null = null;
    private resolutionLocation: WebGLUniformLocation | null = null;
    private atlasLocation: WebGLUniformLocation | null = null;
    private atlasGridLocation: WebGLUniformLocation | null = null;
    private solarProgram: WebGLProgram | null = null;
    private solarVertexArray: WebGLVertexArrayObject | null = null;
    private solarInstanceBuffer: WebGLBuffer | null = null;
    private solarResolutionLocation: WebGLUniformLocation | null = null;
    private solarAtlasLocation: WebGLUniformLocation | null = null;
    private solarAtlasGridLocation: WebGLUniformLocation | null = null;
    private solarGlyphSizeLocation: WebGLUniformLocation | null = null;
    private solarElapsedDaysLocation: WebGLUniformLocation | null = null;
    private solarInnerRadiusLocation: WebGLUniformLocation | null = null;
    private solarOuterRadiusLocation: WebGLUniformLocation | null = null;
    private solarInnerPeriodDaysLocation: WebGLUniformLocation | null = null;
    private solarOuterPeriodDaysLocation: WebGLUniformLocation | null = null;
    private solarOpacityLocation: WebGLUniformLocation | null = null;
    private solarBaseAlphaLocation: WebGLUniformLocation | null = null;
    private solarAlphaVariationLocation: WebGLUniformLocation | null = null;
    private solarCenterLocation: WebGLUniformLocation | null = null;
    private solarWorldScaleLocation: WebGLUniformLocation | null = null;
    private solarCameraDistanceLocation: WebGLUniformLocation | null = null;
    private solarRollLocation: WebGLUniformLocation | null = null;
    private solarPitchLocation: WebGLUniformLocation | null = null;
    private solarYawLocation: WebGLUniformLocation | null = null;
    private solarColorLocation: WebGLUniformLocation | null = null;
    private solarAttributeLocations: number[] = [];
    private solarStaticBufferDirty = true;
    private galaxyProgram: WebGLProgram | null = null;
    private galaxyVertexArray: WebGLVertexArrayObject | null = null;
    private galaxyInstanceBuffer: WebGLBuffer | null = null;
    private galaxyResolutionLocation: WebGLUniformLocation | null = null;
    private galaxyAtlasLocation: WebGLUniformLocation | null = null;
    private galaxyAtlasGridLocation: WebGLUniformLocation | null = null;
    private galaxyGlyphSizeLocation: WebGLUniformLocation | null = null;
    private galaxyCoreLocation: WebGLUniformLocation | null = null;
    private galaxyRadiusLocation: WebGLUniformLocation | null = null;
    private galaxyVerticalProjectionLocation: WebGLUniformLocation | null = null;
    private galaxyRotationLocation: WebGLUniformLocation | null = null;
    private galaxyPatternRotationLocation: WebGLUniformLocation | null = null;
    private galaxyElapsedYearsLocation: WebGLUniformLocation | null = null;
    private galaxySecondsLocation: WebGLUniformLocation | null = null;
    private galaxyReducedMotionLocation: WebGLUniformLocation | null = null;
    private galaxyKindLocation: WebGLUniformLocation | null = null;
    private galaxyAlphaLocation: WebGLUniformLocation | null = null;
    private galaxyAttributeLocations: number[] = [];
    private galaxyColorLocation = -1;
    private galaxyStaticBufferDirty = true;
    private solarBufferGeneration = 0;
    private galaxyBufferGeneration = 0;
    private readonly atlases = new Map<string, TextureAtlas>();
    private readonly batches = new Map<string, InstanceBatch>();
    private readonly solarBatches = new Map<string, SolarParticleBatch>();
    private readonly galaxyBatches = new Map<string, GalaxyParticleBatch>();
    private readonly colorCache = new Map<string, [number, number, number]>();
    private pixelRatio = 1;
    private renderWidth = 1;
    private renderHeight = 1;
    private originX = 0;
    private originY = 0;
    private fontReadyInvalidationScheduled = false;
    private contextLost = false;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'low-power',
        });
        if (!this.gl) return;

        canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            this.contextLost = true;
        });
        canvas.addEventListener('webglcontextrestored', () => {
            this.contextLost = false;
            this.disposeResources();
            this.initialize();
        });
        this.initialize();
    }

    get available() {
        return Boolean(this.gl && this.program && this.vertexArray && this.instanceBuffer && !this.contextLost);
    }

    get solarAvailable() {
        return Boolean(this.available && this.solarProgram && this.solarVertexArray && this.solarInstanceBuffer);
    }

    get galaxyAvailable() {
        return Boolean(this.available && this.galaxyProgram && this.galaxyVertexArray && this.galaxyInstanceBuffer);
    }

    begin(options: {
        renderWidth: number;
        renderHeight: number;
        pixelWidth: number;
        pixelHeight: number;
        pixelRatio: number;
        originX: number;
        originY: number;
    }) {
        if (!this.available || !this.gl) return;
        this.renderWidth = options.renderWidth;
        this.renderHeight = options.renderHeight;
        this.pixelRatio = options.pixelRatio;
        this.originX = options.originX;
        this.originY = options.originY;
        if (this.canvas.width !== options.pixelWidth || this.canvas.height !== options.pixelHeight) {
            this.canvas.width = options.pixelWidth;
            this.canvas.height = options.pixelHeight;
        }

        for (const batch of this.batches.values()) batch.floatCount = 0;
        for (const batch of this.solarBatches.values()) batch.active = false;
        for (const batch of this.galaxyBatches.values()) batch.active = false;
        this.gl.viewport(0, 0, options.pixelWidth, options.pixelHeight);
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    getGlyphDrawer(font: string, color: string): WebGLGlyphDrawer {
        const normalizedFont = normalizeGlyphFont(font);
        const normalizedPixelRatio = Math.round(this.pixelRatio * 100) / 100;
        const atlas = this.getAtlas(normalizedFont, normalizedPixelRatio);
        const rgb = this.colorCache.get(color) ?? hexColor(color);
        this.colorCache.set(color, rgb);
        const batch = this.getBatch(atlas);

        return (glyph, x, y, alpha) => {
            const glyphIndex = atlas.glyphs.get(glyph);
            if (glyphIndex === undefined || alpha <= 0.001) return;

            const offset = this.reserve(batch);
            batch.data[offset] = x + this.originX;
            batch.data[offset + 1] = y + this.originY;
            batch.data[offset + 2] = atlas.tileWidth;
            batch.data[offset + 3] = atlas.tileHeight;
            batch.data[offset + 4] = glyphIndex;
            batch.data[offset + 5] = 0;
            batch.data[offset + 6] = 0;
            batch.data[offset + 7] = 0;
            batch.data[offset + 8] = rgb[0];
            batch.data[offset + 9] = rgb[1];
            batch.data[offset + 10] = rgb[2];
            batch.data[offset + 11] = Math.max(0, Math.min(1, alpha));
        };
    }

    drawSolarParticleField(options: {
        fieldKey: string;
        particles: SolarParticle[];
        font: string;
        color: string;
        compact: boolean;
        elapsedDays: number;
        opacity: number;
        baseAlpha: number;
        alphaVariation: number;
        innerRadius: number;
        outerRadius: number;
        innerPeriodDays: number;
        outerPeriodDays: number;
        transform: SolarParticleTransform;
    }) {
        if (!this.solarAvailable || !this.gl) return false;

        const normalizedFont = normalizeGlyphFont(options.font);
        const normalizedPixelRatio = Math.round(this.pixelRatio * 100) / 100;
        const atlas = this.getAtlas(normalizedFont, normalizedPixelRatio);
        const rgb = this.colorCache.get(options.color) ?? hexColor(options.color);
        this.colorCache.set(options.color, rgb);
        const batchKey = `${options.fieldKey}|${atlas.key}|${options.compact ? 'compact' : 'full'}`;
        let batch = this.solarBatches.get(batchKey);
        if (!batch) {
            batch = {
                atlas,
                data: new Float32Array(0),
                instanceCount: 0,
                bufferOffset: 0,
                bufferGeneration: -1,
                active: true,
                settings: {
                    elapsedDays: 0,
                    opacity: 0,
                    baseAlpha: 0,
                    alphaVariation: 0,
                    innerRadius: 0,
                    outerRadius: 1,
                    innerPeriodDays: 1,
                    outerPeriodDays: 1,
                    color: rgb,
                    transform: options.transform,
                },
            };
            this.solarBatches.set(batchKey, batch);
        }
        if (batch.bufferGeneration !== this.solarBufferGeneration) this.solarStaticBufferDirty = true;
        batch.active = true;
        batch.settings = {
            elapsedDays: options.elapsedDays,
            opacity: options.opacity,
            baseAlpha: options.baseAlpha,
            alphaVariation: options.alphaVariation,
            innerRadius: options.innerRadius,
            outerRadius: options.outerRadius,
            innerPeriodDays: options.innerPeriodDays,
            outerPeriodDays: options.outerPeriodDays,
            color: rgb,
            transform: options.transform,
        };

        if (batch.data.length === 0) {
            batch.data = new Float32Array(options.particles.length * SOLAR_FLOATS_PER_INSTANCE);
            for (let index = 0; index < options.particles.length; index++) {
                if (options.compact && index % 2 !== 0) continue;
                const particle = options.particles[index];
                const glyphIndex = atlas.glyphs.get(particle.glyph);
                if (glyphIndex === undefined) continue;
                const offset = batch.instanceCount * SOLAR_FLOATS_PER_INSTANCE;
                batch.data[offset] = particle.angle;
                batch.data[offset + 1] = particle.radius;
                batch.data[offset + 2] = particle.inclinationCosine;
                batch.data[offset + 3] = particle.inclinationSine;
                batch.data[offset + 4] = particle.nodeCosine;
                batch.data[offset + 5] = particle.nodeSine;
                batch.data[offset + 6] = particle.phase;
                batch.data[offset + 7] = glyphIndex;
                batch.instanceCount++;
            }
            this.solarStaticBufferDirty = true;
        }
        return true;
    }

    getGalaxyGlyphDrawer(options: {
        fieldKey: string;
        font: string;
        kind: GalaxyParticleKind;
        transform: GalaxyParticleTransform;
    }): WebGLGalaxyGlyphDrawer | null {
        if (!this.galaxyAvailable) return null;

        const normalizedFont = normalizeGlyphFont(options.font);
        const normalizedPixelRatio = Math.round(this.pixelRatio * 100) / 100;
        const atlas = this.getAtlas(normalizedFont, normalizedPixelRatio);
        const batchKey = `${options.fieldKey}|${atlas.key}`;
        let batch = this.galaxyBatches.get(batchKey);
        if (!batch) {
            batch = {
                atlas,
                data: new Float32Array(INITIAL_INSTANCE_CAPACITY * GALAXY_FLOATS_PER_INSTANCE),
                floatCount: 0,
                instanceCount: 0,
                bufferOffset: 0,
                bufferGeneration: -1,
                initialized: false,
                active: true,
                settings: {
                    kind: options.kind,
                    font: normalizedFont,
                    transform: options.transform,
                },
            };
            this.galaxyBatches.set(batchKey, batch);
            this.galaxyStaticBufferDirty = true;
        }
        if (batch.bufferGeneration !== this.galaxyBufferGeneration) this.galaxyStaticBufferDirty = true;
        batch.active = true;
        batch.settings = {
            kind: options.kind,
            font: normalizedFont,
            transform: options.transform,
        };

        return (glyph, x, y, radius, phase, strength, opacity, color) => {
            if (batch.initialized) return;
            const glyphIndex = atlas.glyphs.get(glyph);
            if (glyphIndex === undefined) return;
            const rgb = this.colorCache.get(color) ?? hexColor(color);
            this.colorCache.set(color, rgb);
            const offset = this.reserveGalaxy(batch);
            batch.data[offset] = x;
            batch.data[offset + 1] = y;
            batch.data[offset + 2] = radius;
            batch.data[offset + 3] = phase;
            batch.data[offset + 4] = strength;
            batch.data[offset + 5] = opacity;
            batch.data[offset + 6] = glyphIndex;
            batch.data[offset + 7] = rgb[0];
            batch.data[offset + 8] = rgb[1];
            batch.data[offset + 9] = rgb[2];
            batch.data[offset + 10] = 0;
            batch.data[offset + 11] = 0;
        };
    }

    flush() {
        if (!this.available || !this.gl || !this.program || !this.vertexArray || !this.instanceBuffer) return;
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vertexArray);
        gl.uniform2f(this.resolutionLocation, this.renderWidth, this.renderHeight);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this.atlasLocation, 0);

        for (const batch of this.batches.values()) {
            if (batch.floatCount === 0) continue;
            gl.bindTexture(gl.TEXTURE_2D, batch.atlas.texture);
            gl.uniform2f(this.atlasGridLocation, batch.atlas.columns, batch.atlas.rows);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, batch.data.subarray(0, batch.floatCount), gl.DYNAMIC_DRAW);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.floatCount / FLOATS_PER_INSTANCE);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
        gl.useProgram(null);

        if (!this.galaxyAvailable || !this.galaxyProgram || !this.galaxyVertexArray || !this.galaxyInstanceBuffer)
            return;
        for (const batch of this.galaxyBatches.values()) {
            if (batch.active && !batch.initialized) {
                batch.instanceCount = batch.floatCount / GALAXY_FLOATS_PER_INSTANCE;
                batch.initialized = true;
                this.galaxyStaticBufferDirty = true;
            }
        }
        gl.useProgram(this.galaxyProgram);
        gl.bindVertexArray(this.galaxyVertexArray);
        gl.uniform2f(this.galaxyResolutionLocation, this.renderWidth, this.renderHeight);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this.galaxyAtlasLocation, 0);
        this.uploadGalaxyStaticBuffer();

        for (const batch of this.galaxyBatches.values()) {
            if (!batch.active || batch.instanceCount === 0) continue;
            const settings = batch.settings;
            const transform = settings.transform;
            const kind =
                settings.kind === 'material'
                    ? 0
                    : settings.kind === 'nebula'
                      ? 1
                      : settings.kind === 'star'
                        ? 2
                        : settings.kind === 'dust'
                          ? 3
                          : 4;
            gl.bindTexture(gl.TEXTURE_2D, batch.atlas.texture);
            gl.uniform2f(this.galaxyAtlasGridLocation, batch.atlas.columns, batch.atlas.rows);
            gl.uniform2f(this.galaxyGlyphSizeLocation, batch.atlas.tileWidth, batch.atlas.tileHeight);
            gl.uniform2f(this.galaxyCoreLocation, transform.coreX, transform.coreY);
            gl.uniform1f(this.galaxyRadiusLocation, transform.radius);
            gl.uniform1f(this.galaxyVerticalProjectionLocation, transform.verticalProjection);
            gl.uniform2f(this.galaxyRotationLocation, transform.rotationCosine, transform.rotationSine);
            gl.uniform2f(this.galaxyPatternRotationLocation, transform.patternCosine, transform.patternSine);
            gl.uniform1f(this.galaxyElapsedYearsLocation, transform.elapsedGalacticYears);
            gl.uniform1f(this.galaxySecondsLocation, transform.seconds);
            gl.uniform1f(this.galaxyReducedMotionLocation, transform.reducedMotion ? 1 : 0);
            gl.uniform1f(this.galaxyKindLocation, kind);
            gl.uniform1f(this.galaxyAlphaLocation, transform.alpha);
            this.bindGalaxyBatch(batch);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.instanceCount);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
        gl.useProgram(null);

        if (!this.solarAvailable || !this.solarProgram || !this.solarVertexArray || !this.solarInstanceBuffer) return;
        gl.useProgram(this.solarProgram);
        gl.bindVertexArray(this.solarVertexArray);
        gl.uniform2f(this.solarResolutionLocation, this.renderWidth, this.renderHeight);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(this.solarAtlasLocation, 0);
        this.uploadSolarStaticBuffer();

        for (const batch of this.solarBatches.values()) {
            if (!batch.active || batch.instanceCount === 0) continue;
            const settings = batch.settings;
            const transform = settings.transform;
            gl.bindTexture(gl.TEXTURE_2D, batch.atlas.texture);
            gl.uniform2f(this.solarAtlasGridLocation, batch.atlas.columns, batch.atlas.rows);
            gl.uniform2f(this.solarGlyphSizeLocation, batch.atlas.tileWidth, batch.atlas.tileHeight);
            gl.uniform1f(this.solarElapsedDaysLocation, settings.elapsedDays);
            gl.uniform1f(this.solarInnerRadiusLocation, settings.innerRadius);
            gl.uniform1f(this.solarOuterRadiusLocation, settings.outerRadius);
            gl.uniform1f(this.solarInnerPeriodDaysLocation, settings.innerPeriodDays);
            gl.uniform1f(this.solarOuterPeriodDaysLocation, settings.outerPeriodDays);
            gl.uniform1f(this.solarOpacityLocation, settings.opacity);
            gl.uniform1f(this.solarBaseAlphaLocation, settings.baseAlpha);
            gl.uniform1f(this.solarAlphaVariationLocation, settings.alphaVariation);
            gl.uniform2f(this.solarCenterLocation, transform.centerX, transform.centerY);
            gl.uniform1f(this.solarWorldScaleLocation, transform.worldScale);
            gl.uniform1f(this.solarCameraDistanceLocation, transform.cameraDistance);
            gl.uniform2f(this.solarRollLocation, transform.rollCosine, transform.rollSine);
            gl.uniform2f(this.solarPitchLocation, transform.pitchCosine, transform.pitchSine);
            gl.uniform2f(this.solarYawLocation, transform.yawCosine, transform.yawSine);
            gl.uniform3f(this.solarColorLocation, settings.color[0], settings.color[1], settings.color[2]);
            this.bindSolarBatch(batch);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.instanceCount);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindVertexArray(null);
        gl.useProgram(null);
    }

    private initialize() {
        if (!this.gl) return;
        const gl = this.gl;
        this.program = createProgram(gl);
        if (!this.program) return;
        this.resolutionLocation = gl.getUniformLocation(this.program, 'uResolution');
        this.atlasLocation = gl.getUniformLocation(this.program, 'uGlyphAtlas');
        this.atlasGridLocation = gl.getUniformLocation(this.program, 'uAtlasGrid');
        this.vertexArray = gl.createVertexArray();
        this.instanceBuffer = gl.createBuffer();
        if (!this.vertexArray || !this.instanceBuffer) return;

        gl.bindVertexArray(this.vertexArray);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
        const stride = FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
        const positionLocation = gl.getAttribLocation(this.program, 'aPosition');
        const sizeLocation = gl.getAttribLocation(this.program, 'aSize');
        const glyphLocation = gl.getAttribLocation(this.program, 'aGlyphIndex');
        const colorLocation = gl.getAttribLocation(this.program, 'aColor');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(positionLocation, 1);
        gl.enableVertexAttribArray(sizeLocation);
        gl.vertexAttribPointer(sizeLocation, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribDivisor(sizeLocation, 1);
        gl.enableVertexAttribArray(glyphLocation);
        gl.vertexAttribPointer(glyphLocation, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribDivisor(glyphLocation, 1);
        gl.enableVertexAttribArray(colorLocation);
        gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, stride, 8 * Float32Array.BYTES_PER_ELEMENT);
        gl.vertexAttribDivisor(colorLocation, 1);
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);

        this.solarProgram = createProgram(gl, SOLAR_VERTEX_SHADER);
        if (this.solarProgram) {
            this.solarResolutionLocation = gl.getUniformLocation(this.solarProgram, 'uResolution');
            this.solarAtlasLocation = gl.getUniformLocation(this.solarProgram, 'uGlyphAtlas');
            this.solarAtlasGridLocation = gl.getUniformLocation(this.solarProgram, 'uAtlasGrid');
            this.solarGlyphSizeLocation = gl.getUniformLocation(this.solarProgram, 'uGlyphSize');
            this.solarElapsedDaysLocation = gl.getUniformLocation(this.solarProgram, 'uElapsedDays');
            this.solarInnerRadiusLocation = gl.getUniformLocation(this.solarProgram, 'uInnerRadius');
            this.solarOuterRadiusLocation = gl.getUniformLocation(this.solarProgram, 'uOuterRadius');
            this.solarInnerPeriodDaysLocation = gl.getUniformLocation(this.solarProgram, 'uInnerPeriodDays');
            this.solarOuterPeriodDaysLocation = gl.getUniformLocation(this.solarProgram, 'uOuterPeriodDays');
            this.solarOpacityLocation = gl.getUniformLocation(this.solarProgram, 'uOpacity');
            this.solarBaseAlphaLocation = gl.getUniformLocation(this.solarProgram, 'uBaseAlpha');
            this.solarAlphaVariationLocation = gl.getUniformLocation(this.solarProgram, 'uAlphaVariation');
            this.solarCenterLocation = gl.getUniformLocation(this.solarProgram, 'uCenter');
            this.solarWorldScaleLocation = gl.getUniformLocation(this.solarProgram, 'uWorldScale');
            this.solarCameraDistanceLocation = gl.getUniformLocation(this.solarProgram, 'uCameraDistance');
            this.solarRollLocation = gl.getUniformLocation(this.solarProgram, 'uRoll');
            this.solarPitchLocation = gl.getUniformLocation(this.solarProgram, 'uPitch');
            this.solarYawLocation = gl.getUniformLocation(this.solarProgram, 'uYaw');
            this.solarColorLocation = gl.getUniformLocation(this.solarProgram, 'uColor');
            this.solarVertexArray = gl.createVertexArray();
            this.solarInstanceBuffer = gl.createBuffer();
            if (this.solarVertexArray && this.solarInstanceBuffer) {
                gl.bindVertexArray(this.solarVertexArray);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.solarInstanceBuffer);
                const solarStride = SOLAR_FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
                const angleLocation = gl.getAttribLocation(this.solarProgram, 'aAngle');
                const radiusLocation = gl.getAttribLocation(this.solarProgram, 'aRadius');
                const inclinationCosineLocation = gl.getAttribLocation(this.solarProgram, 'aInclinationCosine');
                const inclinationSineLocation = gl.getAttribLocation(this.solarProgram, 'aInclinationSine');
                const nodeCosineLocation = gl.getAttribLocation(this.solarProgram, 'aNodeCosine');
                const nodeSineLocation = gl.getAttribLocation(this.solarProgram, 'aNodeSine');
                const phaseLocation = gl.getAttribLocation(this.solarProgram, 'aPhase');
                const glyphIndexLocation = gl.getAttribLocation(this.solarProgram, 'aGlyphIndex');
                const solarAttributes = [
                    angleLocation,
                    radiusLocation,
                    inclinationCosineLocation,
                    inclinationSineLocation,
                    nodeCosineLocation,
                    nodeSineLocation,
                    phaseLocation,
                    glyphIndexLocation,
                ];
                this.solarAttributeLocations = solarAttributes;
                for (const [index, location] of solarAttributes.entries()) {
                    gl.enableVertexAttribArray(location);
                    gl.vertexAttribPointer(
                        location,
                        1,
                        gl.FLOAT,
                        false,
                        solarStride,
                        index * Float32Array.BYTES_PER_ELEMENT,
                    );
                    gl.vertexAttribDivisor(location, 1);
                }
                gl.bindVertexArray(null);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
            }
        }

        this.galaxyProgram = createProgram(gl, GALAXY_VERTEX_SHADER);
        if (this.galaxyProgram) {
            this.galaxyResolutionLocation = gl.getUniformLocation(this.galaxyProgram, 'uResolution');
            this.galaxyAtlasLocation = gl.getUniformLocation(this.galaxyProgram, 'uGlyphAtlas');
            this.galaxyAtlasGridLocation = gl.getUniformLocation(this.galaxyProgram, 'uAtlasGrid');
            this.galaxyGlyphSizeLocation = gl.getUniformLocation(this.galaxyProgram, 'uGlyphSize');
            this.galaxyCoreLocation = gl.getUniformLocation(this.galaxyProgram, 'uCore');
            this.galaxyRadiusLocation = gl.getUniformLocation(this.galaxyProgram, 'uRadius');
            this.galaxyVerticalProjectionLocation = gl.getUniformLocation(this.galaxyProgram, 'uVerticalProjection');
            this.galaxyRotationLocation = gl.getUniformLocation(this.galaxyProgram, 'uRotation');
            this.galaxyPatternRotationLocation = gl.getUniformLocation(this.galaxyProgram, 'uPatternRotation');
            this.galaxyElapsedYearsLocation = gl.getUniformLocation(this.galaxyProgram, 'uElapsedGalacticYears');
            this.galaxySecondsLocation = gl.getUniformLocation(this.galaxyProgram, 'uSeconds');
            this.galaxyReducedMotionLocation = gl.getUniformLocation(this.galaxyProgram, 'uReducedMotion');
            this.galaxyKindLocation = gl.getUniformLocation(this.galaxyProgram, 'uKind');
            this.galaxyAlphaLocation = gl.getUniformLocation(this.galaxyProgram, 'uAlpha');
            this.galaxyVertexArray = gl.createVertexArray();
            this.galaxyInstanceBuffer = gl.createBuffer();
            if (this.galaxyVertexArray && this.galaxyInstanceBuffer) {
                gl.bindVertexArray(this.galaxyVertexArray);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.galaxyInstanceBuffer);
                const galaxyStride = GALAXY_FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
                const galaxyAttributes = [
                    gl.getAttribLocation(this.galaxyProgram, 'aX'),
                    gl.getAttribLocation(this.galaxyProgram, 'aY'),
                    gl.getAttribLocation(this.galaxyProgram, 'aRadius'),
                    gl.getAttribLocation(this.galaxyProgram, 'aPhase'),
                    gl.getAttribLocation(this.galaxyProgram, 'aStrength'),
                    gl.getAttribLocation(this.galaxyProgram, 'aOpacity'),
                    gl.getAttribLocation(this.galaxyProgram, 'aGlyphIndex'),
                ];
                this.galaxyAttributeLocations = galaxyAttributes;
                for (const [index, location] of galaxyAttributes.entries()) {
                    gl.enableVertexAttribArray(location);
                    gl.vertexAttribPointer(
                        location,
                        1,
                        gl.FLOAT,
                        false,
                        galaxyStride,
                        index * Float32Array.BYTES_PER_ELEMENT,
                    );
                    gl.vertexAttribDivisor(location, 1);
                }
                const colorLocation = gl.getAttribLocation(this.galaxyProgram, 'aColor');
                this.galaxyColorLocation = colorLocation;
                gl.enableVertexAttribArray(colorLocation);
                gl.vertexAttribPointer(
                    colorLocation,
                    3,
                    gl.FLOAT,
                    false,
                    galaxyStride,
                    7 * Float32Array.BYTES_PER_ELEMENT,
                );
                gl.vertexAttribDivisor(colorLocation, 1);
                gl.bindVertexArray(null);
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
            }
        }
        this.scheduleFontReadyInvalidation();
    }

    private getBatch(atlas: TextureAtlas) {
        let batch = this.batches.get(atlas.key);
        if (!batch) {
            batch = {
                atlas,
                data: new Float32Array(INITIAL_INSTANCE_CAPACITY * FLOATS_PER_INSTANCE),
                floatCount: 0,
            };
            this.batches.set(atlas.key, batch);
        }
        return batch;
    }

    private reserve(batch: InstanceBatch) {
        const offset = batch.floatCount;
        if (offset + FLOATS_PER_INSTANCE > batch.data.length) {
            const next = new Float32Array(batch.data.length * 2);
            next.set(batch.data);
            batch.data = next;
        }
        batch.floatCount += FLOATS_PER_INSTANCE;
        return offset;
    }

    private reserveGalaxy(batch: GalaxyParticleBatch) {
        const offset = batch.floatCount;
        if (offset + GALAXY_FLOATS_PER_INSTANCE > batch.data.length) {
            const next = new Float32Array(batch.data.length * 2);
            next.set(batch.data);
            batch.data = next;
        }
        batch.floatCount += GALAXY_FLOATS_PER_INSTANCE;
        return offset;
    }

    private bindSolarBatch(batch: SolarParticleBatch) {
        const gl = this.gl;
        if (!gl || !this.solarInstanceBuffer) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.solarInstanceBuffer);
        const stride = SOLAR_FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
        for (const [index, location] of this.solarAttributeLocations.entries()) {
            gl.vertexAttribPointer(
                location,
                1,
                gl.FLOAT,
                false,
                stride,
                batch.bufferOffset + index * Float32Array.BYTES_PER_ELEMENT,
            );
        }
    }

    private bindGalaxyBatch(batch: GalaxyParticleBatch) {
        const gl = this.gl;
        if (!gl || !this.galaxyInstanceBuffer) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.galaxyInstanceBuffer);
        const stride = GALAXY_FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
        for (const [index, location] of this.galaxyAttributeLocations.entries()) {
            gl.vertexAttribPointer(
                location,
                1,
                gl.FLOAT,
                false,
                stride,
                batch.bufferOffset + index * Float32Array.BYTES_PER_ELEMENT,
            );
        }
        gl.vertexAttribPointer(
            this.galaxyColorLocation,
            3,
            gl.FLOAT,
            false,
            stride,
            batch.bufferOffset + 7 * Float32Array.BYTES_PER_ELEMENT,
        );
    }

    private uploadSolarStaticBuffer() {
        const gl = this.gl;
        if (!gl || !this.solarInstanceBuffer || !this.solarStaticBufferDirty) return;
        let totalFloats = 0;
        for (const batch of this.solarBatches.values()) {
            if (!batch.active) continue;
            batch.bufferOffset = totalFloats * Float32Array.BYTES_PER_ELEMENT;
            totalFloats += batch.instanceCount * SOLAR_FLOATS_PER_INSTANCE;
        }
        const data = new Float32Array(totalFloats);
        let floatOffset = 0;
        for (const batch of this.solarBatches.values()) {
            if (!batch.active) continue;
            const batchData = batch.data.subarray(0, batch.instanceCount * SOLAR_FLOATS_PER_INSTANCE);
            data.set(batchData, floatOffset);
            floatOffset += batchData.length;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.solarInstanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        this.solarBufferGeneration++;
        for (const batch of this.solarBatches.values()) {
            if (batch.active) batch.bufferGeneration = this.solarBufferGeneration;
        }
        this.solarStaticBufferDirty = false;
    }

    private uploadGalaxyStaticBuffer() {
        const gl = this.gl;
        if (!gl || !this.galaxyInstanceBuffer || !this.galaxyStaticBufferDirty) return;
        let totalFloats = 0;
        for (const batch of this.galaxyBatches.values()) {
            if (!batch.active) continue;
            batch.bufferOffset = totalFloats * Float32Array.BYTES_PER_ELEMENT;
            totalFloats += batch.instanceCount * GALAXY_FLOATS_PER_INSTANCE;
        }
        const data = new Float32Array(totalFloats);
        let floatOffset = 0;
        for (const batch of this.galaxyBatches.values()) {
            if (!batch.active) continue;
            const batchData = batch.data.subarray(0, batch.instanceCount * GALAXY_FLOATS_PER_INSTANCE);
            data.set(batchData, floatOffset);
            floatOffset += batchData.length;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.galaxyInstanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        this.galaxyBufferGeneration++;
        for (const batch of this.galaxyBatches.values()) {
            if (batch.active) batch.bufferGeneration = this.galaxyBufferGeneration;
        }
        this.galaxyStaticBufferDirty = false;
    }

    private getAtlas(font: string, pixelRatio: number) {
        const key = `${font}|${pixelRatio}`;
        const cached = this.atlases.get(key);
        if (cached) return cached;

        const gl = this.gl;
        if (!gl) throw new Error('WebGL2 is unavailable');
        const sourceCanvas = document.createElement('canvas');
        const measureContext = sourceCanvas.getContext('2d');
        if (!measureContext) throw new Error('Unable to create a WebGL glyph atlas context');
        measureContext.font = font;
        const fontSize = fontSizeFrom(font);
        const tileWidth = Math.ceil(
            Math.max(...ATLAS_GLYPHS.map((glyph) => measureContext.measureText(glyph).width)) + 4,
        );
        const tileHeight = Math.ceil(fontSize * 1.6 + 4);
        const columns = 8;
        const rows = Math.ceil(ATLAS_GLYPHS.length / columns);
        const tileWidthPixels = Math.ceil(tileWidth * pixelRatio);
        const tileHeightPixels = Math.ceil(tileHeight * pixelRatio);
        sourceCanvas.width = columns * tileWidthPixels;
        sourceCanvas.height = rows * tileHeightPixels;

        const context = sourceCanvas.getContext('2d');
        if (!context) throw new Error('Unable to create a WebGL glyph atlas context');
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = font;
        context.fillStyle = '#ffffff';
        for (let index = 0; index < ATLAS_GLYPHS.length; index++) {
            const column = index % columns;
            const row = Math.floor(index / columns);
            context.fillText(
                ATLAS_GLYPHS[index],
                column * tileWidth + tileWidth / 2,
                row * tileHeight + tileHeight / 2,
            );
        }
        const texture = gl.createTexture();
        if (!texture) throw new Error('Unable to create a WebGL glyph texture');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const atlas: TextureAtlas = {
            key,
            texture,
            tileWidth,
            tileHeight,
            columns,
            rows,
            glyphs: new Map(ATLAS_GLYPHS.map((glyph, index) => [glyph, index])),
        };
        this.atlases.set(key, atlas);
        return atlas;
    }

    private scheduleFontReadyInvalidation() {
        if (this.fontReadyInvalidationScheduled || typeof document === 'undefined' || !document.fonts) return;
        this.fontReadyInvalidationScheduled = true;
        void document.fonts.ready.then(() => this.clearAtlases());
    }

    private clearAtlases() {
        if (this.gl) {
            for (const atlas of this.atlases.values()) this.gl.deleteTexture(atlas.texture);
        }
        this.atlases.clear();
        this.batches.clear();
        this.solarBatches.clear();
        this.galaxyBatches.clear();
        this.solarStaticBufferDirty = true;
        this.galaxyStaticBufferDirty = true;
    }

    private disposeResources() {
        if (!this.gl) return;
        this.clearAtlases();
        if (this.instanceBuffer) this.gl.deleteBuffer(this.instanceBuffer);
        if (this.vertexArray) this.gl.deleteVertexArray(this.vertexArray);
        if (this.program) this.gl.deleteProgram(this.program);
        if (this.solarInstanceBuffer) this.gl.deleteBuffer(this.solarInstanceBuffer);
        if (this.solarVertexArray) this.gl.deleteVertexArray(this.solarVertexArray);
        if (this.solarProgram) this.gl.deleteProgram(this.solarProgram);
        if (this.galaxyInstanceBuffer) this.gl.deleteBuffer(this.galaxyInstanceBuffer);
        if (this.galaxyVertexArray) this.gl.deleteVertexArray(this.galaxyVertexArray);
        if (this.galaxyProgram) this.gl.deleteProgram(this.galaxyProgram);
        this.instanceBuffer = null;
        this.vertexArray = null;
        this.program = null;
        this.solarInstanceBuffer = null;
        this.solarVertexArray = null;
        this.solarProgram = null;
        this.galaxyInstanceBuffer = null;
        this.galaxyVertexArray = null;
        this.galaxyProgram = null;
    }
}
