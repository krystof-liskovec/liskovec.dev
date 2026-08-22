import { MAJOR_MOON_SYSTEMS, PLANETS, PLANETARY_MOON_SYSTEMS } from './catalog';
import type { MajorMoon } from './catalog';
import { DEG, rotateX, rotateZ, solveKeplerOrbit } from './math';
import { ASTEROID_BELT, JUPITER_TROJANS, KUIPER_BELT, ZODIACAL_DUST, type SolarParticle } from './scene-data';
import { drawSolarBody } from './solar-body-renderer';
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
    baseSpeed: number;
    speedVariation: number;
};

const ZODIACAL_DUST_STYLE: ParticleFieldStyle = {
    color: '#d79921',
    baseAlpha: 0.065,
    alphaVariation: 0.1,
    baseSpeed: 0.007,
    speedVariation: 0.005,
};
const ASTEROID_BELT_STYLE: ParticleFieldStyle = {
    color: '#a89984',
    baseAlpha: 0.2,
    alphaVariation: 0.32,
    baseSpeed: 0.0045,
    speedVariation: 0.0015,
};
const KUIPER_BELT_STYLE: ParticleFieldStyle = {
    color: '#83a598',
    baseAlpha: 0.3,
    alphaVariation: 0.3,
    baseSpeed: 0.0012,
    speedVariation: 0.0005,
};

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

    draw(
        context: CanvasRenderingContext2D,
        options: {
            farMarks: OrbitMark[];
            nearMarks: OrbitMark[];
            bodies: ProjectedBody[];
            cameraTransform: CameraTransform;
            solveMoonOrbit: SolveMoonOrbit;
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
            renderedSunScale: number;
            now: number;
            seconds: number;
            reducedMotion: boolean;
            solarSystemScale: number;
            viewportGlyphScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            introSunOpacity: number;
            introDetailOpacity: number;
        },
    ) {
        this.drawOrbitMarks(context, options.farMarks);
        this.drawOrbitMarks(context, options.nearMarks);
        this.drawSmallBodyFields(context, options);
        this.drawTrojanClouds(context, options);
        this.drawComet(context, options);
        this.drawBodies(context, options);
    }

    private drawOrbitMarks(context: CanvasRenderingContext2D, marks: OrbitMark[]) {
        context.font = '9px "DM Mono", monospace';
        context.fillStyle = '#7c6f64';
        for (const mark of marks) {
            context.globalAlpha = mark.alpha * mark.reveal;
            context.fillText(mark.glyph, mark.x, mark.y);
        }
        context.globalAlpha = 1;
    }

    private drawSmallBodyFields(
        context: CanvasRenderingContext2D,
        options: {
            seconds: number;
            reducedMotion: boolean;
            solarSystemScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            cameraTransform: CameraTransform;
            introDetailOpacity: number;
        },
    ) {
        const { seconds, reducedMotion, solarSystemScale, localDetailOpacity, planetSceneFocus, cameraTransform } =
            options;
        const opacity = localDetailOpacity * (1 - planetSceneFocus) * options.introDetailOpacity;
        const scaleRoot = Math.sqrt(solarSystemScale);

        this.drawParticleField(
            context,
            ZODIACAL_DUST,
            cameraTransform,
            seconds,
            reducedMotion,
            opacity,
            Math.max(5, 6.5 * scaleRoot),
            ZODIACAL_DUST_STYLE,
        );
        this.drawParticleField(
            context,
            ASTEROID_BELT,
            cameraTransform,
            seconds,
            reducedMotion,
            opacity,
            Math.max(5.5, 7.5 * scaleRoot),
            ASTEROID_BELT_STYLE,
        );
        this.drawParticleField(
            context,
            KUIPER_BELT,
            cameraTransform,
            seconds,
            reducedMotion,
            opacity,
            Math.max(6.5, 8.35 * scaleRoot),
            KUIPER_BELT_STYLE,
        );
        context.globalAlpha = 1;
    }

    private drawParticleField(
        context: CanvasRenderingContext2D,
        particles: SolarParticle[],
        cameraTransform: CameraTransform,
        seconds: number,
        reducedMotion: boolean,
        opacity: number,
        fontSize: number,
        style: ParticleFieldStyle,
    ) {
        context.font = `${fontSize}px "DM Mono", monospace`;
        context.fillStyle = style.color;
        for (const particle of particles) {
            const angle =
                particle.angle +
                (reducedMotion ? 0 : seconds * (style.baseSpeed + particle.phase * style.speedVariation));
            this.asteroidPoint.x = Math.cos(angle) * particle.radius;
            this.asteroidPoint.y = Math.sin(angle) * particle.radius;
            this.asteroidPoint.z = 0;
            rotateX(this.asteroidPoint, particle.inclination, this.asteroidPoint);
            rotateZ(this.asteroidPoint, particle.node, this.asteroidPoint);
            const projected = cameraTransform(this.asteroidPoint, this.asteroidProjection);
            context.globalAlpha = opacity * (style.baseAlpha + particle.phase * style.alphaVariation);
            context.fillText(particle.glyph, projected.x, projected.y);
        }
    }

    private drawTrojanClouds(
        context: CanvasRenderingContext2D,
        options: {
            bodies: ProjectedBody[];
            cameraTransform: CameraTransform;
            seconds: number;
            reducedMotion: boolean;
            solarSystemScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            introDetailOpacity: number;
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
        context.fillStyle = '#d79921';
        context.font = `${Math.max(5.5, 7 * Math.sqrt(options.solarSystemScale))}px "DM Mono", monospace`;
        for (const trojan of JUPITER_TROJANS) {
            const libration = options.reducedMotion
                ? 0
                : Math.sin(options.seconds * 0.16 + trojan.phase * 6.28) * 0.025;
            const angle = baseAngle + trojan.angleOffset + libration;
            this.asteroidPoint.x = Math.cos(angle) * trojan.radius;
            this.asteroidPoint.y = Math.sin(angle) * trojan.radius;
            this.asteroidPoint.z = jupiter.world.z + trojan.z;
            const projected = options.cameraTransform(this.asteroidPoint, this.asteroidProjection);
            context.globalAlpha = opacity * (0.11 + trojan.phase * 0.22);
            context.fillText(trojan.glyph, projected.x, projected.y);
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
        },
    ) {
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
        options: {
            bodies: ProjectedBody[];
            cameraTransform: CameraTransform;
            solveMoonOrbit: SolveMoonOrbit;
            focusedPlanet: Planet | null;
            focusedSun: boolean;
            focusedSunDetailReveal: number;
            focusedSunBridgeScale: number;
            hoveredBody: ProjectedBody | null;
            hoveredSun: boolean;
            showHoverVisuals: boolean;
            centerX: number;
            centerY: number;
            renderedSunScale: number;
            seconds: number;
            reducedMotion: boolean;
            solarSystemScale: number;
            viewportGlyphScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
            introSunOpacity: number;
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
            centerX,
            centerY,
            renderedSunScale,
            seconds,
            reducedMotion,
            solarSystemScale,
            viewportGlyphScale,
            localDetailOpacity,
            planetSceneFocus,
            introSunOpacity,
        } = options;

        drawSun(context, {
            x: centerX,
            y: centerY,
            scale: renderedSunScale * focusedSunBridgeScale ** 2,
            opacity:
                localDetailOpacity * introSunOpacity * (focusedSun ? 1 - focusedSunDetailReveal : 1 - planetSceneFocus),
            seconds,
            reducedMotion,
        });
        if (hoveredSun && showHoverVisuals) {
            context.globalAlpha = localDetailOpacity;
            context.fillStyle = '#ebdbb2';
            context.font = 'bold 12px "DM Mono", monospace';
            const bracketOffset = 54 * Math.max(0.55, Math.sqrt(renderedSunScale));
            context.fillText('[', centerX - bracketOffset, centerY);
            context.fillText(']', centerX + bracketOffset, centerY);
            context.globalAlpha = 1;
        }

        for (const body of bodies) {
            this.drawPlanetShadow(context, body, options);
            this.drawPlanetarySystem(context, body, false, options);
            drawSolarBody(context, body, {
                focusedPlanet,
                seconds,
                reducedMotion,
                solarSystemScale,
                viewportGlyphScale,
                localDetailOpacity,
                planetSceneFocus,
                isHovered: body === hoveredBody && showHoverVisuals,
            });
            this.drawPlanetarySystem(context, body, true, options);
        }
    }

    private drawPlanetShadow(
        context: CanvasRenderingContext2D,
        body: ProjectedBody,
        options: {
            solarSystemScale: number;
            viewportGlyphScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
        },
    ) {
        if (body.planet.easterEgg) return;
        const glyphScale = Math.max(0.3, Math.sqrt(options.solarSystemScale)) * options.viewportGlyphScale;
        const isGiant =
            body.planet.name === 'Jupiter' || body.planet.name === 'Saturn' || body.planet.name === 'Uranus';
        const radiusX = (isGiant ? 16 : 11) * glyphScale;
        const radiusY = (isGiant ? 11 : 8) * glyphScale;
        context.beginPath();
        context.ellipse(body.x, body.y, radiusX, radiusY, 0, 0, Math.PI * 2);
        context.fillStyle = '#1d2021';
        context.globalAlpha = body.reveal * options.localDetailOpacity * (1 - options.planetSceneFocus) * 0.76;
        context.fill();
        context.globalAlpha = 1;
    }

    private drawPlanetarySystem(
        context: CanvasRenderingContext2D,
        body: ProjectedBody,
        foreground: boolean,
        options: {
            cameraTransform: CameraTransform;
            solveMoonOrbit: SolveMoonOrbit;
            seconds: number;
            solarSystemScale: number;
            viewportGlyphScale: number;
            localDetailOpacity: number;
            planetSceneFocus: number;
        },
    ) {
        const system = PLANETARY_MOON_SYSTEMS[body.planet.name];
        if (!system || body.reveal < 0.35) return;
        const opacity = options.localDetailOpacity * (1 - options.planetSceneFocus) * body.reveal;
        if (opacity <= 0.01) return;
        const majorMoonSystem = MAJOR_MOON_SYSTEMS[body.planet.name];
        const systemGlyphSize = Math.max(8, 9.5 * Math.sqrt(options.solarSystemScale));
        context.font = `bold ${systemGlyphSize * options.viewportGlyphScale}px "DM Mono", monospace`;

        for (let moonIndex = 0; moonIndex < system.radii.length; moonIndex++) {
            const majorMoon = majorMoonSystem?.moons[moonIndex];
            const solvedMoon = majorMoon ? options.solveMoonOrbit(majorMoon, this.moonOrbit) : null;
            const moonAngle =
                solvedMoon?.angle ??
                options.seconds * system.speeds[moonIndex] + moonIndex * 1.73 + body.planet.displayRadius;
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
            if (moon.z >= body.z !== foreground) continue;

            context.globalAlpha = opacity;
            context.fillStyle = '#bdae93';
            context.fillText('.', moon.x, moon.y);
        }
        context.globalAlpha = 1;
    }
}
