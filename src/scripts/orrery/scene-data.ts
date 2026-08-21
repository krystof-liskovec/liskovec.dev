import { PLANETS } from './catalog';
import { DEG, orbitalPoint, randomUnit } from './math';

export const STARS = Array.from({ length: 90 }, (_, index) => ({
  x: ((index * 47) % 131) / 131,
  y: ((index * 83) % 127) / 127,
  phase: (index * 1.618) % (Math.PI * 2),
  speed: .55 + (index % 9) * .09,
  glyph: index % 17 === 0 ? '+' : index % 7 === 0 ? '*' : '.',
}));

const GALACTIC_SOL_RADIUS = .58;
const GALACTIC_SOL_ANGLE = Math.PI + GALACTIC_SOL_RADIUS * 6.25;

export const GALACTIC_SOL = {
  x: Math.cos(GALACTIC_SOL_ANGLE) * GALACTIC_SOL_RADIUS,
  y: Math.sin(GALACTIC_SOL_ANGLE) * GALACTIC_SOL_RADIUS * .58,
};

export const GALAXY_STARS = Array.from({ length: 1180 }, (_, index) => {
  const inCore = index < 170;
  const radius = inCore
    ? Math.pow(randomUnit(index + 1), 2.15) * .24
    : .08 + Math.pow(randomUnit(index + 1), .66) * .92;
  const arm = index % 4;
  const angle = inCore
    ? randomUnit(index + 11) * Math.PI * 2
    : arm * Math.PI / 2 + radius * 6.25 + (randomUnit(index + 11) - .5) * (.12 + radius * .3);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * .58,
    radius,
    phase: randomUnit(index + 31) * Math.PI * 2,
    strength: randomUnit(index + 51),
    glyph: index % 37 === 0 ? '+' : index % 8 === 0 ? '*' : index % 5 === 0 ? ':' : '.',
  };
});

export const ORION_SPUR_STARS = Array.from({ length: 72 }, (_, index) => {
  const radius = GALACTIC_SOL_RADIUS + (index / 71 - .5) * .18;
  const angle = Math.PI + radius * 6.25 + (randomUnit(index + 801) - .5) * .024;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * .58,
    phase: randomUnit(index + 901) * Math.PI * 2,
    glyph: index % 13 === 0 ? '*' : index % 5 === 0 ? ':' : '.',
  };
});

export const ASTEROID_BELT = Array.from({ length: 170 }, (_, index) => ({
  angle: randomUnit(index + 1201) * Math.PI * 2,
  radius: 20.15 + randomUnit(index + 1301) * 2.15,
  inclination: (randomUnit(index + 1401) - .5) * 8 * DEG,
  node: randomUnit(index + 1501) * Math.PI * 2,
  phase: randomUnit(index + 1601),
  glyph: index % 19 === 0 ? ':' : index % 7 === 0 ? "'" : '.',
}));

export const ORBIT_SAMPLES = 112;
export const ORBIT_POINTS = PLANETS.map((planet) =>
  Array.from({ length: ORBIT_SAMPLES }, (_, sample) => {
    const trueAnomaly = sample / ORBIT_SAMPLES * Math.PI * 2;
    const normalizedDistance = (1 - planet.e ** 2) / (1 + planet.e * Math.cos(trueAnomaly));
    return orbitalPoint(planet, trueAnomaly, normalizedDistance);
  })
);
