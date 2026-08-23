import { DEG } from './math';
import type { CameraState, GalaxyCameraState, PointerState } from './runtime-state';
import type { FocusState } from './types';

export const updateSolarCamera = (options: {
    camera: CameraState;
    pointer: PointerState;
    seconds: number;
    frameTime: number;
    frameDelta: number;
    reducedMotion: boolean;
}) => {
    const { camera, pointer, seconds, frameTime, frameDelta, reducedMotion } = options;
    if (camera.manual && !camera.dragging && !camera.resetting && !reducedMotion) {
        camera.roll += 0.000035 * frameDelta;
    }
    const drift = reducedMotion ? 0 : seconds * 0.035;
    const automaticPitch = (58 + Math.sin(seconds * 0.18) * 4 + pointer.y * 10) * DEG;
    const automaticYaw = (Math.sin(seconds * 0.11) * 8 + pointer.x * 14) * DEG;
    const automaticRoll = -12 * DEG + drift;
    let pitch = camera.manual ? camera.pitch : automaticPitch;
    let yaw = camera.manual ? camera.yaw : automaticYaw;
    let roll = camera.manual ? camera.roll : automaticRoll;

    if (camera.resetting) {
        const progress = Math.min(1, (frameTime - camera.resetStartedAt) / 900);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        const interpolateAngle = (from: number, to: number) => {
            const difference = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            return from + difference * eased;
        };
        pitch = camera.resetPitch + (automaticPitch - camera.resetPitch) * eased;
        yaw = interpolateAngle(camera.resetYaw, automaticYaw);
        roll = interpolateAngle(camera.resetRoll, automaticRoll);
        if (progress === 1) camera.resetting = false;
    }

    camera.renderedPitch = pitch;
    camera.renderedYaw = yaw;
    camera.renderedRoll = roll;
};

export const updateGalaxyCamera = (options: {
    galaxyCamera: GalaxyCameraState;
    solarCamera: CameraState;
    frameTime: number;
    frameDelta: number;
    reducedMotion: boolean;
}) => {
    const { galaxyCamera, solarCamera, frameTime, frameDelta, reducedMotion } = options;
    if (!(solarCamera.dragging && solarCamera.dragMode === 'galaxy') && !galaxyCamera.resetting && !reducedMotion) {
        galaxyCamera.rotation -= 0.0000025 * frameDelta;
    }
    if (!galaxyCamera.resetting) return;

    const progress = Math.min(1, (frameTime - galaxyCamera.resetStartedAt) / 900);
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    const rotationDifference = ((-galaxyCamera.resetRotation + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    galaxyCamera.rotation = galaxyCamera.resetRotation + rotationDifference * eased;
    galaxyCamera.tilt = galaxyCamera.resetTilt + (1 - galaxyCamera.resetTilt) * eased;
    if (progress === 1) {
        galaxyCamera.rotation = 0;
        galaxyCamera.tilt = 1;
        galaxyCamera.resetting = false;
    }
};

export const updateFocusRotation = (focus: FocusState, frameTime: number) => {
    if (!focus.resetting) return;
    const progress = Math.min(1, (frameTime - focus.resetStartedAt) / 700);
    const eased = 1 - (1 - progress) ** 3;
    const longitudeDifference = ((-focus.resetLongitude + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    focus.longitude = focus.resetLongitude + longitudeDifference * eased;
    focus.latitude = focus.resetLatitude * (1 - eased);
    if (progress === 1) {
        focus.longitude = 0;
        focus.latitude = 0;
        focus.resetting = false;
    }
};
