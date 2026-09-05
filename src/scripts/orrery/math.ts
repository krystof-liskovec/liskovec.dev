import type { Planet, Vec3 } from './types';

export const DEG = Math.PI / 180;
export const J2000 = Date.UTC(2000, 0, 1, 12);

export const shortestAngleDifference = (from: number, to: number) =>
    Math.atan2(Math.sin(to - from), Math.cos(to - from));

export const smoothstep = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
};

export const visualTransitionProgress = (progress: number, exiting: boolean, completionThreshold = 0.06) =>
    exiting ? Math.max(0, (progress - completionThreshold) / (1 - completionThreshold)) : progress;

export const randomUnit = (seed: number) => {
    const value = Math.sin(seed * 91.733) * 43758.5453;
    return value - Math.floor(value);
};

export const rotateX = (point: Vec3, angle: number, target: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 => {
    const { x, y, z } = point;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    target.x = x;
    target.y = y * cosine - z * sine;
    target.z = y * sine + z * cosine;
    return target;
};

export const rotateY = (point: Vec3, angle: number, target: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 => {
    const { x, y, z } = point;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    target.x = x * cosine + z * sine;
    target.y = y;
    target.z = -x * sine + z * cosine;
    return target;
};

export const rotateZ = (point: Vec3, angle: number, target: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 => {
    const { x, y, z } = point;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    target.x = x * cosine - y * sine;
    target.y = x * sine + y * cosine;
    target.z = z;
    return target;
};

export function solveKeplerOrbit(
    meanAnomaly: number,
    eccentricity: number,
    target: { angle: number; distance: number } = { angle: 0, distance: 1 },
) {
    const fullTurn = Math.PI * 2;
    const normalizedMeanAnomaly = ((((meanAnomaly + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
    let eccentricAnomaly = normalizedMeanAnomaly;
    for (let iteration = 0; iteration < 8; iteration++) {
        eccentricAnomaly -=
            (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - normalizedMeanAnomaly) /
            (1 - eccentricity * Math.cos(eccentricAnomaly));
    }
    target.angle = Math.atan2(
        Math.sqrt(1 - eccentricity ** 2) * Math.sin(eccentricAnomaly),
        Math.cos(eccentricAnomaly) - eccentricity,
    );
    target.distance = 1 - eccentricity * Math.cos(eccentricAnomaly);
    return target;
}

export function solveOrbit(
    planet: Planet,
    date: number,
    target: { angle: number; distance: number } = { angle: 0, distance: 1 },
) {
    const centuries = (date - J2000) / 86400000 / 36525;
    const meanAnomaly = (planet.meanLongitude + planet.longitudeRate * centuries - planet.perihelion) * DEG;
    return solveKeplerOrbit(meanAnomaly, planet.e, target);
}

export function orbitalPoint(planet: Planet, angle: number, distance = 1, target: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
    const radius = planet.displayRadius * distance;
    const argumentOfPerihelion = (planet.perihelion - planet.node) * DEG;
    target.x = Math.cos(angle + argumentOfPerihelion) * radius;
    target.y = Math.sin(angle + argumentOfPerihelion) * radius;
    target.z = 0;
    rotateX(target, planet.inclination * DEG * 2.4, target);
    return rotateZ(target, planet.node * DEG, target);
}

export function heliocentricPosition(
    planet: Planet,
    angle: number,
    normalizedDistance: number,
    target: { longitude: number; latitude: number; distance: number } = { longitude: 0, latitude: 0, distance: 0 },
) {
    const radius = planet.a * normalizedDistance;
    const argumentOfPerihelion = (planet.perihelion - planet.node) * DEG;
    const x = Math.cos(angle + argumentOfPerihelion) * radius;
    const y = Math.sin(angle + argumentOfPerihelion) * radius;
    const inclination = planet.inclination * DEG;
    const inclinedY = y * Math.cos(inclination);
    const z = y * Math.sin(inclination);
    const node = planet.node * DEG;
    const rotatedX = x * Math.cos(node) - inclinedY * Math.sin(node);
    const rotatedY = x * Math.sin(node) + inclinedY * Math.cos(node);
    target.longitude = (Math.atan2(rotatedY, rotatedX) / DEG + 360) % 360;
    target.latitude = Math.atan2(z, Math.hypot(rotatedX, rotatedY)) / DEG;
    target.distance = radius;
    return target;
}
