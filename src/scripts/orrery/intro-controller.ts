import { smoothstep } from './math';

const INTRO_DURATION_MS = 2400;
const STORAGE_KEY = 'liskovec:orrery-intro-seen:v3';
const ORBIT_START_PROGRESS = 0.34;
const ORBIT_REVEAL_PROGRESS = 0.5;
const REPEAT_ORBIT_START_PROGRESS = 0.16;
const REPEAT_ORBIT_REVEAL_PROGRESS = 0.42;
const BODY_START_PROGRESS = 0.56;
const BODY_REVEAL_PROGRESS = 0.36;
const REPEAT_BODY_START_PROGRESS = 0.35;
const REPEAT_BODY_REVEAL_PROGRESS = 0.36;

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
    private readonly orbitStartProgress: number;
    private readonly orbitRevealProgress: number;
    private readonly bodyStartProgress: number;
    private readonly bodyRevealProgress: number;

    constructor(reducedMotion: boolean) {
        const isRepeatIntro = document.documentElement.hasAttribute('data-orrery-intro-repeat');
        const skipIntro = document.documentElement.hasAttribute('data-orrery-anchor-entry');
        this.orbitStartProgress = isRepeatIntro ? REPEAT_ORBIT_START_PROGRESS : ORBIT_START_PROGRESS;
        this.orbitRevealProgress = isRepeatIntro ? REPEAT_ORBIT_REVEAL_PROGRESS : ORBIT_REVEAL_PROGRESS;
        this.bodyStartProgress = isRepeatIntro ? REPEAT_BODY_START_PROGRESS : BODY_START_PROGRESS;
        this.bodyRevealProgress = isRepeatIntro ? REPEAT_BODY_REVEAL_PROGRESS : BODY_REVEAL_PROGRESS;
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
        this.state.orbits = smoothstep((progress - this.orbitStartProgress) / this.orbitRevealProgress);
        this.state.bodies = smoothstep((progress - this.bodyStartProgress) / this.bodyRevealProgress);
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
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // The animation can complete normally without persistent storage.
        }
    }
}
