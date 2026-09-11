import { DEG, shortestAngleDifference } from './math';
import type { CameraState, GalaxyCameraState, PointerState } from './runtime-state';
import type { FocusState } from './types';

export const updateSolarCamera = (options: {
    camera: CameraState;
    pointer: PointerState;
    seconds: number;
    frameTime: number;
    frameDelta: number;
    reducedMotion: boolean;
    pausePassiveRotation: boolean;
}) => {
    const { camera, pointer, seconds, frameTime, frameDelta, reducedMotion, pausePassiveRotation } = options;
    if (pausePassiveRotation) {
        camera.passiveRotationPaused = true;
        return;
    }
    if (camera.passiveRotationPaused) {
        camera.passiveRotationPaused = false;
        // Automatic angles are derived from elapsed time, so ease back to the
        // current automatic pose after focus instead of snapping across the
        // rotation accumulated while the close-up was open.
        if (!camera.manual) {
            camera.resetting = true;
            camera.resetStartedAt = frameTime;
            camera.resetPitch = camera.renderedPitch;
            camera.resetYaw = camera.renderedYaw;
            camera.resetRoll = camera.renderedRoll;
        }
    }
    if (camera.manual && !camera.dragging && !camera.resetting && !reducedMotion) {
        camera.roll += 0.000035 * frameDelta;
    }
    const drift = reducedMotion ? 0 : seconds * 0.035;
    const automaticPitch = (58 + Math.sin(seconds * 0.18) * 4 + pointer.y * 10) * DEG;
    const automaticYaw = (Math.sin(seconds * 0.11) * 8 + pointer.x * 14) * DEG;
    // Keep automatic roll on the same continuous branch as a manually dragged
    // camera. The projection only cares about the angle modulo one turn, but
    // surface textures use the raw value so a branch change would look like a
    // sudden reverse spin after reset.
    const automaticRoll = -12 * DEG + drift + camera.automaticRollOffset;
    let pitch = camera.manual ? camera.pitch : automaticPitch;
    let yaw = camera.manual ? camera.yaw : automaticYaw;
    let roll = camera.manual ? camera.roll : automaticRoll;

    if (camera.resetting) {
        const progress = Math.min(1, (frameTime - camera.resetStartedAt) / 900);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        pitch = camera.resetPitch + (automaticPitch - camera.resetPitch) * eased;
        yaw = camera.resetYaw + shortestAngleDifference(camera.resetYaw, automaticYaw) * eased;
        const resetRollTarget = camera.resetRoll + shortestAngleDifference(camera.resetRoll, automaticRoll);
        roll = camera.resetRoll + (resetRollTarget - camera.resetRoll) * eased;
        if (progress === 1) {
            // The target is visually equivalent to automaticRoll, but may be
            // several turns away numerically. Carry that turn offset forward so
            // the next frame does not snap the texture's raw rotation back.
            camera.automaticRollOffset += resetRollTarget - automaticRoll;
            camera.resetting = false;
        }
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
    pausePassiveRotation: boolean;
}) => {
    const { galaxyCamera, solarCamera, frameTime, frameDelta, reducedMotion, pausePassiveRotation } = options;
    if (
        !pausePassiveRotation &&
        !(solarCamera.dragging && solarCamera.dragMode === 'galaxy') &&
        !galaxyCamera.resetting &&
        !reducedMotion
    ) {
        galaxyCamera.rotation -= 0.0000025 * frameDelta;
    }
    if (!galaxyCamera.resetting) return;

    const progress = Math.min(1, (frameTime - galaxyCamera.resetStartedAt) / 900);
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    const rotationDifference = shortestAngleDifference(galaxyCamera.resetRotation, 0);
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
    const longitudeDifference = shortestAngleDifference(focus.resetLongitude, 0);
    focus.longitude = focus.resetLongitude + longitudeDifference * eased;
    focus.latitude = focus.resetLatitude * (1 - eased);
    if (progress === 1) {
        focus.longitude = 0;
        focus.latitude = 0;
        focus.resetting = false;
    }
};
