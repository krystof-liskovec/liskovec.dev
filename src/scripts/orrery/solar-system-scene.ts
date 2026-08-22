import { MAJOR_MOON_SYSTEMS, PLANETARY_MOON_SYSTEMS } from './catalog';
import type { MajorMoon } from './catalog';
import { rotateX, rotateZ } from './math';
import { ASTEROID_BELT, KUIPER_BELT, ZODIACAL_DUST, type SolarParticle } from './scene-data';
import { drawSolarBody } from './solar-body-renderer';
import { drawSun } from './sun-renderer';
import type { Planet, ProjectedBody, Vec3 } from './types';

type ProjectedPoint = Vec3 & { scale: number };
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

export class SolarSystemSceneRenderer {
    private readonly moonOffset = { x: 0, y: 0, z: 0 };
    private readonly moonWorld = { x: 0, y: 0, z: 0 };
    private readonly moonProjection = { x: 0, y: 0, z: 0, scale: 1 };
    private readonly moonOrbit = { angle: 0, distance: 1 };
    private readonly asteroidPoint = { x: 0, y: 0, z: 0 };
    private readonly asteroidProjection = { x: 0, y: 0, z: 0, scale: 1 };

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
        },
    ) {
        this.drawOrbitMarks(context, options.farMarks);
        this.drawOrbitMarks(context, options.nearMarks);
        this.drawSmallBodyFields(context, options);
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
        },
    ) {
        const { seconds, reducedMotion, solarSystemScale, localDetailOpacity, planetSceneFocus, cameraTransform } =
            options;
        const opacity = localDetailOpacity * (1 - planetSceneFocus);
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
        } = options;

        drawSun(context, {
            x: centerX,
            y: centerY,
            scale: renderedSunScale * focusedSunBridgeScale ** 2,
            opacity: localDetailOpacity * (focusedSun ? 1 - focusedSunDetailReveal : 1 - planetSceneFocus),
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
        const opacity = options.localDetailOpacity * (1 - options.planetSceneFocus);
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
