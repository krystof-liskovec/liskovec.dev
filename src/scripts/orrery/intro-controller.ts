import { smoothstep } from './math';

const INTRO_DURATION_MS = 2000;
const SESSION_KEY = 'liskovec:orrery-intro-seen:v2';

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
        let seen = false;
        try {
            seen = sessionStorage.getItem(SESSION_KEY) === '1';
        } catch {
            // Storage may be unavailable in hardened/private browsing modes.
        }
        this.complete = reducedMotion || seen;
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
        this.state.orbits = smoothstep((progress - 0.16) / 0.55);
        this.state.bodies = smoothstep((progress - 0.34) / 0.48);
        this.state.details = smoothstep((progress - 0.62) / 0.3);
        if (progress === 1) this.finish();
        return this.state;
    }

    skip() {
        if (!this.complete) this.finish();
    }

    private finish() {
        this.complete = true;
        completeState(this.state);
        try {
            sessionStorage.setItem(SESSION_KEY, '1');
        } catch {
            // The animation can complete normally without persistent storage.
        }
    }
}
