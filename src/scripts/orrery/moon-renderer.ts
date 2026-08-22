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
  { longitude: -.82, latitude: .12, width: .34, height: .58 }, // Oceanus Procellarum
  { longitude: -.38, latitude: .48, width: .34, height: .25 }, // Mare Imbrium
  { longitude: .12, latitude: .43, width: .22, height: .18 },  // Mare Serenitatis
  { longitude: .34, latitude: .16, width: .27, height: .22 },  // Mare Tranquillitatis
  { longitude: .67, latitude: -.12, width: .2, height: .25 },  // Mare Fecunditatis
  { longitude: .94, latitude: .32, width: .16, height: .15 },  // Mare Crisium
];

const CRATERS: SurfaceFeature[] = [
  { longitude: -.2, latitude: -.72, width: .095, height: .095 }, // Tycho
  { longitude: -.42, latitude: .06, width: .08, height: .08 },  // Copernicus
  { longitude: -.78, latitude: .15, width: .05, height: .05 },
  { longitude: -.28, latitude: .72, width: .065, height: .055 },
  { longitude: .72, latitude: -.48, width: .055, height: .055 },
];

const wrapLongitude = (longitude: number) => Math.atan2(Math.sin(longitude), Math.cos(longitude));

const featureDistance = (longitude: number, latitude: number, feature: SurfaceFeature) => {
  const longitudeDistance = wrapLongitude(longitude - feature.longitude) * Math.cos(latitude);
  return Math.hypot(longitudeDistance / feature.width, (latitude - feature.latitude) / feature.height);
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
  const characterWidth = context.measureText('M').width * .72;
  const lineHeight = fontSize * .74;
  const spin = focusedRotation('Moon', seconds, reducedMotion) + inspectionLongitude;
  const latitudeCosine = Math.cos(inspectionLatitude);
  const latitudeSine = Math.sin(inspectionLatitude);

  for (let row = 0; row < rows; row++) {
    const normalizedY = (row + .5 - rows / 2) / (rows / 2);
    const lineY = centerY + (row - (rows - 1) / 2) * lineHeight;
    for (let column = 0; column < columns; column++) {
      const normalizedX = (column + .5 - columns / 2) / (columns / 2);
      const diskDistance = normalizedX ** 2 + normalizedY ** 2;
      if (diskDistance > 1) continue;

      const sphereZ = Math.sqrt(Math.max(0, 1 - diskDistance));
      const latitudeY = normalizedY * latitudeCosine + sphereZ * latitudeSine;
      const latitudeZ = -normalizedY * latitudeSine + sphereZ * latitudeCosine;
      const longitude = Math.atan2(normalizedX, latitudeZ) + spin;
      const latitude = Math.asin(-latitudeY);
      const mariaDepth = Math.min(...MARIA.map((feature) => featureDistance(longitude, latitude, feature)));
      const craterDepth = Math.min(...CRATERS.map((feature) => featureDistance(longitude, latitude, feature)));
      const tychoDistance = featureDistance(longitude, latitude, CRATERS[0]);
      const longitudeFromTycho = wrapLongitude(longitude - CRATERS[0].longitude) * Math.cos(latitude);
      const latitudeFromTycho = latitude - CRATERS[0].latitude;
      const rayAngle = Math.atan2(latitudeFromTycho, longitudeFromTycho);
      const rayDistance = Math.hypot(longitudeFromTycho, latitudeFromTycho);
      const ray = rayDistance > .12 && rayDistance < .85 && Math.abs(Math.sin(rayAngle * 7)) < .075;
      const relief = Math.sin(longitude * 13 + latitude * 7)
        + Math.sin(longitude * 5 - latitude * 17) * .45;
      const light = Math.max(0, normalizedX * -.28 + normalizedY * -.2 + sphereZ * .94);
      const limb = sphereZ < .17;

      let glyph = relief > .72 ? ':' : relief < -.78 ? ',' : '.';
      let color = light > .72 ? '#d5c4a1' : light > .38 ? '#bdae93' : '#7c6f64';
      if (mariaDepth < 1) {
        glyph = mariaDepth > .8 ? ':' : relief > .15 ? '~' : '.';
        color = light > .48 ? '#928374' : '#665c54';
      }
      if (ray) {
        glyph = relief > 0 ? ':' : '.';
        color = '#d5c4a1';
      }
      if (craterDepth < 1) {
        glyph = craterDepth > .62 ? 'o' : craterDepth < .22 ? '*' : '.';
        color = craterDepth > .62 || craterDepth < .22 ? '#ebdbb2' : '#665c54';
      }
      if (limb) {
        glyph = Math.abs(normalizedY) > .78 ? (normalizedX * normalizedY > 0 ? '/' : '\\') : '|';
        color = '#d5c4a1';
      }

      context.globalAlpha = reveal * (limb ? .82 : (.34 + sphereZ * .66) * (.34 + light * .66));
      context.fillStyle = color;
      context.fillText(glyph, centerX + (column + .5 - columns / 2) * characterWidth, lineY);
    }
  }
  context.globalAlpha = 1;
}
