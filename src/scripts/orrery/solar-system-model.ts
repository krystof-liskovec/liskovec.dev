import { PLANETS } from './catalog';
import { heliocentricPosition, orbitalPoint, smoothstep, solveOrbit } from './math';
import { ORBIT_POINTS, ORBIT_SAMPLES } from './solar-scene-data';
import type { Planet, ProjectedBody, Vec3 } from './types';

// Keep the overview lightweight, but subdivide the selected planet's lane in
// close-up so long projected arcs do not break into widely spaced dashes.
const FOCUSED_ORBIT_SUBDIVISIONS = 8;
const FOCUSED_ORBIT_SAMPLES = ORBIT_SAMPLES * FOCUSED_ORBIT_SUBDIVISIONS;

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
    private readonly focusedNextWorld = { x: 0, y: 0, z: 0 };
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
    private readonly orbitMarkPool: OrbitMark[] = Array.from(
        { length: PLANETS.length * FOCUSED_ORBIT_SAMPLES },
        () => ({
            x: 0,
            y: 0,
            z: 0,
            scale: 1,
            glyph: '-',
            alpha: 0,
            reveal: 1,
        }),
    );

    projectOrbits(options: {
        cameraTransform: CameraTransform;
        plutoUnlocked: boolean;
        plutoReveal: number;
        localDetailOpacity: number;
        planetSceneFocus: number;
        focusedPlanetName?: string | null;
        focusOcclusionDepth?: number | null;
        introProgress: number;
        compact: boolean;
    }) {
        const {
            cameraTransform,
            plutoUnlocked,
            plutoReveal,
            localDetailOpacity,
            planetSceneFocus,
            focusedPlanetName = null,
            focusOcclusionDepth = null,
            introProgress,
            compact,
        } = options;
        this.farMarks.length = 0;
        this.nearMarks.length = 0;
        let markCount = 0;

        PLANETS.forEach((planet, planetIndex) => {
            if (planet.easterEgg && !plutoUnlocked) return;
            const introReveal = smoothstep((introProgress - planetIndex * 0.055) / 0.58);
            const isFocusedOrbit = focusedPlanetName === planet.name;
            const sampleCount = isFocusedOrbit ? FOCUSED_ORBIT_SAMPLES : ORBIT_SAMPLES;
            let previousGlyph: string | null = null;
            for (let sample = 0; sample < sampleCount; sample++) {
                if (!isFocusedOrbit && (sample + planetIndex) % 3 === 0) continue;
                const baseSample = isFocusedOrbit ? Math.floor(sample / FOCUSED_ORBIT_SUBDIVISIONS) : sample;
                const projectedWorld = isFocusedOrbit
                    ? this.projectOrbitPoint(planet, sample, sampleCount, this.focusedWorld)
                    : ORBIT_POINTS[planetIndex][sample];
                const nextWorld = isFocusedOrbit
                    ? this.projectOrbitPoint(planet, (sample + 1) % sampleCount, sampleCount, this.focusedNextWorld)
                    : ORBIT_POINTS[planetIndex][(sample + 1) % ORBIT_SAMPLES];
                const projected = cameraTransform(projectedWorld, this.orbitProjection);
                const next = cameraTransform(nextWorld, this.nextOrbitProjection);
                // An orbit lane is represented by the glyph at its starting
                // point. Do not let a single near-side mark leak through just
                // because the adjacent sample crosses back behind the focus.
                if (focusOcclusionDepth !== null && !isFocusedOrbit && projected.z > focusOcclusionDepth) {
                    continue;
                }
                const dx = next.x - projected.x;
                const dy = next.y - projected.y;
                const slope = Math.abs(dy / (dx || 0.001));
                const glyph = slope > 2.1 ? '|' : slope > 0.55 ? (dx * dy > 0 ? '\\' : '/') : '-';
                const directionChanged = glyph !== previousGlyph;
                previousGlyph = glyph;
                // Keep the mobile gaps regular. Combining the desktop
                // every-third pattern with an every-other pattern creates
                // uneven holes that can erase short /-to-- transitions.
                const sparseSample = isFocusedOrbit
                    ? sample % FOCUSED_ORBIT_SUBDIVISIONS !== 0 ||
                      (baseSample + planetIndex) % 3 === 0 ||
                      (compact && baseSample % 4 === 3 && !directionChanged)
                    : (sample + planetIndex) % 3 === 0 || (compact && sample % 4 === 3 && !directionChanged);
                if (!isFocusedOrbit && compact && sample % 4 === 3 && !directionChanged) continue;
                const mark = this.orbitMarkPool[markCount++];
                mark.x = projected.x;
                mark.y = projected.y;
                mark.z = projected.z;
                mark.scale = projected.scale;
                mark.glyph = glyph;
                // Keep the rest of the solar system as faint spatial context
                // while the camera is orbiting a focused planet. The selected
                // lane remains dominant and receives the extra dense samples.
                const orbitReveal = isFocusedOrbit
                    ? Math.max(0.8, 1 - planetSceneFocus * 0.2)
                    : 1 - planetSceneFocus * 0.82;
                const denseSampleReveal = isFocusedOrbit && sparseSample ? planetSceneFocus : 1;
                mark.alpha = 0.7 * localDetailOpacity * orbitReveal * denseSampleReveal;
                mark.reveal = introReveal * (planet.easterEgg ? plutoReveal : 1);
                (projected.z < 0 ? this.farMarks : this.nearMarks).push(mark);
            }
        });
    }

    private projectOrbitPoint(planet: Planet, sample: number, sampleCount: number, target: Vec3) {
        const trueAnomaly = (sample / sampleCount) * Math.PI * 2;
        const normalizedDistance = (1 - planet.e ** 2) / (1 + planet.e * Math.cos(trueAnomaly));
        return orbitalPoint(planet, trueAnomaly, normalizedDistance, target);
    }

    projectBodies(options: {
        cameraTransform: CameraTransform;
        now: number;
        plutoUnlocked: boolean;
        plutoReveal: number;
        introProgress: number;
    }) {
        const { cameraTransform, now, plutoUnlocked, plutoReveal, introProgress } = options;
        this.bodies.length = 0;
        for (let index = 0; index < PLANETS.length; index++) {
            const planet = PLANETS[index];
            if (planet.easterEgg && !plutoUnlocked) continue;
            const body = this.bodyPool[index];
            const orbit = solveOrbit(planet, now, this.orbitSolutions[index]);
            orbitalPoint(planet, orbit.angle, orbit.distance, body.world);
            const introReveal = smoothstep((introProgress - index * 0.055) / 0.56);
            body.reveal = introReveal * (planet.easterEgg ? plutoReveal : 1);
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

    focusedDistanceFromSun() {
        return Math.sqrt(
            this.focusedWorld.x * this.focusedWorld.x +
                this.focusedWorld.y * this.focusedWorld.y +
                this.focusedWorld.z * this.focusedWorld.z,
        );
    }
}
