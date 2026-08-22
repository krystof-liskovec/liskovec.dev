import { PLANETS } from './catalog';
import {
    GALACTIC_BAR_BETA,
    GALACTIC_BAR_HALF_LENGTH_KPC,
    GALACTIC_SCENE_UNITS_PER_KPC,
    LOCAL_GALACTIC_ARM,
    MAJOR_GALACTIC_ARMS,
    galacticArmPoint,
    galacticArmRadius,
    galacticArmWidth,
    type NamedGalacticArm,
} from './galaxy-model';
import { DEG, orbitalPoint, randomUnit } from './math';

export { GALACTIC_SOL, galacticPositionFromSun } from './galaxy-model';

export const STARS = Array.from({ length: 90 }, (_, index) => ({
    x: ((index * 47) % 131) / 131,
    y: ((index * 83) % 127) / 127,
    phase: (index * 1.618) % (Math.PI * 2),
    speed: 0.55 + (index % 9) * 0.09,
    glyph: index % 17 === 0 ? '+' : index % 7 === 0 ? '*' : '.',
}));

const GALACTIC_BAR_STARS = 360;
const GALACTIC_ARM_STARS = 3400;
const STARS_PER_MAJOR_ARM = GALACTIC_ARM_STARS / MAJOR_GALACTIC_ARMS.length;

export const GALAXY_STARS = Array.from({ length: GALACTIC_BAR_STARS + GALACTIC_ARM_STARS }, (_, index) => {
    if (index < GALACTIC_BAR_STARS) {
        const alongBarKpc =
            (randomUnit(index + 1) * 2 - 1) *
            (1 + Math.pow(randomUnit(index + 11), 0.62) * (GALACTIC_BAR_HALF_LENGTH_KPC - 1));
        const acrossBarKpc = (randomUnit(index + 21) - 0.5) * (0.6 + Math.abs(alongBarKpc) * 0.2);
        const directionX = Math.sin(GALACTIC_BAR_BETA);
        const directionY = Math.cos(GALACTIC_BAR_BETA);
        const x = (alongBarKpc * directionX - acrossBarKpc * directionY) * GALACTIC_SCENE_UNITS_PER_KPC;
        const y = (alongBarKpc * directionY + acrossBarKpc * directionX) * GALACTIC_SCENE_UNITS_PER_KPC;
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

    const armIndex = (index - GALACTIC_BAR_STARS) % MAJOR_GALACTIC_ARMS.length;
    const arm = MAJOR_GALACTIC_ARMS[armIndex];
    const sampleIndex = Math.floor((index - GALACTIC_BAR_STARS) / MAJOR_GALACTIC_ARMS.length);
    const progress = (sampleIndex + randomUnit(index + 1)) / STARS_PER_MAJOR_ARM;
    const beta = arm.betaMin + progress * (arm.betaMax - arm.betaMin);
    const armRadius = galacticArmRadius(arm, beta);
    const armWidth = galacticArmWidth(arm, armRadius);
    const crossArmOffset = (randomUnit(index + 11) + randomUnit(index + 17) - 1) * armWidth * 1.65;
    const point = galacticArmPoint(arm, beta, crossArmOffset);

    return {
        x: point.x,
        y: point.y,
        radius: armRadius * GALACTIC_SCENE_UNITS_PER_KPC,
        phase: randomUnit(index + 31) * Math.PI * 2,
        strength: randomUnit(index + 51),
        opacity: 0.72 + randomUnit(index + 71) * 0.28,
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
    const arm = MAJOR_GALACTIC_ARMS[index % MAJOR_GALACTIC_ARMS.length];
    const progress = (Math.floor(index / MAJOR_GALACTIC_ARMS.length) + randomUnit(index + 2601)) / 38;
    const beta = arm.betaMin + Math.min(1, progress) * (arm.betaMax - arm.betaMin);
    const radius = galacticArmRadius(arm, beta);
    const width = galacticArmWidth(arm, radius);
    const crossArmOffset = -width * (0.72 + randomUnit(index + 2701) * 0.45);
    const point = galacticArmPoint(arm, beta, crossArmOffset);
    return {
        x: point.x,
        y: point.y,
        glyph: index % 6 === 0 ? ':' : '.',
        opacity: 0.48 + randomUnit(index + 2801) * 0.34,
    };
});

const armNamed = (name: NamedGalacticArm['name']) =>
    name === 'Local' ? LOCAL_GALACTIC_ARM : MAJOR_GALACTIC_ARMS.find((arm) => arm.name === name)!;

const NEBULA_REGIONS = [
    { arm: armNamed('Norma–Outer'), beta: 20 * DEG, spread: 0.055, color: '#d3869b' },
    { arm: armNamed('Norma–Outer'), beta: -300 * DEG, spread: 0.065, color: '#83a598' },
    { arm: armNamed('Scutum–Centaurus'), beta: 55 * DEG, spread: 0.06, color: '#fe8019' },
    { arm: armNamed('Sagittarius–Carina'), beta: -18 * DEG, spread: 0.065, color: '#fabd2f' },
    { arm: armNamed('Sagittarius–Carina'), beta: 70 * DEG, spread: 0.055, color: '#d3869b' },
    { arm: armNamed('Local'), beta: 10 * DEG, spread: 0.045, color: '#b8bb26' },
    { arm: armNamed('Perseus'), beta: 0 * DEG, spread: 0.06, color: '#fb4934' },
    { arm: armNamed('Perseus'), beta: 35 * DEG, spread: 0.065, color: '#d65d0e' },
];

export const GALACTIC_NEBULAE = NEBULA_REGIONS.flatMap((region, regionIndex) =>
    Array.from({ length: 24 }, (_, particleIndex) => {
        const seed = regionIndex * 97 + particleIndex;
        const beta = region.beta + (randomUnit(seed + 1701) + randomUnit(seed + 1801) - 1) * region.spread * 2.4;
        const radius = galacticArmRadius(region.arm, beta);
        const crossArmOffset =
            (randomUnit(seed + 1901) + randomUnit(seed + 2001) - 1) * galacticArmWidth(region.arm, radius) * 2;
        const point = galacticArmPoint(region.arm, beta, crossArmOffset);
        return {
            x: point.x,
            y: point.y,
            color: region.color,
            glyph: particleIndex % 13 === 0 ? '*' : particleIndex % 4 === 0 ? ':' : '.',
            opacity: 0.08 + randomUnit(seed + 2101) * 0.2,
            phase: randomUnit(seed + 2201) * Math.PI * 2,
        };
    }),
);

// Reid et al.'s measured -8°..34° Local (Orion) Arm fit spans about
// 6.1 kpc / 19,900 ly along its logarithmic centreline.
export const LOCAL_ARM_STARS = Array.from({ length: 190 }, (_, index) => {
    const progress = (index + randomUnit(index + 701)) / 190;
    const beta = LOCAL_GALACTIC_ARM.betaMin + progress * (LOCAL_GALACTIC_ARM.betaMax - LOCAL_GALACTIC_ARM.betaMin);
    const radius = galacticArmRadius(LOCAL_GALACTIC_ARM, beta);
    const width = galacticArmWidth(LOCAL_GALACTIC_ARM, radius);
    const crossArmOffset = (randomUnit(index + 801) + randomUnit(index + 851) - 1) * width * 1.65;
    const point = galacticArmPoint(LOCAL_GALACTIC_ARM, beta, crossArmOffset);
    return {
        x: point.x,
        y: point.y,
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
