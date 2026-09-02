export type Typewriter = {
    setText: (target: string, onComplete?: () => void) => void;
};

export const createTypewriter = (element: HTMLElement, getReducedMotion: () => boolean): Typewriter => {
    const TYPE_DELAY_MS = 32;
    const DELETE_DELAY_MS = 18;
    let timer = 0;
    let run = 0;

    const setText = (target: string, onComplete?: () => void) => {
        run += 1;
        const activeRun = run;
        window.clearTimeout(timer);

        if (getReducedMotion()) {
            element.textContent = target;
            element.classList.remove('is-typing');
            onComplete?.();
            return;
        }

        const current = element.textContent ?? '';
        let visibleLength = current.length;
        let sharedLength = 0;
        while (
            sharedLength < visibleLength &&
            sharedLength < target.length &&
            current[sharedLength] === target[sharedLength]
        ) {
            sharedLength += 1;
        }
        let deleting = visibleLength > sharedLength;

        element.classList.add('is-typing');

        const step = () => {
            if (activeRun !== run) return;

            if (deleting) {
                if (visibleLength > sharedLength) {
                    visibleLength -= 1;
                    element.textContent = current.slice(0, visibleLength);
                    timer = window.setTimeout(step, DELETE_DELAY_MS);
                    return;
                }
                deleting = false;
            }

            if (visibleLength < target.length) {
                visibleLength += 1;
                element.textContent = target.slice(0, visibleLength);
                timer = window.setTimeout(step, TYPE_DELAY_MS);
                return;
            }

            element.classList.remove('is-typing');
            onComplete?.();
        };

        step();
    };

    return { setText };
};
