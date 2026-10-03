import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import type { PlaybackEvent } from '../audio/Scheduler';

const instances: MockScheduler[] = [];

class MockScheduler {
    onUpdate: ((e: PlaybackEvent) => void) | null = null;
    onStopped: (() => void) | null = null;
    queued: RhythmPattern | null = null;
    setPattern = vi.fn((p: RhythmPattern) => { if (this.playing && p.id !== this.current?.id) this.queued = p; else this.current = p; });
    current: RhythmPattern | null = null;
    playing = false;
    setTempo = vi.fn();
    start = vi.fn(() => { this.playing = true; });
    stop = vi.fn(() => { this.playing = false; this.queued = null; });
    dispose = vi.fn();
    resetPracticeStats = vi.fn();
    getQueuedPatternId = () => this.queued?.id ?? null;
    setOnPlaybackUpdate = (cb: (e: PlaybackEvent) => void) => { this.onUpdate = cb; };
    setOnStopped = (cb: () => void) => { this.onStopped = cb; };
    setChannelVolume = vi.fn();
    setChannelPan = vi.fn();
    setChannelMute = vi.fn();
    setHarmonyProgression = vi.fn();
    setHarmonyVolume = vi.fn();
    setAccompanimentStyle = vi.fn();
    configureTrainer = vi.fn();
    setSilenceMode = vi.fn();
    configureFormas = vi.fn();
    playOneShot = vi.fn();
    ready: Promise<void> = Promise.resolve();
    whenReady = () => this.ready;
    constructor() { instances.push(this); }
}

vi.mock('../audio/Scheduler', () => ({ default: class { constructor() { return new MockScheduler(); } } }));
const resume = vi.fn(async () => {});
vi.mock('../audio/AudioContextManager', () => ({ default: { getInstance: () => ({ resume }) } }));

import { useMetronomeEngine } from './useMetronomeEngine';

const pattern = (id: string, extra: Partial<RhythmPattern> = {}): RhythmPattern => ({
    id, name: id, description: '', timeSignature: [4, 4], subdivision: 4, instruments: ['kick'], countingMode: 'numbers', steps: [], ...extra
});

const event = (p: RhythmPattern, extra: Partial<PlaybackEvent> = {}): PlaybackEvent => ({
    step: 0, bpm: 120, trainerBar: 0, totalBars: 0, pattern: p, formState: null, chordIndex: -1, queuedPatternId: null, ...extra
});

describe('useMetronomeEngine', () => {
    beforeEach(() => {
        instances.length = 0;
        vi.clearAllMocks();
    });

    const setup = (initial = pattern('a')) => {
        const onBpmChange = vi.fn();
        const onPatternChange = vi.fn();
        const hook = renderHook((props: { pattern: RhythmPattern; bpm: number }) =>
            useMetronomeEngine({ ...props, onBpmChange, onPatternChange }), { initialProps: { pattern: initial, bpm: 120 } });
        return { ...hook, onBpmChange, onPatternChange, scheduler: () => instances.at(-1)! };
    };

    it('replays settings made before the scheduler existed and disposes it on unmount', () => {
        const { result, unmount, scheduler } = setup();
        act(() => {
            result.current.setChannelMute('click', true);
            result.current.setHarmonyProgression([['C4']]);
        });
        expect(scheduler().setChannelMute).toHaveBeenCalledWith('click', true);
        unmount();
        expect(scheduler().dispose).toHaveBeenCalled();
    });

    it('starts after resuming the audio context and stops', async () => {
        const { result, scheduler } = setup();
        await act(async () => { await result.current.start(); });
        expect(resume).toHaveBeenCalled();
        expect(scheduler().start).toHaveBeenCalledTimes(1);
        expect(result.current.isPlaying).toBe(true);

        await act(async () => { await result.current.start(); });
        expect(scheduler().start).toHaveBeenCalledTimes(1); // no double start

        act(() => result.current.stop());
        expect(result.current.isPlaying).toBe(false);
    });

    it('publishes step data to the store and reports pattern switches by id only', async () => {
        const a = pattern('a');
        const { result, scheduler, onPatternChange } = setup(a);
        await act(async () => { await result.current.start(); });

        act(() => scheduler().onUpdate!(event({ ...a, steps: [] }, { step: 2 })));
        expect(result.current.store.getSnapshot().step).toBe(2);
        expect(onPatternChange).not.toHaveBeenCalled(); // stale copy of the same pattern: no revert (C3)

        const b = pattern('b');
        act(() => result.current.queuePattern(b));
        expect(result.current.store.getSnapshot().queuedPatternId).toBe('b');
        act(() => scheduler().onUpdate!(event(b)));
        expect(onPatternChange).toHaveBeenCalledWith(b);
    });

    it('reports tempo changes made by the engine', async () => {
        const { result, scheduler, onBpmChange } = setup();
        await act(async () => { await result.current.start(); });
        act(() => scheduler().onUpdate!(event(pattern('a'), { bpm: 125 })));
        expect(onBpmChange).toHaveBeenCalledWith(125);
    });

    it('applies a still-queued pattern when stopped before the bar line', async () => {
        const { result, onPatternChange, onBpmChange } = setup();
        await act(async () => { await result.current.start(); });
        const b = pattern('b', { recommendedTempo: 90 });
        act(() => result.current.queuePattern(b));
        act(() => result.current.stop());
        expect(onPatternChange).toHaveBeenCalledWith(b);
        expect(onBpmChange).toHaveBeenCalledWith(90);
    });

    it('marks playback as stopped when the scheduler ends a form by itself', async () => {
        const { result, scheduler } = setup();
        await act(async () => { await result.current.start(); });
        act(() => scheduler().onStopped!());
        expect(result.current.isPlaying).toBe(false);
    });

    it('syncs pattern and tempo props into the scheduler', () => {
        const { rerender, scheduler } = setup();
        const next = pattern('c');
        rerender({ pattern: next, bpm: 140 });
        expect(scheduler().setPattern).toHaveBeenLastCalledWith(next);
        expect(scheduler().setTempo).toHaveBeenLastCalledWith(140);
    });

    it('waits for the samples, and a stop pressed meanwhile cancels the start', async () => {
        const { result, scheduler } = setup();
        let release!: () => void;
        scheduler().ready = new Promise<void>(r => { release = r; });

        let starting!: Promise<void>;
        act(() => { starting = result.current.start(); });
        await act(async () => { await Promise.resolve(); });
        expect(scheduler().start).not.toHaveBeenCalled(); // still waiting for samples

        act(() => result.current.toggle()); // user changes their mind
        await act(async () => { release(); await starting; });
        expect(scheduler().start).not.toHaveBeenCalled();
        expect(result.current.isPlaying).toBe(false);
    });

    it('stays stopped and reports the error when the audio context cannot resume', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        resume.mockRejectedValueOnce(new Error('interrupted'));
        const { result, scheduler } = setup();
        await act(async () => { await result.current.start(); });
        expect(scheduler().start).not.toHaveBeenCalled();
        expect(result.current.isPlaying).toBe(false);
        expect(error).toHaveBeenCalled();
        error.mockRestore();

        await act(async () => { await result.current.start(); }); // next attempt works
        expect(scheduler().start).toHaveBeenCalledTimes(1);
    });
});
