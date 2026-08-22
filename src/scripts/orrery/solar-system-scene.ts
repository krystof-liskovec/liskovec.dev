import { MAJOR_MOON_SYSTEMS, PLANETARY_MOON_SYSTEMS } from './catalog';
import type { MajorMoon } from './catalog';
import { rotateX, rotateZ } from './math';
import { ASTEROID_BELT } from './scene-data';
import { drawSolarBody } from './solar-body-renderer';
import { drawSun } from './sun-renderer';
import type { Planet, ProjectedBody, Vec3 } from './types';

type ProjectedPoint = Vec3 & { scale: number };
type OrbitMark = ProjectedPoint & { glyph: string; alpha: number; reveal: number };
type CameraTransform = (world: Vec3, target: ProjectedPoint) => ProjectedPoint;
type MoonOrbit = { angle: number; distance: number };
type SolveMoonOrbit = (moon: MajorMoon, target?: MoonOrbit) => MoonOrbit;

const JUPITER_MOON_COLORS = ['#fe8019', '#d5c4a1', '#bdae93', '#928374'];
const JUPITER_MOON_GLYPHS = ['o', '·', 'O', 'o'];
const SATURN_MOON_COLORS = ['#ebdbb2', '#bdae93', '#d79921', '#928374'];
const SATURN_MOON_GLYPHS = ['·', 'o', 'O', 'o'];

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
        this.drawAsteroids(context, options);
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

    private drawAsteroids(
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
        context.font = `${Math.max(5.5, 7.5 * Math.sqrt(solarSystemScale))}px "DM Mono", monospace`;
        context.fillStyle = '#928374';
        for (const asteroid of ASTEROID_BELT) {
            const angle = asteroid.angle + (reducedMotion ? 0 : seconds * (0.0045 + asteroid.phase * 0.0015));
            this.asteroidPoint.x = Math.cos(angle) * asteroid.radius;
            this.asteroidPoint.y = Math.sin(angle) * asteroid.radius;
            this.asteroidPoint.z = 0;
            rotateX(this.asteroidPoint, asteroid.inclination, this.asteroidPoint);
            rotateZ(this.asteroidPoint, asteroid.node, this.asteroidPoint);
            const projected = cameraTransform(this.asteroidPoint, this.asteroidProjection);
            context.globalAlpha = localDetailOpacity * (1 - planetSceneFocus) * (0.14 + asteroid.phase * 0.28);
            context.fillText(asteroid.glyph, projected.x, projected.y);
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
        const isJupiter = body.planet.name === 'Jupiter';
        const isSaturn = body.planet.name === 'Saturn';
        const hasMajorMoons = isJupiter || isSaturn;
        const majorMoonSystem = MAJOR_MOON_SYSTEMS[body.planet.name];
        const systemGlyphSize = Math.max(
            hasMajorMoons ? 7 : 5.5,
            (hasMajorMoons ? 8.5 : 7) * Math.sqrt(options.solarSystemScale),
        );
        context.font = `${systemGlyphSize * options.viewportGlyphScale}px "DM Mono", monospace`;

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

            context.globalAlpha = opacity * (hasMajorMoons ? 1 : 0.86);
            if (isJupiter) {
                context.fillStyle = JUPITER_MOON_COLORS[moonIndex];
                context.fillText(JUPITER_MOON_GLYPHS[moonIndex], moon.x, moon.y);
            } else if (isSaturn) {
                context.fillStyle = SATURN_MOON_COLORS[moonIndex];
                context.fillText(SATURN_MOON_GLYPHS[moonIndex], moon.x, moon.y);
            } else {
                context.fillStyle = body.planet.name === 'Earth' ? '#bdae93' : '#928374';
                context.fillText(moonIndex > 1 ? 'o' : '.', moon.x, moon.y);
            }
        }
        context.globalAlpha = 1;
    }
}
