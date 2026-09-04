import { DEG } from './math';
import type { FocusState } from './types';

export type PointerState = {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    clientX: number;
    clientY: number;
    active: boolean;
    showsHover: boolean;
};

export type CameraState = {
    manual: boolean;
    dragging: boolean;
    pitch: number;
    yaw: number;
    roll: number;
    renderedPitch: number;
    renderedYaw: number;
    renderedRoll: number;
    resetting: boolean;
    resetStartedAt: number;
    resetPitch: number;
    resetYaw: number;
    resetRoll: number;
    lastX: number;
    lastY: number;
    pointerId: number;
    dragDistance: number;
    dragMode: 'solar' | 'galaxy' | 'focus';
};

export type GalaxyCameraState = {
    rotation: number;
    tilt: number;
    resetting: boolean;
    resetStartedAt: number;
    resetRotation: number;
    resetTilt: number;
};

export type OrbitClockState = {
    active: boolean;
    returning: boolean;
    speed: number;
    anchorDate: number;
    startedAt: number;
    returnFrom: number;
    returnStartedAt: number;
};

export type GalacticClockState = {
    started: boolean;
    speed: number;
    anchorYears: number;
    startedAt: number;
};

export type RotationClockState = {
    started: boolean;
    speed: number;
    anchorHours: number;
    startedAt: number;
};

export const ORBIT_SPEED_PRESETS = [
    { multiplier: 1, label: '1×', description: 'realtime' },
    { multiplier: 3_600, label: '1h/s', description: 'one simulated hour per second' },
    { multiplier: 43_200, label: '12h/s', description: 'twelve simulated hours per second' },
    { multiplier: 604_800, label: '7d/s', description: 'seven simulated days per second' },
    { multiplier: 2_592_000, label: '30d/s', description: 'thirty simulated days per second' },
    { multiplier: 31_557_600, label: '1y/s', description: 'one simulated Julian year per second' },
] as const;
export const DEFAULT_ORBIT_SPEED_PRESET = 1;

export const GALACTIC_SPEED_PRESETS = [
    { yearsPerSecond: 1 / 31_557_600, label: '1×', description: 'realtime' },
    { yearsPerSecond: 1_000_000, label: '1My/s', description: 'one million simulated years per second' },
    { yearsPerSecond: 5_000_000, label: '5My/s', description: 'five million simulated years per second' },
    { yearsPerSecond: 10_000_000, label: '10My/s', description: 'ten million simulated years per second' },
] as const;
export const DEFAULT_GALACTIC_SPEED_PRESET = 1;

export const ROTATION_SPEED_PRESETS = [
    { hoursPerSecond: 1 / 3_600, label: '1×', description: 'realtime axial rotation' },
    { hoursPerSecond: 1, label: '1h/s', description: 'one simulated hour per second' },
    { hoursPerSecond: 6, label: '6h/s', description: 'six simulated hours per second' },
    { hoursPerSecond: 12, label: '12h/s', description: 'twelve simulated hours per second' },
    { hoursPerSecond: 24, label: '1d/s', description: 'one simulated day per second' },
] as const;
export const DEFAULT_ROTATION_SPEED_PRESET = 1;

export const orbitSpeedLabel = (speed: number) =>
    ORBIT_SPEED_PRESETS.find((preset) => preset.multiplier === speed)?.label.toUpperCase() ?? `${speed}×`;

export const galacticSpeedLabel = (speed: number) =>
    GALACTIC_SPEED_PRESETS.find((preset) => preset.yearsPerSecond === speed)?.label.toUpperCase() ?? `${speed}Y/S`;

export type EasterEggState = {
    clicks: number;
    lastClickAt: number;
    unlocked: boolean;
    revealedAt: number;
};

export type CosmicZoomState = { current: number; target: number };

export type KeyboardNavigationState = {
    mode: 'camera' | 'planet-selection' | 'child-selection';
    selectedId: string | null;
};

export const createRuntimeState = () => {
    const startedAt = performance.now();
    const anchorDate = Date.now();
    const pointer: PointerState = {
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        clientX: -1000,
        clientY: -1000,
        active: false,
        showsHover: true,
    };
    const camera: CameraState = {
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
        dragMode: 'solar',
    };
    const galaxyCamera: GalaxyCameraState = {
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
    };

    return {
        pointer,
        camera,
        galaxyCamera,
        objectFocus,
        keyboardNavigation: { mode: 'camera', selectedId: null } as KeyboardNavigationState,
        easterEgg: { clicks: 0, lastClickAt: 0, unlocked: false, revealedAt: 0 } as EasterEggState,
        cosmicZoom: { current: 0, target: 0 } as CosmicZoomState,
        orbitClock: {
            active: true,
            returning: false,
            speed: ORBIT_SPEED_PRESETS[DEFAULT_ORBIT_SPEED_PRESET].multiplier,
            anchorDate,
            startedAt,
            returnFrom: anchorDate,
            returnStartedAt: 0,
        } as OrbitClockState,
        galacticClock: {
            started: false,
            speed: GALACTIC_SPEED_PRESETS[DEFAULT_GALACTIC_SPEED_PRESET].yearsPerSecond,
            anchorYears: 0,
            startedAt,
        } as GalacticClockState,
        rotationClock: {
            started: false,
            speed: ROTATION_SPEED_PRESETS[DEFAULT_ROTATION_SPEED_PRESET].hoursPerSecond,
            anchorHours: 0,
            startedAt,
        } as RotationClockState,
    };
};

export const getGalacticElapsedYears = (clock: GalacticClockState, frameTime: number) =>
    clock.started ? clock.anchorYears + ((frameTime - clock.startedAt) / 1000) * clock.speed : clock.anchorYears;

export const getRotationElapsedHours = (clock: RotationClockState, frameTime: number) =>
    clock.started ? clock.anchorHours + ((frameTime - clock.startedAt) / 1000) * clock.speed : clock.anchorHours;

export const getOrbitDate = (clock: OrbitClockState, frameTime: number, _reducedMotion: boolean) => {
    if (clock.returning) {
        const progress = Math.min(1, (frameTime - clock.returnStartedAt) / 900);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        const date = clock.returnFrom + (Date.now() - clock.returnFrom) * eased;
        if (progress === 1) clock.returning = false;
        return date;
    }
    if (clock.active) {
        return clock.anchorDate + (frameTime - clock.startedAt) * clock.speed;
    }
    return Date.now();
};
