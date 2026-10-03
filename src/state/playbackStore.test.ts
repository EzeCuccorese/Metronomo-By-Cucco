import { describe, it, expect, vi } from 'vitest';
import { createPlaybackStore } from './playbackStore';

describe('playbackStore', () => {
    it('notifies subscribers only on real changes', () => {
        const store = createPlaybackStore();
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        store.update({ step: 0 });
        expect(listener).not.toHaveBeenCalled();
        store.update({ step: 3 });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot().step).toBe(3);

        unsubscribe();
        store.update({ step: 4 });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('keeps the formState reference when its content is unchanged', () => {
        const store = createPlaybackStore();
        const form = { sectionName: 'A', sectionBar: 0, sectionTotalBars: 4, totalFormBars: 0, part: 1, isFinal: false };
        store.update({ formState: form });
        const first = store.getSnapshot();
        store.update({ formState: { ...form } });
        expect(store.getSnapshot()).toBe(first);
        store.update({ formState: { ...form, sectionBar: 1 } });
        expect(store.getSnapshot().formState?.sectionBar).toBe(1);
        store.update({ formState: null });
        expect(store.getSnapshot().formState).toBeNull();
    });
});
