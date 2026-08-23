import { EARTH_MAP, EARTH_MAP_HEIGHT, EARTH_MAP_WIDTH } from './earth-map';

const DECORATIVE_ROTATION_SPEEDS: Record<string, number> = {
    Mercury: 0.011,
    Venus: -0.008,
    Earth: 0.055,
    Mars: 0.026,
    Jupiter: 0.068,
    Saturn: 0.058,
    Uranus: -0.018,
    Neptune: 0.038,
    Pluto: 0.009,
    Moon: 0.018,
    Io: 0.07,
    Europa: 0.036,
    Ganymede: 0.023,
    Callisto: 0.012,
    Enceladus: 0.052,
    Rhea: 0.026,
    Titan: 0.016,
    Iapetus: 0.009,
    Phobos: 0.11,
    Deimos: 0.045,
    Triton: -0.02,
    Charon: 0.009,
    Styx: 0.041,
    Nix: 0.034,
    Kerberos: 0.029,
    Hydra: 0.026,
    Titania: 0.018,
    Oberon: 0.013,
    Sol: 0.024,
};

// Approximate sidereal rotation periods in hours. Negative values preserve
// retrograde rotation. Tidally locked major moons use their orbital periods;
// Pluto's smaller moons use measured rotation periods from its fact sheet.
const SIDEREAL_ROTATION_HOURS: Record<string, number> = {
    Mercury: 1_407.6,
    Venus: -5_832.5,
    Earth: 23.9345,
    Mars: 24.6229,
    Jupiter: 9.925,
    Saturn: 10.656,
    Uranus: -17.24,
    Neptune: 16.11,
    Pluto: -153.2928,
    Moon: 655.7199,
    Io: 42.456,
    Europa: 85.224,
    Ganymede: 171.72,
    Callisto: 400.536,
    Enceladus: 32.88,
    Rhea: 108.48,
    Titan: 382.68,
    Iapetus: 1_903.92,
    Phobos: 7.65,
    Deimos: 30.3,
    Triton: -141.04,
    Charon: -153.2928,
    Styx: 77.76,
    Nix: 43.92,
    Kerberos: 127.44,
    Hydra: 10.32,
    Titania: 208.94,
    Oberon: 323.12,
    Sol: 609.12,
};

const wrapLongitude = (longitude: number) => Math.atan2(Math.sin(longitude), Math.cos(longitude));

const insideFeature = (
    longitude: number,
    latitude: number,
    centerLongitude: number,
    centerLatitude: number,
    radius: number,
) => {
    const longitudeDistance = wrapLongitude(longitude - centerLongitude) * Math.cos(latitude);
    return Math.hypot(longitudeDistance, latitude - centerLatitude) < radius;
};

export function decorativeRotation(name: string, seconds: number, reducedMotion: boolean) {
    return reducedMotion ? 0 : seconds * (DECORATIVE_ROTATION_SPEEDS[name] ?? 0.02);
}

export function focusedRotation(name: string, elapsedHours: number, reducedMotion: boolean) {
    if (reducedMotion) return 0;
    const periodHours = SIDEREAL_ROTATION_HOURS[name];
    return periodHours ? (elapsedHours / periodHours) * Math.PI * 2 : 0;
}

export function planetSurfaceGlyph(name: string, longitude: number, latitude: number) {
    const wrappedLongitude = wrapLongitude(longitude);
    const broadWave = Math.sin(longitude * 2.4 + latitude * 1.7) + Math.sin(longitude * 0.8 - latitude * 3.1) * 0.45;

    if (name === 'Earth') {
        const mapX = Math.floor(((((longitude / (Math.PI * 2) + 0.5) % 1) + 1) % 1) * EARTH_MAP_WIDTH);
        const mapY = Math.max(
            0,
            Math.min(EARTH_MAP_HEIGHT - 1, Math.floor((0.5 - latitude / Math.PI) * EARTH_MAP_HEIGHT)),
        );
        return EARTH_MAP[mapY][mapX];
    }
    if (name === 'Sol') {
        const granulation =
            Math.sin(longitude * 11 + Math.sin(latitude * 7) * 2.3) +
            Math.sin(latitude * 13 - longitude * 4.1) * 0.62 +
            Math.sin((longitude + latitude) * 19) * 0.28;
        const activity =
            Math.sin(longitude * 1.7 + latitude * 2.8) + Math.sin(latitude * 3.9 - longitude * 0.65) * 0.72;
        const turbulentSpot = (activity > 1.18 && granulation < 0.45) || (activity < -1.32 && granulation > -0.25);
        if (turbulentSpot) return granulation > 0.38 || granulation < -0.78 ? '@' : ':';
        return granulation > 1.02
            ? '*'
            : granulation > 0.28
              ? '~'
              : granulation > -0.28
                ? 'o'
                : granulation > -0.9
                  ? ':'
                  : '.';
    }
    if (name === 'Jupiter') {
        if (latitude > -0.48 && latitude < -0.18 && wrappedLongitude > 0.1 && wrappedLongitude < 0.78) {
            return wrappedLongitude > 0.28 && wrappedLongitude < 0.62 ? '@' : 'o';
        }
        const band = Math.floor((latitude + Math.PI / 2) * 11);
        return band % 4 === 0 ? '=' : band % 4 === 2 ? '-' : broadWave > 0.2 ? '~' : ':';
    }
    if (name === 'Saturn') {
        if (latitude > 1.08) {
            const hexagonSector = Math.floor((wrappedLongitude + Math.PI) / (Math.PI / 3));
            return hexagonSector % 2 ? ':' : '=';
        }
        if (latitude > 0.18 && latitude < 0.34 && wrappedLongitude > 0.35 && wrappedLongitude < 0.7) return 'o';
        const band = Math.floor((latitude + Math.PI / 2) * 10);
        const cloudWave = Math.sin(longitude * 3 + latitude * 2.4);
        if (band % 4 === 0) return cloudWave > 0.45 ? '~' : '=';
        if (band % 2) return cloudWave < -0.5 ? '.' : ':';
        return cloudWave > 0.55 ? ':' : '~';
    }
    if (name === 'Venus') {
        const cloud = Math.sin(longitude * 3 + latitude * 5) + Math.sin(longitude - latitude * 7) * 0.35;
        return cloud > 0.55 ? '=' : cloud < -0.55 ? ':' : '~';
    }
    if (name === 'Mars') {
        if (Math.abs(latitude) > 1.12) return '*';
        if (insideFeature(longitude, latitude, -2.34, 0.33, 0.13)) return '^';
        if (
            insideFeature(longitude, latitude, -0.7, 0.15, 0.18) ||
            insideFeature(longitude, latitude, 1.3, -0.35, 0.12)
        )
            return 'o';
        return broadWave > 0.55 ? ':' : broadWave < -0.7 ? ',' : '.';
    }
    if (name === 'Mercury' || name === 'Moon') {
        const craters =
            name === 'Moon'
                ? [
                      [-0.9, 0.35, 0.2],
                      [0.55, -0.15, 0.14],
                      [1.8, 0.5, 0.1],
                  ]
                : [
                      [-0.6, 0.2, 0.16],
                      [1.2, -0.4, 0.12],
                      [2.2, 0.45, 0.09],
                  ];
        if (
            craters.some(([featureLongitude, featureLatitude, radius]) =>
                insideFeature(longitude, latitude, featureLongitude, featureLatitude, radius),
            )
        )
            return 'o';
        return broadWave > 0.45 ? ':' : '.';
    }
    if (name === 'Io') {
        if (insideFeature(longitude, latitude, -0.8, 0.25, 0.14) || insideFeature(longitude, latitude, 1.45, -0.3, 0.1))
            return '@';
        return broadWave > 0.55 ? '*' : broadWave < -0.45 ? ':' : 'o';
    }
    if (name === 'Europa') {
        const fracture = Math.sin(longitude * 4 + latitude * 7);
        return Math.abs(fracture) < 0.14 ? '/' : broadWave > 0.5 ? ':' : '.';
    }
    if (name === 'Ganymede') {
        if (insideFeature(longitude, latitude, 0.7, -0.15, 0.17)) return 'o';
        return broadWave > 0.45 ? '=' : broadWave < -0.5 ? ':' : '~';
    }
    if (name === 'Callisto') {
        const crater =
            insideFeature(longitude, latitude, -0.9, 0.35, 0.16) ||
            insideFeature(longitude, latitude, 0.45, -0.4, 0.12) ||
            insideFeature(longitude, latitude, 1.8, 0.2, 0.1);
        return crater ? 'O' : broadWave > 0.3 ? ':' : '.';
    }
    if (name === 'Enceladus') {
        const fracture = Math.sin(longitude * 5 + latitude * 9);
        return Math.abs(fracture) < 0.12 ? '/' : Math.abs(latitude) > 1.08 ? '*' : broadWave > 0.4 ? ':' : '.';
    }
    if (name === 'Rhea') {
        const crater =
            insideFeature(longitude, latitude, -0.65, 0.28, 0.16) ||
            insideFeature(longitude, latitude, 1.5, -0.35, 0.11);
        return crater ? 'o' : broadWave > 0.45 ? ':' : '.';
    }
    if (name === 'Titan') {
        const hazeBand = Math.sin(latitude * 7 + longitude * 0.65);
        if (insideFeature(longitude, latitude, 0.8, -0.72, 0.14)) return 'o';
        return hazeBand > 0.35 ? '~' : hazeBand < -0.45 ? ':' : '=';
    }
    if (name === 'Iapetus') {
        const darkHemisphere = Math.cos(wrappedLongitude) > 0.08;
        if (Math.abs(latitude) < 0.08) return '-';
        return darkHemisphere ? (broadWave > 0.25 ? '#' : ':') : broadWave > 0.4 ? ':' : '.';
    }
    if (name === 'Uranus') {
        if (Math.abs(latitude) > 1.12) return ':';
        const band = Math.floor((latitude + Math.PI / 2) * 10);
        return band % 4 === 0 ? '-' : broadWave > 0.8 ? '.' : '~';
    }
    if (name === 'Neptune') {
        if (latitude > 0.08 && latitude < 0.38 && wrappedLongitude > -0.85 && wrappedLongitude < -0.28) {
            return wrappedLongitude > -0.7 && wrappedLongitude < -0.42 ? 'O' : 'o';
        }
        const band = Math.floor((latitude + Math.PI / 2) * 9);
        return band % 4 === 1 ? '=' : broadWave > 0.75 ? ':' : '~';
    }
    if (name === 'Phobos' || name === 'Deimos') {
        const crater =
            insideFeature(longitude, latitude, -0.7, 0.24, name === 'Phobos' ? 0.24 : 0.17) ||
            insideFeature(longitude, latitude, 1.35, -0.32, 0.12);
        return crater ? 'O' : broadWave > 0.35 ? ':' : '.';
    }
    if (name === 'Triton') {
        if (latitude < -0.82) return '*';
        const cantaloupeTerrain = Math.sin(longitude * 5 + latitude * 4);
        return cantaloupeTerrain > 0.52 ? '=' : cantaloupeTerrain < -0.55 ? ':' : '~';
    }
    if (name === 'Charon') {
        if (latitude > 0.82) return '@';
        if (insideFeature(longitude, latitude, 0.75, -0.12, 0.15)) return 'O';
        return broadWave > 0.4 ? ':' : '.';
    }
    if (name === 'Titania' || name === 'Oberon') {
        const canyon = Math.sin(longitude * 4.5 + latitude * 6.5);
        if (insideFeature(longitude, latitude, name === 'Titania' ? -0.7 : 0.9, -0.2, 0.15)) return 'O';
        return Math.abs(canyon) < 0.12 ? '/' : broadWave > 0.4 ? ':' : '.';
    }
    if (name === 'Styx' || name === 'Nix' || name === 'Kerberos' || name === 'Hydra') {
        return broadWave > 0.42 ? ':' : broadWave < -0.58 ? ',' : '.';
    }
    if (name === 'Pluto') {
        const heartLobes =
            insideFeature(longitude, latitude, -0.46, 0.18, 0.22) ||
            insideFeature(longitude, latitude, -0.08, 0.18, 0.22);
        const heartPoint =
            latitude < 0.2 && latitude > -0.42 && Math.abs(wrapLongitude(longitude + 0.27)) < 0.3 + latitude * 0.45;
        if (heartLobes || heartPoint) return '*';
        return broadWave > 0.4 ? ':' : broadWave < -0.55 ? ',' : '.';
    }
    return broadWave > 0 ? ':' : '.';
}
