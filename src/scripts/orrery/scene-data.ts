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
  y: Math.sin(GALACTIC_SOL_ANGLE) * GALACTIC_SOL_RADIUS,
};

export const GALAXY_STARS = Array.from({ length: 1420 }, (_, index) => {
  const inCore = index < 230;
  const radius = inCore
    ? Math.pow(randomUnit(index + 1), 2.05) * .27
    : .08 + Math.pow(randomUnit(index + 1), .66) * .92;
  const arm = index % 4;
  const armLane = ((index % 3) - 1) * (.022 + radius * .028);
  const angle = inCore
    ? randomUnit(index + 11) * Math.PI * 2
    : arm * Math.PI / 2 + radius * 6.25 + armLane + (randomUnit(index + 11) - .5) * (.1 + radius * .2);
  return {
    x: Math.cos(angle) * radius * (inCore ? 1.18 : 1),
    y: Math.sin(angle) * radius * (inCore ? .72 : 1),
    radius,
    phase: randomUnit(index + 31) * Math.PI * 2,
    strength: randomUnit(index + 51),
    glyph: index % 37 === 0 ? '+' : index % 8 === 0 ? '*' : index % 5 === 0 ? ':' : '.',
  };
});

const NEBULA_REGIONS = [
  { arm: 0, radius: .28, spread: .055, color: '#d3869b' },
  { arm: 1, radius: .36, spread: .05, color: '#fe8019' },
  { arm: 2, radius: .43, spread: .06, color: '#83a598' },
  { arm: 3, radius: .51, spread: .055, color: '#d3869b' },
  { arm: 0, radius: .6, spread: .065, color: '#b8bb26' },
  { arm: 1, radius: .68, spread: .06, color: '#d3869b' },
  { arm: 2, radius: .76, spread: .07, color: '#fe8019' },
  { arm: 3, radius: .84, spread: .065, color: '#83a598' },
];

export const GALACTIC_NEBULAE = NEBULA_REGIONS.flatMap((region, regionIndex) =>
  Array.from({ length: 24 }, (_, particleIndex) => {
    const seed = regionIndex * 97 + particleIndex;
    const radialOffset = (randomUnit(seed + 1701) + randomUnit(seed + 1801) - 1) * region.spread;
    const radius = region.radius + radialOffset;
    const armAngle = region.arm * Math.PI / 2 + region.radius * 6.25;
    const angle = armAngle + (randomUnit(seed + 1901) + randomUnit(seed + 2001) - 1) * region.spread * 1.8;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      color: region.color,
      glyph: particleIndex % 13 === 0 ? '*' : particleIndex % 4 === 0 ? ':' : '.',
      opacity: .16 + randomUnit(seed + 2101) * .32,
      phase: randomUnit(seed + 2201) * Math.PI * 2,
    };
  }),
);

export const ORION_SPUR_STARS = Array.from({ length: 72 }, (_, index) => {
  const radius = GALACTIC_SOL_RADIUS + (index / 71 - .5) * .18;
  const angle = Math.PI + radius * 6.25 + (randomUnit(index + 801) - .5) * .024;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
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
