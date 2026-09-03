import { PLANETS } from './catalog';
import { DEG, orbitalPoint, randomUnit } from './math';

export const STARS = Array.from({ length: 90 }, (_, index) => ({
    // Use independent seeded coordinates. Advancing x/y with separate modular
    // sequences created visible diagonal rows on narrow, expanded canvases.
    x: 0.03 + randomUnit(index * 2 + 401) * 0.94,
    y: 0.03 + randomUnit(index * 2 + 1201) * 0.94,
    phase: randomUnit(index * 2 + 2001) * Math.PI * 2,
    speed: 0.55 + randomUnit(index * 2 + 2801) * 0.72,
    glyph: index % 17 === 0 ? '+' : index % 7 === 0 ? '*' : '.',
}));

export type SolarParticle = {
    angle: number;
    radius: number;
    inclination: number;
    inclinationCosine: number;
    inclinationSine: number;
    node: number;
    nodeCosine: number;
    nodeSine: number;
    phase: number;
    glyph: '.' | ':' | "'";
};

const createSolarParticle = (
    angle: number,
    radius: number,
    inclination: number,
    node: number,
    phase: number,
    glyph: SolarParticle['glyph'],
): SolarParticle => ({
    angle,
    radius,
    inclination,
    inclinationCosine: Math.cos(inclination),
    inclinationSine: Math.sin(inclination),
    node,
    nodeCosine: Math.cos(node),
    nodeSine: Math.sin(node),
    phase,
    glyph,
});

export const ZODIACAL_DUST: SolarParticle[] = Array.from({ length: 130 }, (_, index) => {
    const inclination = (randomUnit(index + 3101) - 0.5) * 5 * DEG;
    const node = randomUnit(index + 3201) * Math.PI * 2;
    return createSolarParticle(
        randomUnit(index + 2901) * Math.PI * 2,
        3.2 + Math.pow(randomUnit(index + 3001), 1.55) * 14.8,
        inclination,
        node,
        randomUnit(index + 3301),
        '.',
    );
});

export const ASTEROID_BELT: SolarParticle[] = Array.from({ length: 270 }, (_, index) => {
    const inclination = (randomUnit(index + 1401) - 0.5) * 8 * DEG;
    const node = randomUnit(index + 1501) * Math.PI * 2;
    return createSolarParticle(
        randomUnit(index + 1201) * Math.PI * 2,
        // Four overlapping lanes leave narrow low-density regions reminiscent of
        // the belt's resonant gaps without turning them into diagrammatic rings.
        20.05 + (((index % 4) + randomUnit(index + 1301) * 0.76) / 4) * 2.4,
        inclination,
        node,
        randomUnit(index + 1601),
        index % 19 === 0 ? ':' : index % 7 === 0 ? "'" : '.',
    );
});

export const KUIPER_BELT: SolarParticle[] = Array.from({ length: 560 }, (_, index) => {
    const inclination = (randomUnit(index + 3601) + randomUnit(index + 3701) - 1) * 14 * DEG;
    const node = randomUnit(index + 3801) * Math.PI * 2;
    return createSolarParticle(
        randomUnit(index + 3401) * Math.PI * 2,
        43 + Math.pow(randomUnit(index + 3501), 0.82) * 9.5,
        inclination,
        node,
        randomUnit(index + 3901),
        index % 31 === 0 ? ':' : index % 11 === 0 ? "'" : '.',
    );
});

export type TrojanParticle = {
    angleOffset: number;
    radius: number;
    z: number;
    phase: number;
    glyph: '.' | ':';
};

export const JUPITER_TROJANS: TrojanParticle[] = Array.from({ length: 150 }, (_, index) => {
    const side = index % 2 === 0 ? 1 : -1;
    return {
        angleOffset: side * 60 * DEG + (randomUnit(index + 4001) + randomUnit(index + 4101) - 1) * 13 * DEG,
        radius: 24 + (randomUnit(index + 4201) + randomUnit(index + 4301) - 1) * 1.25,
        z: (randomUnit(index + 4401) + randomUnit(index + 4501) - 1) * 0.65,
        phase: randomUnit(index + 4601),
        glyph: index % 17 === 0 ? ':' : '.',
    };
});

export const ORBIT_SAMPLES = 112;
export const ORBIT_POINTS = PLANETS.map((planet) =>
    Array.from({ length: ORBIT_SAMPLES }, (_, sample) => {
        const trueAnomaly = (sample / ORBIT_SAMPLES) * Math.PI * 2;
        const normalizedDistance = (1 - planet.e ** 2) / (1 + planet.e * Math.cos(trueAnomaly));
        return orbitalPoint(planet, trueAnomaly, normalizedDistance);
    }),
);
