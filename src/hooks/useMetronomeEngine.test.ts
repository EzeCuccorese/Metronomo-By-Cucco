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
    setMelody = vi.fn();
    melodyCallback: ((m: unknown, late: boolean) => void) | null = null;
    setOnMelodyRecorded = (cb: (m: unknown, late: boolean) => void) => { this.melodyCallback = cb; };
    pianoStatusListener: ((s: string) => void) | null = null;
    getPianoStatus = () => 'idle';
    onPianoStatusChange = (cb: (s: string) => void) => { this.pianoStatusListener = cb; return () => { this.pianoStatusListener = null; }; };
    preloadPiano = vi.fn(async () => true);
    pianoNoteOn = vi.fn();
    pianoNoteOff = vi.fn();
    releaseAllPianoKeys = vi.fn();
    armMelodyRecording = vi.fn();
    cancelMelodyRecording = vi.fn();
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
    step: 0, bpm: 120, trainerBar: 0, totalBars: 0, pattern: p, formState: null, chordIndex: -1, queuedPatternId: null, melodyState: 'idle', recordingBar: 0, ...extra
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

    describe('piano', () => {
        const melody = { bars: 1, subdivision: 4, notes: [{ step: 0, midi: 60, velocity: 1, length: 1 }] };

        it('plays live notes after resuming the context, and releases them', () => {
            const { result, scheduler } = setup();
            act(() => result.current.pianoNoteOn(60, 0.8));
            expect(resume).toHaveBeenCalled();
            expect(scheduler().pianoNoteOn).toHaveBeenCalledWith(60, 0.8);
            act(() => result.current.pianoNoteOff(60));
            expect(scheduler().pianoNoteOff).toHaveBeenCalledWith(60);
            act(() => result.current.releaseAllPianoKeys());
            expect(scheduler().releaseAllPianoKeys).toHaveBeenCalled();
            act(() => result.current.preloadPiano());
            expect(scheduler().preloadPiano).toHaveBeenCalled();
        });

        it('a failed resume never breaks a key press', async () => {
            resume.mockRejectedValueOnce(new Error('blocked'));
            const { result, scheduler } = setup();
            act(() => result.current.pianoNoteOn(62, 1));
            await act(async () => { await Promise.resolve(); });
            expect(scheduler().pianoNoteOn).toHaveBeenCalledWith(62, 1);
        });

        it('mirrors the sample status of the scheduler', () => {
            const { result, scheduler } = setup();
            expect(result.current.pianoStatus).toBe('idle');
            act(() => scheduler().pianoStatusListener!('ready'));
            expect(result.current.pianoStatus).toBe('ready');
        });

        it('exposes the progression as state (unchanged arrays keep their identity)', () => {
            const { result } = setup();
            act(() => result.current.setHarmonyProgression([['C4', 'E4', 'G4']]));
            const first = result.current.harmonyProgression;
            expect(first).toEqual([['C4', 'E4', 'G4']]);
            act(() => result.current.setHarmonyProgression([['C4', 'E4', 'G4']]));
            expect(result.current.harmonyProgression).toBe(first);
        });

        it('replays the melody on a new scheduler and forwards finished takes', () => {
            const { result, scheduler } = setup();
            act(() => result.current.setMelody(melody));
            expect(scheduler().setMelody).toHaveBeenLastCalledWith(melody);

            const listener = vi.fn();
            let unsubscribe!: () => void;
            act(() => { unsubscribe = result.current.subscribeMelodyRecorded(listener); });
            act(() => scheduler().melodyCallback!(melody, false));
            expect(listener).toHaveBeenCalledWith(melody, false);
            unsubscribe();
            act(() => scheduler().melodyCallback!(melody, true));
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('recording while stopped starts the transport with one bar of count-in', async () => {
            const { result, scheduler } = setup();
            await act(async () => { await result.current.recordMelody(2); });
            expect(scheduler().start).toHaveBeenCalled();
            expect(scheduler().armMelodyRecording).toHaveBeenCalledWith(2, 1);
            expect(result.current.store.getSnapshot().melodyState).toBe('armed');

            act(() => result.current.cancelMelodyRecording());
            expect(scheduler().cancelMelodyRecording).toHaveBeenCalled();
            expect(result.current.store.getSnapshot().melodyState).toBe('idle');
        });

        it('recording while playing waits only for the next bar line', async () => {
            const { result, scheduler } = setup();
            await act(async () => { await result.current.start(); });
            await act(async () => { await result.current.recordMelody(4); });
            expect(scheduler().armMelodyRecording).toHaveBeenCalledWith(4, 0);
            act(() => scheduler().onUpdate!(event(pattern('a'), { melodyState: 'recording', recordingBar: 1 })));
            expect(result.current.store.getSnapshot()).toMatchObject({ melodyState: 'recording', recordingBar: 1 });
            act(() => result.current.stop());
            expect(result.current.store.getSnapshot().melodyState).toBe('idle');
        });

        it('does not arm when the start was refused', async () => {
            const error = vi.spyOn(console, 'error').mockImplementation(() => {});
            resume.mockRejectedValueOnce(new Error('interrupted'));
            const { result, scheduler } = setup();
            await act(async () => { await result.current.recordMelody(1); });
            expect(scheduler().armMelodyRecording).not.toHaveBeenCalled();
            error.mockRestore();
        });
    });
});
