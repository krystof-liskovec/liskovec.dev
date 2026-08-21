import { FOCUSED_ART, GALACTIC_OBJECTS, PLANETARY_MOON_SYSTEMS, PLANETS } from './orrery/catalog';
import { drawReadout } from './orrery/canvas-ui';
import { EARTH_MAP, EARTH_MAP_HEIGHT, EARTH_MAP_WIDTH } from './orrery/earth-map';
import { DEG, J2000, heliocentricPosition, orbitalPoint, randomUnit, rotateX, rotateY, rotateZ, smoothstep, solveOrbit } from './orrery/math';
import { ASTEROID_BELT, GALACTIC_SOL, GALAXY_STARS, ORBIT_POINTS, ORBIT_SAMPLES, ORION_SPUR_STARS, STARS } from './orrery/scene-data';
import type { FocusState, FocusTarget, Vec3 } from './orrery/types';

const canvas = document.querySelector<HTMLCanvasElement>('#solar-canvas');
const system = document.querySelector<HTMLElement>('#solar-system');
const clock = document.querySelector<HTMLElement>('#solar-time');
const sceneLabel = document.querySelector<HTMLElement>('.solar-caption span:first-child');
const zoomInput = document.querySelector<HTMLInputElement>('#cosmic-zoom');
const zoomStatus = document.querySelector<HTMLOutputElement>('#cosmic-zoom-status');
const zoomLocation = document.querySelector<HTMLElement>('#zoom-location');
const focusReturn = document.querySelector<HTMLButtonElement>('#object-focus-return');
const context = canvas?.getContext('2d');

if (canvas && system && context) {
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
    dragMode: 'solar' as 'solar' | 'galaxy' | 'focus',
  };
  const galaxyCamera = {
    rotation: 0,
    tilt: 1,
    resetting: false,
    resetStartedAt: 0,
    resetRotation: 0,
    resetTilt: 1,
  };
  const objectFocus: FocusState = {
    target: null,
    progress: 0,
    exiting: false,
    child: null,
    childProgress: 0,
    childExiting: false,
    longitude: 0,
    latitude: 0,
    childLongitude: 0,
    childLatitude: 0,
    resetLongitude: 0,
    resetLatitude: 0,
    resetting: false,
    resetStartedAt: 0,
    previousLabel: '',
  };
  let activeFocusCandidate: FocusTarget | null = null;
  let pressedFocusCandidate: FocusTarget | null = null;
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
  let zoomLocationState = 'solar';
  let zoomLocationTimer = 0;

  const setZoomLocation = (state: string, copy: string) => {
    if (!zoomLocation || state === zoomLocationState) return;
    zoomLocationState = state;
    window.clearTimeout(zoomLocationTimer);
    if (reducedMotion) {
      zoomLocation.textContent = copy;
      return;
    }
    zoomLocation.classList.remove('is-changing');
    void zoomLocation.offsetWidth;
    zoomLocation.classList.add('is-changing');
    zoomLocationTimer = window.setTimeout(() => {
      zoomLocation.textContent = copy;
    }, 180);
  };

  const beginObjectFocus = (target: FocusTarget) => {
    objectFocus.target = target;
    objectFocus.progress = 0;
    objectFocus.exiting = false;
    objectFocus.child = null;
    objectFocus.childProgress = 0;
    objectFocus.childExiting = false;
    objectFocus.longitude = 0;
    objectFocus.latitude = 0;
    objectFocus.resetting = false;
    objectFocus.previousLabel = sceneLabel?.textContent ?? '';
    activeFocusCandidate = null;
    system.classList.add('is-object-focus');
    if (focusReturn) {
      focusReturn.hidden = false;
      focusReturn.textContent = '[ ← return to previous view ]';
    }
    if (zoomInput) zoomInput.disabled = true;
    setZoomLocation(`focus:${target.id}`, target.name === 'Earth' ? 'on planet Earth.' : `near ${target.name}.`);
    if (sceneLabel) sceneLabel.textContent = `${target.name.toUpperCase()} / ${target.kind === 'galactic' ? 'DEEP-SPACE VIEW' : 'PLANETARY VIEW'}`;
  };

  const leaveObjectFocus = () => {
    if (objectFocus.child && !objectFocus.childExiting) {
      objectFocus.childExiting = true;
      camera.dragging = false;
      system.classList.remove('is-dragging');
      if (focusReturn) {
        focusReturn.disabled = true;
        focusReturn.textContent = '[ returning to Earth… ]';
      }
      return;
    }
    if (!objectFocus.target || objectFocus.exiting) return;
    objectFocus.exiting = true;
    camera.dragging = false;
    system.classList.remove('is-dragging');
    if (focusReturn) {
      focusReturn.disabled = true;
      focusReturn.textContent = '[ returning to previous view… ]';
    }
  };

  const beginChildFocus = (target: FocusTarget) => {
    objectFocus.child = target;
    objectFocus.childProgress = 0;
    objectFocus.childExiting = false;
    objectFocus.childLongitude = 0;
    objectFocus.childLatitude = 0;
    activeFocusCandidate = null;
    if (focusReturn) focusReturn.textContent = '[ ← return to Earth ]';
    setZoomLocation(`focus:${target.id}`, target.kind === 'moon' ? 'near the Moon.' : 'aboard the ISS.');
    if (sceneLabel) sceneLabel.textContent = target.kind === 'moon' ? 'MOON / LUNAR VIEW' : 'ISS / ORBITAL VIEW';
  };

  reducedMotionQuery.addEventListener('change', (event) => {
    reducedMotion = event.matches;
  });

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
    if (objectFocus.target) {
      const focusTarget = objectFocus.exiting ? 0 : 1;
      objectFocus.progress += (focusTarget - objectFocus.progress) * (reducedMotion ? 1 : Math.min(.11, frameDelta * .0034));
      if (objectFocus.exiting && objectFocus.progress < .012) {
        objectFocus.target = null;
        objectFocus.progress = 0;
        objectFocus.exiting = false;
        system.classList.remove('is-object-focus');
        if (focusReturn) {
          focusReturn.hidden = true;
          focusReturn.disabled = false;
        }
        if (zoomInput) zoomInput.disabled = false;
        if (cosmicZoom.target >= .5) setZoomLocation('milky-way', 'in the Milky Way.');
        else setZoomLocation('solar', 'in the solar system.');
        if (sceneLabel) sceneLabel.textContent = objectFocus.previousLabel;
      }
    }
    if (objectFocus.child) {
      const childTarget = objectFocus.childExiting ? 0 : 1;
      objectFocus.childProgress += (childTarget - objectFocus.childProgress) * (reducedMotion ? 1 : Math.min(.11, frameDelta * .0034));
      // At 6% linear progress, smoothstep leaves under 1.1% of the child scene
      // visible. Complete here so the controls match the perceived end of the zoom.
      if (objectFocus.childExiting && objectFocus.childProgress < .06) {
        objectFocus.child = null;
        objectFocus.childProgress = 0;
        objectFocus.childExiting = false;
        if (focusReturn) {
          focusReturn.disabled = false;
          focusReturn.textContent = '[ ← return to previous view ]';
        }
        setZoomLocation('focus:planet:Earth', 'on planet Earth.');
        if (sceneLabel) sceneLabel.textContent = 'EARTH / PLANETARY VIEW';
      }
    }
    cosmicZoom.current += (cosmicZoom.target - cosmicZoom.current) * (reducedMotion ? 1 : .055);
    const outwardZoom = Math.max(0, cosmicZoom.current);
    const focusedPlanet = objectFocus.target?.kind === 'planet'
      ? PLANETS.find((planet) => planet.name === objectFocus.target?.name) ?? null
      : null;
    const planetSceneFocus = focusedPlanet ? smoothstep(objectFocus.progress) : 0;
    const galaxyProgress = smoothstep((outwardZoom - .24) / .76);
    const localDetailOpacity = 1 - smoothstep((outwardZoom - .2) / .26);
    const solarSystemScale = Math.pow(.055, Math.min(1, outwardZoom / .7));
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
    const now = getOrbitDate(frameTime);
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
    if (objectFocus.resetting) {
      const progress = Math.min(1, (frameTime - objectFocus.resetStartedAt) / 700);
      const eased = 1 - (1 - progress) ** 3;
      const longitudeDifference = ((-objectFocus.resetLongitude + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      objectFocus.longitude = objectFocus.resetLongitude + longitudeDifference * eased;
      objectFocus.latitude = objectFocus.resetLatitude * (1 - eased);
      if (progress === 1) {
        objectFocus.longitude = 0;
        objectFocus.latitude = 0;
        objectFocus.resetting = false;
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
    const finalSolOffset = galacticOffset(GALACTIC_SOL.x, GALACTIC_SOL.y, finalGalaxyRadius);
    const currentSolOffset = galacticOffset(GALACTIC_SOL.x, GALACTIC_SOL.y, galaxyRadius);
    let centerX = viewportCenterX + finalSolOffset.x * galaxyProgress;
    let centerY = viewportCenterY + finalSolOffset.y * galaxyProgress;
    const galaxyCoreX = centerX - currentSolOffset.x;
    const galaxyCoreY = centerY - currentSolOffset.y;
    const galaxyAlpha = smoothstep((cosmicZoom.current - .28) / .34);
    const localSkyOpacity = 1 - smoothstep((cosmicZoom.current - .06) / .24);
    // Leave enough room for Neptune even at the nearest point in the projection.
    const baseWorldScale = width < 600
      ? Math.min(width / 116, height / 54)
      : Math.min(width / 104, height / 50);
    const focusedSceneScale = 1 + planetSceneFocus * 13;
    const worldScale = baseWorldScale * (1 - plutoReveal * .11) * solarSystemScale * focusedSceneScale;
    const cameraDistance = 145;

    const cameraProjection = (world: Vec3) => {
      let point = rotateZ(world, cameraRoll);
      point = rotateX(point, cameraPitch);
      point = rotateY(point, cameraYaw);
      const perspective = cameraDistance / (cameraDistance - point.z);
      return {
        x: point.x * worldScale * perspective,
        y: point.y * worldScale * perspective,
        z: point.z,
        scale: perspective,
      };
    };
    if (focusedPlanet) {
      const focusedOrbit = solveOrbit(focusedPlanet, now);
      const focusedOffset = cameraProjection(orbitalPoint(focusedPlanet, focusedOrbit.angle, focusedOrbit.distance));
      const focusedCentering = 1 - (1 - planetSceneFocus) / focusedSceneScale;
      centerX += (viewportCenterX - (centerX + focusedOffset.x)) * focusedCentering;
      centerY += (viewportCenterY - (centerY + focusedOffset.y)) * focusedCentering;
    }
    const cameraTransform = (world: Vec3) => {
      const point = cameraProjection(world);
      return { ...point, x: centerX + point.x, y: centerY + point.y };
    };

    const starParallaxX = pointer.x * 8;
    const starParallaxY = pointer.y * 5;
    for (const glyph of ['.', '*', '+']) {
      context.fillStyle = glyph === '+' ? '#fabd2f' : '#928374';
      context.font = `${glyph === '+' ? 14 : 11}px "DM Mono", monospace`;
      for (const star of STARS) {
        if (star.glyph !== glyph) continue;
        const pulse = reducedMotion ? .45 : .5 + .5 * Math.sin(seconds * star.speed * 2.2 + star.phase);
        context.globalAlpha = (.12 + pulse * (glyph === '+' ? .78 : .4)) * localSkyOpacity;
        context.fillText(glyph, star.x * width + starParallaxX, star.y * height + starParallaxY);
      }
    }
    context.globalAlpha = 1;

    if (galaxyAlpha > .001) {
      context.font = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
      for (const star of GALAXY_STARS) {
        const offset = galacticOffset(star.x, star.y, galaxyRadius);
        const starX = galaxyCoreX + offset.x;
        const starY = galaxyCoreY + offset.y;
        if (starX < -12 || starX > width + 12 || starY < -12 || starY > height + 12) continue;
        const twinkle = reducedMotion ? .7 : .68 + Math.sin(seconds * .9 + star.phase) * .22;
        context.globalAlpha = galaxyAlpha * twinkle * (.5 + (1 - star.radius) * .42 + star.strength * .16);
        context.fillStyle = star.radius < .2 ? '#ebdbb2' : star.glyph === '+' ? '#d3869b' : star.glyph === '*' ? '#b8bb26' : '#928374';
        context.fillText(star.glyph, starX, starY);
      }
      for (const star of ORION_SPUR_STARS) {
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
        const projected = cameraTransform(ORBIT_POINTS[planetIndex][sample]);
        const next = cameraTransform(ORBIT_POINTS[planetIndex][(sample + 1) % ORBIT_SAMPLES]);
        const dx = next.x - projected.x;
        const dy = next.y - projected.y;
        const slope = Math.abs(dy / (dx || .001));
        const glyph = slope > 2.1 ? '|' : slope > .55 ? (dx * dy > 0 ? '\\' : '/') : '-';
        const mark = { ...projected, glyph, earth: planet.name === 'Earth', alpha: (planet.name === 'Earth' ? .78 : .62) * localDetailOpacity * (1 - planetSceneFocus), reveal: planet.easterEgg ? plutoReveal : 1 };
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

    const bodies = PLANETS.filter((planet) => !planet.easterEgg || easterEgg.unlocked).map((planet) => {
      const orbit = solveOrbit(planet, now);
      const world = orbitalPoint(planet, orbit.angle, orbit.distance);
      return { planet, world, reveal: planet.easterEgg ? plutoReveal : 1, position: heliocentricPosition(planet, orbit.angle, orbit.distance), ...cameraTransform(world) };
    }).sort((first, second) => first.z - second.z);

    const canvasBounds = canvas.getBoundingClientRect();
    const localPointerX = pointer.clientX - canvasBounds.left;
    const localPointerY = pointer.clientY - canvasBounds.top;
    const hoveredBody = pointer.active && !camera.dragging && !objectFocus.target && localDetailOpacity > .45
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
    const hoveredGalacticObject = pointer.active && !camera.dragging && !objectFocus.target && galaxyObjectOpacity > .35
      ? galacticObjects.reduce<typeof galacticObjects[number] | null>((closest, object) => {
          const distance = Math.hypot(object.x - localPointerX, object.y - localPointerY);
          const closestDistance = closest ? Math.hypot(closest.x - localPointerX, closest.y - localPointerY) : Infinity;
          return distance < 30 && distance < closestDistance ? object : closest;
        }, null)
      : null;

    activeFocusCandidate = hoveredBody
      ? {
          id: `planet:${hoveredBody.planet.name}`,
          name: hoveredBody.planet.name,
          kind: 'planet',
          color: hoveredBody.planet.color,
          subtitle: hoveredBody.planet.easterEgg ? 'dwarf planet' : 'planet',
          detail: `${hoveredBody.position.distance.toFixed(3)} au from Sol`,
          originX: hoveredBody.x,
          originY: hoveredBody.y,
        }
      : hoveredGalacticObject
          ? {
              id: `galactic:${hoveredGalacticObject.object.name}`,
              name: hoveredGalacticObject.object.name,
              kind: 'galactic',
              color: hoveredGalacticObject.object.color,
              subtitle: hoveredGalacticObject.object.kind,
              detail: `${hoveredGalacticObject.object.distance} / ${hoveredGalacticObject.object.detail}`,
              originX: hoveredGalacticObject.x,
              originY: hoveredGalacticObject.y,
            }
          : null;

    const drawBody = (body: typeof bodies[number]) => {
      const { planet } = body;
      const isFocusedPlanet = focusedPlanet === planet;
      const depthScale = Math.max(.68, Math.min(1.55, body.scale));
      const isHovered = body === hoveredBody;
      const cosmicGlyphScale = Math.max(.3, Math.sqrt(solarSystemScale));
      const fontSize = (planet.easterEgg ? 16 : Math.max(7, 12.5 * planet.size * depthScale) * (isHovered ? 1.14 : 1)) * cosmicGlyphScale;
      const lines = planet.easterEgg || (fontSize < 9 && solarSystemScale < .45) ? [planet.glyph] : planet.sprite;
      const lineHeight = fontSize * .78;
      const bodyOpacity = body.reveal * localDetailOpacity * (isFocusedPlanet ? 1 : 1 - planetSceneFocus);
      const focusedDetailReveal = isFocusedPlanet ? smoothstep((planetSceneFocus - .08) / .28) : 0;
      const focusedSpriteScale = isFocusedPlanet ? 1 + planetSceneFocus * 2 : 1;
      context.fillStyle = planet.color;
      context.shadowBlur = 0;
      context.strokeStyle = '#1d2021';
      context.lineJoin = 'round';
      context.globalAlpha = bodyOpacity * (1 - focusedDetailReveal);
      context.font = `bold ${fontSize * focusedSpriteScale}px "DM Mono", monospace`;
      context.lineWidth = Math.max(2, fontSize * .2);
      lines.forEach((line, index) => {
        const lineY = body.y + (index - (lines.length - 1) / 2) * lineHeight * focusedSpriteScale;
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

    const drawPlanetarySystem = (body: typeof bodies[number], foreground: boolean) => {
      const system = PLANETARY_MOON_SYSTEMS[body.planet.name];
      if (!system || body.reveal < .35) return;
      const opacity = localDetailOpacity * (1 - planetSceneFocus);
      if (opacity <= .01) return;
      context.font = `${Math.max(5.5, 7 * Math.sqrt(solarSystemScale))}px "DM Mono", monospace`;
      context.fillStyle = body.planet.name === 'Earth' ? '#bdae93' : '#928374';
      system.radii.forEach((radius, moonIndex) => {
        for (let sample = 0; sample < 28; sample += 3) {
          const angle = sample / 28 * Math.PI * 2;
          let offset: Vec3 = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 };
          offset = rotateX(offset, system.tilt);
          const projected = cameraTransform({ x: body.world.x + offset.x, y: body.world.y + offset.y, z: body.world.z + offset.z });
          if ((projected.z >= body.z) !== foreground) continue;
          context.globalAlpha = opacity * .22;
          context.fillText('.', projected.x, projected.y);
        }
        const moonAngle = seconds * system.speeds[moonIndex] + moonIndex * 1.73 + body.planet.displayRadius;
        let moonOffset: Vec3 = { x: Math.cos(moonAngle) * radius, y: Math.sin(moonAngle) * radius, z: 0 };
        moonOffset = rotateX(moonOffset, system.tilt);
        const moon = cameraTransform({ x: body.world.x + moonOffset.x, y: body.world.y + moonOffset.y, z: body.world.z + moonOffset.z });
        if ((moon.z >= body.z) !== foreground) return;
        context.globalAlpha = opacity * .86;
        context.fillText(moonIndex > 1 ? 'o' : '.', moon.x, moon.y);
      });
      context.globalAlpha = 1;
    };

    drawMarks(farMarks);
    drawMarks(nearMarks);

    context.font = `${Math.max(5.5, 7.5 * Math.sqrt(solarSystemScale))}px "DM Mono", monospace`;
    context.fillStyle = '#928374';
    for (const asteroid of ASTEROID_BELT) {
      const angle = asteroid.angle + (reducedMotion ? 0 : seconds * (.0045 + asteroid.phase * .0015));
      let point: Vec3 = { x: Math.cos(angle) * asteroid.radius, y: Math.sin(angle) * asteroid.radius, z: 0 };
      point = rotateX(point, asteroid.inclination);
      point = rotateZ(point, asteroid.node);
      const projected = cameraTransform(point);
      context.globalAlpha = localDetailOpacity * (1 - planetSceneFocus) * (.14 + asteroid.phase * .28);
      context.fillText(asteroid.glyph, projected.x, projected.y);
    }
    context.globalAlpha = 1;

    const sunPulse = reducedMotion ? 1 : 1 + Math.sin(seconds * 2.1) * .08;
    const sunSize = 12 * sunPulse * Math.max(.28, Math.sqrt(solarSystemScale));
    context.fillStyle = '#fabd2f';
    context.globalAlpha = localDetailOpacity * (1 - planetSceneFocus) * (.24 + Math.sin(seconds * 2.1) * .05);
    context.shadowColor = '#fe8019';
    context.shadowBlur = 35;
    context.font = `${sunSize * 3.4}px "DM Mono", monospace`;
    context.fillText('·', centerX, centerY);
    context.globalAlpha = localDetailOpacity * (1 - planetSceneFocus);
    context.shadowBlur = 15;
    context.font = `bold ${sunSize}px "DM Mono", monospace`;
    ['    \\  |  /    ', "  `. \\ | / .'  ", '----  (@)  ----', "  .' / | \\ `.  ", '    /  |  \\    '].forEach((line, index) => context.fillText(line, centerX, centerY + (index - 2) * sunSize * .72));
    context.shadowBlur = 0;

    // Keep every body visible so each of the eight orbit lanes has a clear owner.
    bodies.forEach((body) => {
      drawPlanetarySystem(body, false);
      drawBody(body);
      drawPlanetarySystem(body, true);
    });
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
      drawReadout(context, {
        lines: [
          `[ ${hoveredBody.planet.name.toUpperCase()} ]`,
          `lon  ${hoveredBody.position.longitude.toFixed(2).padStart(6)} deg`,
          `lat  ${`${hoveredBody.position.latitude >= 0 ? '+' : '-'}${Math.abs(hoveredBody.position.latitude).toFixed(2)}`.padStart(6)} deg`,
          `r    ${hoveredBody.position.distance.toFixed(3).padStart(6)} au`,
          '[ click to zoom ]',
        ],
        anchorX: hoveredBody.x,
        anchorY: hoveredBody.y,
        viewportWidth: width,
        viewportHeight: height,
        titleColor: hoveredBody.planet.color,
        width: 174,
      });
    }

    if (hoveredGalacticObject) {
      drawReadout(context, {
        lines: [
          `[ ${hoveredGalacticObject.object.name.toUpperCase()} ]`,
          hoveredGalacticObject.object.kind,
          `dist  ${hoveredGalacticObject.object.distance}`,
          hoveredGalacticObject.object.detail,
          '[ click to zoom ]',
        ],
        anchorX: hoveredGalacticObject.x,
        anchorY: hoveredGalacticObject.y,
        viewportWidth: width,
        viewportHeight: height,
        titleColor: hoveredGalacticObject.object.color,
      });
    }

    if (objectFocus.target && objectFocus.progress > .001) {
      const target = objectFocus.target;
      const focusEase = smoothstep(objectFocus.progress);
      const focusedPlanetBody = focusedPlanet ? bodies.find((body) => body.planet === focusedPlanet) : null;
      const isPlanetDestination = target.kind === 'planet' && !!focusedPlanetBody;
      const focusCenterX = focusedPlanetBody?.x ?? target.originX + (viewportCenterX - target.originX) * focusEase;
      const focusCenterY = focusedPlanetBody?.y ?? target.originY + (viewportCenterY - target.originY) * focusEase;
      const planetGrowth = smoothstep((planetSceneFocus - .08) / .92) ** 1.45;
      const focusScale = isPlanetDestination ? .1 + planetGrowth * .9 : .18 + focusEase * .82;
      const objectReveal = isPlanetDestination ? smoothstep((planetSceneFocus - .06) / .3) : focusEase;
      if (!isPlanetDestination) {
        context.globalAlpha = focusEase;
        context.fillStyle = '#1d2021';
        context.fillRect(0, 0, width, height);
      }
      context.globalAlpha = objectReveal;

      const drawFocusField = (radius: number, count: number, glyphs = ['.', ':', '*']) => {
        context.font = `${Math.max(5, (width < 600 ? 7 : 9) * focusScale)}px "DM Mono", monospace`;
        for (let index = 0; index < count; index++) {
          const baseAngle = index / count * Math.PI * 2 + objectFocus.longitude;
          const spread = .48 + randomUnit(index + target.name.length * 37) * .55;
          const fieldRadius = radius * spread * focusScale;
          const x = focusCenterX + Math.cos(baseAngle) * fieldRadius;
          const y = focusCenterY + Math.sin(baseAngle) * fieldRadius * (.32 + Math.cos(objectFocus.latitude) * .3);
          context.globalAlpha = objectReveal * (.12 + randomUnit(index + 33) * .32);
          context.fillStyle = index % 17 === 0 ? target.color : '#665c54';
          context.fillText(glyphs[index % glyphs.length], x, y);
        }
      };

      const sphereGlyph = (name: string, longitude: number, latitude: number, x: number, y: number) => {
        if (name === 'Earth') {
          const mapX = Math.floor((((longitude / (Math.PI * 2) + .5) % 1 + 1) % 1) * EARTH_MAP_WIDTH);
          const mapY = Math.max(0, Math.min(EARTH_MAP_HEIGHT - 1, Math.floor((.5 - latitude / Math.PI) * EARTH_MAP_HEIGHT)));
          return EARTH_MAP[mapY][mapX];
        }
        const noise = randomUnit(Math.floor((longitude + Math.PI) * 91) + Math.floor((latitude + Math.PI / 2) * 137) + name.length * 71);
        if (name === 'Jupiter') {
          if (latitude > -.28 && latitude < -.08 && longitude > .15 && longitude < .75) return 'o';
          return Math.floor((latitude + Math.PI / 2) * 9) % 2 ? '=' : '~';
        }
        if (name === 'Saturn') return Math.floor((latitude + Math.PI / 2) * 8) % 2 ? ':' : '=';
        if (name === 'Venus') return noise > .68 ? '~' : noise > .34 ? '=' : ':';
        if (name === 'Mars') return Math.abs(latitude) > 1.15 ? '*' : noise > .72 ? 'o' : noise > .4 ? ':' : '.';
        if (name === 'Mercury' || name === 'Moon') return noise > .78 ? 'o' : noise > .42 ? ':' : '.';
        if (name === 'Uranus') return Math.floor((latitude + Math.PI / 2) * 7) % 3 ? '~' : '-';
        if (name === 'Neptune') return noise > .76 ? '=' : '~';
        if (name === 'Pluto') return noise > .7 ? ':' : '.';
        return noise > .55 ? ':' : '.';
      };

      const focusedSphereColumns = width < 600 ? 37 : 49;
      const focusedSphereRows = width < 600 ? 19 : 25;
      const focusedSphereFontSize = (width < 600 ? 10 : 12.5) * focusScale;

      const drawFocusedSphere = () => {
        const columns = focusedSphereColumns;
        const rows = focusedSphereRows;
        const fontSize = focusedSphereFontSize;
        context.font = `bold ${fontSize}px "DM Mono", monospace`;
        const characterWidth = context.measureText('M').width * .76;
        const lineHeight = fontSize * .82;
        const spin = (reducedMotion ? 0 : seconds * .055) + objectFocus.longitude;
        const latitudeTilt = objectFocus.latitude;
        const sphereWidth = columns * characterWidth;
        const sphereHeight = rows * lineHeight;
        if (target.name === 'Saturn') {
          for (let sample = 0; sample < 112; sample++) {
            const angle = sample / 112 * Math.PI * 2;
            const ringX = Math.cos(angle) * sphereWidth * .93;
            const ringY = Math.sin(angle) * sphereHeight * .24;
            const tiltedX = ringX * Math.cos(objectFocus.longitude * .22) - ringY * Math.sin(objectFocus.longitude * .22);
            const tiltedY = (ringX * Math.sin(objectFocus.longitude * .22) + ringY * Math.cos(objectFocus.longitude * .22)) * Math.cos(latitudeTilt);
            context.globalAlpha = objectReveal * (Math.sin(angle) < 0 ? .28 : .76);
            context.fillStyle = Math.sin(angle) < 0 ? '#665c54' : target.color;
            context.fillText(sample % 3 === 0 ? '=' : '-', focusCenterX + tiltedX, focusCenterY + tiltedY);
          }
        }
        for (let row = 0; row < rows; row++) {
          const normalizedY = (row + .5 - rows / 2) / (rows / 2);
          const lineY = focusCenterY + (row - (rows - 1) / 2) * lineHeight;
          for (let column = 0; column < columns; column++) {
            const normalizedX = (column + .5 - columns / 2) / (columns / 2);
            if (normalizedX ** 2 + normalizedY ** 2 > 1) continue;
            const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
            const latitudeY = normalizedY * Math.cos(latitudeTilt) + sphereZ * Math.sin(latitudeTilt);
            const latitudeZ = -normalizedY * Math.sin(latitudeTilt) + sphereZ * Math.cos(latitudeTilt);
            const longitude = Math.atan2(normalizedX, latitudeZ) + spin;
            const latitude = Math.asin(-latitudeY);
            const character = sphereGlyph(target.name, longitude, latitude, normalizedX, normalizedY);
            context.globalAlpha = objectReveal * (.62 + sphereZ * .38);
            context.fillStyle = target.name === 'Earth'
              ? character === '#' ? '#b8bb26' : character === '%' ? '#d79921' : character === '*' ? '#ebdbb2' : '#83a598'
              : target.color;
            context.fillText(character, focusCenterX + (column + .5 - columns / 2) * characterWidth, lineY);
          }
        }
      };

      const earthSatelliteReveal = target.name === 'Earth' ? smoothstep((planetSceneFocus - .28) / .45) : 0;
      const focusedEarthRadius = focusedSphereRows * focusedSphereFontSize * .82 / 2;
      const focusedEarthOrbitOffset = (angle: number, radius: number, inclination: number, node: number) => {
        let point: Vec3 = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 };
        point = rotateX(point, inclination);
        point = rotateZ(point, node);
        point = rotateY(point, -objectFocus.longitude);
        return rotateX(point, objectFocus.latitude);
      };
      const focusedMoonRadius = width < 600
        ? Math.min(focusedEarthRadius * 1.55, width * .42)
        : Math.min(focusedEarthRadius * 1.65, height * .38);
      const focusedMoonAngle = ((Date.now() - J2000) / 86400000 / 27.321661 * Math.PI * 2) + (reducedMotion ? 0 : seconds * .014);
      const focusedMoonOffset = focusedEarthOrbitOffset(focusedMoonAngle, focusedMoonRadius, 50 * DEG, -18 * DEG);
      const focusedIssRadius = focusedEarthRadius * 1.13;
      const focusedIssAngle = 1.2 + (reducedMotion ? 0 : seconds * (Math.PI * 2 / 70));
      const focusedIssOffset = focusedEarthOrbitOffset(focusedIssAngle, focusedIssRadius, 44 * DEG, 24 * DEG);
      const focusedMoonPosition = { x: focusCenterX + focusedMoonOffset.x, y: focusCenterY + focusedMoonOffset.y };
      const focusedIssPosition = { x: focusCenterX + focusedIssOffset.x, y: focusCenterY + focusedIssOffset.y };
      const hoveredFocusedEarthObject = earthSatelliteReveal > .35 && pointer.active && !camera.dragging
        && !objectFocus.child
        ? [
            { id: 'moon' as const, ...focusedMoonPosition },
            { id: 'iss' as const, ...focusedIssPosition },
          ].reduce<{ id: 'moon' | 'iss'; x: number; y: number } | null>((closest, object) => {
            const distance = Math.hypot(object.x - localPointerX, object.y - localPointerY);
            const closestDistance = closest ? Math.hypot(closest.x - localPointerX, closest.y - localPointerY) : Infinity;
            return distance < 30 && distance < closestDistance ? object : closest;
          }, null)
        : null;
      if (hoveredFocusedEarthObject) {
        const isMoon = hoveredFocusedEarthObject.id === 'moon';
        activeFocusCandidate = {
          id: hoveredFocusedEarthObject.id,
          name: isMoon ? 'Moon' : 'International Space Station',
          kind: isMoon ? 'moon' : 'station',
          color: isMoon ? '#bdae93' : '#8ec07c',
          subtitle: isMoon ? 'natural satellite' : 'orbital laboratory',
          detail: isMoon ? 'mean distance 384,400 km' : 'low Earth orbit / ~90 min period',
          originX: hoveredFocusedEarthObject.x,
          originY: hoveredFocusedEarthObject.y,
        };
      }

      const drawFocusedEarthSatellites = (foreground: boolean) => {
        if (earthSatelliteReveal <= .001) return;
        const drawOrbit = (radius: number, inclination: number, node: number, samples: number, color: string, alpha: number) => {
          context.font = `${Math.max(5, (width < 600 ? 7 : 8) * focusScale)}px "DM Mono", monospace`;
          context.fillStyle = color;
          for (let sample = 0; sample < samples; sample += 2) {
            const offset = focusedEarthOrbitOffset(sample / samples * Math.PI * 2, radius, inclination, node);
            if ((offset.z >= 0) !== foreground) continue;
            const next = focusedEarthOrbitOffset((sample + 1) / samples * Math.PI * 2, radius, inclination, node);
            const dx = next.x - offset.x;
            const dy = next.y - offset.y;
            const slope = Math.abs(dy / (dx || .001));
            const glyph = slope > 2.2 ? '|' : slope > .6 ? (dx * dy > 0 ? '\\' : '/') : '-';
            context.globalAlpha = earthSatelliteReveal * alpha;
            context.fillText(glyph, focusCenterX + offset.x, focusCenterY + offset.y);
          }
        };
        drawOrbit(focusedMoonRadius, 50 * DEG, -18 * DEG, 96, '#928374', .66);
        drawOrbit(focusedIssRadius, 44 * DEG, 24 * DEG, 72, '#665c54', .52);

        if ((focusedMoonOffset.z >= 0) === foreground) {
          const moonFontSize = Math.max(5, (width < 600 ? 7 : 9) * focusScale);
          context.globalAlpha = earthSatelliteReveal;
          context.fillStyle = '#bdae93';
          context.strokeStyle = '#1d2021';
          context.lineWidth = 2;
          context.font = `bold ${moonFontSize}px "DM Mono", monospace`;
          [' .-. ', '(.:)', " '-' "].forEach((line, index) => {
            const lineY = focusedMoonPosition.y + (index - 1) * moonFontSize * .76;
            context.strokeText(line, focusedMoonPosition.x, lineY);
            context.fillText(line, focusedMoonPosition.x, lineY);
          });
          if (hoveredFocusedEarthObject?.id === 'moon') {
            context.fillStyle = '#ebdbb2';
            context.fillText('[', focusedMoonPosition.x - 22 * focusScale, focusedMoonPosition.y);
            context.fillText(']', focusedMoonPosition.x + 22 * focusScale, focusedMoonPosition.y);
          }
        }
        if ((focusedIssOffset.z >= 0) === foreground) {
          const issFontSize = Math.max(5, (width < 600 ? 7 : 9) * focusScale);
          context.globalAlpha = earthSatelliteReveal;
          context.fillStyle = '#8ec07c';
          context.strokeStyle = '#1d2021';
          context.lineWidth = 2;
          context.font = `bold ${issFontSize}px "DM Mono", monospace`;
          context.strokeText('=-[ISS]-=', focusedIssPosition.x, focusedIssPosition.y);
          context.fillText('=-[ISS]-=', focusedIssPosition.x, focusedIssPosition.y);
          if (hoveredFocusedEarthObject?.id === 'iss') {
            context.fillStyle = '#ebdbb2';
            context.fillText('[', focusedIssPosition.x - 38 * focusScale, focusedIssPosition.y);
            context.fillText(']', focusedIssPosition.x + 38 * focusScale, focusedIssPosition.y);
          }
        }
        context.globalAlpha = 1;
      };

      if (target.kind === 'planet' || target.kind === 'moon') {
        drawFocusField(width < 600 ? 155 : 245, 72);
        if (target.name === 'Earth') drawFocusedEarthSatellites(false);
        drawFocusedSphere();
        if (target.name === 'Earth') drawFocusedEarthSatellites(true);
      } else {
        drawFocusField(width < 600 ? 145 : 235, target.kind === 'galactic' ? 116 : 62, target.kind === 'galactic' ? ['.', ':', '*', '+'] : ['.', '-']);
        const lines = FOCUSED_ART[target.name] ?? [target.name];
        const artFontSize = (width < 600 ? 14 : 22) * focusScale;
        context.font = `bold ${artFontSize}px "DM Mono", monospace`;
        context.fillStyle = target.color;
        context.globalAlpha = objectReveal;
        lines.forEach((line, index) => {
          const parallax = Math.sin(objectFocus.longitude + index * .7) * artFontSize * .55;
          context.fillText(line, focusCenterX + parallax, focusCenterY + (index - (lines.length - 1) / 2) * artFontSize * .9);
        });
      }

      if (hoveredFocusedEarthObject) {
        const isMoon = hoveredFocusedEarthObject.id === 'moon';
        drawReadout(context, {
          lines: isMoon
            ? ['[ MOON ]', 'natural satellite', 'mean r  384,400 km', 'sidereal 27.3 days', '[ click to zoom ]']
            : ['[ ISS ]', 'orbital laboratory', 'alt     ~400 km', 'period  ~90 min', '[ click to zoom ]'],
          anchorX: hoveredFocusedEarthObject.x,
          anchorY: hoveredFocusedEarthObject.y,
          viewportWidth: width,
          viewportHeight: height,
          titleColor: isMoon ? '#bdae93' : '#8ec07c',
          width: 218,
          openAwayFromCenter: true,
          opacity: earthSatelliteReveal,
        });
      }

      const infoY = Math.min(height - 72, focusCenterY + (width < 600 ? 150 : 205) * focusScale);
      const infoReveal = isPlanetDestination ? smoothstep((planetSceneFocus - .45) / .4) : focusEase;
      context.globalAlpha = infoReveal;
      context.fillStyle = target.color;
      context.font = `bold ${width < 600 ? 11 : 13}px "DM Mono", monospace`;
      context.fillText(`[ ${target.name.toUpperCase()} ]`, viewportCenterX, infoY);
      context.fillStyle = '#a89984';
      context.font = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
      context.fillText(`${target.subtitle} · ${target.detail}`, viewportCenterX, infoY + 21);
      context.fillText('drag to inspect · double-click to reset orientation', viewportCenterX, infoY + 42);

      if (objectFocus.child && objectFocus.childProgress > .001) {
        const child = objectFocus.child;
        const childEase = smoothstep(objectFocus.childProgress);
        const childGrowth = smoothstep((childEase - .08) / .92) ** 1.45;
        const childScale = .1 + childGrowth * .9;
        const childReveal = smoothstep((childEase - .06) / .3);
        const childCenterX = child.originX + (viewportCenterX - child.originX) * childEase;
        const childCenterY = child.originY + (viewportCenterY - child.originY) * childEase;
        context.globalAlpha = childEase;
        context.fillStyle = '#1d2021';
        context.fillRect(0, 0, width, height);

        context.font = `${Math.max(5, (width < 600 ? 7 : 9) * childScale)}px "DM Mono", monospace`;
        for (let index = 0; index < 78; index++) {
          const angle = index / 78 * Math.PI * 2 + objectFocus.childLongitude;
          const radius = (width < 600 ? 155 : 245) * (.48 + randomUnit(index + 2101) * .55) * childScale;
          context.globalAlpha = childReveal * (.12 + randomUnit(index + 2201) * .3);
          context.fillStyle = index % 19 === 0 ? child.color : '#665c54';
          context.fillText(index % 11 === 0 ? '*' : '.', childCenterX + Math.cos(angle) * radius, childCenterY + Math.sin(angle) * radius * .58);
        }

        if (child.kind === 'moon') {
          const columns = width < 600 ? 37 : 49;
          const rows = width < 600 ? 19 : 25;
          const fontSize = (width < 600 ? 10 : 12.5) * childScale;
          context.font = `bold ${fontSize}px "DM Mono", monospace`;
          const characterWidth = context.measureText('M').width * .76;
          const lineHeight = fontSize * .82;
          const spin = (reducedMotion ? 0 : seconds * .018) + objectFocus.childLongitude;
          for (let row = 0; row < rows; row++) {
            const normalizedY = (row + .5 - rows / 2) / (rows / 2);
            const lineY = childCenterY + (row - (rows - 1) / 2) * lineHeight;
            for (let column = 0; column < columns; column++) {
              const normalizedX = (column + .5 - columns / 2) / (columns / 2);
              if (normalizedX ** 2 + normalizedY ** 2 > 1) continue;
              const sphereZ = Math.sqrt(Math.max(0, 1 - normalizedX ** 2 - normalizedY ** 2));
              const latitudeY = normalizedY * Math.cos(objectFocus.childLatitude) + sphereZ * Math.sin(objectFocus.childLatitude);
              const latitudeZ = -normalizedY * Math.sin(objectFocus.childLatitude) + sphereZ * Math.cos(objectFocus.childLatitude);
              const longitude = Math.atan2(normalizedX, latitudeZ) + spin;
              const latitude = Math.asin(-latitudeY);
              context.globalAlpha = childReveal * (.6 + sphereZ * .4);
              context.fillStyle = child.color;
              context.fillText(sphereGlyph('Moon', longitude, latitude, normalizedX, normalizedY), childCenterX + (column + .5 - columns / 2) * characterWidth, lineY);
            }
          }
        } else {
          const issLines = [
            '             |             ',
            '===[####]====|====[####]===',
            '      \\_____[O]_____/      ',
            '          /  |  \\          ',
            '         /   |   \\         ',
          ];
          const fontSize = (width < 600 ? 11 : 17) * childScale;
          context.font = `bold ${fontSize}px "DM Mono", monospace`;
          context.fillStyle = child.color;
          context.globalAlpha = childReveal;
          issLines.forEach((line, index) => {
            const parallax = Math.sin(objectFocus.childLongitude + index * .65) * fontSize * .65;
            context.fillText(line, childCenterX + parallax, childCenterY + (index - 2) * fontSize * .86);
          });
        }

        const childInfoY = Math.min(height - 72, childCenterY + (width < 600 ? 150 : 205) * childScale);
        const childInfoReveal = smoothstep((childEase - .45) / .4);
        context.globalAlpha = childInfoReveal;
        context.fillStyle = child.color;
        context.font = `bold ${width < 600 ? 11 : 13}px "DM Mono", monospace`;
        context.fillText(`[ ${child.name.toUpperCase()} ]`, viewportCenterX, childInfoY);
        context.fillStyle = '#a89984';
        context.font = `${width < 600 ? 8 : 10}px "DM Mono", monospace`;
        context.fillText(`${child.subtitle} · ${child.detail}`, viewportCenterX, childInfoY + 21);
        context.fillText('drag to inspect · double-click to reset orientation', viewportCenterX, childInfoY + 42);
      }
      context.globalAlpha = 1;
    }

    context.globalAlpha = .35 * (1 - planetSceneFocus) * (1 - objectFocus.progress);
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
      if (camera.dragMode === 'focus') {
        if (objectFocus.child) {
          objectFocus.childLongitude -= deltaX * .008;
          objectFocus.childLatitude = Math.max(-65 * DEG, Math.min(65 * DEG, objectFocus.childLatitude + deltaY * .006));
        } else {
          objectFocus.resetting = false;
          objectFocus.longitude -= deltaX * .008;
          objectFocus.latitude = Math.max(-65 * DEG, Math.min(65 * DEG, objectFocus.latitude + deltaY * .006));
        }
      } else if (camera.dragMode === 'galaxy') {
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
    pressedFocusCandidate = activeFocusCandidate;
    camera.dragMode = objectFocus.target ? 'focus' : cosmicZoom.current > .55 ? 'galaxy' : 'solar';
    if (camera.dragMode === 'solar') {
      camera.manual = true;
      camera.resetting = false;
      camera.pitch = camera.renderedPitch;
      camera.yaw = camera.renderedYaw;
      camera.roll = camera.renderedRoll;
      pointer.targetX = pointer.x;
      pointer.targetY = pointer.y;
    } else if (camera.dragMode === 'galaxy') {
      galaxyCamera.resetting = false;
    } else {
      objectFocus.resetting = false;
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
    const clickedFocusCandidate = event.type === 'pointerup' && camera.dragDistance < 3
      ? pressedFocusCandidate
      : null;
    if (clickedFocusCandidate) {
      if (objectFocus.target?.name === 'Earth' && (clickedFocusCandidate.kind === 'moon' || clickedFocusCandidate.kind === 'station')) {
        beginChildFocus(clickedFocusCandidate);
      } else if (!objectFocus.target) {
        beginObjectFocus(clickedFocusCandidate);
      }
    }
    if (event.type === 'pointerup' && camera.dragMode === 'solar' && camera.dragDistance >= 3) {
      const startedAt = performance.now();
      orbitClock.anchorDate = getOrbitDate(startedAt);
      orbitClock.startedAt = startedAt;
      orbitClock.active = true;
      orbitClock.returning = false;
    }
    if (event.type === 'pointerup' && camera.dragMode === 'solar' && !clickedFocusCandidate && !easterEgg.unlocked) {
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
    pressedFocusCandidate = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  window.addEventListener('pointerup', finishDrag);
  window.addEventListener('pointercancel', finishDrag);

  canvas.addEventListener('dblclick', (event) => {
    const resetAt = performance.now();
    if (objectFocus.target) {
      if (objectFocus.child) {
        objectFocus.childLongitude = 0;
        objectFocus.childLatitude = 0;
        event.preventDefault();
        return;
      }
      objectFocus.resetting = true;
      objectFocus.resetStartedAt = resetAt;
      objectFocus.resetLongitude = objectFocus.longitude;
      objectFocus.resetLatitude = objectFocus.latitude;
      event.preventDefault();
      return;
    }
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

  focusReturn?.addEventListener('click', leaveObjectFocus);

  zoomInput?.addEventListener('input', () => {
    cosmicZoom.target = Number(zoomInput.value) / 100;
    const location = cosmicZoom.target < .5
      ? ['solar', 'in the solar system.']
      : ['milky-way', 'in the Milky Way.'];
    setZoomLocation(location[0], location[1]);
    const status = cosmicZoom.target < .3
      ? 'LOCAL SYSTEM'
      : cosmicZoom.target < .72
        ? 'INTERSTELLAR'
        : 'MILKY WAY';
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
