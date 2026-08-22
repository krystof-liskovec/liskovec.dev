import { DEG } from './math';

export const GALACTIC_CENTER_DISTANCE_KPC = 8.15;
export const GALACTIC_SCENE_UNITS_PER_KPC = 0.58 / GALACTIC_CENTER_DISTANCE_KPC;
export const GALACTIC_BAR_BETA = 27 * DEG;
export const GALACTIC_BAR_HALF_LENGTH_KPC = 4.6;

// Continuing the fitted logarithmic arms to these azimuths brings them onto
// the two sides of the 27° Galactic bar. They describe the uncertain inner
// continuation, not an additional measured section of each arm.
const NEGATIVE_BAR_ATTACHMENT_BETA = GALACTIC_BAR_BETA + Math.PI;
const POSITIVE_BAR_ATTACHMENT_BETA = GALACTIC_BAR_BETA + Math.PI * 2;

export type GalacticPoint = { x: number; y: number };
export type GalacticScenePoint = GalacticPoint & { z: number };

export type NamedGalacticArm = {
    name: 'Norma–Outer' | 'Scutum–Centaurus' | 'Sagittarius–Carina' | 'Perseus' | 'Local';
    betaMin: number;
    betaMax: number;
    kinkBeta: number;
    kinkRadius: number;
    pitchBefore: number;
    pitchAfter: number;
    width: number;
    radiusAtBeta?: (beta: number) => number;
    pitchAtBeta?: (beta: number) => number;
};

const fittedRadius = (beta: number, anchorBeta: number, anchorRadius: number, pitch: number) =>
    anchorRadius * Math.exp(-(beta - anchorBeta) * Math.tan(pitch));

const kinkedRadius = (arm: NamedGalacticArm, beta: number) =>
    fittedRadius(beta, arm.kinkBeta, arm.kinkRadius, beta <= arm.kinkBeta ? arm.pitchBefore : arm.pitchAfter);

const SAGITTARIUS_OBSERVED_END = 97 * DEG;
const sagittariusCarinaPitch = (beta: number) =>
    beta <= 24 * DEG ? 17.1 * DEG : beta <= 97 * DEG ? 1 * DEG : 10 * DEG;
const sagittariusCarinaRadius = (beta: number) => {
    const kinkBeta = 24 * DEG;
    const kinkRadius = 6.04;
    if (beta <= kinkBeta) return fittedRadius(beta, kinkBeta, kinkRadius, 17.1 * DEG);
    if (beta <= SAGITTARIUS_OBSERVED_END) return fittedRadius(beta, kinkBeta, kinkRadius, 1 * DEG);

    // Reid et al. continue the unmeasured far-side section at about 10° so it
    // reaches the Galactic bar instead of remaining an implausible circle.
    const radiusAtObservedEnd = fittedRadius(SAGITTARIUS_OBSERVED_END, kinkBeta, kinkRadius, 1 * DEG);
    return fittedRadius(beta, SAGITTARIUS_OBSERVED_END, radiusAtObservedEnd, 10 * DEG);
};

// The fitted Norma and Outer segments are separated by one winding and are
// treated as one of the four major arm families in the BeSSeL model. A 9.1°
// continuation joins their measured radii without inventing a local bend.
const normaOuterRadius = (beta: number) => fittedRadius(beta, 18 * DEG, 4.46, 9.1 * DEG);

export const MAJOR_GALACTIC_ARMS: NamedGalacticArm[] = [
    {
        name: 'Norma–Outer',
        betaMin: -342 * DEG,
        betaMax: NEGATIVE_BAR_ATTACHMENT_BETA,
        kinkBeta: 18 * DEG,
        kinkRadius: 4.46,
        pitchBefore: 9.1 * DEG,
        pitchAfter: 9.1 * DEG,
        width: 0.14,
        radiusAtBeta: normaOuterRadius,
    },
    {
        name: 'Scutum–Centaurus',
        betaMin: -230 * DEG,
        betaMax: NEGATIVE_BAR_ATTACHMENT_BETA,
        kinkBeta: 23 * DEG,
        kinkRadius: 4.91,
        pitchBefore: 14.1 * DEG,
        pitchAfter: 12.1 * DEG,
        width: 0.23,
    },
    {
        name: 'Sagittarius–Carina',
        betaMin: -120 * DEG,
        betaMax: POSITIVE_BAR_ATTACHMENT_BETA,
        kinkBeta: 24 * DEG,
        kinkRadius: 6.04,
        pitchBefore: 17.1 * DEG,
        pitchAfter: 1 * DEG,
        width: 0.27,
        radiusAtBeta: sagittariusCarinaRadius,
        pitchAtBeta: sagittariusCarinaPitch,
    },
    {
        name: 'Perseus',
        betaMin: -23 * DEG,
        betaMax: POSITIVE_BAR_ATTACHMENT_BETA,
        kinkBeta: 40 * DEG,
        kinkRadius: 8.87,
        pitchBefore: 10.3 * DEG,
        pitchAfter: 8.7 * DEG,
        width: 0.35,
    },
];

export const LOCAL_GALACTIC_ARM: NamedGalacticArm = {
    name: 'Local',
    betaMin: -8 * DEG,
    betaMax: 34 * DEG,
    kinkBeta: 9 * DEG,
    kinkRadius: 8.26,
    pitchBefore: 11.4 * DEG,
    pitchAfter: 11.4 * DEG,
    width: 0.31,
};

export const GALACTIC_SOL = {
    x: 0,
    y: GALACTIC_CENTER_DISTANCE_KPC * GALACTIC_SCENE_UNITS_PER_KPC,
};

export const galacticArmRadius = (arm: NamedGalacticArm, beta: number) =>
    arm.radiusAtBeta ? arm.radiusAtBeta(beta) : kinkedRadius(arm, beta);

export const galacticArmPitch = (arm: NamedGalacticArm, beta: number) =>
    arm.pitchAtBeta ? arm.pitchAtBeta(beta) : beta <= arm.kinkBeta ? arm.pitchBefore : arm.pitchAfter;

export const galacticArmWidth = (arm: NamedGalacticArm, radius: number) =>
    Math.max(0.12, arm.width + 0.036 * (radius - arm.kinkRadius));

export const galacticArmPoint = (
    arm: NamedGalacticArm,
    beta: number,
    crossArmOffsetKpc = 0,
    target: GalacticPoint = { x: 0, y: 0 },
) => {
    const radius = galacticArmRadius(arm, beta);
    const pitch = galacticArmPitch(arm, beta);
    const radialDerivative = -radius * Math.tan(pitch);
    const centerX = Math.sin(beta) * radius;
    const centerY = Math.cos(beta) * radius;
    const tangentX = Math.sin(beta) * radialDerivative + Math.cos(beta) * radius;
    const tangentY = Math.cos(beta) * radialDerivative - Math.sin(beta) * radius;
    const tangentLength = Math.hypot(tangentX, tangentY);
    const normalX = -tangentY / tangentLength;
    const normalY = tangentX / tangentLength;

    target.x = (centerX + normalX * crossArmOffsetKpc) * GALACTIC_SCENE_UNITS_PER_KPC;
    target.y = (centerY + normalY * crossArmOffsetKpc) * GALACTIC_SCENE_UNITS_PER_KPC;
    return target;
};

export const galacticPositionFromSun = (
    longitude: number,
    latitude: number,
    distanceKpc: number,
    target: GalacticScenePoint = { x: 0, y: 0, z: 0 },
) => {
    const longitudeRadians = longitude * DEG;
    const latitudeRadians = latitude * DEG;
    const planarDistance = distanceKpc * Math.cos(latitudeRadians);

    // Reid et al. place the Sun at (0, R0), with positive Galactic azimuth
    // increasing toward l=90° in the direction of Galactic rotation.
    target.x = planarDistance * Math.sin(longitudeRadians) * GALACTIC_SCENE_UNITS_PER_KPC;
    target.y =
        (GALACTIC_CENTER_DISTANCE_KPC - planarDistance * Math.cos(longitudeRadians)) * GALACTIC_SCENE_UNITS_PER_KPC;
    target.z = distanceKpc * Math.sin(latitudeRadians) * GALACTIC_SCENE_UNITS_PER_KPC;
    return target;
};
