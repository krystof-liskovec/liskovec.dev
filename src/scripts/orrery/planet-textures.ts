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

// Sample in spherical coordinates so fine terrain stays attached to the body
// and meets continuously at the longitude seam and both poles.
const terrainGrain = (longitude: number, latitude: number) => {
    const x = Math.cos(longitude) * Math.cos(latitude);
    const y = Math.sin(latitude);
    const z = Math.sin(longitude) * Math.cos(latitude);
    return Math.sin(x * 31 + y * 17) * Math.sin(z * 27 - y * 23) + Math.sin(x * 67 - z * 41) * 0.28;
};

const MERCURY_CRATERS = Array.from({ length: 34 }, (_, index) => ({
    longitude: wrapLongitude(index * 2.399963),
    latitude: Math.asin(1 - (2 * (index + 0.5)) / 34),
    radius: 0.045 + ((index * 7) % 11) * 0.009,
}));

const SURFACE_COLORS: Record<string, Record<string, string>> = {
    Mercury: { o: '#928374', O: '#ebdbb2', ':': '#a89984', '.': '#bdae93', '*': '#ebdbb2' },
    Venus: { '=': '#ebdbb2', '~': '#d5c4a1', ':': '#d79921', '.': '#bdae93' },
    Earth: { '#': '#b8bb26', '%': '#d79921', '*': '#ebdbb2', '~': '#d5c4a1', '.': '#83a598', ':': '#458588' },
    Mars: {
        '*': '#ebdbb2',
        '^': '#fabd2f',
        '=': '#9d4935',
        ':': '#d65d0e',
        ',': '#9d4935',
        '.': '#fe8019',
        o: '#d79921',
    },
    // Stylized natural-color palettes, guided by NASA's Juno/Cassini views:
    // https://www.nasa.gov/image-article/jupiters-great-red-spot-true-color/
    // https://science.nasa.gov/resource/jewel-of-the-solar-system/
    Jupiter: {
        '@': '#bf6e50',
        o: '#ce8c65',
        '*': '#eee5d5',
        '=': '#b58d70',
        '-': '#e6d4bd',
        '~': '#c8b59c',
        ':': '#a77e65',
    },
    Saturn: { o: '#c2aa78', '=': '#dfcda3', '-': '#ede0bb', '~': '#d1bd94', ':': '#bca77d', '.': '#e0d1ae' },
    Uranus: { '*': '#c4d6bd', '-': '#a4c4b3', '~': '#83a598', ':': '#689d8c', '.': '#b1c9bb' },
    Neptune: { O: '#45657d', o: '#458588', '*': '#d5c4c1', '=': '#83a598', ':': '#547d9b', '~': '#6696ad' },
    Pluto: { '*': '#ebdbb2', ':': '#bdae93', ',': '#9d6c55', '.': '#d5b69b' },
    // Warm illustrative light; dark umbrae and softer penumbrae remain distinct.
    Sol: {
        '@': '#713b20',
        '%': '#b85e20',
        '*': '#ffd34d',
        '~': '#ffad24',
        ':': '#ed851b',
        '.': '#cf6718',
        o: '#ffc12e',
    },
};

export const planetSurfaceColor = (name: string, glyph: string, fallback: string) =>
    SURFACE_COLORS[name]?.[glyph] ?? fallback;

// Illustrative upper-left illumination, fixed in view space as the globe turns.
export const planetSurfaceLight = (x: number, y: number, z: number) =>
    0.24 + Math.max(0, -x * 0.42 - y * 0.32 + z * 0.85) * 0.64 + z * 0.12;

// An emitting photosphere has radial limb darkening, rather than a day/night side.
export const sunSurfaceLight = (z: number) => 0.42 + z * 0.58;

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
        const surface = EARTH_MAP[mapY][mapX];
        const cloud =
            Math.sin(longitude * 6 + Math.sin(latitude * 7) * 2) + Math.sin(longitude * 11 - latitude * 13) * 0.5;
        if (surface !== '*' && cloud > 1.13 && Math.abs(latitude) < 1.15) return '~';
        return surface === '.' && cloud < -0.65 ? ':' : surface;
    }
    if (name === 'Sol') {
        const spotA = Math.hypot(
            (wrapLongitude(longitude + 0.42) * Math.cos(latitude)) / 0.16,
            (latitude - 0.24) / 0.105,
        );
        const spotB = Math.hypot(
            (wrapLongitude(longitude + 0.16) * Math.cos(latitude)) / 0.085,
            (latitude - 0.19) / 0.065,
        );
        const spotC = Math.hypot(
            (wrapLongitude(longitude - 1.85) * Math.cos(latitude)) / 0.12,
            (latitude + 0.32) / 0.09,
        );
        const spotD = Math.hypot(
            (wrapLongitude(longitude + 2.1) * Math.cos(latitude)) / 0.13,
            (latitude + 0.16) / 0.075,
        );
        const spot = Math.min(spotA, spotB, spotC, spotD);
        if (spot < 0.58) return '@';
        if (spot < 1.15) return '%';
        const x = Math.cos(longitude) * Math.cos(latitude);
        const y = Math.sin(latitude);
        const z = Math.sin(longitude) * Math.cos(latitude);
        const granulation =
            Math.sin(x * 37 + Math.sin(z * 19) * 1.8) * Math.sin(y * 31 - z * 11) +
            terrainGrain(longitude, latitude) * 0.42;
        if (spot < 1.6 && granulation > 0.1) return '*';
        return granulation > 0.62
            ? '*'
            : granulation > 0.15
              ? '~'
              : granulation > -0.25
                ? 'o'
                : granulation > -0.65
                  ? ':'
                  : '.';
    }
    if (name === 'Jupiter') {
        const stormX = wrapLongitude(longitude - 0.44) / 0.36;
        const stormY = (latitude + 0.33) / 0.16;
        const stormRadius = Math.hypot(stormX, stormY);
        if (stormRadius < 1) return stormRadius < 0.55 ? '@' : 'o';
        const eddy = Math.sin(longitude * 9 + Math.sin(latitude * 13)) * 0.026;
        const band = Math.sin((latitude + eddy) * 22 + Math.sin(longitude * 4) * 0.24);
        if (band > 0.6) return '=';
        if (band < -0.5) return '-';
        const turbulence = Math.sin(longitude * 17 + latitude * 29 + Math.sin(longitude * 7));
        if (latitude < -0.45 && latitude > -0.65 && turbulence > 0.88) return '*';
        return turbulence > 0.15 ? '~' : ':';
    }
    if (name === 'Saturn') {
        if (latitude > 1.08) {
            const hexagonSector = Math.floor((wrappedLongitude + Math.PI) / (Math.PI / 3));
            return hexagonSector % 2 ? ':' : '=';
        }
        if (latitude > 0.18 && latitude < 0.34 && wrappedLongitude > 0.35 && wrappedLongitude < 0.7) return 'o';
        const band = Math.sin(latitude * 26 + Math.sin(longitude * 5) * 0.22);
        if (Math.abs(latitude) < 0.12) return '-';
        return band > 0.55 ? '=' : band < -0.5 ? ':' : band > 0 ? '~' : '.';
    }
    if (name === 'Venus') {
        const cloud =
            Math.sin(longitude * 3 + Math.abs(latitude) * 8 + Math.sin(longitude * 5) * 0.5) +
            Math.sin(longitude * 7 - latitude * 11) * 0.25;
        return cloud > 0.55 ? '=' : cloud < -0.55 ? ':' : '~';
    }
    if (name === 'Mars') {
        const grain = terrainGrain(longitude, latitude);
        if (Math.abs(latitude) > 1.22 + Math.sin(longitude * 7) * 0.045) return '*';
        if (insideFeature(longitude, latitude, -2.34, 0.33, 0.13)) return '^';
        const canyonLatitude = -0.16 + Math.sin(longitude * 3) * 0.035;
        if (wrappedLongitude > -1.5 && wrappedLongitude < -0.45 && Math.abs(latitude - canyonLatitude) < 0.038)
            return '=';
        if (
            insideFeature(longitude, latitude, -0.7, 0.15, 0.18) ||
            insideFeature(longitude, latitude, 1.3, -0.35, 0.12)
        )
            return 'o';
        return broadWave + grain * 0.35 > 0.55 ? ':' : broadWave + grain * 0.25 < -0.7 ? ',' : grain > 0.8 ? 'o' : '.';
    }
    if (name === 'Mercury') {
        for (const crater of MERCURY_CRATERS) {
            const distance =
                Math.hypot(
                    wrapLongitude(longitude - crater.longitude) * Math.cos(latitude),
                    latitude - crater.latitude,
                ) / crater.radius;
            if (distance < 0.68) return 'o';
            if (distance < 1) return 'O';
        }
        const grain = terrainGrain(longitude, latitude);
        return grain > 0.72 ? '*' : grain < -0.2 ? ':' : '.';
    }
    if (name === 'Moon') {
        const craters = [
            [-0.9, 0.35, 0.2],
            [0.55, -0.15, 0.14],
            [1.8, 0.5, 0.1],
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
        if (latitude > 0.85 + Math.sin(longitude * 4) * 0.025) return '*';
        const band = Math.sin(latitude * 18 + Math.sin(longitude * 3) * 0.1);
        return band > 0.7 ? '-' : band < -0.72 ? ':' : broadWave > 0.8 ? '.' : '~';
    }
    if (name === 'Neptune') {
        const storm = Math.hypot(wrapLongitude(longitude + 0.56) / 0.3, (latitude - 0.23) / 0.14);
        if (storm < 1) return storm < 0.66 ? 'O' : 'o';
        const cloud = Math.sin(longitude * 12 + latitude * 19);
        if (latitude > 0.4 && latitude < 0.49 && cloud > 0.3) return '*';
        const band = Math.sin(latitude * 20 + Math.sin(longitude * 6) * 0.3);
        return band > 0.65 ? '=' : band < -0.25 ? ':' : '~';
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
