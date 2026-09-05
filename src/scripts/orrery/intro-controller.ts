import { smoothstep } from './math';

const INTRO_DURATION_MS = 2400;
const ORBIT_START_PROGRESS = 0.16;
const ORBIT_REVEAL_PROGRESS = 0.42;
const BODY_START_PROGRESS = 0.35;
const BODY_REVEAL_PROGRESS = 0.36;

export type OrreryIntroState = {
    progress: number;
    stars: number;
    sun: number;
    orbits: number;
    bodies: number;
    details: number;
};

const completeState = (state: OrreryIntroState) => {
    state.progress = 1;
    state.stars = 1;
    state.sun = 1;
    state.orbits = 1;
    state.bodies = 1;
    state.details = 1;
};

export class OrreryIntroController {
    readonly state: OrreryIntroState = { progress: 0, stars: 0, sun: 0, orbits: 0, bodies: 0, details: 0 };

    private startedAt = -1;
    private complete: boolean;

    constructor(reducedMotion: boolean) {
        const skipIntro = document.documentElement.hasAttribute('data-orrery-anchor-entry');
        this.complete = reducedMotion || skipIntro;
        if (this.complete) completeState(this.state);
    }

    get running() {
        return !this.complete;
    }

    update(frameTime: number, reducedMotion: boolean) {
        if (this.complete) return this.state;
        if (reducedMotion) {
            this.finish();
            return this.state;
        }
        if (this.startedAt < 0) this.startedAt = frameTime;

        const progress = Math.min(1, (frameTime - this.startedAt) / INTRO_DURATION_MS);
        this.state.progress = progress;
        this.state.stars = smoothstep(progress / 0.2);
        this.state.sun = smoothstep((progress - 0.05) / 0.22);
        this.state.orbits = smoothstep((progress - ORBIT_START_PROGRESS) / ORBIT_REVEAL_PROGRESS);
        this.state.bodies = smoothstep((progress - BODY_START_PROGRESS) / BODY_REVEAL_PROGRESS);
        this.state.details = smoothstep((progress - 0.8) / 0.2);
        if (progress === 1) this.finish();
        return this.state;
    }

    skip() {
        if (!this.complete) this.finish();
    }

    private finish() {
        this.complete = true;
        completeState(this.state);
    }
}
