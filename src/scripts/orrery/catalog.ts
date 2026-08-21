import type { GalacticObject, Planet } from './types';
import { DEG } from './math';

export const PLANETS: Planet[] = [
  { name: 'Mercury', a: .38709927, e: .20563593, meanLongitude: 252.2503235, perihelion: 77.45779628, longitudeRate: 149472.67411175, inclination: 7.00497902, node: 48.33076593, displayRadius: 7, glyph: '.', sprite: [' ... ', '(:.)', " '.' "], color: '#bdae93', size: .68 },
  { name: 'Venus', a: .72333566, e: .00677672, meanLongitude: 181.9790995, perihelion: 131.60246718, longitudeRate: 58517.81538729, inclination: 3.39467605, node: 76.67984255, displayRadius: 10, glyph: 'o', sprite: [' .-. ', '(:~)', " '-' "], color: '#d79921', size: .74 },
  { name: 'Earth', a: 1.00000261, e: .01671123, meanLongitude: 100.46457166, perihelion: 102.93768193, longitudeRate: 35999.37244981, inclination: 0, node: 0, displayRadius: 14, glyph: '@', sprite: [' .-. ', '(o~)', " '-' "], color: '#83a598', size: .74 },
  { name: 'Mars', a: 1.52371034, e: .0933941, meanLongitude: -4.55343205, perihelion: -23.94362959, longitudeRate: 19140.30268499, inclination: 1.84969142, node: 49.55953891, displayRadius: 18, glyph: 'o', sprite: [' .-. ', '(:.)', " '-' "], color: '#fb4934', size: .7 },
  { name: 'Jupiter', a: 5.202887, e: .04838624, meanLongitude: 34.39644051, perihelion: 14.72847983, longitudeRate: 3034.74612775, inclination: 1.30439695, node: 100.47390909, displayRadius: 24, glyph: 'O', sprite: ['  .---.  ', ' /~~~~~\\ ', '|==~~~==|', '|~(@)~~~|', '|==~~~==|', ' \\~~~~~/ ', "  '---'  "], color: '#d5c4a1', size: .76 },
  { name: 'Saturn', a: 9.53667594, e: .05386179, meanLongitude: 49.95424423, perihelion: 92.59887831, longitudeRate: 1222.49362201, inclination: 2.48599187, node: 113.66242448, displayRadius: 30, glyph: 'O', sprite: ['     .---.     ', "   .':::::'.   ", '   /:::::::\\   ', '=====(=:=)=====', '   \\:::::::/   ', "   '.:::::.'   ", "     '---'     "], color: '#fabd2f', size: .52 },
  { name: 'Uranus', a: 19.18916464, e: .04725744, meanLongitude: 313.23810451, perihelion: 170.9542763, longitudeRate: 428.48202785, inclination: .77263783, node: 74.01692503, displayRadius: 36, glyph: 'O', sprite: ['  .---.  ', ' /~~~~~\\ ', '|~~---~~|', '|~~~~~~~|', '|~~---~~|', ' \\~~~~~/ ', "  '---'  "], color: '#8ec07c', size: .55 },
  { name: 'Neptune', a: 30.06992276, e: .00859048, meanLongitude: -55.12002969, perihelion: 44.96476227, longitudeRate: 218.45945325, inclination: 1.77004347, node: 131.78422574, displayRadius: 42, glyph: 'O', sprite: ['  .---.  ', ' /~~~~~\\ ', '|~~===~~|', '|~o~~~~~|', '|~~===~~|', ' \\~~~~~/ ', "  '---'  "], color: '#458588', size: .49 },
  { name: 'Pluto', a: 39.48168677, e: .24880766, meanLongitude: 238.92881, perihelion: 224.06676, longitudeRate: 145.2, inclination: 17.14175, node: 110.30347, displayRadius: 49, glyph: '.', sprite: ['.'], color: '#d3869b', size: .64, easterEgg: true },
];

// These positions are schematic locations on the face-on illustration.
export const GALACTIC_OBJECTS: GalacticObject[] = [
  { name: 'Sagittarius A*', kind: 'supermassive black hole', x: 0, y: 0, glyph: '{(@)}', color: '#fe8019', distance: '~26,700 ly', detail: 'galactic centre' },
  { name: 'Orion Nebula', kind: 'stellar nursery', x: .48, y: -.15, glyph: ':.*.:', color: '#d3869b', distance: '~1,340 ly', detail: 'Orion molecular cloud' },
  { name: 'Cygnus X-1', kind: 'stellar black hole', x: .2, y: .25, glyph: '<*O>', color: '#83a598', distance: '~7,200 ly', detail: 'x-ray binary system' },
  { name: 'Crab Nebula', kind: 'supernova remnant', x: -.25, y: -.22, glyph: '{+}', color: '#b8bb26', distance: '~6,500 ly', detail: 'pulsar wind nebula' },
];

export const PLANETARY_MOON_SYSTEMS: Record<string, { radii: number[]; speeds: number[]; tilt: number }> = {
  Earth: { radii: [1.15], speeds: [.13], tilt: 5 * DEG },
  Mars: { radii: [.72, 1], speeds: [.24, .17], tilt: 2 * DEG },
  Jupiter: { radii: [1.35, 1.72, 2.1, 2.58], speeds: [.34, .23, .17, .11], tilt: 3 * DEG },
  Saturn: { radii: [1.72, 2.42], speeds: [.2, .1], tilt: 7 * DEG },
  Uranus: { radii: [1.45, 2], speeds: [.18, .12], tilt: 28 * DEG },
  Neptune: { radii: [1.62], speeds: [-.13], tilt: 18 * DEG },
};

export const FOCUSED_ART: Record<string, string[]> = {
  'International Space Station': ['       |       ', '===[###]===[###]===', '    \\___O___/    ', '       / \\       '],
  'Sagittarius A*': ['       .   .       ', '   .-==\\|/==-.   ', '--==< ((@)) >==--', "   '-==/|\\==-'   ", '       .   .       '],
  'Orion Nebula': ['    .  *  .    ', ' .:*::...::*:. ', ':..::*:+:*::..:', ' .::*:...:*::. ', '    .  *  .    '],
  'Cygnus X-1': ['      \\ | /      ', '  ===(( O ))===  ', '      / | \\      ', '       <*         '],
  'Crab Nebula': ['   .:*\\|/*:.   ', '.::*--{+}--*::.', '   :*/|\\*:   ', '     /|\\     '],
};
