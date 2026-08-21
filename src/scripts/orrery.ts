type Vec3 = { x: number; y: number; z: number };

type Planet = {
  name: string;
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

type GalacticObject = {
  name: string;
  kind: string;
  x: number;
  y: number;
  glyph: string;
  color: string;
  distance: string;
  detail: string;
};

const DEG = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12);

const PLANETS: Planet[] = [
  { name: 'Mercury', a: .38709927, e: .20563593, meanLongitude: 252.2503235, perihelion: 77.45779628, longitudeRate: 149472.67411175, inclination: 7.00497902, node: 48.33076593, displayRadius: 7, glyph: '.', sprite: ['(.)'], color: '#bdae93', size: .75 },
  { name: 'Venus', a: .72333566, e: .00677672, meanLongitude: 181.9790995, perihelion: 131.60246718, longitudeRate: 58517.81538729, inclination: 3.39467605, node: 76.67984255, displayRadius: 10, glyph: 'o', sprite: ['(o)'], color: '#d79921', size: .72 },
  { name: 'Earth', a: 1.00000261, e: .01671123, meanLongitude: 100.46457166, perihelion: 102.93768193, longitudeRate: 35999.37244981, inclination: 0, node: 0, displayRadius: 14, glyph: '@', sprite: [' .-. ', '(o~)', " '-' "], color: '#83a598', size: .72 },
  { name: 'Mars', a: 1.52371034, e: .0933941, meanLongitude: -4.55343205, perihelion: -23.94362959, longitudeRate: 19140.30268499, inclination: 1.84969142, node: 49.55953891, displayRadius: 18, glyph: 'o', sprite: ['(.)'], color: '#fb4934', size: .68 },
  { name: 'Jupiter', a: 5.202887, e: .04838624, meanLongitude: 34.39644051, perihelion: 14.72847983, longitudeRate: 3034.74612775, inclination: 1.30439695, node: 100.47390909, displayRadius: 24, glyph: 'O', sprite: [' .---. ', '(=-=-=)', " '---' "], color: '#d5c4a1', size: .88 },
  { name: 'Saturn', a: 9.53667594, e: .05386179, meanLongitude: 49.95424423, perihelion: 92.59887831, longitudeRate: 1222.49362201, inclination: 2.48599187, node: 113.66242448, displayRadius: 30, glyph: 'O', sprite: ['   .--.   ', '--(====)--', "   '--'   "], color: '#fabd2f', size: .82 },
  { name: 'Uranus', a: 19.18916464, e: .04725744, meanLongitude: 313.23810451, perihelion: 170.9542763, longitudeRate: 428.48202785, inclination: .77263783, node: 74.01692503, displayRadius: 36, glyph: 'O', sprite: [' .-. ', '( o )', " '-' "], color: '#8ec07c', size: .72 },
  { name: 'Neptune', a: 30.06992276, e: .00859048, meanLongitude: -55.12002969, perihelion: 44.96476227, longitudeRate: 218.45945325, inclination: 1.77004347, node: 131.78422574, displayRadius: 42, glyph: 'O', sprite: [' .-. ', '( ~ )', " '-' "], color: '#458588', size: .72 },
  { name: 'Pluto', a: 39.48168677, e: .24880766, meanLongitude: 238.92881, perihelion: 224.06676, longitudeRate: 145.2, inclination: 17.14175, node: 110.30347, displayRadius: 49, glyph: '.', sprite: ['.'], color: '#d3869b', size: .64, easterEgg: true },
];

// These are intentionally schematic positions on the face-on illustration, not a
// claim that every object lies neatly in the same two-dimensional galactic plane.
const GALACTIC_OBJECTS: GalacticObject[] = [
  { name: 'Sagittarius A*', kind: 'supermassive black hole', x: 0, y: 0, glyph: '{(@)}', color: '#fe8019', distance: '~26,700 ly', detail: 'galactic centre' },
  { name: 'Orion Nebula', kind: 'stellar nursery', x: .48, y: -.15, glyph: ':.*.:', color: '#d3869b', distance: '~1,340 ly', detail: 'Orion molecular cloud' },
  { name: 'Cygnus X-1', kind: 'stellar black hole', x: .2, y: .25, glyph: '<*O>', color: '#83a598', distance: '~7,200 ly', detail: 'x-ray binary system' },
  { name: 'Crab Nebula', kind: 'supernova remnant', x: -.25, y: -.22, glyph: '{+}', color: '#b8bb26', distance: '~6,500 ly', detail: 'pulsar wind nebula' },
];

const canvas = document.querySelector<HTMLCanvasElement>('#solar-canvas');
const system = document.querySelector<HTMLElement>('#solar-system');
const clock = document.querySelector<HTMLElement>('#solar-time');
const sceneLabel = document.querySelector<HTMLElement>('.solar-caption span:first-child');
const zoomInput = document.querySelector<HTMLInputElement>('#cosmic-zoom');
const zoomStatus = document.querySelector<HTMLOutputElement>('#cosmic-zoom-status');
const context = canvas?.getContext('2d');

if (canvas && system && context) {
  const stars = Array.from({ length: 90 }, (_, index) => ({
    x: ((index * 47) % 131) / 131,
    y: ((index * 83) % 127) / 127,
    phase: (index * 1.618) % (Math.PI * 2),
    speed: .55 + (index % 9) * .09,
    glyph: index % 17 === 0 ? '+' : index % 7 === 0 ? '*' : '.',
  }));
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, clientX: -1000, clientY: -1000, active: false };
  const camera = {
    manual: false,
    dragging: false,
    pitch: 58 * DEG,
    yaw: 0,
    roll: -12 * DEG,
    renderedPitch: 58 * DEG,
    renderedYaw: 0,
    renderedRoll: -12 * DEG,
    resetting: false,
    resetStartedAt: 0,
    resetPitch: 58 * DEG,
    resetYaw: 0,
    resetRoll: -12 * DEG,
    lastX: 0,
    lastY: 0,
    pointerId: -1,
    dragDistance: 0,
    dragMode: 'solar' as 'solar' | 'galaxy',
  };
  const galaxyCamera = {
    rotation: 0,
    tilt: 1,
    resetting: false,
    resetStartedAt: 0,
    resetRotation: 0,
    resetTilt: 1,
  };
  const easterEgg = { clicks: 0, lastClickAt: 0, unlocked: false, revealedAt: 0 };
  const cosmicZoom = { current: 0, target: 0 };
  const orbitClock = {
    active: false,
    returning: false,
    anchorDate: Date.now(),
    startedAt: 0,
    returnFrom: Date.now(),
    returnStartedAt: 0,
  };
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reducedMotionQuery.matches;
  let lastClockSecond = -1;
  let lastFrameAt = 0;

  const randomUnit = (seed: number) => {
    const value = Math.sin(seed * 91.733) * 43758.5453;
    return value - Math.floor(value);
  };
  const galacticSolRadius = .58;
  const galacticSolAngle = Math.PI + galacticSolRadius * 6.25;
  const galacticSol = {
    x: Math.cos(galacticSolAngle) * galacticSolRadius,
    y: Math.sin(galacticSolAngle) * galacticSolRadius * .58,
  };
  const galaxyStars = Array.from({ length: 1180 }, (_, index) => {
    const inCore = index < 170;
    const radius = inCore
      ? Math.pow(randomUnit(index + 1), 2.15) * .24
      : .08 + Math.pow(randomUnit(index + 1), .66) * .92;
    const arm = index % 4;
    const angle = inCore
      ? randomUnit(index + 11) * Math.PI * 2
      : arm * Math.PI / 2 + radius * 6.25 + (randomUnit(index + 11) - .5) * (.12 + radius * .3);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * .58,
      radius,
      phase: randomUnit(index + 31) * Math.PI * 2,
      strength: randomUnit(index + 51),
      glyph: index % 37 === 0 ? '+' : index % 8 === 0 ? '*' : index % 5 === 0 ? ':' : '.',
    };
  });
  const orionSpurStars = Array.from({ length: 72 }, (_, index) => {
    const radius = galacticSolRadius + (index / 71 - .5) * .18;
    const angle = Math.PI + radius * 6.25 + (randomUnit(index + 801) - .5) * .024;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * .58,
      phase: randomUnit(index + 901) * Math.PI * 2,
      glyph: index % 13 === 0 ? '*' : index % 5 === 0 ? ':' : '.',
    };
  });

  reducedMotionQuery.addEventListener('change', (event) => {
    reducedMotion = event.matches;
  });

  const rotateX = (point: Vec3, angle: number): Vec3 => ({
    x: point.x,
    y: point.y * Math.cos(angle) - point.z * Math.sin(angle),
    z: point.y * Math.sin(angle) + point.z * Math.cos(angle),
  });
  const rotateY = (point: Vec3, angle: number): Vec3 => ({
    x: point.x * Math.cos(angle) + point.z * Math.sin(angle),
    y: point.y,
    z: -point.x * Math.sin(angle) + point.z * Math.cos(angle),
  });
  const rotateZ = (point: Vec3, angle: number): Vec3 => ({
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
    z: point.z,
  });

  function solveOrbit(planet: Planet, date: number) {
    const centuries = (date - J2000) / 86400000 / 36525;
    const meanAnomaly = (planet.meanLongitude + planet.longitudeRate * centuries - planet.perihelion) * DEG;
    let eccentricAnomaly = meanAnomaly;
    for (let iteration = 0; iteration < 8; iteration++) {
      eccentricAnomaly -= (eccentricAnomaly - planet.e * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - planet.e * Math.cos(eccentricAnomaly));
    }
    return {
      angle: Math.atan2(Math.sqrt(1 - planet.e ** 2) * Math.sin(eccentricAnomaly), Math.cos(eccentricAnomaly) - planet.e),
      distance: (planet.a * (1 - planet.e * Math.cos(eccentricAnomaly))) / planet.a,
    };
  }

  function orbitalPoint(planet: Planet, angle: number, distance = 1): Vec3 {
    const radius = planet.displayRadius * distance;
    const argumentOfPerihelion = (planet.perihelion - planet.node) * DEG;
    let point: Vec3 = { x: Math.cos(angle + argumentOfPerihelion) * radius, y: Math.sin(angle + argumentOfPerihelion) * radius, z: 0 };
    point = rotateX(point, planet.inclination * DEG * 2.4);
    return rotateZ(point, planet.node * DEG);
  }

  function heliocentricPosition(planet: Planet, angle: number, normalizedDistance: number) {
    const radius = planet.a * normalizedDistance;
    const argumentOfPerihelion = (planet.perihelion - planet.node) * DEG;
    let point: Vec3 = { x: Math.cos(angle + argumentOfPerihelion) * radius, y: Math.sin(angle + argumentOfPerihelion) * radius, z: 0 };
    point = rotateX(point, planet.inclination * DEG);
    point = rotateZ(point, planet.node * DEG);
    return {
      longitude: (Math.atan2(point.y, point.x) / DEG + 360) % 360,
      latitude: Math.atan2(point.z, Math.hypot(point.x, point.y)) / DEG,
      distance: radius,
    };
  }

  const ORBIT_SAMPLES = 112;
  const orbitPoints = PLANETS.map((planet) =>
    Array.from({ length: ORBIT_SAMPLES }, (_, sample) => {
      const trueAnomaly = sample / ORBIT_SAMPLES * Math.PI * 2;
      const normalizedDistance = (1 - planet.e ** 2) / (1 + planet.e * Math.cos(trueAnomaly));
      return orbitalPoint(planet, trueAnomaly, normalizedDistance);
    })
  );

  function getOrbitDate(frameTime: number) {
    if (orbitClock.returning) {
      const progress = Math.min(1, (frameTime - orbitClock.returnStartedAt) / 900);
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      const date = orbitClock.returnFrom + (Date.now() - orbitClock.returnFrom) * eased;
      if (progress === 1) orbitClock.returning = false;
      return date;
    }
    if (orbitClock.active) {
      const speed = reducedMotion ? 1 : 43_200;
      return orbitClock.anchorDate + (frameTime - orbitClock.startedAt) * speed;
    }
    return Date.now();
  }

  function render(frameTime: number) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, width < 600 ? 1.5 : 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    pointer.x += (pointer.targetX - pointer.x) * .055;
    pointer.y += (pointer.targetY - pointer.y) * .055;
    const seconds = frameTime / 1000;
    const frameDelta = Math.min(40, lastFrameAt ? frameTime - lastFrameAt : 16.67);
    lastFrameAt = frameTime;
    cosmicZoom.current += (cosmicZoom.target - cosmicZoom.current) * (reducedMotion ? 1 : .055);
    const smoothstep = (value: number) => {
      const clamped = Math.max(0, Math.min(1, value));
      return clamped * clamped * (3 - 2 * clamped);
    };
    const galaxyProgress = smoothstep((cosmicZoom.current - .24) / .76);
    const localDetailOpacity = 1 - smoothstep((cosmicZoom.current - .2) / .26);
    const solarSystemScale = Math.pow(.055, Math.min(1, cosmicZoom.current / .7));
    if (camera.manual && !camera.dragging && !camera.resetting && !reducedMotion) {
      camera.roll += .000035 * frameDelta;
    }
    const revealProgress = easterEgg.unlocked
      ? Math.min(1, (frameTime - easterEgg.revealedAt) / (reducedMotion ? 1 : 1200))
      : 0;
    const plutoReveal = 1 - (1 - revealProgress) ** 3;
    const drift = reducedMotion ? 0 : seconds * .035;
    const automaticPitch = (58 + Math.sin(seconds * .18) * 4 + pointer.y * 10) * DEG;
    const automaticYaw = (Math.sin(seconds * .11) * 8 + pointer.x * 14) * DEG;
    const automaticRoll = (-12 * DEG) + drift;
    let cameraPitch = camera.manual ? camera.pitch : automaticPitch;
    let cameraYaw = camera.manual ? camera.yaw : automaticYaw;
    let cameraRoll = camera.manual ? camera.roll : automaticRoll;
    if (camera.resetting) {
      const progress = Math.min(1, (frameTime - camera.resetStartedAt) / 900);
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      const interpolateAngle = (from: number, to: number) => {
        const difference = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        return from + difference * eased;
      };
      cameraPitch = camera.resetPitch + (automaticPitch - camera.resetPitch) * eased;
      cameraYaw = interpolateAngle(camera.resetYaw, automaticYaw);
      cameraRoll = interpolateAngle(camera.resetRoll, automaticRoll);
      if (progress === 1) camera.resetting = false;
    }
    camera.renderedPitch = cameraPitch;
    camera.renderedYaw = cameraYaw;
    camera.renderedRoll = cameraRoll;
    const viewportCenterX = width * .52;
    const viewportCenterY = height * .38;
    const finalGalaxyRadius = Math.min(width * .48, height * .62);
    const distantGalaxyRadius = Math.max(width, height) * 2.2;
    const galaxyRadius = finalGalaxyRadius + (distantGalaxyRadius - finalGalaxyRadius) * (1 - galaxyProgress) ** 2;
    if (!(camera.dragging && camera.dragMode === 'galaxy') && !galaxyCamera.resetting && !reducedMotion) {
      galaxyCamera.rotation += .000025 * frameDelta;
    }
    if (galaxyCamera.resetting) {
      const progress = Math.min(1, (frameTime - galaxyCamera.resetStartedAt) / 900);
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      const rotationDifference = ((-galaxyCamera.resetRotation + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      galaxyCamera.rotation = galaxyCamera.resetRotation + rotationDifference * eased;
      galaxyCamera.tilt = galaxyCamera.resetTilt + (1 - galaxyCamera.resetTilt) * eased;
      if (progress === 1) {
        galaxyCamera.rotation = 0;
        galaxyCamera.tilt = 1;
        galaxyCamera.resetting = false;
      }
    }
    const galacticOffset = (x: number, y: number, radius: number) => {
      const tiltedY = y * galaxyCamera.tilt;
      return {
        x: (x * Math.cos(galaxyCamera.rotation) - tiltedY * Math.sin(galaxyCamera.rotation)) * radius,
        y: (x * Math.sin(galaxyCamera.rotation) + tiltedY * Math.cos(galaxyCamera.rotation)) * radius,
      };
    };
    // Move Sol along a stable screen-space path while the galactic centre arrives behind it.
    // Coupling this movement to the enormous intermediate radius creates an empty visual jump.
    const finalSolOffset = galacticOffset(galacticSol.x, galacticSol.y, finalGalaxyRadius);
    const currentSolOffset = galacticOffset(galacticSol.x, galacticSol.y, galaxyRadius);
    const centerX = viewportCenterX + finalSolOffset.x * galaxyProgress;
    const centerY = viewportCenterY + finalSolOffset.y * galaxyProgress;
    const galaxyCoreX = centerX - currentSolOffset.x;
    const galaxyCoreY = centerY - currentSolOffset.y;
    const galaxyAlpha = smoothstep((cosmicZoom.current - .28) / .34);
    const localSkyOpacity = 1 - smoothstep((cosmicZoom.current - .06) / .24);
    // Leave enough room for Neptune even at the nearest point in the projection.
    const baseWorldScale = width < 600
      ? Math.min(width / 116, height / 54)
      : Math.min(width / 104, height / 50);
    const worldScale = baseWorldScale * (1 - plutoReveal * .11) * solarSystemScale;
    const cameraDistance = 145;

    const cameraTransform = (world: Vec3) => {
      let point = rotateZ(world, cameraRoll);
      point = rotateX(point, cameraPitch);
      point = rotateY(point, cameraYaw);
      const perspective = cameraDistance / (cameraDistance - point.z);
      return {
        x: centerX + point.x * worldScale * perspective,
        y: centerY + point.y * worldScale * perspective,
        z: point.z,
        scale: perspective,
      };
    };

    const starParallaxX = pointer.x * 8;
    const starParallaxY = pointer.y * 5;
    for (const glyph of ['.', '*', '+']) {
      context.fillStyle = glyph === '+' ? '#fabd2f' : '#928374';
      context.font = `${glyph === '+' ? 14 : 11}px "DM Mono", monospace`;
      for (const star of stars) {
        if (star.glyph !== glyph) continue;
        const pulse = reducedMotion ? .45 : .5 + .5 * Math.sin(seconds * star.speed * 2.2 + star.phase);
        context.globalAlpha = (.12 + pulse * (glyph === '+' ? .78 : .4)) * localSkyOpacity;
        context.fillText(glyph, star.x * width + starParallaxX, star.y * height + starParallaxY);
      }
    }
    context.globalAlpha = 1;

    if (galaxyAlpha > .001) {
      context.font = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
      for (const star of galaxyStars) {
        const offset = galacticOffset(star.x, star.y, galaxyRadius);
        const starX = galaxyCoreX + offset.x;
        const starY = galaxyCoreY + offset.y;
        if (starX < -12 || starX > width + 12 || starY < -12 || starY > height + 12) continue;
        const twinkle = reducedMotion ? .7 : .68 + Math.sin(seconds * .9 + star.phase) * .22;
        context.globalAlpha = galaxyAlpha * twinkle * (.5 + (1 - star.radius) * .42 + star.strength * .16);
        context.fillStyle = star.radius < .2 ? '#ebdbb2' : star.glyph === '+' ? '#d3869b' : star.glyph === '*' ? '#b8bb26' : '#928374';
        context.fillText(star.glyph, starX, starY);
      }
      for (const star of orionSpurStars) {
        const offset = galacticOffset(star.x, star.y, galaxyRadius);
        const starX = galaxyCoreX + offset.x;
        const starY = galaxyCoreY + offset.y;
        if (starX < -12 || starX > width + 12 || starY < -12 || starY > height + 12) continue;
        const twinkle = reducedMotion ? .72 : .72 + Math.sin(seconds + star.phase) * .18;
        context.globalAlpha = galaxyAlpha * twinkle * .78;
        context.fillStyle = star.glyph === '*' ? '#b8bb26' : '#a89984';
        context.fillText(star.glyph, starX, starY);
      }
      context.globalAlpha = galaxyAlpha;
      context.fillStyle = '#fabd2f';
      context.font = `${width < 600 ? 10 : 13}px "DM Mono", monospace`;
      context.fillText('{:*:::*:}', galaxyCoreX, galaxyCoreY);
      context.globalAlpha = 1;
    }

    type OrbitMark = { x: number; y: number; z: number; scale: number; glyph: string; earth: boolean; alpha: number; reveal: number };
    const farMarks: OrbitMark[] = [];
    const nearMarks: OrbitMark[] = [];
    // The orbits are a stable spatial reference; motion belongs to the scene itself.
    const dashTravel = 0;

    PLANETS.forEach((planet, planetIndex) => {
      if (planet.easterEgg && !easterEgg.unlocked) return;
      for (let sample = 0; sample < ORBIT_SAMPLES; sample++) {
        if ((sample + dashTravel + planetIndex) % 3 === 0) continue;
        const projected = cameraTransform(orbitPoints[planetIndex][sample]);
        const next = cameraTransform(orbitPoints[planetIndex][(sample + 1) % ORBIT_SAMPLES]);
        const dx = next.x - projected.x;
        const dy = next.y - projected.y;
        const slope = Math.abs(dy / (dx || .001));
        const glyph = slope > 2.1 ? '|' : slope > .55 ? (dx * dy > 0 ? '\\' : '/') : '-';
        const mark = { ...projected, glyph, earth: planet.name === 'Earth', alpha: (planet.name === 'Earth' ? .78 : .62) * localDetailOpacity, reveal: planet.easterEgg ? plutoReveal : 1 };
        (projected.z < 0 ? farMarks : nearMarks).push(mark);
      }
    });

    const drawMarks = (marks: OrbitMark[]) => {
      context.font = '9px "DM Mono", monospace';
      for (const mark of marks) {
        context.globalAlpha = mark.alpha * mark.reveal;
        context.fillStyle = mark.earth ? '#83a598' : '#665c54';
        context.fillText(mark.glyph, mark.x, mark.y);
      }
      context.globalAlpha = 1;
    };

    const now = getOrbitDate(frameTime);
    const bodies = PLANETS.filter((planet) => !planet.easterEgg || easterEgg.unlocked).map((planet) => {
      const orbit = solveOrbit(planet, now);
      return { planet, reveal: planet.easterEgg ? plutoReveal : 1, position: heliocentricPosition(planet, orbit.angle, orbit.distance), ...cameraTransform(orbitalPoint(planet, orbit.angle, orbit.distance)) };
    }).sort((first, second) => first.z - second.z);

    const canvasBounds = canvas.getBoundingClientRect();
    const localPointerX = pointer.clientX - canvasBounds.left;
    const localPointerY = pointer.clientY - canvasBounds.top;
    const hoveredBody = pointer.active && !camera.dragging && localDetailOpacity > .45
      ? bodies.reduce<typeof bodies[number] | null>((closest, body) => {
          const distance = Math.hypot(body.x - localPointerX, body.y - localPointerY);
          const closestDistance = closest ? Math.hypot(closest.x - localPointerX, closest.y - localPointerY) : Infinity;
          return body.reveal > .35 && distance < 28 && distance < closestDistance ? body : closest;
        }, null)
      : null;
    const galaxyObjectOpacity = galaxyAlpha * smoothstep((galaxyProgress - .42) / .35);
    const galacticObjects = GALACTIC_OBJECTS.map((object) => ({
      object,
      ...galacticOffset(object.x, object.y, galaxyRadius),
    })).map((object) => ({
      ...object,
      x: galaxyCoreX + object.x,
      y: galaxyCoreY + object.y,
    }));
    const hoveredGalacticObject = pointer.active && !camera.dragging && galaxyObjectOpacity > .35
      ? galacticObjects.reduce<typeof galacticObjects[number] | null>((closest, object) => {
          const distance = Math.hypot(object.x - localPointerX, object.y - localPointerY);
          const closestDistance = closest ? Math.hypot(closest.x - localPointerX, closest.y - localPointerY) : Infinity;
          return distance < 30 && distance < closestDistance ? object : closest;
        }, null)
      : null;

    const drawBody = (body: typeof bodies[number]) => {
      const { planet } = body;
      const depthScale = Math.max(.68, Math.min(1.55, body.scale));
      const isHovered = body === hoveredBody;
      const cosmicGlyphScale = Math.max(.3, Math.sqrt(solarSystemScale));
      const fontSize = (planet.easterEgg ? 16 : Math.max(8, 15 * planet.size * depthScale) * (isHovered ? 1.14 : 1)) * cosmicGlyphScale;
      const lines = planet.easterEgg || fontSize < 9 ? [planet.glyph] : planet.sprite;
      const lineHeight = fontSize * .78;
      context.globalAlpha = body.reveal * localDetailOpacity;
      context.fillStyle = planet.color;
      context.shadowBlur = 0;
      context.font = `bold ${fontSize}px "DM Mono", monospace`;
      context.strokeStyle = '#1d2021';
      context.lineWidth = Math.max(2, fontSize * .2);
      context.lineJoin = 'round';
      lines.forEach((line, index) => {
        const lineY = body.y + (index - (lines.length - 1) / 2) * lineHeight;
        if (!planet.easterEgg) context.strokeText(line, body.x, lineY);
        context.fillText(line, body.x, lineY);
      });
      if (isHovered) {
        const spriteWidth = Math.max(...lines.map((line) => context.measureText(line).width));
        context.fillStyle = '#ebdbb2';
        context.font = `bold ${Math.max(9, fontSize * .72)}px "DM Mono", monospace`;
        context.fillText('[', body.x - spriteWidth / 2 - 7, body.y);
        context.fillText(']', body.x + spriteWidth / 2 + 7, body.y);
      }
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    };

    drawMarks(farMarks);
    drawMarks(nearMarks);

    const sunPulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 2.1) * .08;
    const sunSize = 12 * sunPulse * Math.max(.28, Math.sqrt(solarSystemScale));
    context.fillStyle = '#fabd2f';
    context.globalAlpha = localDetailOpacity * (.24 + Math.sin(seconds * 2.1) * .05);
    context.shadowColor = '#fe8019';
    context.shadowBlur = 35;
    context.font = `${sunSize * 3.4}px "DM Mono", monospace`;
    context.fillText('·', centerX, centerY);
    context.globalAlpha = localDetailOpacity;
    context.shadowBlur = 15;
    context.font = `bold ${sunSize}px "DM Mono", monospace`;
    ['    \\  |  /    ', "  `. \\ | / .'  ", '----  (@)  ----', "  .' / | \\ `.  ", '    /  |  \\    '].forEach((line, index) => context.fillText(line, centerX, centerY + (index - 2) * sunSize * .72));
    context.shadowBlur = 0;

    // Keep every body visible so each of the eight orbit lanes has a clear owner.
    bodies.forEach(drawBody);

    if (galaxyObjectOpacity > .001) {
      for (const galacticObject of galacticObjects) {
        if (galacticObject.x < -30 || galacticObject.x > width + 30 || galacticObject.y < -30 || galacticObject.y > height + 30) continue;
        const isHovered = galacticObject === hoveredGalacticObject;
        const pulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 1.4 + galacticObject.x) * .08;
        context.globalAlpha = galaxyObjectOpacity;
        context.fillStyle = galacticObject.object.color;
        context.font = `bold ${Math.round((isHovered ? 13 : 11) * pulse)}px "DM Mono", monospace`;
        context.fillText(galacticObject.object.glyph, galacticObject.x, galacticObject.y);
        if (isHovered) {
          const glyphWidth = context.measureText(galacticObject.object.glyph).width;
          context.fillStyle = '#ebdbb2';
          context.font = 'bold 11px "DM Mono", monospace';
          context.fillText('[', galacticObject.x - glyphWidth / 2 - 8, galacticObject.y);
          context.fillText(']', galacticObject.x + glyphWidth / 2 + 8, galacticObject.y);
        }
      }
      context.globalAlpha = 1;
    }

    if (galaxyAlpha > .001) {
      const markerAlpha = galaxyAlpha * (1 - localDetailOpacity * .75);
      context.globalAlpha = markerAlpha;
      context.fillStyle = '#fabd2f';
      context.font = 'bold 12px "DM Mono", monospace';
      context.fillText('+', centerX, centerY);
      if (galaxyProgress > .62) {
        context.globalAlpha = markerAlpha * smoothstep((galaxyProgress - .62) / .25);
        context.font = '9px "DM Mono", monospace';
        context.fillText('[ SOL / YOU ARE HERE ]', centerX, centerY + 18);
      }
      context.globalAlpha = 1;
    }

    if (hoveredBody) {
      const readout = [
        `[ ${hoveredBody.planet.name.toUpperCase()} ]`,
        `lon  ${hoveredBody.position.longitude.toFixed(2).padStart(6)} deg`,
        `lat  ${`${hoveredBody.position.latitude >= 0 ? '+' : '-'}${Math.abs(hoveredBody.position.latitude).toFixed(2)}`.padStart(6)} deg`,
        `r    ${hoveredBody.position.distance.toFixed(3).padStart(6)} au`,
      ];
      const boxWidth = 174;
      const boxHeight = 82;
      const boxX = Math.min(width - boxWidth - 8, Math.max(8, hoveredBody.x + 25));
      const boxY = Math.min(height - boxHeight - 8, Math.max(8, hoveredBody.y - boxHeight / 2));
      context.globalAlpha = .94;
      context.fillStyle = '#1d2021';
      context.fillRect(boxX, boxY, boxWidth, boxHeight);
      context.strokeStyle = '#665c54';
      context.lineWidth = 1;
      context.strokeRect(boxX + .5, boxY + .5, boxWidth - 1, boxHeight - 1);
      context.globalAlpha = 1;
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.font = '12px "DM Mono", monospace';
      readout.forEach((line, index) => {
        context.fillStyle = index === 0 ? hoveredBody.planet.color : '#a89984';
        context.fillText(line, boxX + 11, boxY + 10 + index * 16);
      });
      context.textAlign = 'center';
      context.textBaseline = 'middle';
    }

    if (hoveredGalacticObject) {
      const readout = [
        `[ ${hoveredGalacticObject.object.name.toUpperCase()} ]`,
        hoveredGalacticObject.object.kind,
        `dist  ${hoveredGalacticObject.object.distance}`,
        hoveredGalacticObject.object.detail,
      ];
      const boxWidth = Math.min(224, width - 16);
      const boxHeight = 82;
      const boxX = Math.min(width - boxWidth - 8, Math.max(8, hoveredGalacticObject.x + 25));
      const boxY = Math.min(height - boxHeight - 8, Math.max(8, hoveredGalacticObject.y - boxHeight / 2));
      context.globalAlpha = .94;
      context.fillStyle = '#1d2021';
      context.fillRect(boxX, boxY, boxWidth, boxHeight);
      context.strokeStyle = '#665c54';
      context.lineWidth = 1;
      context.strokeRect(boxX + .5, boxY + .5, boxWidth - 1, boxHeight - 1);
      context.globalAlpha = 1;
      context.textAlign = 'left';
      context.textBaseline = 'top';
      context.font = '12px "DM Mono", monospace';
      readout.forEach((line, index) => {
        context.fillStyle = index === 0 ? hoveredGalacticObject.object.color : '#a89984';
        context.fillText(line, boxX + 11, boxY + 10 + index * 16);
      });
      context.textAlign = 'center';
      context.textBaseline = 'middle';
    }

    context.globalAlpha = .35;
    context.fillStyle = '#a89984';
    context.font = '9px "DM Mono", monospace';
    context.textAlign = 'left';
    context.fillText('+Z / NEAR', 14, height - 41);
    context.fillText('-Z / FAR', 14, height - 27);
    context.globalAlpha = 1;

    const currentSecond = Math.floor(frameTime / 1000);
    if (clock && currentSecond !== lastClockSecond) {
      const clockMode = orbitClock.active && !orbitClock.returning ? ' · SIM 12H/S' : ' UTC';
      clock.textContent = new Date(now).toISOString().replace('T', ' / ').slice(0, 22) + clockMode;
      lastClockSecond = currentSecond;
    }
    requestAnimationFrame(render);
  }

  window.addEventListener('pointermove', (event) => {
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    pointer.active = true;
    if (camera.dragging && event.pointerId === camera.pointerId) {
      const deltaX = event.clientX - camera.lastX;
      const deltaY = event.clientY - camera.lastY;
      if (camera.dragMode === 'galaxy') {
        galaxyCamera.rotation += deltaX * .005;
        galaxyCamera.tilt = Math.max(.5, Math.min(1.35, galaxyCamera.tilt + deltaY * .0035));
      } else {
        camera.roll += deltaX * .0045;
        camera.yaw += deltaX * .0018;
        camera.pitch = Math.max(12 * DEG, Math.min(88 * DEG, camera.pitch + deltaY * .0055));
      }
      camera.dragDistance += Math.hypot(deltaX, deltaY);
      camera.lastX = event.clientX;
      camera.lastY = event.clientY;
      return;
    }
    if (!camera.manual) {
      pointer.targetX = (event.clientX / window.innerWidth - .5) * 2;
      pointer.targetY = (event.clientY / window.innerHeight - .5) * 2;
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    camera.dragMode = cosmicZoom.current > .55 ? 'galaxy' : 'solar';
    if (camera.dragMode === 'solar') {
      camera.manual = true;
      camera.resetting = false;
      camera.pitch = camera.renderedPitch;
      camera.yaw = camera.renderedYaw;
      camera.roll = camera.renderedRoll;
      pointer.targetX = pointer.x;
      pointer.targetY = pointer.y;
    } else {
      galaxyCamera.resetting = false;
    }
    camera.dragging = true;
    camera.lastX = event.clientX;
    camera.lastY = event.clientY;
    camera.dragDistance = 0;
    camera.pointerId = event.pointerId;
    system.classList.add('is-dragging');
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  const finishDrag = (event: PointerEvent) => {
    if (!camera.dragging || event.pointerId !== camera.pointerId) return;
    camera.dragging = false;
    system.classList.remove('is-dragging');
    if (event.type === 'pointerup' && camera.dragMode === 'solar' && camera.dragDistance >= 3) {
      const startedAt = performance.now();
      orbitClock.anchorDate = getOrbitDate(startedAt);
      orbitClock.startedAt = startedAt;
      orbitClock.active = true;
      orbitClock.returning = false;
    }
    if (event.type === 'pointerup' && camera.dragMode === 'solar' && !easterEgg.unlocked) {
      if (camera.dragDistance < 3) {
        const clickedAt = performance.now();
        if (clickedAt - easterEgg.lastClickAt > 650) easterEgg.clicks = 0;
        easterEgg.clicks += 1;
        easterEgg.lastClickAt = clickedAt;
        if (easterEgg.clicks === 9) {
          easterEgg.unlocked = true;
          easterEgg.revealedAt = clickedAt;
          if (sceneLabel) sceneLabel.textContent = 'OBJECT 134340 DETECTED / PLUTO';
        }
      } else {
        easterEgg.clicks = 0;
        easterEgg.lastClickAt = 0;
      }
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);

  canvas.addEventListener('dblclick', (event) => {
    const resetAt = performance.now();
    orbitClock.returnFrom = getOrbitDate(resetAt);
    orbitClock.returnStartedAt = resetAt;
    orbitClock.returning = orbitClock.active;
    orbitClock.active = false;
    camera.manual = false;
    camera.dragging = false;
    system.classList.remove('is-dragging');
    camera.resetting = true;
    camera.resetStartedAt = performance.now();
    camera.resetPitch = camera.renderedPitch;
    camera.resetYaw = camera.renderedYaw;
    camera.resetRoll = camera.renderedRoll;
    galaxyCamera.resetting = true;
    galaxyCamera.resetStartedAt = resetAt;
    galaxyCamera.resetRotation = galaxyCamera.rotation;
    galaxyCamera.resetTilt = galaxyCamera.tilt;
    pointer.targetX = (event.clientX / window.innerWidth - .5) * 2;
    pointer.targetY = (event.clientY / window.innerHeight - .5) * 2;
    event.preventDefault();
  });
  document.documentElement.addEventListener('pointerleave', () => {
    pointer.targetX = 0;
    pointer.targetY = 0;
    pointer.active = false;
  });

  zoomInput?.addEventListener('input', () => {
    cosmicZoom.target = Number(zoomInput.value) / 100;
    const status = cosmicZoom.target < .3 ? 'LOCAL SYSTEM' : cosmicZoom.target < .72 ? 'INTERSTELLAR' : 'MILKY WAY';
    if (zoomStatus) zoomStatus.value = status;
    zoomInput.setAttribute('aria-valuetext', status);
    if (sceneLabel) {
      sceneLabel.textContent = cosmicZoom.target >= .72
        ? 'MILKY WAY / GALACTIC VIEW'
        : cosmicZoom.target >= .3
          ? 'DEPARTING LOCAL SYSTEM / ORION ARM'
          : easterEgg.unlocked
            ? 'OBJECT 134340 DETECTED / PLUTO'
            : 'LIVE ASCII ORRERY / 3D HELIOCENTRIC';
    }
  });

  requestAnimationFrame(render);
}
