import { PLANETS } from './catalog';
import { heliocentricPosition, orbitalPoint, solveOrbit } from './math';
import { ORBIT_POINTS, ORBIT_SAMPLES } from './scene-data';
import type { Planet, ProjectedBody, Vec3 } from './types';

export type ProjectedPoint = Vec3 & { scale: number };
export type OrbitMark = ProjectedPoint & { glyph: string; alpha: number; reveal: number };
type CameraTransform = (world: Vec3, target: ProjectedPoint) => ProjectedPoint;

export class SolarSystemModel {
    readonly bodies: ProjectedBody[] = [];
    readonly farMarks: OrbitMark[] = [];
    readonly nearMarks: OrbitMark[] = [];

    private readonly orbitProjection = { x: 0, y: 0, z: 0, scale: 1 };
    private readonly nextOrbitProjection = { x: 0, y: 0, z: 0, scale: 1 };
    private readonly focusedOrbit = { angle: 0, distance: 1 };
    private readonly focusedWorld = { x: 0, y: 0, z: 0 };
    private readonly focusedProjection = { x: 0, y: 0, z: 0, scale: 1 };
    private readonly orbitSolutions = PLANETS.map(() => ({ angle: 0, distance: 1 }));
    private readonly bodyPool: ProjectedBody[] = PLANETS.map((planet) => ({
        planet,
        world: { x: 0, y: 0, z: 0 },
        reveal: 1,
        position: { longitude: 0, latitude: 0, distance: 0 },
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
    }));
    private readonly orbitMarkPool: OrbitMark[] = Array.from({ length: PLANETS.length * ORBIT_SAMPLES }, () => ({
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
        glyph: '-',
        alpha: 0,
        reveal: 1,
    }));

    projectOrbits(options: {
        cameraTransform: CameraTransform;
        plutoUnlocked: boolean;
        plutoReveal: number;
        localDetailOpacity: number;
        planetSceneFocus: number;
    }) {
        const { cameraTransform, plutoUnlocked, plutoReveal, localDetailOpacity, planetSceneFocus } = options;
        this.farMarks.length = 0;
        this.nearMarks.length = 0;
        let markCount = 0;

        PLANETS.forEach((planet, planetIndex) => {
            if (planet.easterEgg && !plutoUnlocked) return;
            for (let sample = 0; sample < ORBIT_SAMPLES; sample++) {
                if ((sample + planetIndex) % 3 === 0) continue;
                const projected = cameraTransform(ORBIT_POINTS[planetIndex][sample], this.orbitProjection);
                const next = cameraTransform(
                    ORBIT_POINTS[planetIndex][(sample + 1) % ORBIT_SAMPLES],
                    this.nextOrbitProjection,
                );
                const dx = next.x - projected.x;
                const dy = next.y - projected.y;
                const slope = Math.abs(dy / (dx || 0.001));
                const mark = this.orbitMarkPool[markCount++];
                mark.x = projected.x;
                mark.y = projected.y;
                mark.z = projected.z;
                mark.scale = projected.scale;
                mark.glyph = slope > 2.1 ? '|' : slope > 0.55 ? (dx * dy > 0 ? '\\' : '/') : '-';
                mark.alpha = 0.7 * localDetailOpacity * (1 - planetSceneFocus);
                mark.reveal = planet.easterEgg ? plutoReveal : 1;
                (projected.z < 0 ? this.farMarks : this.nearMarks).push(mark);
            }
        });
    }

    projectBodies(options: {
        cameraTransform: CameraTransform;
        now: number;
        plutoUnlocked: boolean;
        plutoReveal: number;
    }) {
        const { cameraTransform, now, plutoUnlocked, plutoReveal } = options;
        this.bodies.length = 0;
        for (let index = 0; index < PLANETS.length; index++) {
            const planet = PLANETS[index];
            if (planet.easterEgg && !plutoUnlocked) continue;
            const body = this.bodyPool[index];
            const orbit = solveOrbit(planet, now, this.orbitSolutions[index]);
            orbitalPoint(planet, orbit.angle, orbit.distance, body.world);
            body.reveal = planet.easterEgg ? plutoReveal : 1;
            heliocentricPosition(planet, orbit.angle, orbit.distance, body.position);
            cameraTransform(body.world, body);
            this.bodies.push(body);
        }
        this.bodies.sort((first, second) => first.z - second.z);
    }

    projectFocusedPlanet(planet: Planet, now: number, cameraProjection: CameraTransform) {
        const orbit = solveOrbit(planet, now, this.focusedOrbit);
        orbitalPoint(planet, orbit.angle, orbit.distance, this.focusedWorld);
        return cameraProjection(this.focusedWorld, this.focusedProjection);
    }
}
