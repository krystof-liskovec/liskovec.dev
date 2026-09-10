export type GalacticSurfaceTexture = {
    glyph: string;
    color: string;
};

const wrapLongitude = (longitude: number) => Math.atan2(Math.sin(longitude), Math.cos(longitude));

const baseWave = (longitude: number, latitude: number) =>
    Math.sin(longitude * 2.4 + latitude * 1.7) + Math.sin(longitude * 0.8 - latitude * 3.1) * 0.45;

const texture = (glyph: string, color: string): GalacticSurfaceTexture => ({ glyph, color });

export const galacticSurfaceTexture = (
    name: string,
    longitude: number,
    latitude: number,
    baseColor: string,
): GalacticSurfaceTexture => {
    const wrappedLongitude = wrapLongitude(longitude);
    const wave = baseWave(longitude, latitude);

    if (name === 'Sagittarius A*') {
        const turbulence =
            Math.sin(longitude * 7.5 + latitude * 3.2) + Math.sin(longitude * 2.7 - latitude * 9.4) * 0.42;
        if (turbulence > 0.95) return texture('=', '#fabd2f');
        if (turbulence < -0.72) return texture('.', '#d79921');
        return texture(turbulence > 0.2 ? '~' : ':', turbulence > 0.2 ? '#fe8019' : '#d65d0e');
    }

    if (name === 'Cygnus X-1') {
        const disk = Math.sin(latitude * 13 + longitude * 2.2) + Math.sin(longitude * 5.4) * 0.34;
        if (disk > 0.78) return texture('=', '#fabd2f');
        if (disk < -0.58) return texture(':', '#458588');
        return texture(disk > 0.12 ? '~' : '.', disk > 0.12 ? '#83a598' : '#b8bb26');
    }

    if (name === 'Crab Nebula') {
        const filament = Math.sin(longitude * 5.5 + latitude * 7.2) + Math.sin(longitude * 11 - latitude * 2) * 0.3;
        if (Math.abs(Math.sin(longitude * 3.5 - latitude * 4.6)) < 0.13) return texture('/', '#fb4934');
        if (filament > 0.72) return texture('*', '#fb4934');
        return texture(filament < -0.55 ? '.' : ':', filament < -0.55 ? '#d3869b' : '#fe8019');
    }

    if (name === 'Eta Carinae') {
        const lobe = Math.sin(longitude * 4.4) + Math.sin(latitude * 5.2 + longitude) * 0.35;
        if (Math.abs(latitude) > 0.62 && lobe > -0.4) return texture('|', '#83a598');
        if (lobe > 0.72) return texture('*', '#fabd2f');
        return texture(lobe < -0.5 ? ':' : '~', lobe < -0.5 ? '#d79921' : '#fabd2f');
    }

    if (name === 'Cassiopeia A') {
        const shell = Math.abs(Math.sin(longitude * 5.2 + latitude * 2.1));
        if (shell > 0.82) return texture('*', '#fb4934');
        return texture(shell < 0.25 ? '.' : ':', shell < 0.25 ? '#d65d0e' : '#fe8019');
    }

    if (name === 'Omega Centauri') {
        const density =
            Math.sin(longitude * 8.3 + latitude * 1.8) +
            Math.sin(longitude * 15.1 - latitude * 4.4) * 0.48 +
            Math.cos(latitude * 5.6) * 0.18;
        if (density > 0.86) return texture('*', '#ebdbb2');
        if (density > 0.2) return texture('o', '#fabd2f');
        return texture(density < -0.55 ? '.' : ':', density < -0.55 ? '#bdae93' : '#d5c4a1');
    }

    if (name === 'PSR B1509-58') {
        const beam = Math.abs(Math.sin(longitude * 4.2 + latitude * 2.1));
        if (beam < 0.13) return texture('|', '#83a598');
        return texture(wave > 0.6 ? '*' : wave < -0.45 ? '.' : '~', wave > 0.6 ? '#b8bb26' : '#83a598');
    }

    if (Math.abs(wrappedLongitude) < 0.5 && wave > 0.5) return texture(':', baseColor);
    return texture(wave > 0 ? '.' : ':', baseColor);
};
