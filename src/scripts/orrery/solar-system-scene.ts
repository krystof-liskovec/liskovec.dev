import { MAJOR_MOON_SYSTEMS, PLANETS, PLANETARY_MOON_SYSTEMS } from './catalog';
import type { MajorMoon } from './catalog';
import { DEG, J2000, isOutsideRenderBounds, rotateX, rotateZ, smoothstep, solveKeplerOrbit } from './math';
import type { RenderBounds } from './render-metrics';
import { ASTEROID_BELT, JUPITER_TROJANS, KUIPER_BELT, ZODIACAL_DUST, type SolarParticle } from './solar-scene-data';
import { createParticleGlyphDrawer } from './particle-glyph';
import { drawSoftSceneMask, sceneMaskColor } from './scene-mask';
import type { SolarParticleTransform, WebGLParticleRenderer } from './webgl-particle-renderer';
import { drawSolarBody, solarBodyViewportScale } from './solar-body-renderer';
import { drawSun } from './sun-renderer';
import type { Planet, ProjectedBody, Vec3 } from './types';

type ProjectedPoint = Vec3 & { scale: number };
export type ProjectedComet = ProjectedPoint & { world: Vec3; distanceAu: number };
type OrbitMark = ProjectedPoint & { glyph: string; alpha: number; reveal: number };
type CameraTransform = (world: Vec3, target: ProjectedPoint) => ProjectedPoint;
type MoonOrbit = { angle: number; distance: number };
type SolveMoonOrbit = (moon: MajorMoon, target?: MoonOrbit) => MoonOrbit;
type ParticleFieldStyle = {
    color: string;
    baseAlpha: number;
    alphaVariation: number;
    innerRadius: number;
    outerRadius: number;
    innerPeriodDays: number;
    outerPeriodDays: number;
};

const ZODIACAL_DUST_STYLE: ParticleFieldStyle = {
    color: '#d79921',
    baseAlpha: 0.065,
    alphaVariation: 0.1,
    innerRadius: 3.2,
    outerRadius: 18,
    innerPeriodDays: 21.2,
    outerPeriodDays: 687,
};
const ASTEROID_BELT_STYLE: ParticleFieldStyle = {
    color: '#a89984',
    baseAlpha: 0.2,
    alphaVariation: 0.32,
    innerRadius: 20.05,
    outerRadius: 22.45,
    innerPeriodDays: 1192,
    outerPeriodDays: 2085,
};
const KUIPER_BELT_STYLE: ParticleFieldStyle = {
    color: '#83a598',
    baseAlpha: 0.3,
    alphaVariation: 0.3,
    innerRadius: 43,
    outerRadius: 52.5,
    innerPeriodDays: 59860,
    outerPeriodDays: 129100,
};

const JUPITER_TROJAN_LIBRATION_PERIOD_DAYS = 150 * 365.256;
// Mercury through Mars remain close enough in the compressed solar view for
// Sol's surface detail to stay legible alongside the nearest-planet LOD.
const DETAILED_SUN_DISTANCE = 19;

// JPL J863/77 osculating elements for 1P/Halley, referred to the J2000
// ecliptic. The two-body propagation is sufficient for this compressed scene;
// Horizons should be used for observational ephemerides.
const HALLEY_PERIHELION_DISTANCE_AU = 0.58597811;
const HALLEY_ECCENTRICITY = 0.96714291;
const HALLEY_INCLINATION = 162.26269 * DEG;
const HALLEY_ARGUMENT_OF_PERIHELION = 111.33249 * DEG;
const HALLEY_ASCENDING_NODE = 58.42008 * DEG;
const HALLEY_LAST_PERIHELION = Date.UTC(1986, 1, 5) + 0.89532 * 86400000;
const HALLEY_SEMIMAJOR_AXIS_AU = HALLEY_PERIHELION_DISTANCE_AU / (1 - HALLEY_ECCENTRICITY);
const HALLEY_PERIOD_DAYS = Math.sqrt(HALLEY_SEMIMAJOR_AXIS_AU ** 3) * 365.256;

const displayRadiusForDistance = (distanceAu: number) => {
    let previousDistance = 0;
    let previousRadius = 0;
    for (const planet of PLANETS) {
        if (distanceAu <= planet.a) {
            const progress = (distanceAu - previousDistance) / (planet.a - previousDistance);
            return previousRadius + (planet.displayRadius - previousRadius) * progress;
        }
        previousDistance = planet.a;
        previousRadius = planet.displayRadius;
    }
    return previousRadius + (distanceAu - previousDistance) * 0.5;
};

export class SolarSystemSceneRenderer {
    readonly halley: ProjectedComet = {
        world: { x: 0, y: 0, z: 0 },
        distanceAu: 0,
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
    };

    private readonly moonOffset = { x: 0, y: 0, z: 0 };
    private readonly moonWorld = { x: 0, y: 0, z: 0 };
    private readonly moonProjection = { x: 0, y: 0, z: 0, scale: 1 };
    private readonly moonOrbit = { angle: 0, distance: 1 };
    private readonly asteroidPoint = { x: 0, y: 0, z: 0 };
    private readonly asteroidProjection = { x: 0, y: 0, z: 0, scale: 1 };
    private readonly cometTailPoint = { x: 0, y: 0, z: 0 };
    private readonly cometFarTailPoint = { x: 0, y: 0, z: 0 };
    private readonly cometTailProjection = { x: 0, y: 0, z: 0, scale: 1 };
    private readonly cometFarTailProjection = { x: 0, y: 0, z: 0, scale: 1 };
    private readonly cometOrbit = { angle: 0, distance: 1 };
    private detailFocusPlanetName: string | null = null;
    private detailNeighborName: string | null = null;
    private detailSunForFocus = false;

    draw(
        context: CanvasRenderingContext2D,
        options: RenderBounds & {
            farMarks: OrbitMark[];
            nearMarks: OrbitMark[];
            bodies: ProjectedBody[];
            cameraTransform: CameraTransform;
            solveMoonOrbit: SolveMoonOrbit;
            moonElapsedDays: number;
            focusedPlanet: Planet | null;
            focusedSun: boolean;
            focusedSunDetailReveal: number;
            focusedSunBridgeScale: number;
            hoveredBody: ProjectedBody | null;
            hoveredComet: ProjectedComet | null;
            hoveredSun: boolean;
            showHoverVisuals: boolean;
            centerX: number;
            centerY: number;
            sunX: number;
            sunY: number;
            renderedSunScale: number;
            now: number;
            seconds: number;
            reducedMotion: boolean;
            solarSystemScale: number;
            viewportGlyphScale: number;
            innerPlanetScale: number;
            surroundingSunScale: number;
            compact: boolean;
            localDetailOpacity: number;
            planetSceneFocus: number;
            asteroidBeltOpacity: number;
            asteroidBeltSampleStride: number;
            introSunOpacity: number;
            introDetailOpacity: number;
            pixelRatio: number;
            particleRenderer?: WebGLParticleRenderer | null;
            particleTransform?: SolarParticleTransform;
            planetRotationOffset: number;
            planetTiltOffset: number;
            planetYawOffset: number;
            isOgPreview: boolean;
            width: number;
            height: number;
            focusOcclusionDepth: number | null;
            focusedComet: boolean;
            drawFocusedLayer?: () => void;
        },
    ) {
        this.drawOrbitMarks(
            context,
            options.farMarks,
            options.viewportGlyphScale,
            options.pixelRatio,
            options.particleRenderer,
            options.isOgPreview,
        );
        this.drawOrbitMarks(
            context,
            options.nearMarks,
            options.viewportGlyphScale,
            options.pixelRatio,
            options.particleRenderer,
            options.isOgPreview,
        );
        this.drawSmallBodyFields(context, options);
        this.drawTrojanClouds(context, options);
        this.drawComet(context, options);
        this.drawBodies(context, options);
    }

    private drawOrbitMarks(
        context: CanvasRenderingContext2D,
        marks: OrbitMark[],
        viewportGlyphScale: number,
        pixelRatio: number,
        particleRenderer?: WebGLParticleRenderer | null,
        isOgPreview = false,
    ) {
        // Orbit spacing contracts on narrow screens, so keep the lane glyphs
        // from visually merging into heavy continuous lines.
        const fontSize = Math.max(5.5, 9 * viewportGlyphScale);
        const font = `${fontSize}px "DM Mono", monospace`;
        const drawOrbitGlyph = createParticleGlyphDrawer(
            context,
            particleRenderer,
            font,
            isOgPreview ? '#665c54' : '#7c6f64',
            pixelRatio,
        );
        const orbitOpacity = isOgPreview ? 0.78 : 1;
        for (const mark of marks) {
            drawOrbitGlyph(mark.glyph, mark.x, mark.y, mark.alpha * mark.reveal * orbitOpacity);
        }
        context.globalAlpha = 1;
    }

    private drawSmallBodyFields(
        context: CanvasRenderingContext2D,
        options: {
            now: number;
            reducedMotion: boolean;
            solarSystemScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            asteroidBeltOpacity: number;
            asteroidBeltSampleStride: number;
            cameraTransform: CameraTransform;
            introDetailOpacity: number;
            compact: boolean;
            pixelRatio: number;
            particleRenderer?: WebGLParticleRenderer | null;
            particleTransform?: SolarParticleTransform;
            focusOcclusionDepth: number | null;
        },
    ) {
        const {
            now,
            solarSystemScale,
            localDetailOpacity,
            planetSceneFocus,
            cameraTransform,
            compact,
            asteroidBeltOpacity,
            asteroidBeltSampleStride,
        } = options;
        const elapsedDays = (now - J2000) / 86400000;
        const opacity = localDetailOpacity * (1 - planetSceneFocus) * options.introDetailOpacity;
        if (opacity <= 0.001) return;
        const scaleRoot = Math.sqrt(solarSystemScale);

        this.drawParticleField(
            context,
            'zodiacal-dust',
            ZODIACAL_DUST,
            cameraTransform,
            elapsedDays,
            opacity,
            Math.max(5, 6.5 * scaleRoot),
            ZODIACAL_DUST_STYLE,
            compact,
            options.pixelRatio,
            options.particleRenderer,
            options.particleTransform,
            options.focusOcclusionDepth,
            compact ? 2 : 1,
        );
        this.drawParticleField(
            context,
            'asteroid-belt',
            ASTEROID_BELT,
            cameraTransform,
            elapsedDays,
            opacity * asteroidBeltOpacity,
            Math.max(5.5, 7.5 * scaleRoot),
            ASTEROID_BELT_STYLE,
            compact,
            options.pixelRatio,
            options.particleRenderer,
            options.particleTransform,
            options.focusOcclusionDepth,
            asteroidBeltSampleStride,
        );
        this.drawParticleField(
            context,
            'kuiper-belt',
            KUIPER_BELT,
            cameraTransform,
            elapsedDays,
            opacity * asteroidBeltOpacity,
            Math.max(6.5, 8.35 * scaleRoot),
            KUIPER_BELT_STYLE,
            compact,
            options.pixelRatio,
            options.particleRenderer,
            options.particleTransform,
            options.focusOcclusionDepth,
            asteroidBeltSampleStride,
        );
        context.globalAlpha = 1;
    }

    private drawParticleField(
        context: CanvasRenderingContext2D,
        fieldKey: string,
        particles: SolarParticle[],
        cameraTransform: CameraTransform,
        elapsedDays: number,
        opacity: number,
        fontSize: number,
        style: ParticleFieldStyle,
        compact: boolean,
        pixelRatio: number,
        particleRenderer?: WebGLParticleRenderer | null,
        particleTransform?: SolarParticleTransform,
        focusOcclusionDepth: number | null = null,
        sampleStride = compact ? 2 : 1,
    ) {
        const font = `${fontSize}px "DM Mono", monospace`;
        if (
            particleRenderer &&
            particleTransform &&
            focusOcclusionDepth === null &&
            particleRenderer.drawSolarParticleField({
                fieldKey,
                particles,
                font,
                color: style.color,
                compact,
                elapsedDays,
                opacity,
                baseAlpha: style.baseAlpha,
                alphaVariation: style.alphaVariation,
                innerRadius: style.innerRadius,
                outerRadius: style.outerRadius,
                innerPeriodDays: style.innerPeriodDays,
                outerPeriodDays: style.outerPeriodDays,
                sampleStride,
                transform: particleTransform,
            })
        ) {
            return;
        }
        const drawParticleGlyph = createParticleGlyphDrawer(context, particleRenderer, font, style.color, pixelRatio);
        for (let index = 0; index < particles.length; index++) {
            if (index % sampleStride !== 0) continue;
            const particle = particles[index];
            const radialProgress = Math.max(
                0,
                Math.min(1, (particle.radius - style.innerRadius) / (style.outerRadius - style.innerRadius)),
            );
            const orbitalPeriodDays =
                style.innerPeriodDays + (style.outerPeriodDays - style.innerPeriodDays) * radialProgress;
            const angle = particle.angle + (elapsedDays / orbitalPeriodDays) * Math.PI * 2;
            const orbitalX = Math.cos(angle) * particle.radius;
            const orbitalY = Math.sin(angle) * particle.radius;
            // Inclination and node are fixed per particle; their trig values are
            // prepared once in scene-data.ts, leaving only the animated orbital
            // angle to evaluate in this hot loop.
            this.asteroidPoint.x =
                orbitalX * particle.nodeCosine - orbitalY * particle.inclinationCosine * particle.nodeSine;
            this.asteroidPoint.y =
                orbitalX * particle.nodeSine + orbitalY * particle.inclinationCosine * particle.nodeCosine;
            this.asteroidPoint.z = orbitalY * particle.inclinationSine;
            const projected = cameraTransform(this.asteroidPoint, this.asteroidProjection);
            if (focusOcclusionDepth !== null && projected.z > focusOcclusionDepth) continue;
            drawParticleGlyph(
                particle.glyph,
                projected.x,
                projected.y,
                opacity * (style.baseAlpha + particle.phase * style.alphaVariation),
            );
        }
    }

    private drawTrojanClouds(
        context: CanvasRenderingContext2D,
        options: {
            bodies: ProjectedBody[];
            cameraTransform: CameraTransform;
            now: number;
            reducedMotion: boolean;
            solarSystemScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            asteroidBeltOpacity: number;
            asteroidBeltSampleStride: number;
            introDetailOpacity: number;
            compact: boolean;
            pixelRatio: number;
            particleRenderer?: WebGLParticleRenderer | null;
            focusOcclusionDepth: number | null;
        },
    ) {
        let jupiter: ProjectedBody | null = null;
        for (const body of options.bodies) {
            if (body.planet.name === 'Jupiter') {
                jupiter = body;
                break;
            }
        }
        if (!jupiter) return;

        const baseAngle = Math.atan2(jupiter.world.y, jupiter.world.x);
        const opacity = options.localDetailOpacity * (1 - options.planetSceneFocus) * options.introDetailOpacity;
        if (opacity <= 0.001) return;
        const font = `${Math.max(5.5, 7 * Math.sqrt(options.solarSystemScale))}px "DM Mono", monospace`;
        const drawTrojanGlyph = createParticleGlyphDrawer(
            context,
            options.particleRenderer,
            font,
            '#d79921',
            options.pixelRatio,
        );
        const elapsedDays = (options.now - J2000) / 86400000;
        for (let index = 0; index < JUPITER_TROJANS.length; index++) {
            if (index % options.asteroidBeltSampleStride !== 0) continue;
            const trojan = JUPITER_TROJANS[index];
            const libration = options.reducedMotion
                ? 0
                : Math.sin((elapsedDays / JUPITER_TROJAN_LIBRATION_PERIOD_DAYS) * Math.PI * 2 + trojan.phase * 6.28) *
                  0.025;
            const angle = baseAngle + trojan.angleOffset + libration;
            this.asteroidPoint.x = Math.cos(angle) * trojan.radius;
            this.asteroidPoint.y = Math.sin(angle) * trojan.radius;
            this.asteroidPoint.z = jupiter.world.z + trojan.z;
            const projected = options.cameraTransform(this.asteroidPoint, this.asteroidProjection);
            if (options.focusOcclusionDepth !== null && projected.z > options.focusOcclusionDepth) continue;
            drawTrojanGlyph(
                trojan.glyph,
                projected.x,
                projected.y,
                opacity * options.asteroidBeltOpacity * (0.11 + trojan.phase * 0.22),
            );
        }
        context.globalAlpha = 1;
    }

    projectHalley(now: number, cameraTransform: CameraTransform) {
        const elapsedDays = (now - HALLEY_LAST_PERIHELION) / 86400000;
        const meanAnomaly = (elapsedDays / HALLEY_PERIOD_DAYS) * Math.PI * 2;
        const orbit = solveKeplerOrbit(meanAnomaly, HALLEY_ECCENTRICITY, this.cometOrbit);
        const physicalRadius = HALLEY_SEMIMAJOR_AXIS_AU * orbit.distance;
        const radius = displayRadiusForDistance(physicalRadius);
        const angle = orbit.angle + HALLEY_ARGUMENT_OF_PERIHELION;

        this.halley.world.x = Math.cos(angle) * radius;
        this.halley.world.y = Math.sin(angle) * radius;
        this.halley.world.z = 0;
        rotateX(this.halley.world, HALLEY_INCLINATION, this.halley.world);
        rotateZ(this.halley.world, HALLEY_ASCENDING_NODE, this.halley.world);
        this.halley.distanceAu = physicalRadius;

        // Keep a short identifying tail even near aphelion, where a literal
        // dust tail would be too faint to survive this tiny ASCII scale.
        const tailScale = (radius + 3.2) / radius;
        const farTailScale = (radius + 5.8) / radius;
        this.cometTailPoint.x = this.halley.world.x * tailScale;
        this.cometTailPoint.y = this.halley.world.y * tailScale;
        this.cometTailPoint.z = this.halley.world.z * tailScale;
        this.cometFarTailPoint.x = this.halley.world.x * farTailScale;
        this.cometFarTailPoint.y = this.halley.world.y * farTailScale;
        this.cometFarTailPoint.z = this.halley.world.z * farTailScale;

        cameraTransform(this.halley.world, this.halley);
        cameraTransform(this.cometTailPoint, this.cometTailProjection);
        cameraTransform(this.cometFarTailPoint, this.cometFarTailProjection);
        return this.halley;
    }

    private drawComet(
        context: CanvasRenderingContext2D,
        options: {
            hoveredComet: ProjectedComet | null;
            solarSystemScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            showHoverVisuals: boolean;
            introDetailOpacity: number;
            focusOcclusionDepth: number | null;
            focusedComet: boolean;
        },
    ) {
        if (
            !options.focusedComet &&
            options.focusOcclusionDepth !== null &&
            this.halley.z > options.focusOcclusionDepth
        ) {
            return;
        }
        const head = this.halley;
        const tail = this.cometTailProjection;
        const farTail = this.cometFarTailProjection;
        const opacity = options.localDetailOpacity * (1 - options.planetSceneFocus) * options.introDetailOpacity;
        const fontSize = Math.max(7.5, 9.5 * Math.sqrt(options.solarSystemScale));
        context.font = `bold ${fontSize}px "DM Mono", monospace`;
        context.fillStyle = '#83a598';
        context.globalAlpha = opacity * 0.4;
        context.fillText('~', farTail.x, farTail.y);
        context.globalAlpha = opacity * 0.52;
        context.fillText('~', farTail.x * 0.58 + tail.x * 0.42, farTail.y * 0.58 + tail.y * 0.42);
        context.globalAlpha = opacity * 0.64;
        context.fillText('=', tail.x, tail.y);
        context.globalAlpha = opacity * 0.76;
        context.fillText('-', tail.x * 0.45 + head.x * 0.55, tail.y * 0.45 + head.y * 0.55);
        context.fillStyle = '#ebdbb2';
        context.globalAlpha = opacity * 0.9;
        context.fillText('*', head.x, head.y);
        if (options.hoveredComet === this.halley && options.showHoverVisuals) {
            context.fillStyle = '#ebdbb2';
            context.globalAlpha = opacity;
            context.fillText('[', head.x - fontSize * 1.2, head.y);
            context.fillText(']', head.x + fontSize * 1.2, head.y);
        }
        context.globalAlpha = 1;
    }

    private drawBodies(
        context: CanvasRenderingContext2D,
        options: RenderBounds & {
            bodies: ProjectedBody[];
            cameraTransform: CameraTransform;
            solveMoonOrbit: SolveMoonOrbit;
            moonElapsedDays: number;
            focusedPlanet: Planet | null;
            focusedSun: boolean;
            focusedSunDetailReveal: number;
            focusedSunBridgeScale: number;
            hoveredBody: ProjectedBody | null;
            hoveredSun: boolean;
            showHoverVisuals: boolean;
            sunX: number;
            sunY: number;
            renderedSunScale: number;
            seconds: number;
            reducedMotion: boolean;
            solarSystemScale: number;
            viewportGlyphScale: number;
            innerPlanetScale: number;
            surroundingSunScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            introSunOpacity: number;
            planetRotationOffset: number;
            planetTiltOffset: number;
            planetYawOffset: number;
            width: number;
            height: number;
            isOgPreview: boolean;
            focusOcclusionDepth: number | null;
            drawFocusedLayer?: () => void;
        },
    ) {
        const {
            bodies,
            focusedPlanet,
            focusedSun,
            focusedSunDetailReveal,
            focusedSunBridgeScale,
            hoveredBody,
            hoveredSun,
            showHoverVisuals,
            sunX,
            sunY,
            renderedSunScale,
            seconds,
            reducedMotion,
            solarSystemScale,
            viewportGlyphScale,
            localDetailOpacity,
            planetSceneFocus,
            introSunOpacity,
        } = options;

        const focusedBody = focusedPlanet ? (bodies.find((body) => body.planet === focusedPlanet) ?? null) : null;
        if (!focusedBody) {
            this.detailFocusPlanetName = null;
            this.detailNeighborName = null;
            this.detailSunForFocus = false;
        } else if (this.detailFocusPlanetName !== focusedPlanet?.name) {
            this.detailFocusPlanetName = focusedPlanet?.name ?? null;
            this.detailNeighborName = null;
            const focusedSunDistance = Math.hypot(focusedBody.world.x, focusedBody.world.y, focusedBody.world.z);
            this.detailSunForFocus = focusedSunDistance <= DETAILED_SUN_DISTANCE;
            let closestDetailDistance = Infinity;
            for (const body of bodies) {
                if (body === focusedBody || body.planet.easterEgg) continue;
                const distance = Math.hypot(
                    body.world.x - focusedBody.world.x,
                    body.world.y - focusedBody.world.y,
                    body.world.z - focusedBody.world.z,
                );
                if (distance >= closestDetailDistance) continue;
                closestDetailDistance = distance;
                this.detailNeighborName = body.planet.name;
            }
        }
        // Hold the chosen secondary LOD for the whole focus session. Re-picking
        // it every frame can swap two nearly equidistant planets mid-transition
        // and read as a one-frame positional jump.
        const closestDetailBody = this.detailNeighborName
            ? (bodies.find((body) => body.planet.name === this.detailNeighborName) ?? null)
            : null;
        const detailedSun = this.detailSunForFocus;
        const apparentScaleFor = (body: ProjectedBody) => {
            if (!focusedBody || body === focusedBody) return 1;
            const dx = body.world.x - focusedBody.world.x;
            const dy = body.world.y - focusedBody.world.y;
            const dz = body.world.z - focusedBody.world.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            // The catalogue uses compressed display-space orbits, so this is
            // a legibility-aware angular-size curve rather than a literal AU
            // calculation. It still responds continuously to live 3D distance.
            const distanceScale = Math.max(0.62, Math.min(2.2, 15 / Math.max(1, distance)));
            return 1 + (distanceScale - 1) * planetSceneFocus;
        };

        const drawBody = (body: ProjectedBody) => {
            if (body.reveal * localDetailOpacity <= 0.001) return;
            const apparentBodyScale = apparentScaleFor(body);
            const detailAppearanceReveal =
                body === closestDetailBody ? smoothstep((planetSceneFocus - 0.08) / 0.72) : 0;
            this.drawPlanetShadow(context, body, apparentBodyScale, detailAppearanceReveal, options);
            this.drawPlanetarySystem(context, body, false, apparentBodyScale, options);
            drawSolarBody(context, body, {
                bounds: options,
                focusedPlanet,
                seconds,
                reducedMotion,
                solarSystemScale,
                viewportGlyphScale,
                innerPlanetScale: options.innerPlanetScale,
                apparentBodyScale,
                detailAppearanceReveal,
                localDetailOpacity,
                planetSceneFocus,
                isHovered: body === hoveredBody && showHoverVisuals,
                planetRotationOffset: options.planetRotationOffset,
                planetTiltOffset: options.planetTiltOffset,
                planetYawOffset: options.planetYawOffset,
            });
            this.drawPlanetarySystem(context, body, true, apparentBodyScale, options);
        };

        const bodyPassesFocusOcclusion = (body: ProjectedBody) =>
            options.focusOcclusionDepth === null || body === focusedBody || body.z <= options.focusOcclusionDepth;

        let focusedLayerDrawn = false;
        const drawFocusedLayerAfter = (body: ProjectedBody) => {
            if (!options.drawFocusedLayer || focusedLayerDrawn || body !== focusedBody) return;
            options.drawFocusedLayer();
            focusedLayerDrawn = true;
        };

        for (const body of bodies) {
            if (body.z < 0 && bodyPassesFocusOcclusion(body)) {
                drawBody(body);
                drawFocusedLayerAfter(body);
            }
        }

        const surroundingSunReveal = 1 - planetSceneFocus * 0.38;
        const sunDetailReveal = detailedSun ? smoothstep((planetSceneFocus - 0.08) / 0.72) : 0;
        const sunOcclusionReveal = surroundingSunReveal + sunDetailReveal * (1 - surroundingSunReveal);
        const sunPassesFocusOcclusion =
            options.focusOcclusionDepth === null || focusedSun || 0 <= options.focusOcclusionDepth;
        if (sunPassesFocusOcclusion) {
            drawSun(context, {
                bounds: options,
                x: sunX,
                y: sunY,
                scale: renderedSunScale * options.surroundingSunScale ** 2 * focusedSunBridgeScale ** 2,
                opacity:
                    localDetailOpacity *
                    introSunOpacity *
                    (focusedSun ? 1 - focusedSunDetailReveal : sunOcclusionReveal),
                seconds,
                reducedMotion,
                planetRotationOffset: options.planetRotationOffset,
                planetTiltOffset: options.planetTiltOffset,
                detailReveal: sunDetailReveal,
            });
            if (hoveredSun && showHoverVisuals) {
                context.globalAlpha = localDetailOpacity;
                context.fillStyle = '#ebdbb2';
                context.font = 'bold 12px "DM Mono", monospace';
                const bracketOffset = 54 * Math.max(0.55, Math.sqrt(renderedSunScale));
                context.fillText('[', sunX - bracketOffset, sunY);
                context.fillText(']', sunX + bracketOffset, sunY);
                context.globalAlpha = 1;
            }
        }

        for (const body of bodies) {
            if (body.z >= 0 && bodyPassesFocusOcclusion(body)) {
                drawBody(body);
                drawFocusedLayerAfter(body);
            }
        }
        if (options.drawFocusedLayer && !focusedLayerDrawn) options.drawFocusedLayer();
    }

    private drawPlanetShadow(
        context: CanvasRenderingContext2D,
        body: ProjectedBody,
        apparentBodyScale: number,
        detailAppearanceReveal: number,
        options: RenderBounds & {
            focusedPlanet: Planet | null;
            solarSystemScale: number;
            viewportGlyphScale: number;
            innerPlanetScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            width: number;
            height: number;
            isOgPreview: boolean;
        },
    ) {
        if (body.planet.easterEgg) return;
        const glyphScale =
            Math.max(0.3, Math.sqrt(options.solarSystemScale)) *
            solarBodyViewportScale(body.planet.name, options.viewportGlyphScale, options.innerPlanetScale) *
            apparentBodyScale;
        const isGiant =
            body.planet.name === 'Jupiter' || body.planet.name === 'Saturn' || body.planet.name === 'Uranus';
        const radiusX = (isGiant ? 16 : 11) * glyphScale;
        const radiusY = (isGiant ? 11 : 8) * glyphScale;
        if (isOutsideRenderBounds(body.x, body.y, radiusX, radiusY, options)) return;
        // This ellipse is an opaque occlusion mask for the orbit marks and
        // particles behind a planet. Match the page's local background glow so
        // the mask does not appear as a second, darker planet-sized circle.
        const surroundingBodyReveal = 1 - options.planetSceneFocus * 0.68;
        const occlusionReveal = surroundingBodyReveal + detailAppearanceReveal * (1 - surroundingBodyReveal);
        const maskColor =
            options.planetSceneFocus > 0.45
                ? '#1d2021'
                : sceneMaskColor(body.x, body.y, options.width, options.height, options.isOgPreview);
        drawSoftSceneMask(context, {
            x: body.x,
            y: body.y,
            radiusX,
            radiusY,
            opacity: body.reveal * options.localDetailOpacity * occlusionReveal,
            color: maskColor,
        });
        if (detailAppearanceReveal > 0) {
            // Transition from the overview's glow-aware mask to the exact
            // close-up background instead of carrying the warm tint into the
            // planet's interior.
            drawSoftSceneMask(context, {
                x: body.x,
                y: body.y,
                radiusX,
                radiusY,
                opacity: body.reveal * options.localDetailOpacity * detailAppearanceReveal,
                color: maskColor,
            });
        }
        context.globalAlpha = 1;
    }

    private drawPlanetarySystem(
        context: CanvasRenderingContext2D,
        body: ProjectedBody,
        foreground: boolean,
        apparentBodyScale: number,
        options: RenderBounds & {
            focusedPlanet: Planet | null;
            cameraTransform: CameraTransform;
            solveMoonOrbit: SolveMoonOrbit;
            moonElapsedDays: number;
            solarSystemScale: number;
            viewportGlyphScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            focusOcclusionDepth: number | null;
        },
    ) {
        const system = PLANETARY_MOON_SYSTEMS[body.planet.name];
        if (!system || body.reveal < 0.35) return;
        const surroundingBodyReveal = 1 - options.planetSceneFocus * 0.68;
        const opacity = options.localDetailOpacity * surroundingBodyReveal * body.reveal;
        if (opacity <= 0.01) return;
        const majorMoonSystem = MAJOR_MOON_SYSTEMS[body.planet.name];
        const systemGlyphSize = Math.max(8, 9.5 * Math.sqrt(options.solarSystemScale)) * apparentBodyScale;
        const padding = Math.max(12, systemGlyphSize * options.viewportGlyphScale);
        context.font = `bold ${systemGlyphSize * options.viewportGlyphScale}px "DM Mono", monospace`;

        for (let moonIndex = 0; moonIndex < system.radii.length; moonIndex++) {
            const majorMoon = majorMoonSystem?.moons[moonIndex];
            const solvedMoon = majorMoon ? options.solveMoonOrbit(majorMoon, this.moonOrbit) : null;
            const moonAngle =
                solvedMoon?.angle ??
                (options.moonElapsedDays / 27.321661) * Math.PI * 2 + moonIndex * 1.73 + body.planet.displayRadius;
            const moonRadius = system.radii[moonIndex] * (solvedMoon?.distance ?? 1);
            this.moonOffset.x = Math.cos(moonAngle) * moonRadius;
            this.moonOffset.y = Math.sin(moonAngle) * moonRadius;
            this.moonOffset.z = 0;
            if (majorMoon) {
                rotateX(this.moonOffset, majorMoon.inclination, this.moonOffset);
                rotateZ(this.moonOffset, majorMoon.node, this.moonOffset);
            }
            rotateX(this.moonOffset, system.tilt, this.moonOffset);
            this.moonWorld.x = body.world.x + this.moonOffset.x;
            this.moonWorld.y = body.world.y + this.moonOffset.y;
            this.moonWorld.z = body.world.z + this.moonOffset.z;
            const moon = options.cameraTransform(this.moonWorld, this.moonProjection);
            if (options.focusOcclusionDepth !== null && moon.z > options.focusOcclusionDepth) continue;
            if (moon.z >= body.z !== foreground) continue;
            // Cull each satellite independently: a moon may still be visible
            // even when its parent planet is outside the canvas.
            if (isOutsideRenderBounds(moon.x, moon.y, padding, padding, options)) continue;

            context.globalAlpha = opacity;
            context.fillStyle = '#bdae93';
            context.fillText('.', moon.x, moon.y);
        }
        context.globalAlpha = 1;
    }
}
