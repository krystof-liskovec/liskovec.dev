import { EARTH_MAP, EARTH_MAP_HEIGHT, EARTH_MAP_WIDTH } from './earth-map';

const ROTATION_SPEEDS: Record<string, number> = {
  Mercury: .011,
  Venus: -.008,
  Earth: .055,
  Mars: .026,
  Jupiter: .068,
  Saturn: .058,
  Uranus: -.018,
  Neptune: .038,
  Pluto: .009,
  Moon: .018,
  Io: .07,
  Europa: .036,
  Ganymede: .023,
  Callisto: .012,
  Sol: .024,
};

const wrapLongitude = (longitude: number) => Math.atan2(Math.sin(longitude), Math.cos(longitude));

const insideFeature = (longitude: number, latitude: number, centerLongitude: number, centerLatitude: number, radius: number) => {
  const longitudeDistance = wrapLongitude(longitude - centerLongitude) * Math.cos(latitude);
  return Math.hypot(longitudeDistance, latitude - centerLatitude) < radius;
};

export function focusedRotation(name: string, seconds: number, reducedMotion: boolean) {
  return reducedMotion ? 0 : seconds * (ROTATION_SPEEDS[name] ?? .02);
}

export function planetSurfaceGlyph(name: string, longitude: number, latitude: number) {
  const wrappedLongitude = wrapLongitude(longitude);
  const broadWave = Math.sin(longitude * 2.4 + latitude * 1.7) + Math.sin(longitude * .8 - latitude * 3.1) * .45;

  if (name === 'Earth') {
    const mapX = Math.floor((((longitude / (Math.PI * 2) + .5) % 1 + 1) % 1) * EARTH_MAP_WIDTH);
    const mapY = Math.max(0, Math.min(EARTH_MAP_HEIGHT - 1, Math.floor((.5 - latitude / Math.PI) * EARTH_MAP_HEIGHT)));
    return EARTH_MAP[mapY][mapX];
  }
  if (name === 'Sol') {
    const granulation = Math.sin(longitude * 5 + latitude * 3) + Math.sin(longitude * 2 - latitude * 7) * .55;
    if (insideFeature(longitude, latitude, -.75, .24, .11) || insideFeature(longitude, latitude, 1.35, -.32, .08)) return '@';
    return granulation > .75 ? '*' : granulation < -.65 ? ':' : 'o';
  }
  if (name === 'Jupiter') {
    if (latitude > -.48 && latitude < -.18 && wrappedLongitude > .1 && wrappedLongitude < .78) {
      return wrappedLongitude > .28 && wrappedLongitude < .62 ? '@' : 'o';
    }
    const band = Math.floor((latitude + Math.PI / 2) * 11);
    return band % 4 === 0 ? '=' : band % 4 === 2 ? '-' : broadWave > .2 ? '~' : ':';
  }
  if (name === 'Saturn') {
    const band = Math.floor((latitude + Math.PI / 2) * 10);
    return band % 4 === 0 ? '=' : band % 2 ? ':' : '~';
  }
  if (name === 'Venus') {
    const cloud = Math.sin(longitude * 3 + latitude * 5) + Math.sin(longitude - latitude * 7) * .35;
    return cloud > .55 ? '=' : cloud < -.55 ? ':' : '~';
  }
  if (name === 'Mars') {
    if (Math.abs(latitude) > 1.12) return '*';
    if (insideFeature(longitude, latitude, -.7, .15, .18) || insideFeature(longitude, latitude, 1.3, -.35, .12)) return 'o';
    return broadWave > .55 ? ':' : broadWave < -.7 ? ',' : '.';
  }
  if (name === 'Mercury' || name === 'Moon') {
    const craters = name === 'Moon'
      ? [[-.9, .35, .2], [.55, -.15, .14], [1.8, .5, .1]]
      : [[-.6, .2, .16], [1.2, -.4, .12], [2.2, .45, .09]];
    if (craters.some(([featureLongitude, featureLatitude, radius]) =>
      insideFeature(longitude, latitude, featureLongitude, featureLatitude, radius))) return 'o';
    return broadWave > .45 ? ':' : '.';
  }
  if (name === 'Io') {
    if (insideFeature(longitude, latitude, -.8, .25, .14) || insideFeature(longitude, latitude, 1.45, -.3, .1)) return '@';
    return broadWave > .55 ? '*' : broadWave < -.45 ? ':' : 'o';
  }
  if (name === 'Europa') {
    const fracture = Math.sin(longitude * 4 + latitude * 7);
    return Math.abs(fracture) < .14 ? '/' : broadWave > .5 ? ':' : '.';
  }
  if (name === 'Ganymede') {
    if (insideFeature(longitude, latitude, .7, -.15, .17)) return 'o';
    return broadWave > .45 ? '=' : broadWave < -.5 ? ':' : '~';
  }
  if (name === 'Callisto') {
    const crater = insideFeature(longitude, latitude, -.9, .35, .16)
      || insideFeature(longitude, latitude, .45, -.4, .12)
      || insideFeature(longitude, latitude, 1.8, .2, .1);
    return crater ? 'O' : broadWave > .3 ? ':' : '.';
  }
  if (name === 'Uranus') {
    if (Math.abs(latitude) > 1.12) return ':';
    const band = Math.floor((latitude + Math.PI / 2) * 10);
    return band % 4 === 0 ? '-' : broadWave > .8 ? '.' : '~';
  }
  if (name === 'Neptune') {
    if (latitude > .08 && latitude < .38 && wrappedLongitude > -.85 && wrappedLongitude < -.28) {
      return wrappedLongitude > -.7 && wrappedLongitude < -.42 ? 'O' : 'o';
    }
    const band = Math.floor((latitude + Math.PI / 2) * 9);
    return band % 4 === 1 ? '=' : broadWave > .75 ? ':' : '~';
  }
  if (name === 'Pluto') return broadWave > .4 ? ':' : broadWave < -.55 ? ',' : '.';
  return broadWave > 0 ? ':' : '.';
}
