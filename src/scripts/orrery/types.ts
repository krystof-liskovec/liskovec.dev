export type Vec3 = { x: number; y: number; z: number };

export type Planet = {
    name: string;
    kind: string;
    detail: string;
    fact: string;
    a: number;
    e: number;
    meanLongitude: number;
    perihelion: number;
    longitudeRate: number;
    inclination: number;
    node: number;
    displayRadius: number;
    glyph: string;
    sprite: string[];
    color: string;
    size: number;
    easterEgg?: boolean;
};

export type GalacticObject = {
    name: string;
    kind: string;
    galacticLongitude: number;
    galacticLatitude: number;
    heliocentricDistanceKpc: number;
    glyph: string;
    sprite: string[];
    color: string;
    distance: string;
    detail: string;
    fact: string;
};

export type FocusTarget = {
    id: string;
    name: string;
    kind: 'star' | 'planet' | 'moon' | 'station' | 'galactic';
    color: string;
    subtitle: string;
    detail: string;
    fact?: string;
    originX: number;
    originY: number;
};

export type FocusState = {
    target: FocusTarget | null;
    progress: number;
    exiting: boolean;
    child: FocusTarget | null;
    childProgress: number;
    childExiting: boolean;
    longitude: number;
    latitude: number;
    childLongitude: number;
    childLatitude: number;
    resetLongitude: number;
    resetLatitude: number;
    resetting: boolean;
    resetStartedAt: number;
};

export type ProjectedBody = {
    planet: Planet;
    world: Vec3;
    reveal: number;
    position: { longitude: number; latitude: number; distance: number };
    x: number;
    y: number;
    z: number;
    scale: number;
};
