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
    anchorDate: number;
    startedAt: number;
    returnFrom: number;
    returnStartedAt: number;
};

export type EasterEggState = {
    clicks: number;
    lastClickAt: number;
    unlocked: boolean;
    revealedAt: number;
};

export type CosmicZoomState = { current: number; target: number };

export const createRuntimeState = () => {
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
        easterEgg: { clicks: 0, lastClickAt: 0, unlocked: false, revealedAt: 0 } as EasterEggState,
        cosmicZoom: { current: 0, target: 0 } as CosmicZoomState,
        orbitClock: {
            active: false,
            returning: false,
            anchorDate: Date.now(),
            startedAt: 0,
            returnFrom: Date.now(),
            returnStartedAt: 0,
        } as OrbitClockState,
    };
};

export const getOrbitDate = (clock: OrbitClockState, frameTime: number, reducedMotion: boolean) => {
    if (clock.returning) {
        const progress = Math.min(1, (frameTime - clock.returnStartedAt) / 900);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        const date = clock.returnFrom + (Date.now() - clock.returnFrom) * eased;
        if (progress === 1) clock.returning = false;
        return date;
    }
    if (clock.active) {
        const speed = reducedMotion ? 1 : 43_200;
        return clock.anchorDate + (frameTime - clock.startedAt) * speed;
    }
    return Date.now();
};
