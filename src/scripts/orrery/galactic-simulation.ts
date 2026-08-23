import { GALACTIC_CENTER_DISTANCE_KPC, GALACTIC_SCENE_UNITS_PER_KPC } from './galaxy-model';

const TAU = Math.PI * 2;

// Sol takes roughly 230 million years to orbit the Galactic Centre. The
// material model uses a deliberately simple flat rotation curve: orbital
// speed remains approximately constant, so period grows with radius.
export const SOL_GALACTIC_PERIOD_YEARS = 230_000_000;
// Put the arm pattern's corotation radius at Sol for this visualization. This
// keeps the Local Arm and the zoom anchor coherent while material at other
// radii still drifts relative to the pattern.
export const ARM_PATTERN_PERIOD_YEARS = SOL_GALACTIC_PERIOD_YEARS;

export type GalacticPoint = { x: number; y: number };

const normalizedPhase = (turns: number) => (((turns % 1) + 1) % 1) * TAU;

export const galacticPatternPhase = (elapsedYears: number) => normalizedPhase(elapsedYears / ARM_PATTERN_PERIOD_YEARS);

export const galacticMaterialPhase = (x: number, y: number, elapsedYears: number) => {
    const radiusKpc = Math.hypot(x, y) / GALACTIC_SCENE_UNITS_PER_KPC;
    if (radiusKpc < 0.08) return 0;
    const orbitalPeriod = SOL_GALACTIC_PERIOD_YEARS * (radiusKpc / GALACTIC_CENTER_DISTANCE_KPC);
    return normalizedPhase(elapsedYears / orbitalPeriod);
};

// Galactic azimuth increases from +Y toward +X in the coordinate convention
// used by the Milky Way map.
export const rotateGalacticPoint = (x: number, y: number, phase: number, target: GalacticPoint) => {
    const cosine = Math.cos(phase);
    const sine = Math.sin(phase);
    target.x = x * cosine + y * sine;
    target.y = -x * sine + y * cosine;
    return target;
};

export const moveGalacticMaterial = (x: number, y: number, elapsedYears: number, target: GalacticPoint) =>
    rotateGalacticPoint(x, y, galacticMaterialPhase(x, y, elapsedYears), target);
