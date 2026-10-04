import { useSyncExternalStore } from 'react';
import type { PianoLayout } from '../audio/piano/notes';

let current: PianoLayout = 'ableton';
const listeners = new Set<() => void>();

/** Layout the piano panel is using: the registry's piano keys follow it. */
export const getPianoLayout = (): PianoLayout => current;

export function setPianoLayout(layout: PianoLayout) {
    if (layout === current) return;
    current = layout;
    listeners.forEach(l => l());
}

export const subscribePianoLayout = (l: () => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
};

export const usePianoLayout = (): PianoLayout => useSyncExternalStore(subscribePianoLayout, getPianoLayout, (): PianoLayout => 'ableton');
