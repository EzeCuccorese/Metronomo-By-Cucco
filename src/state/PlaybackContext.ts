import { createContext, useContext, useSyncExternalStore } from 'react';
import { createPlaybackStore } from './playbackStore';
import type { PlaybackSnapshot, PlaybackStore } from './playbackStore';

const fallbackStore = createPlaybackStore();

export const PlaybackContext = createContext<PlaybackStore>(fallbackStore);

export const usePlaybackStore = (): PlaybackStore => useContext(PlaybackContext);

/**
 * Subscribes to one slice of the playback snapshot. The component re-renders only
 * when the selected value changes, so selectors should return primitives or stable refs.
 */
export function usePlayback<T>(selector: (s: PlaybackSnapshot) => T): T {
    const store = usePlaybackStore();
    return useSyncExternalStore(
        store.subscribe,
        () => selector(store.getSnapshot()),
        () => selector(store.getSnapshot()),
    );
}
