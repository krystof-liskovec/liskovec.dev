import type { CameraState, CosmicZoomState } from './runtime-state';
import type { FocusState, FocusTarget } from './types';

type SetZoomLocation = (state: string, copy: string) => void;

export class FocusController {
    constructor(
        private readonly state: FocusState,
        private readonly system: HTMLElement,
        private readonly returnButton: HTMLButtonElement | null,
        private readonly zoomInput: HTMLInputElement | null,
        private readonly zoomSwitch: HTMLInputElement | null,
        private readonly cosmicZoom: CosmicZoomState,
        private readonly camera: CameraState,
        private readonly setZoomLocation: SetZoomLocation,
        private readonly clearCandidate: () => void,
    ) {}

    begin(target: FocusTarget) {
        this.state.target = target;
        this.state.progress = 0;
        this.state.exiting = false;
        this.state.child = null;
        this.state.childProgress = 0;
        this.state.childExiting = false;
        this.state.longitude = 0;
        this.state.latitude = 0;
        this.state.resetting = false;
        this.clearCandidate();
        if (this.returnButton) {
            this.returnButton.hidden = false;
            this.returnButton.classList.remove('is-transitioning');
            this.returnButton.textContent = '[ ← return ]';
        }
        if (this.zoomInput) this.zoomInput.disabled = true;
        if (this.zoomSwitch) this.zoomSwitch.disabled = true;
        this.setZoomLocation(
            `focus:${target.id}`,
            target.name === 'Earth' ? 'on planet Earth.' : target.kind === 'star' ? 'at Sol.' : `near ${target.name}.`,
        );
    }

    beginChild(target: FocusTarget) {
        this.state.child = target;
        this.state.childProgress = 0;
        this.state.childExiting = false;
        this.state.childLongitude = 0;
        this.state.childLatitude = 0;
        this.clearCandidate();
        if (this.returnButton) {
            this.returnButton.classList.remove('is-transitioning');
            this.returnButton.textContent = '[ ← return ]';
        }
        this.setZoomLocation(`focus:${target.id}`, target.kind === 'moon' ? `near ${target.name}.` : 'aboard the ISS.');
    }

    leave() {
        if (this.state.child && !this.state.childExiting) {
            this.state.childExiting = true;
            this.stopDragging();
            if (this.returnButton) {
                this.returnButton.disabled = true;
                this.returnButton.classList.add('is-transitioning');
            }
            return;
        }
        if (!this.state.target || this.state.exiting) return;
        this.state.exiting = true;
        this.stopDragging();
        if (this.returnButton) {
            this.returnButton.disabled = true;
            this.returnButton.hidden = true;
        }
    }

    update(frameDelta: number, reducedMotion: boolean) {
        this.updateParent(frameDelta, reducedMotion);
        this.updateChild(frameDelta, reducedMotion);
    }

    private updateParent(frameDelta: number, reducedMotion: boolean) {
        if (!this.state.target) return;
        const targetProgress = this.state.exiting ? 0 : 1;
        const response = this.state.target.kind === 'galactic' && !this.state.exiting ? 0.0044 : 0.0034;
        this.state.progress +=
            (targetProgress - this.state.progress) * (reducedMotion ? 1 : Math.min(0.11, frameDelta * response));
        if (!this.state.exiting || this.state.progress >= 0.06) return;

        this.state.target = null;
        this.state.progress = 0;
        this.state.exiting = false;
        this.system.classList.remove('is-object-focus');
        if (this.returnButton) {
            this.returnButton.hidden = true;
            this.returnButton.disabled = false;
        }
        if (this.zoomInput) this.zoomInput.disabled = false;
        if (this.zoomSwitch) this.zoomSwitch.disabled = false;
        if (this.cosmicZoom.target >= 0.5) this.setZoomLocation('milky-way', 'in the Milky Way.');
        else this.setZoomLocation('solar', 'in the solar system.');
    }

    private updateChild(frameDelta: number, reducedMotion: boolean) {
        if (!this.state.child) return;
        const targetProgress = this.state.childExiting ? 0 : 1;
        this.state.childProgress +=
            (targetProgress - this.state.childProgress) * (reducedMotion ? 1 : Math.min(0.11, frameDelta * 0.0034));
        if (!this.state.childExiting || this.state.childProgress >= 0.06) return;

        this.state.child = null;
        this.state.childProgress = 0;
        this.state.childExiting = false;
        if (this.returnButton) {
            this.returnButton.disabled = false;
            this.returnButton.textContent = '[ ← return ]';
            this.returnButton.classList.remove('is-transitioning');
        }
        const parent = this.state.target;
        if (parent) {
            this.setZoomLocation(
                `focus:${parent.id}`,
                parent.name === 'Earth' ? 'on planet Earth.' : `near ${parent.name}.`,
            );
        }
    }

    private stopDragging() {
        this.camera.dragging = false;
        this.system.classList.remove('is-dragging');
    }
}
