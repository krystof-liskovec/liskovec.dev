import { focusedRotation } from './planet-textures';

type MoonRenderOptions = {
    centerX: number;
    centerY: number;
    scale: number;
    reveal: number;
    longitude: number;
    latitude: number;
    seconds: number;
    reducedMotion: boolean;
    compact: boolean;
};

type SurfaceFeature = {
    longitude: number;
    latitude: number;
    width: number;
    height: number;
};

const MARIA: SurfaceFeature[] = [
    { longitude: -0.82, latitude: 0.12, width: 0.34, height: 0.58 }, // Oceanus Procellarum
    { longitude: -0.38, latitude: 0.48, width: 0.34, height: 0.25 }, // Mare Imbrium
    { longitude: 0.12, latitude: 0.43, width: 0.22, height: 0.18 }, // Mare Serenitatis
    { longitude: 0.34, latitude: 0.16, width: 0.27, height: 0.22 }, // Mare Tranquillitatis
    { longitude: 0.67, latitude: -0.12, width: 0.2, height: 0.25 }, // Mare Fecunditatis
    { longitude: 0.94, latitude: 0.32, width: 0.16, height: 0.15 }, // Mare Crisium
];

const CRATERS: SurfaceFeature[] = [
    { longitude: -0.2, latitude: -0.72, width: 0.095, height: 0.095 }, // Tycho
    { longitude: -0.42, latitude: 0.06, width: 0.08, height: 0.08 }, // Copernicus
    { longitude: -0.78, latitude: 0.15, width: 0.05, height: 0.05 },
    { longitude: -0.28, latitude: 0.72, width: 0.065, height: 0.055 },
    { longitude: 0.72, latitude: -0.48, width: 0.055, height: 0.055 },
];

const wrapLongitude = (longitude: number) => Math.atan2(Math.sin(longitude), Math.cos(longitude));

const featureDistance = (longitude: number, latitude: number, feature: SurfaceFeature) => {
    const longitudeDistance = wrapLongitude(longitude - feature.longitude) * Math.cos(latitude);
    return Math.hypot(longitudeDistance / feature.width, (latitude - feature.latitude) / feature.height);
};

const minimumFeatureDistance = (longitude: number, latitude: number, features: SurfaceFeature[]) => {
    let minimum = Infinity;
    for (const feature of features) minimum = Math.min(minimum, featureDistance(longitude, latitude, feature));
    return minimum;
};

export function drawFocusedMoon(context: CanvasRenderingContext2D, options: MoonRenderOptions) {
    const {
        centerX,
        centerY,
        scale,
        reveal,
        longitude: inspectionLongitude,
        latitude: inspectionLatitude,
        seconds,
        reducedMotion,
        compact,
    } = options;
    const columns = compact ? 39 : 53;
    const rows = compact ? 21 : 29;
    const fontSize = (compact ? 9.6 : 11.8) * scale;
    context.font = `bold ${fontSize}px "DM Mono", monospace`;
    const characterWidth = context.measureText('M').width * 0.72;
    const lineHeight = fontSize * 0.74;
    const spin = focusedRotation('Moon', seconds, reducedMotion) + inspectionLongitude;
    const latitudeCosine = Math.cos(inspectionLatitude);
    const latitudeSine = Math.sin(inspectionLatitude);

    for (let row = 0; row < rows; row++) {
        const normalizedY = (row + 0.5 - rows / 2) / (rows / 2);
        const lineY = centerY + (row - (rows - 1) / 2) * lineHeight;
        for (let column = 0; column < columns; column++) {
            const normalizedX = (column + 0.5 - columns / 2) / (columns / 2);
            const diskDistance = normalizedX ** 2 + normalizedY ** 2;
            if (diskDistance > 1) continue;

            const sphereZ = Math.sqrt(Math.max(0, 1 - diskDistance));
            const latitudeY = normalizedY * latitudeCosine + sphereZ * latitudeSine;
            const latitudeZ = -normalizedY * latitudeSine + sphereZ * latitudeCosine;
            const longitude = Math.atan2(normalizedX, latitudeZ) + spin;
            const latitude = Math.asin(-latitudeY);
            const mariaDepth = minimumFeatureDistance(longitude, latitude, MARIA);
            const craterDepth = minimumFeatureDistance(longitude, latitude, CRATERS);
            const longitudeFromTycho = wrapLongitude(longitude - CRATERS[0].longitude) * Math.cos(latitude);
            const latitudeFromTycho = latitude - CRATERS[0].latitude;
            const rayAngle = Math.atan2(latitudeFromTycho, longitudeFromTycho);
            const rayDistance = Math.hypot(longitudeFromTycho, latitudeFromTycho);
            const ray = rayDistance > 0.12 && rayDistance < 0.85 && Math.abs(Math.sin(rayAngle * 7)) < 0.075;
            const relief = Math.sin(longitude * 13 + latitude * 7) + Math.sin(longitude * 5 - latitude * 17) * 0.45;
            const light = Math.max(0, normalizedX * -0.28 + normalizedY * -0.2 + sphereZ * 0.94);
            const limb = sphereZ < 0.17;

            let glyph = relief > 0.72 ? ':' : relief < -0.78 ? ',' : '.';
            let color = light > 0.72 ? '#d5c4a1' : light > 0.38 ? '#bdae93' : '#7c6f64';
            if (mariaDepth < 1) {
                glyph = mariaDepth > 0.8 ? ':' : relief > 0.15 ? '~' : '.';
                color = light > 0.48 ? '#928374' : '#665c54';
            }
            if (ray) {
                glyph = relief > 0 ? ':' : '.';
                color = '#d5c4a1';
            }
            if (craterDepth < 1) {
                glyph = craterDepth > 0.62 ? 'o' : craterDepth < 0.22 ? '*' : '.';
                color = craterDepth > 0.62 || craterDepth < 0.22 ? '#ebdbb2' : '#665c54';
            }
            if (limb) {
                glyph = Math.abs(normalizedY) > 0.78 ? (normalizedX * normalizedY > 0 ? '/' : '\\') : '|';
                color = '#d5c4a1';
            }

            context.globalAlpha = reveal * (limb ? 0.82 : (0.34 + sphereZ * 0.66) * (0.34 + light * 0.66));
            context.fillStyle = color;
            context.fillText(glyph, centerX + (column + 0.5 - columns / 2) * characterWidth, lineY);
        }
    }
    context.globalAlpha = 1;
}
