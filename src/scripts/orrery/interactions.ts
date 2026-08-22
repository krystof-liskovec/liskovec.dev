import { DEG } from './math';
import type {
    CameraState,
    CosmicZoomState,
    EasterEggState,
    GalaxyCameraState,
    OrbitClockState,
    PointerState,
} from './runtime-state';
import type { FocusState, FocusTarget } from './types';

type InteractionOptions = {
    canvas: HTMLCanvasElement;
    system: HTMLElement;
    focusReturn: HTMLButtonElement | null;
    zoomInput: HTMLInputElement | null;
    zoomStatus: HTMLOutputElement | null;
    pointer: PointerState;
    camera: CameraState;
    galaxyCamera: GalaxyCameraState;
    objectFocus: FocusState;
    easterEgg: EasterEggState;
    cosmicZoom: CosmicZoomState;
    orbitClock: OrbitClockState;
    getActiveFocusCandidate: () => FocusTarget | null;
    getOrbitDate: (frameTime: number) => number;
    beginObjectFocus: (target: FocusTarget) => void;
    beginChildFocus: (target: FocusTarget) => void;
    leaveObjectFocus: () => void;
    setZoomLocation: (state: string, copy: string) => void;
    onInteract: () => void;
};

export const bindOrreryInteractions = ({
    canvas,
    system,
    focusReturn,
    zoomInput,
    zoomStatus,
    pointer,
    camera,
    galaxyCamera,
    objectFocus,
    easterEgg,
    cosmicZoom,
    orbitClock,
    getActiveFocusCandidate,
    getOrbitDate,
    beginObjectFocus,
    beginChildFocus,
    leaveObjectFocus,
    setZoomLocation,
    onInteract,
}: InteractionOptions) => {
    let pressedFocusCandidate: FocusTarget | null = null;
    const touchGesture = { pending: false, pointerId: -1, startX: 0, startY: 0 };

    const startCameraDrag = (event: PointerEvent, startX = event.clientX, startY = event.clientY) => {
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
        camera.lastX = startX;
        camera.lastY = startY;
        camera.dragDistance = 0;
        camera.pointerId = event.pointerId;
        system.classList.add('is-dragging');
        canvas.setPointerCapture(event.pointerId);
        if (event.pointerType !== 'touch') event.preventDefault();
    };

    window.addEventListener('pointermove', (event) => {
        pointer.clientX = event.clientX;
        pointer.clientY = event.clientY;
        pointer.active = true;
        pointer.showsHover = event.pointerType !== 'touch';
        if (touchGesture.pending && event.pointerId === touchGesture.pointerId) {
            const travelX = event.clientX - touchGesture.startX;
            const travelY = event.clientY - touchGesture.startY;
            if (Math.hypot(travelX, travelY) < 8) return;

            if (Math.abs(travelY) >= Math.abs(travelX) * 0.85) {
                touchGesture.pending = false;
                pressedFocusCandidate = null;
                return;
            }

            touchGesture.pending = false;
            startCameraDrag(event, touchGesture.startX, touchGesture.startY);
        }
        if (camera.dragging && event.pointerId === camera.pointerId) {
            const deltaX = event.clientX - camera.lastX;
            const deltaY = event.clientY - camera.lastY;
            if (camera.dragMode === 'focus') {
                if (objectFocus.child) {
                    objectFocus.childLongitude -= deltaX * 0.008;
                    objectFocus.childLatitude = Math.max(
                        -65 * DEG,
                        Math.min(65 * DEG, objectFocus.childLatitude - deltaY * 0.006),
                    );
                } else {
                    objectFocus.resetting = false;
                    objectFocus.longitude -= deltaX * 0.008;
                    objectFocus.latitude = Math.max(
                        -65 * DEG,
                        Math.min(65 * DEG, objectFocus.latitude - deltaY * 0.006),
                    );
                }
            } else if (camera.dragMode === 'galaxy') {
                galaxyCamera.rotation += deltaX * 0.005;
                galaxyCamera.tilt = Math.max(0.5, Math.min(1.35, galaxyCamera.tilt - deltaY * 0.0035));
            } else {
                camera.roll += deltaX * 0.0045;
                camera.yaw += deltaX * 0.0018;
                camera.pitch = Math.max(12 * DEG, Math.min(88 * DEG, camera.pitch - deltaY * 0.0055));
            }
            camera.dragDistance += Math.hypot(deltaX, deltaY);
            camera.lastX = event.clientX;
            camera.lastY = event.clientY;
            return;
        }
        if (!camera.manual) {
            pointer.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
            pointer.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
        }
    });

    canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        onInteract();
        pointer.clientX = event.clientX;
        pointer.clientY = event.clientY;
        pointer.active = true;
        pointer.showsHover = event.pointerType !== 'touch';
        pressedFocusCandidate = getActiveFocusCandidate();
        camera.dragMode = objectFocus.target ? 'focus' : cosmicZoom.current > 0.55 ? 'galaxy' : 'solar';
        if (event.pointerType === 'touch') {
            pressedFocusCandidate = null;
            touchGesture.pending = true;
            touchGesture.pointerId = event.pointerId;
            touchGesture.startX = event.clientX;
            touchGesture.startY = event.clientY;
            camera.pointerId = event.pointerId;
            camera.dragDistance = 0;
            return;
        }
        startCameraDrag(event);
    });

    const completeInteraction = (event: PointerEvent, dragDistance: number, clickThreshold: number) => {
        const clickedFocusCandidate =
            event.type === 'pointerup' && dragDistance < clickThreshold ? pressedFocusCandidate : null;
        if (clickedFocusCandidate) {
            if (
                objectFocus.target &&
                (clickedFocusCandidate.kind === 'moon' || clickedFocusCandidate.kind === 'station')
            ) {
                beginChildFocus(clickedFocusCandidate);
            } else if (!objectFocus.target) {
                beginObjectFocus(clickedFocusCandidate);
            }
        }
        if (event.type === 'pointerup' && camera.dragMode === 'solar' && dragDistance >= clickThreshold) {
            const startedAt = performance.now();
            orbitClock.anchorDate = getOrbitDate(startedAt);
            orbitClock.startedAt = startedAt;
            orbitClock.active = true;
            orbitClock.returning = false;
        }
        if (
            event.type === 'pointerup' &&
            camera.dragMode === 'solar' &&
            !clickedFocusCandidate &&
            !easterEgg.unlocked
        ) {
            if (dragDistance < clickThreshold) {
                const clickedAt = performance.now();
                if (clickedAt - easterEgg.lastClickAt > 650) easterEgg.clicks = 0;
                easterEgg.clicks += 1;
                easterEgg.lastClickAt = clickedAt;
                if (easterEgg.clicks === 9) {
                    easterEgg.unlocked = true;
                    easterEgg.revealedAt = clickedAt;
                }
            } else {
                easterEgg.clicks = 0;
                easterEgg.lastClickAt = 0;
            }
        }
    };

    const finishDrag = (event: PointerEvent) => {
        if (touchGesture.pending && event.pointerId === touchGesture.pointerId) {
            const travel = Math.hypot(event.clientX - touchGesture.startX, event.clientY - touchGesture.startY);
            touchGesture.pending = false;
            if (event.type === 'pointerup' && travel < 8 && !pressedFocusCandidate) {
                pressedFocusCandidate = getActiveFocusCandidate();
            }
            completeInteraction(event, travel, 8);
            pressedFocusCandidate = null;
            return;
        }
        if (!camera.dragging || event.pointerId !== camera.pointerId) return;
        camera.dragging = false;
        system.classList.remove('is-dragging');
        completeInteraction(event, camera.dragDistance, 3);
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
        camera.resetStartedAt = resetAt;
        camera.resetPitch = camera.renderedPitch;
        camera.resetYaw = camera.renderedYaw;
        camera.resetRoll = camera.renderedRoll;
        galaxyCamera.resetting = true;
        galaxyCamera.resetStartedAt = resetAt;
        galaxyCamera.resetRotation = galaxyCamera.rotation;
        galaxyCamera.resetTilt = galaxyCamera.tilt;
        pointer.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
        pointer.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
        event.preventDefault();
    });

    document.documentElement.addEventListener('pointerleave', () => {
        pointer.targetX = 0;
        pointer.targetY = 0;
        pointer.active = false;
    });

    focusReturn?.addEventListener('click', leaveObjectFocus);
    zoomInput?.addEventListener('input', () => {
        onInteract();
        cosmicZoom.target = Number(zoomInput.value) / 100;
        const location =
            cosmicZoom.target < 0.5 ? ['solar', 'in the solar system.'] : ['milky-way', 'in the Milky Way.'];
        setZoomLocation(location[0], location[1]);
        const status =
            cosmicZoom.target < 0.3 ? 'LOCAL SYSTEM' : cosmicZoom.target < 0.72 ? 'INTERSTELLAR' : 'MILKY WAY';
        if (zoomStatus) zoomStatus.value = status;
        zoomInput.setAttribute('aria-valuetext', status);
    });
};
