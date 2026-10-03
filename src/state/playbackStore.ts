import type { FormState } from '../audio/Scheduler';

/**
 * High-frequency playback state (changes on every step).
 * Lives outside React state so only the components that read a given field re-render.
 *
 * (ES) Estado de reproducción de alta frecuencia, fuera del estado de React.
 */
export interface PlaybackSnapshot {
    step: number;
    chordIndex: number;
    trainerBar: number;
    totalBars: number;
    formState: FormState | null;
    queuedPatternId: string | null;
}

export interface PlaybackStore {
    getSnapshot: () => PlaybackSnapshot;
    subscribe: (listener: () => void) => () => void;
    update: (partial: Partial<PlaybackSnapshot>) => void;
}

export const INITIAL_PLAYBACK: PlaybackSnapshot = {
    step: 0,
    chordIndex: -1,
    trainerBar: 0,
    totalBars: 0,
    formState: null,
    queuedPatternId: null,
};

const sameFormState = (a: FormState | null, b: FormState | null): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.sectionName === b.sectionName &&
        a.sectionBar === b.sectionBar &&
        a.sectionTotalBars === b.sectionTotalBars &&
        a.totalFormBars === b.totalFormBars &&
        a.part === b.part &&
        a.isFinal === b.isFinal &&
        a.finished === b.finished;
};

export function createPlaybackStore(initial: PlaybackSnapshot = INITIAL_PLAYBACK): PlaybackStore {
    let snapshot = initial;
    const listeners = new Set<() => void>();

    return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        update: (partial) => {
            const next = { ...snapshot, ...partial };
            if (partial.formState !== undefined && sameFormState(partial.formState, snapshot.formState)) {
                next.formState = snapshot.formState;
            }
            const changed = (Object.keys(next) as (keyof PlaybackSnapshot)[]).some(k => next[k] !== snapshot[k]);
            if (!changed) return;
            snapshot = next;
            listeners.forEach(l => l());
        },
    };
}
