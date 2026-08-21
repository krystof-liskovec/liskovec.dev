import type { Planet, Vec3 } from './types';

export const DEG = Math.PI / 180;
export const J2000 = Date.UTC(2000, 0, 1, 12);

export const smoothstep = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

export const randomUnit = (seed: number) => {
  const value = Math.sin(seed * 91.733) * 43758.5453;
  return value - Math.floor(value);
};

export const rotateX = (point: Vec3, angle: number): Vec3 => ({
  x: point.x,
  y: point.y * Math.cos(angle) - point.z * Math.sin(angle),
  z: point.y * Math.sin(angle) + point.z * Math.cos(angle),
});

export const rotateY = (point: Vec3, angle: number): Vec3 => ({
  x: point.x * Math.cos(angle) + point.z * Math.sin(angle),
  y: point.y,
  z: -point.x * Math.sin(angle) + point.z * Math.cos(angle),
});

export const rotateZ = (point: Vec3, angle: number): Vec3 => ({
  x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
  y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
  z: point.z,
});

export function solveOrbit(planet: Planet, date: number) {
  const centuries = (date - J2000) / 86400000 / 36525;
  const meanAnomaly = (planet.meanLongitude + planet.longitudeRate * centuries - planet.perihelion) * DEG;
  let eccentricAnomaly = meanAnomaly;
  for (let iteration = 0; iteration < 8; iteration++) {
    eccentricAnomaly -= (eccentricAnomaly - planet.e * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - planet.e * Math.cos(eccentricAnomaly));
  }
  return {
    angle: Math.atan2(Math.sqrt(1 - planet.e ** 2) * Math.sin(eccentricAnomaly), Math.cos(eccentricAnomaly) - planet.e),
    distance: (planet.a * (1 - planet.e * Math.cos(eccentricAnomaly))) / planet.a,
  };
}

export function orbitalPoint(planet: Planet, angle: number, distance = 1): Vec3 {
  const radius = planet.displayRadius * distance;
  const argumentOfPerihelion = (planet.perihelion - planet.node) * DEG;
  let point: Vec3 = { x: Math.cos(angle + argumentOfPerihelion) * radius, y: Math.sin(angle + argumentOfPerihelion) * radius, z: 0 };
  point = rotateX(point, planet.inclination * DEG * 2.4);
  return rotateZ(point, planet.node * DEG);
}

export function heliocentricPosition(planet: Planet, angle: number, normalizedDistance: number) {
  const radius = planet.a * normalizedDistance;
  const argumentOfPerihelion = (planet.perihelion - planet.node) * DEG;
  let point: Vec3 = { x: Math.cos(angle + argumentOfPerihelion) * radius, y: Math.sin(angle + argumentOfPerihelion) * radius, z: 0 };
  point = rotateX(point, planet.inclination * DEG);
  point = rotateZ(point, planet.node * DEG);
  return {
    longitude: (Math.atan2(point.y, point.x) / DEG + 360) % 360,
    latitude: Math.atan2(point.z, Math.hypot(point.x, point.y)) / DEG,
    distance: radius,
  };
}
