import { DEG } from './math';
import { MAJOR_MOON_SYSTEMS, PLANETS } from './catalog';
import type {
    CameraState,
    CosmicZoomState,
    EasterEggState,
    GalacticClockState,
    GalaxyCameraState,
    KeyboardNavigationState,
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
    keyboardNavigation: KeyboardNavigationState;
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
    keyboardNavigation,
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
    const updateZoomOrientation = () => {
        if (!zoomInput) return;
        const isHorizontal = isFullscreen() || window.matchMedia('(max-width: 700px)').matches;
        zoomInput.setAttribute('aria-orientation', isHorizontal ? 'horizontal' : 'vertical');
    };
    const updateFullscreenControl = () => {
        const active = isFullscreen();
        system.classList.toggle('is-fullscreen', active);
        document.documentElement.classList.toggle('is-orrery-fullscreen', active);
        updateZoomOrientation();
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
    window.addEventListener('resize', updateZoomOrientation, { passive: true });

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

    const prepareManualSolarCamera = () => {
        if (camera.manual) return;
        camera.manual = true;
        camera.resetting = false;
        camera.pitch = camera.renderedPitch;
        camera.yaw = camera.renderedYaw;
        camera.roll = camera.renderedRoll;
        pointer.targetX = pointer.x;
        pointer.targetY = pointer.y;
    };

    const selectablePlanetNames = () =>
        PLANETS.filter((planet) => !planet.easterEgg || easterEgg.unlocked).map((planet) => planet.name);
    const selectableChildIds = () => {
        const target = objectFocus.target;
        if (!target || target.kind !== 'planet' || objectFocus.child) return [];
        if (target.name === 'Earth') return ['moon', 'iss'];
        return (MAJOR_MOON_SYSTEMS[target.name]?.moons ?? []).map((moon) => `moon:${target.name}:${moon.name}`);
    };
    const updateCanvasKeyboardLabel = () => {
        if (keyboardNavigation.mode === 'planet-selection' && keyboardNavigation.selectedId) {
            canvas.setAttribute(
                'aria-label',
                `${keyboardNavigation.selectedId} selected. Use arrow keys to choose a planet, then press Enter to zoom in.`,
            );
        } else if (keyboardNavigation.mode === 'child-selection' && keyboardNavigation.selectedId) {
            const selectedName =
                keyboardNavigation.selectedId === 'iss'
                    ? 'International Space Station'
                    : keyboardNavigation.selectedId === 'moon'
                      ? 'Moon'
                      : (keyboardNavigation.selectedId.split(':').at(-1) ?? 'moon');
            canvas.setAttribute(
                'aria-label',
                `${selectedName} selected. Use Tab or arrow keys to choose a nearby object, then press Enter to zoom in.`,
            );
        } else {
            canvas.setAttribute(
                'aria-label',
                'Interactive ASCII solar system with live approximate planetary positions',
            );
        }
    };
    const setKeyboardNavigation = (mode: KeyboardNavigationState['mode'], selectedId: string | null = null) => {
        keyboardNavigation.mode = mode;
        keyboardNavigation.selectedId = selectedId;
        updateCanvasKeyboardLabel();
    };
    const directionForSelection = (key: string) => (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1);
    const cycleKeyboardSelection = (items: string[], direction: number) => {
        if (!items.length) return;
        const currentIndex = keyboardNavigation.selectedId ? items.indexOf(keyboardNavigation.selectedId) : -1;
        const nextIndex = (currentIndex + direction + items.length) % items.length;
        setKeyboardNavigation(keyboardNavigation.mode, items[nextIndex] ?? null);
        onInteract();
    };

    type KeyboardDirection = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
    const keyboardDirections = new Set<KeyboardDirection>();
    let keyboardFast = false;
    let keyboardFrame = 0;
    let lastKeyboardFrameAt = 0;
    const isKeyboardDirection = (key: string): key is KeyboardDirection =>
        key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';

    const applyKeyboardTurn = (frameSeconds: number) => {
        const horizontal =
            (keyboardDirections.has('ArrowRight') ? 1 : 0) - (keyboardDirections.has('ArrowLeft') ? 1 : 0);
        const vertical = (keyboardDirections.has('ArrowUp') ? 1 : 0) - (keyboardDirections.has('ArrowDown') ? 1 : 0);
        if (!horizontal && !vertical) return;

        const stepMultiplier = keyboardFast ? 2 : 1;
        if (objectFocus.target) {
            const longitudeStep = 80 * DEG * frameSeconds * stepMultiplier;
            const latitudeStep = 70 * DEG * frameSeconds * stepMultiplier;
            objectFocus.resetting = false;
            if (objectFocus.child) {
                objectFocus.childLongitude -= horizontal * longitudeStep;
                objectFocus.childLatitude = Math.max(
                    -65 * DEG,
                    Math.min(65 * DEG, objectFocus.childLatitude + vertical * latitudeStep),
                );
            } else {
                objectFocus.longitude -= horizontal * longitudeStep;
                objectFocus.latitude = Math.max(
                    -65 * DEG,
                    Math.min(65 * DEG, objectFocus.latitude + vertical * latitudeStep),
                );
            }
            return;
        }

        if (cosmicZoom.current > 0.55 || cosmicZoom.target > 0.55) {
            galaxyCamera.resetting = false;
            galaxyCamera.rotation += horizontal * 80 * DEG * frameSeconds * stepMultiplier;
            galaxyCamera.tilt = Math.max(
                0.5,
                Math.min(1.35, galaxyCamera.tilt + vertical * 0.9 * frameSeconds * stepMultiplier),
            );
            return;
        }

        prepareManualSolarCamera();
        camera.roll += horizontal * 90 * DEG * frameSeconds * stepMultiplier;
        camera.yaw += horizontal * 36 * DEG * frameSeconds * stepMultiplier;
        camera.pitch = Math.max(
            12 * DEG,
            Math.min(88 * DEG, camera.pitch + vertical * 100 * DEG * frameSeconds * stepMultiplier),
        );
    };

    const stopKeyboardTurn = () => {
        keyboardDirections.clear();
        keyboardFast = false;
        if (keyboardFrame) cancelAnimationFrame(keyboardFrame);
        keyboardFrame = 0;
        lastKeyboardFrameAt = 0;
    };

    const animateKeyboardTurn = (frameTime: number) => {
        keyboardFrame = 0;
        if (!keyboardDirections.size) return;
        const frameSeconds = lastKeyboardFrameAt
            ? Math.min(0.05, Math.max(0, (frameTime - lastKeyboardFrameAt) / 1000))
            : 1 / 60;
        lastKeyboardFrameAt = frameTime;
        applyKeyboardTurn(frameSeconds);
        keyboardFrame = requestAnimationFrame(animateKeyboardTurn);
    };

    const startKeyboardTurn = () => {
        if (keyboardFrame) return;
        lastKeyboardFrameAt = performance.now();
        keyboardFrame = requestAnimationFrame(animateKeyboardTurn);
    };

    const startCameraDrag = (
        event: PointerEvent,
        startX = event.clientX,
        startY = event.clientY,
        captureTarget: HTMLElement = canvas,
    ) => {
        if (camera.dragMode === 'solar') {
            prepareManualSolarCamera();
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

    canvas.addEventListener('focus', () => system.classList.add('is-canvas-focused'));
    canvas.addEventListener('blur', () => {
        system.classList.remove('is-canvas-focused');
        stopKeyboardTurn();
    });
    canvas.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            if (event.repeat) return;
            event.preventDefault();
            stopKeyboardTurn();
            if (!objectFocus.target && keyboardNavigation.mode === 'camera') {
                const selectedPlanet =
                    getActiveFocusCandidate()?.kind === 'planet' ? getActiveFocusCandidate()?.name : null;
                const firstPlanet = selectablePlanetNames()[0] ?? null;
                setKeyboardNavigation('planet-selection', selectedPlanet ?? firstPlanet);
                onInteract();
            } else if (!objectFocus.target && keyboardNavigation.mode === 'planet-selection') {
                const candidate = getActiveFocusCandidate();
                if (candidate?.kind === 'planet') {
                    setKeyboardNavigation('camera');
                    setSimulationControlMode('rotation');
                    beginObjectFocus(candidate);
                    onInteract();
                }
            } else if (objectFocus.target && keyboardNavigation.mode === 'child-selection') {
                const candidate = getActiveFocusCandidate();
                if (candidate?.kind === 'moon' || candidate?.kind === 'station') {
                    setKeyboardNavigation('camera');
                    beginChildFocus(candidate);
                    onInteract();
                }
            }
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            stopKeyboardTurn();
            if (objectFocus.child) {
                const returningChildId = objectFocus.child.id;
                leaveObjectFocus();
                setKeyboardNavigation('child-selection', returningChildId);
            } else if (objectFocus.target) {
                leaveObjectFocus();
                setKeyboardNavigation('camera');
            } else if (keyboardNavigation.mode !== 'camera') {
                setKeyboardNavigation('camera');
                onInteract();
            }
            return;
        }
        if (event.code === 'Space') {
            event.preventDefault();
            stopKeyboardTurn();
            if (keyboardNavigation.mode !== 'camera') {
                setKeyboardNavigation('camera');
                onInteract();
            }
            return;
        }
        if (event.key === 'Tab') {
            const childIds = selectableChildIds();
            if (childIds.length) {
                event.preventDefault();
                stopKeyboardTurn();
                if (keyboardNavigation.mode !== 'child-selection') setKeyboardNavigation('child-selection');
                cycleKeyboardSelection(childIds, event.shiftKey ? -1 : 1);
            }
            return;
        }
        if (!isKeyboardDirection(event.key)) return;

        if (keyboardNavigation.mode === 'planet-selection') {
            event.preventDefault();
            stopKeyboardTurn();
            cycleKeyboardSelection(selectablePlanetNames(), directionForSelection(event.key));
            return;
        }
        if (keyboardNavigation.mode === 'child-selection') {
            const childIds = selectableChildIds();
            if (!childIds.length) return;
            event.preventDefault();
            stopKeyboardTurn();
            cycleKeyboardSelection(childIds, directionForSelection(event.key));
            return;
        }

        event.preventDefault();
        if (!keyboardDirections.has(event.key)) {
            onInteract();
            keyboardDirections.add(event.key);
            applyKeyboardTurn(1 / 60);
            startKeyboardTurn();
        }
        keyboardFast = event.shiftKey;
    });
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Shift') keyboardFast = true;
    });
    window.addEventListener('keyup', (event) => {
        if (event.key === 'Shift') {
            keyboardFast = false;
            return;
        }
        if (!isKeyboardDirection(event.key)) return;
        keyboardDirections.delete(event.key);
        if (!keyboardDirections.size) keyboardFast = false;
    });
    window.addEventListener('blur', stopKeyboardTurn);

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
        const leavingKeyboardSelection = keyboardNavigation.mode !== 'camera';
        if (leavingKeyboardSelection) setKeyboardNavigation('camera');
        pointer.clientX = event.clientX;
        pointer.clientY = event.clientY;
        pointer.active = true;
        pointer.showsHover = event.pointerType !== 'touch';
        pressedFocusCandidate = leavingKeyboardSelection ? null : getActiveFocusCandidate();
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
        if (event.type === 'pointerup' && camera.dragDistance < 3 && !pressedFocusCandidate) {
            pressedFocusCandidate = getFocusCandidateAt(event.clientX, event.clientY) ?? getActiveFocusCandidate();
        }
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
        setKeyboardNavigation('camera');
        if (!leavingChild) setSimulationControlMode(cosmicZoom.target < 0.5 ? 'solar' : 'galactic');
    });
    const setZoomTarget = (target: number) => {
        cosmicZoom.target = target;
        setSimulationControlMode(target < 0.5 ? 'solar' : 'galactic');
        const location = target < 0.5 ? ['solar', 'in the solar system.'] : ['milky-way', 'in the Milky Way.'];
        setZoomLocation(location[0], location[1]);
        const status = target < 0.3 ? 'LOCAL SYSTEM' : target < 0.72 ? 'INTERSTELLAR' : 'MILKY WAY';
        const value = Math.round(target * 100);
        if (zoomStatus) zoomStatus.value = status;
        if (zoomInput) {
            zoomInput.value = String(value);
            zoomInput.style.setProperty('--zoom-progress', `${value}%`);
            zoomInput.setAttribute('aria-valuenow', String(value));
            zoomInput.setAttribute('aria-valuetext', `${value}%, ${status.toLowerCase()}`);
        }
        if (zoomSwitch) {
            const checked = target >= 0.5;
            zoomSwitch.checked = checked;
            zoomSwitch.setAttribute('aria-checked', String(checked));
        }
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
