import { GALACTIC_OBJECTS, PLANETS } from './catalog';
import { DEG, orbitalPoint, randomUnit } from './math';

export const STARS = Array.from({ length: 90 }, (_, index) => ({
    x: ((index * 47) % 131) / 131,
    y: ((index * 83) % 127) / 127,
    phase: (index * 1.618) % (Math.PI * 2),
    speed: 0.55 + (index % 9) * 0.09,
    glyph: index % 17 === 0 ? '+' : index % 7 === 0 ? '*' : '.',
}));

const GALACTIC_BAR_ANGLE = 0.24;
const GALACTIC_SPIRAL_START = 0.16;
const GALACTIC_SPIRAL_PITCH = 11 * DEG;
const GALACTIC_SPIRAL_TIGHTNESS = 1 / Math.tan(GALACTIC_SPIRAL_PITCH);
const galacticSpiralAngle = (arm: number, radius: number, offset = 0) =>
    GALACTIC_BAR_ANGLE +
    arm * Math.PI +
    Math.log(Math.max(radius, GALACTIC_SPIRAL_START) / GALACTIC_SPIRAL_START) * GALACTIC_SPIRAL_TIGHTNESS +
    offset;

const GALACTIC_SOL_RADIUS = 0.58;
const GALACTIC_SOL_ANGLE = galacticSpiralAngle(1, GALACTIC_SOL_RADIUS, 0.18);

export const GALACTIC_SOL = {
    x: Math.cos(GALACTIC_SOL_ANGLE) * GALACTIC_SOL_RADIUS,
    y: Math.sin(GALACTIC_SOL_ANGLE) * GALACTIC_SOL_RADIUS,
};

const GALACTIC_SUN_DISTANCE_KPC = 8.2;

export const galacticPositionFromSun = (
    longitude: number,
    latitude: number,
    distanceKpc: number,
    target = { x: 0, y: 0, z: 0 },
) => {
    const sunRadius = Math.hypot(GALACTIC_SOL.x, GALACTIC_SOL.y);
    const towardCenterX = -GALACTIC_SOL.x / sunRadius;
    const towardCenterY = -GALACTIC_SOL.y / sunRadius;
    const longitudeNinetyX = -towardCenterY;
    const longitudeNinetyY = towardCenterX;
    const longitudeRadians = longitude * DEG;
    const planarDistance = (distanceKpc * Math.cos(latitude * DEG) * sunRadius) / GALACTIC_SUN_DISTANCE_KPC;
    target.x =
        GALACTIC_SOL.x +
        planarDistance * (Math.cos(longitudeRadians) * towardCenterX + Math.sin(longitudeRadians) * longitudeNinetyX);
    target.y =
        GALACTIC_SOL.y +
        planarDistance * (Math.cos(longitudeRadians) * towardCenterY + Math.sin(longitudeRadians) * longitudeNinetyY);
    target.z = (distanceKpc * Math.sin(latitude * DEG) * sunRadius) / GALACTIC_SUN_DISTANCE_KPC;
    return target;
};

const CRAB_NEBULA = GALACTIC_OBJECTS.find((object) => object.name === 'Crab Nebula');
const CRAB_GALACTIC_POSITION = CRAB_NEBULA
    ? galacticPositionFromSun(
          CRAB_NEBULA.galacticLongitude,
          CRAB_NEBULA.galacticLatitude,
          CRAB_NEBULA.heliocentricDistanceKpc,
      )
    : { x: 0, y: 0, z: 0 };
const CRAB_GALACTIC_RADIUS = Math.hypot(CRAB_GALACTIC_POSITION.x, CRAB_GALACTIC_POSITION.y);
const CRAB_GALACTIC_ANGLE = Math.atan2(CRAB_GALACTIC_POSITION.y, CRAB_GALACTIC_POSITION.x);
const CASSIOPEIA_A = GALACTIC_OBJECTS.find((object) => object.name === 'Cassiopeia A');
const CASSIOPEIA_A_POSITION = CASSIOPEIA_A
    ? galacticPositionFromSun(
          CASSIOPEIA_A.galacticLongitude,
          CASSIOPEIA_A.galacticLatitude,
          CASSIOPEIA_A.heliocentricDistanceKpc,
      )
    : CRAB_GALACTIC_POSITION;
const CASSIOPEIA_A_RADIUS = Math.hypot(CASSIOPEIA_A_POSITION.x, CASSIOPEIA_A_POSITION.y);
const CASSIOPEIA_A_ANGLE = Math.atan2(CASSIOPEIA_A_POSITION.y, CASSIOPEIA_A_POSITION.x);
const CRAB_PERSEUS_CORRECTION = CRAB_GALACTIC_ANGLE - galacticSpiralAngle(0, CRAB_GALACTIC_RADIUS, Math.PI / 2);
const CASSIOPEIA_PERSEUS_CORRECTION = CASSIOPEIA_A_ANGLE - galacticSpiralAngle(0, CASSIOPEIA_A_RADIUS, Math.PI / 2);
const PERSEUS_ARM_CORRECTION = Math.atan2(
    Math.sin(CRAB_PERSEUS_CORRECTION) + Math.sin(CASSIOPEIA_PERSEUS_CORRECTION),
    Math.cos(CRAB_PERSEUS_CORRECTION) + Math.cos(CASSIOPEIA_PERSEUS_CORRECTION),
);
const PERSEUS_ANCHOR_RADIUS = (CRAB_GALACTIC_RADIUS + CASSIOPEIA_A_RADIUS) / 2;
const localizedArmCorrection = (radius: number, targetRadius: number, correction: number) => {
    const radialDistance = (radius - targetRadius) / 0.22;
    return correction * Math.exp(-(radialDistance * radialDistance));
};
const perseusArmOffset = (radius: number) => {
    // The broad procedural arm remains intact, but bends between the measured
    // Crab Nebula and Cassiopeia A positions instead of stranding either remnant.
    return Math.PI / 2 + localizedArmCorrection(radius, PERSEUS_ANCHOR_RADIUS, PERSEUS_ARM_CORRECTION);
};

const ETA_CARINAE = GALACTIC_OBJECTS.find((object) => object.name === 'Eta Carinae');
const ETA_CARINAE_POSITION = ETA_CARINAE
    ? galacticPositionFromSun(
          ETA_CARINAE.galacticLongitude,
          ETA_CARINAE.galacticLatitude,
          ETA_CARINAE.heliocentricDistanceKpc,
      )
    : { x: 0, y: 0, z: 0 };
const ETA_CARINAE_RADIUS = Math.hypot(ETA_CARINAE_POSITION.x, ETA_CARINAE_POSITION.y);
const ETA_CARINAE_ANGLE = Math.atan2(ETA_CARINAE_POSITION.y, ETA_CARINAE_POSITION.x);
const CARINA_BASE_ANGLE = galacticSpiralAngle(1, ETA_CARINAE_RADIUS);
const CARINA_ETA_CORRECTION = Math.atan2(
    Math.sin(ETA_CARINAE_ANGLE - CARINA_BASE_ANGLE),
    Math.cos(ETA_CARINAE_ANGLE - CARINA_BASE_ANGLE),
);
const carinaArmOffset = (radius: number) => localizedArmCorrection(radius, ETA_CARINAE_RADIUS, CARINA_ETA_CORRECTION);

export const GALAXY_STARS = Array.from({ length: 2800 }, (_, index) => {
    const inBar = index < 360;
    if (inBar) {
        const alongBar = (randomUnit(index + 1) * 2 - 1) * (0.07 + Math.pow(randomUnit(index + 11), 0.62) * 0.25);
        const acrossBar = (randomUnit(index + 21) - 0.5) * (0.035 + Math.abs(alongBar) * 0.18);
        const x = alongBar * Math.cos(GALACTIC_BAR_ANGLE) - acrossBar * Math.sin(GALACTIC_BAR_ANGLE);
        const y = alongBar * Math.sin(GALACTIC_BAR_ANGLE) + acrossBar * Math.cos(GALACTIC_BAR_ANGLE);
        return {
            x,
            y,
            radius: Math.hypot(x, y),
            phase: randomUnit(index + 31) * Math.PI * 2,
            strength: 0.55 + randomUnit(index + 51) * 0.45,
            opacity: 0.72 + randomUnit(index + 71) * 0.28,
            glyph: index % 29 === 0 ? '+' : index % 7 === 0 ? '*' : index % 4 === 0 ? ':' : '.',
        };
    }

    // Four populations feed the primary pair and two feed the secondary pair.
    // Secondary arms sit between the primary arms instead of hugging their edge.
    const armSlot = index % 6;
    const dominantArm = armSlot < 4;
    const arm = dominantArm ? armSlot % 2 : armSlot - 4;
    const radius = dominantArm
        ? 0.16 + Math.pow(randomUnit(index + 1), 0.72) * 0.84
        : 0.2 + Math.pow(randomUnit(index + 1), 0.78) * 0.75;
    const armLane = ((index % 3) - 1) * (0.032 + radius * 0.045);
    const branch = dominantArm
        ? arm === 1
            ? carinaArmOffset(radius)
            : 0
        : arm === 0
          ? perseusArmOffset(radius)
          : Math.PI / 2;
    const scatter = (randomUnit(index + 11) - 0.5) * (dominantArm ? 0.14 + radius * 0.29 : 0.13 + radius * 0.2);
    const angle = galacticSpiralAngle(arm, radius, branch) + armLane + scatter;
    return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        radius,
        phase: randomUnit(index + 31) * Math.PI * 2,
        strength: randomUnit(index + 51),
        opacity: dominantArm ? 0.82 + randomUnit(index + 71) * 0.18 : 0.62 + randomUnit(index + 71) * 0.24,
        glyph: index % 53 === 0 ? '+' : index % 17 === 0 ? '*' : index % 5 === 0 ? ':' : '.',
    };
});

export const GALACTIC_DISK = Array.from({ length: 600 }, (_, index) => {
    const radius = 0.06 + Math.pow(randomUnit(index + 2301), 0.58) * 0.94;
    const angle = randomUnit(index + 2401) * Math.PI * 2;
    return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        radius,
        glyph: index % 7 === 0 ? ':' : '.',
        opacity: 0.08 + (1 - radius) * 0.16 + randomUnit(index + 2501) * 0.07,
    };
});

export const GALACTIC_DUST_LANES = Array.from({ length: 150 }, (_, index) => {
    const arm = index % 2;
    const radius = 0.18 + Math.pow(randomUnit(index + 2601), 0.76) * 0.7;
    const armOffset = -(0.09 + radius * 0.075) + (arm === 1 ? carinaArmOffset(radius) : 0);
    const angle =
        galacticSpiralAngle(arm, radius, armOffset) + (randomUnit(index + 2701) - 0.5) * (0.07 + radius * 0.09);
    return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        glyph: index % 6 === 0 ? ':' : '.',
        opacity: 0.48 + randomUnit(index + 2801) * 0.34,
    };
});

const NEBULA_REGIONS = [
    { arm: 0, radius: 0.28, offset: 0, spread: 0.055, color: '#d3869b' },
    { arm: 1, radius: 0.36, offset: 0, spread: 0.05, color: '#fe8019' },
    { arm: 0, radius: 0.43, offset: Math.PI / 2, spread: 0.06, color: '#83a598' },
    { arm: 1, radius: 0.51, offset: 0.08, spread: 0.055, color: '#d3869b' },
    { arm: 0, radius: 0.6, offset: 0, spread: 0.065, color: '#b8bb26' },
    { arm: 0, radius: 0.76, offset: Math.PI / 2, spread: 0.07, color: '#fe8019' },
    { arm: 1, radius: 0.84, offset: 0, spread: 0.065, color: '#83a598' },
];

export const GALACTIC_NEBULAE = NEBULA_REGIONS.flatMap((region, regionIndex) =>
    Array.from({ length: 24 }, (_, particleIndex) => {
        const seed = regionIndex * 97 + particleIndex;
        const radialOffset = (randomUnit(seed + 1701) + randomUnit(seed + 1801) - 1) * region.spread * 1.25;
        const radius = region.radius + radialOffset;
        const regionOffset =
            region.arm === 0 && region.offset === Math.PI / 2
                ? perseusArmOffset(region.radius)
                : region.offset + (region.arm === 1 ? carinaArmOffset(region.radius) : 0);
        const armAngle = galacticSpiralAngle(region.arm, region.radius, regionOffset);
        const angle = armAngle + (randomUnit(seed + 1901) + randomUnit(seed + 2001) - 1) * region.spread * 2.35;
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            color: region.color,
            glyph: particleIndex % 13 === 0 ? '*' : particleIndex % 4 === 0 ? ':' : '.',
            opacity: 0.08 + randomUnit(seed + 2101) * 0.2,
            phase: randomUnit(seed + 2201) * Math.PI * 2,
        };
    }),
);

export const ORION_SPUR_STARS = Array.from({ length: 72 }, (_, index) => {
    const radius = GALACTIC_SOL_RADIUS + (index / 71 - 0.5) * 0.18;
    const angle = galacticSpiralAngle(1, radius, 0.18) + (randomUnit(index + 801) - 0.5) * 0.024;
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
    inclination: (randomUnit(index + 1401) - 0.5) * 8 * DEG,
    node: randomUnit(index + 1501) * Math.PI * 2,
    phase: randomUnit(index + 1601),
    glyph: index % 19 === 0 ? ':' : index % 7 === 0 ? "'" : '.',
}));

export const ORBIT_SAMPLES = 112;
export const ORBIT_POINTS = PLANETS.map((planet) =>
    Array.from({ length: ORBIT_SAMPLES }, (_, sample) => {
        const trueAnomaly = (sample / ORBIT_SAMPLES) * Math.PI * 2;
        const normalizedDistance = (1 - planet.e ** 2) / (1 + planet.e * Math.cos(trueAnomaly));
        return orbitalPoint(planet, trueAnomaly, normalizedDistance);
    }),
);
