import { DEG } from './math';
import type {
    CameraState,
    CosmicZoomState,
    EasterEggState,
    GalacticClockState,
    GalaxyCameraState,
    OrbitClockState,
    PointerState,
    RotationClockState,
} from './runtime-state';
import {
    DEFAULT_GALACTIC_SPEED_PRESET,
    DEFAULT_ORBIT_SPEED_PRESET,
    DEFAULT_ROTATION_SPEED_PRESET,
    GALACTIC_SPEED_PRESETS,
    ORBIT_SPEED_PRESETS,
    ROTATION_SPEED_PRESETS,
} from './runtime-state';
import type { FocusState, FocusTarget } from './types';

type InteractionOptions = {
    canvas: HTMLCanvasElement;
    system: HTMLElement;
    focusReturn: HTMLButtonElement | null;
    mobileFullscreenToggle: HTMLButtonElement | null;
    zoomInput: HTMLInputElement | null;
    zoomSwitch: HTMLInputElement | null;
    zoomStatus: HTMLOutputElement | null;
    solarSimulationSpeed: HTMLButtonElement | null;
    galacticSimulationSpeed: HTMLButtonElement | null;
    rotationSimulationSpeed: HTMLButtonElement | null;
    pointer: PointerState;
    camera: CameraState;
    galaxyCamera: GalaxyCameraState;
    objectFocus: FocusState;
    easterEgg: EasterEggState;
    cosmicZoom: CosmicZoomState;
    orbitClock: OrbitClockState;
    galacticClock: GalacticClockState;
    rotationClock: RotationClockState;
    getActiveFocusCandidate: () => FocusTarget | null;
    getFocusCandidateAt: (clientX: number, clientY: number) => FocusTarget | null;
    getOrbitDate: (frameTime: number) => number;
    getGalacticElapsedYears: (frameTime: number) => number;
    getRotationElapsedHours: (frameTime: number) => number;
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
    mobileFullscreenToggle,
    zoomInput,
    zoomSwitch,
    zoomStatus,
    solarSimulationSpeed,
    galacticSimulationSpeed,
    rotationSimulationSpeed,
    pointer,
    camera,
    galaxyCamera,
    objectFocus,
    easterEgg,
    cosmicZoom,
    orbitClock,
    galacticClock,
    rotationClock,
    getActiveFocusCandidate,
    getFocusCandidateAt,
    getOrbitDate,
    getGalacticElapsedYears,
    getRotationElapsedHours,
    beginObjectFocus,
    beginChildFocus,
    leaveObjectFocus,
    setZoomLocation,
    onInteract,
}: InteractionOptions) => {
    let pressedFocusCandidate: FocusTarget | null = null;
    const touchGesture = { pending: false, pointerId: -1, startX: 0, startY: 0 };
    let dragCaptureTarget: HTMLElement = canvas;
    let simulationControlMode: 'solar' | 'galactic' | 'rotation' = 'solar';
    let solarPresetIndex = DEFAULT_ORBIT_SPEED_PRESET;
    let galacticPresetIndex = DEFAULT_GALACTIC_SPEED_PRESET;
    let rotationPresetIndex = DEFAULT_ROTATION_SPEED_PRESET;
    let fallbackFullscreen = false;

    const isFullscreen = () => document.fullscreenElement === system || fallbackFullscreen;
    const updateFullscreenControl = () => {
        const active = isFullscreen();
        system.classList.toggle('is-fullscreen', active);
        document.documentElement.classList.toggle('is-orrery-fullscreen', active);
        if (!mobileFullscreenToggle) return;
        const fullscreenIcon = mobileFullscreenToggle.querySelector<HTMLElement>('.mobile-fullscreen-icon');
        if (fullscreenIcon) fullscreenIcon.textContent = active ? '×' : '⛶';
        mobileFullscreenToggle.setAttribute(
            'aria-label',
            active ? 'Exit fullscreen animation' : 'Open fullscreen animation',
        );
        mobileFullscreenToggle.setAttribute('aria-pressed', String(active));
    };

    mobileFullscreenToggle?.addEventListener('click', async () => {
        onInteract();
        if (document.fullscreenElement === system) {
            try {
                await document.exitFullscreen();
            } catch {
                updateFullscreenControl();
            }
            return;
        }
        if (fallbackFullscreen) {
            fallbackFullscreen = false;
            updateFullscreenControl();
            return;
        }
        try {
            if (!document.fullscreenEnabled || !system.requestFullscreen) throw new Error('Fullscreen unavailable');
            await system.requestFullscreen({ navigationUI: 'hide' });
            try {
                await screen.orientation.lock('landscape');
            } catch {
                // Orientation locking is unavailable in some mobile browsers;
                // fullscreen remains useful and follows the device orientation.
            }
        } catch {
            // Keep the control useful on browsers that do not expose fullscreen
            // for arbitrary elements, such as some iOS browser versions.
            fallbackFullscreen = true;
            updateFullscreenControl();
        }
    });
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement === system) fallbackFullscreen = false;
        updateFullscreenControl();
        if (document.fullscreenElement !== system) screen.orientation?.unlock?.();
    });
    updateFullscreenControl();

    const updateSimulationSpeedControl = (presetIndex: number) => {
        const control =
            simulationControlMode === 'solar'
                ? solarSimulationSpeed
                : simulationControlMode === 'galactic'
                  ? galacticSimulationSpeed
                  : rotationSimulationSpeed;
        if (!control) return;
        const preset =
            simulationControlMode === 'solar'
                ? ORBIT_SPEED_PRESETS[presetIndex]
                : simulationControlMode === 'galactic'
                  ? GALACTIC_SPEED_PRESETS[presetIndex]
                  : ROTATION_SPEED_PRESETS[presetIndex];
        control.dataset.value = String(presetIndex);
        control.textContent = preset.label;
        control.setAttribute('aria-label', `Simulation speed: ${preset.description}`);
        const options = control.parentElement?.querySelectorAll<HTMLButtonElement>('.simulation-speed-option') ?? [];
        options.forEach((option) => {
            option.toggleAttribute('aria-selected', Number(option.dataset.value) === presetIndex);
        });
    };

    const speedControls = [solarSimulationSpeed, galacticSimulationSpeed, rotationSimulationSpeed].filter(
        (control): control is HTMLButtonElement => Boolean(control),
    );
    const getSpeedMenu = (control: HTMLButtonElement) =>
        control.parentElement?.querySelector<HTMLElement>('.simulation-speed-menu') ?? null;
    const closeSpeedMenu = (control: HTMLButtonElement, returnFocus = false) => {
        const menu = getSpeedMenu(control);
        if (!menu) return;
        menu.hidden = true;
        control.setAttribute('aria-expanded', 'false');
        if (returnFocus) control.focus();
    };
    const closeSpeedMenus = () => speedControls.forEach((control) => closeSpeedMenu(control));
    const openSpeedMenu = (control: HTMLButtonElement, focusSelected = false) => {
        speedControls.forEach((otherControl) => {
            if (otherControl !== control) closeSpeedMenu(otherControl);
        });
        const menu = getSpeedMenu(control);
        if (!menu) return;
        menu.hidden = false;
        control.setAttribute('aria-expanded', 'true');
        if (focusSelected) {
            menu.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
        }
    };
    const chooseSpeedOption = (control: HTMLButtonElement, option: HTMLButtonElement) => {
        const presetIndex = Number(option.dataset.value);
        onInteract();
        if (control === solarSimulationSpeed) setSimulationSpeed(presetIndex);
        else if (control === galacticSimulationSpeed) setGalacticSimulationSpeed(presetIndex);
        else setRotationSimulationSpeed(presetIndex);
        closeSpeedMenu(control, true);
    };

    speedControls.forEach((control) => {
        control.addEventListener('click', () => {
            const menu = getSpeedMenu(control);
            if (!menu) return;
            if (menu.hidden) openSpeedMenu(control);
            else closeSpeedMenu(control);
        });
        control.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                openSpeedMenu(control, true);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                closeSpeedMenu(control);
            }
        });
        getSpeedMenu(control)
            ?.querySelectorAll<HTMLButtonElement>('.simulation-speed-option')
            .forEach((option) => {
                option.addEventListener('click', () => chooseSpeedOption(control, option));
                option.addEventListener('keydown', (event) => {
                    const options = Array.from(
                        getSpeedMenu(control)?.querySelectorAll<HTMLButtonElement>('.simulation-speed-option') ?? [],
                    );
                    const currentIndex = options.indexOf(option);
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        const direction = event.key === 'ArrowDown' ? 1 : -1;
                        options[(currentIndex + direction + options.length) % options.length]?.focus();
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        closeSpeedMenu(control, true);
                    }
                });
            });
    });
    document.addEventListener('pointerdown', (event) => {
        if (!(event.target instanceof Element) || !event.target.closest('.simulation-speed-picker')) closeSpeedMenus();
    });
    document.addEventListener('focusin', (event) => {
        if (!(event.target instanceof Element) || !event.target.closest('.simulation-speed-picker')) closeSpeedMenus();
    });

    const setSimulationControlMode = (mode: 'solar' | 'galactic' | 'rotation') => {
        if (mode === simulationControlMode) return;
        simulationControlMode = mode;
        if (solarSimulationSpeed) solarSimulationSpeed.parentElement?.toggleAttribute('hidden', mode !== 'solar');
        if (galacticSimulationSpeed)
            galacticSimulationSpeed.parentElement?.toggleAttribute('hidden', mode !== 'galactic');
        if (rotationSimulationSpeed)
            rotationSimulationSpeed.parentElement?.toggleAttribute('hidden', mode !== 'rotation');
        closeSpeedMenus();
        if (mode === 'galactic' && !galacticClock.started) {
            galacticClock.started = true;
            galacticClock.startedAt = performance.now();
        }
        if (mode === 'rotation' && !rotationClock.started) {
            rotationClock.started = true;
            rotationClock.startedAt = performance.now();
        }
        updateSimulationSpeedControl(
            mode === 'solar' ? solarPresetIndex : mode === 'galactic' ? galacticPresetIndex : rotationPresetIndex,
        );
    };

    const setSimulationSpeed = (presetIndex: number, changedAt = performance.now()) => {
        const preset = ORBIT_SPEED_PRESETS[presetIndex];
        const currentDate = getOrbitDate(changedAt);
        orbitClock.speed = preset.multiplier;
        solarPresetIndex = presetIndex;
        if (presetIndex === 0) {
            orbitClock.returnFrom = currentDate;
            orbitClock.returnStartedAt = changedAt;
            orbitClock.returning = orbitClock.active;
            orbitClock.active = false;
        } else {
            orbitClock.anchorDate = currentDate;
            orbitClock.startedAt = changedAt;
            orbitClock.returning = false;
            orbitClock.active = true;
        }
        if (simulationControlMode === 'solar') updateSimulationSpeedControl(presetIndex);
    };

    const setGalacticSimulationSpeed = (presetIndex: number, changedAt = performance.now()) => {
        const preset = GALACTIC_SPEED_PRESETS[presetIndex];
        galacticClock.anchorYears = getGalacticElapsedYears(changedAt);
        galacticClock.startedAt = changedAt;
        galacticClock.speed = preset.yearsPerSecond;
        galacticClock.started = true;
        galacticPresetIndex = presetIndex;
        if (simulationControlMode === 'galactic') updateSimulationSpeedControl(presetIndex);
    };

    const setRotationSimulationSpeed = (presetIndex: number, changedAt = performance.now()) => {
        const preset = ROTATION_SPEED_PRESETS[presetIndex];
        rotationClock.anchorHours = getRotationElapsedHours(changedAt);
        rotationClock.startedAt = changedAt;
        rotationClock.speed = preset.hoursPerSecond;
        rotationClock.started = true;
        rotationPresetIndex = presetIndex;
        if (simulationControlMode === 'rotation') updateSimulationSpeedControl(presetIndex);
    };

    const startCameraDrag = (
        event: PointerEvent,
        startX = event.clientX,
        startY = event.clientY,
        captureTarget: HTMLElement = canvas,
    ) => {
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
        dragCaptureTarget = captureTarget;
        dragCaptureTarget.setPointerCapture(event.pointerId);
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

            if (!isFullscreen() && Math.abs(travelY) >= Math.abs(travelX) * 0.85) {
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
                if (clickedFocusCandidate.kind === 'planet' || clickedFocusCandidate.kind === 'star') {
                    setSimulationControlMode('rotation');
                }
                beginObjectFocus(clickedFocusCandidate);
            }
        }
        if (event.type === 'pointerup' && camera.dragMode === 'solar' && dragDistance >= clickThreshold) {
            const startedAt = performance.now();
            const activePreset = orbitClock.active
                ? Math.max(
                      1,
                      ORBIT_SPEED_PRESETS.findIndex((preset) => preset.multiplier === orbitClock.speed),
                  )
                : 2;
            setSimulationSpeed(activePreset, startedAt);
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
                pressedFocusCandidate = getFocusCandidateAt(event.clientX, event.clientY) ?? getActiveFocusCandidate();
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
        if (dragCaptureTarget.hasPointerCapture(event.pointerId))
            dragCaptureTarget.releasePointerCapture(event.pointerId);
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

    focusReturn?.addEventListener('click', () => {
        const leavingChild = Boolean(objectFocus.child);
        leaveObjectFocus();
        if (!leavingChild) setSimulationControlMode(cosmicZoom.target < 0.5 ? 'solar' : 'galactic');
    });
    const setZoomTarget = (target: number) => {
        cosmicZoom.target = target;
        setSimulationControlMode(target < 0.5 ? 'solar' : 'galactic');
        const location = target < 0.5 ? ['solar', 'in the solar system.'] : ['milky-way', 'in the Milky Way.'];
        setZoomLocation(location[0], location[1]);
        const status = target < 0.3 ? 'LOCAL SYSTEM' : target < 0.72 ? 'INTERSTELLAR' : 'MILKY WAY';
        if (zoomStatus) zoomStatus.value = status;
        if (zoomInput) {
            zoomInput.value = String(Math.round(target * 100));
            zoomInput.setAttribute('aria-valuetext', status);
        }
        if (zoomSwitch) zoomSwitch.checked = target >= 0.5;
    };

    zoomInput?.addEventListener('input', () => {
        onInteract();
        setZoomTarget(Number(zoomInput.value) / 100);
    });
    zoomSwitch?.addEventListener('change', () => {
        onInteract();
        setZoomTarget(zoomSwitch.checked ? 1 : 0);
    });
    setZoomTarget(cosmicZoom.target);
    updateSimulationSpeedControl(solarPresetIndex);
};
