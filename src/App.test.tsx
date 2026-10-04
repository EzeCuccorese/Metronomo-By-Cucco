import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, within, waitForElementToBeRemoved } from '@testing-library/react';
import type { PlaybackEvent } from './audio/Scheduler';
import type { RhythmPattern } from './rhythms/RhythmPatterns';

// The real audio engine is covered by its own tests and by the Playwright suite;
// here a scripted Scheduler lets us drive the whole UI deterministically.
const { FakeScheduler } = vi.hoisted(() => {
class FakeScheduler {
    static last: FakeScheduler | null = null;
    onUpdate: ((e: PlaybackEvent) => void) | null = null;
    onStopped: (() => void) | null = null;
    pattern: RhythmPattern | null = null;
    queued: RhythmPattern | null = null;
    playing = false;
    calls: Record<string, unknown[][]> = {};
    constructor() { FakeScheduler.last = this; }
    private record(name: string, args: unknown[]) { (this.calls[name] ??= []).push(args); }
    setPattern(p: RhythmPattern) {
        this.record('setPattern', [p]);
        if (this.playing && this.pattern && p.id !== this.pattern.id) this.queued = p;
        else { this.pattern = p; this.queued = null; }
    }
    getQueuedPatternId() { return this.queued?.id ?? null; }
    setTempo(bpm: number) { this.record('setTempo', [bpm]); }
    start() { this.playing = true; this.record('start', []); }
    stop() { this.playing = false; this.queued = null; this.record('stop', []); }
    dispose() { this.record('dispose', []); }
    resetPracticeStats() {}
    whenReady() { return Promise.resolve(); }
    setOnPlaybackUpdate(cb: (e: PlaybackEvent) => void) { this.onUpdate = cb; }
    setOnStopped(cb: () => void) { this.onStopped = cb; }
    setChannelVolume(...a: unknown[]) { this.record('setChannelVolume', a); }
    setChannelPan(...a: unknown[]) { this.record('setChannelPan', a); }
    setChannelMute(...a: unknown[]) { this.record('setChannelMute', a); }
    getChannelLevel() { return 0; }
    setHarmonyProgression(...a: unknown[]) { this.record('setHarmonyProgression', a); }
    setHarmonyVolume(...a: unknown[]) { this.record('setHarmonyVolume', a); }
    setAccompanimentStyle(...a: unknown[]) { this.record('setAccompanimentStyle', a); }
    configureTrainer(...a: unknown[]) { this.record('configureTrainer', a); }
    setSilenceMode(...a: unknown[]) { this.record('setSilenceMode', a); }
    configureFormas(...a: unknown[]) { this.record('configureFormas', a); }
    playOneShot(...a: unknown[]) { this.record('playOneShot', a); }
    setMelody(...a: unknown[]) { this.record('setMelody', a); }
    setOnMelodyRecorded() {}
    getPianoStatus() { return 'idle' as const; }
    onPianoStatusChange() { return () => {}; }
    preloadPiano() { this.record('preloadPiano', []); return Promise.resolve(true); }
    pianoNoteOn(...a: unknown[]) { this.record('pianoNoteOn', a); }
    pianoNoteOff(...a: unknown[]) { this.record('pianoNoteOff', a); }
    releaseAllPianoKeys() {}
    armMelodyRecording(...a: unknown[]) { this.record('armMelodyRecording', a); }
    cancelMelodyRecording() {}
    emit(partial: Partial<PlaybackEvent>) {
        this.onUpdate?.({ step: 0, bpm: 120, trainerBar: 0, totalBars: 0, pattern: this.pattern!, formState: null, chordIndex: -1, queuedPatternId: this.getQueuedPatternId(), melodyState: 'idle', recordingBar: 0, ...partial });
    }
}
    return { FakeScheduler };
});

vi.mock('./audio/Scheduler', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./audio/Scheduler')>();
    return { ...actual, default: FakeScheduler };
});
vi.mock('./audio/AudioContextManager', () => ({ default: { getInstance: () => ({ resume: async () => {}, onContextReplaced: () => () => {}, getOutputLatency: () => 0 }) } }));

import App from './App';
import { STORAGE_PREFIX } from './state/storage';

const scheduler = () => FakeScheduler.last!;
const bpmInput = () => screen.getByTestId('bpm-input') as HTMLInputElement;

const choose = async (comboboxName: string | RegExp, option: string | RegExp) => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: comboboxName }));
    fireEvent.click(within(await screen.findByRole('listbox')).getByText(option));
};

describe('App (integration with a scripted engine)', () => {
    beforeEach(() => {
        localStorage.clear();
        HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
        globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as never;
    });
    afterEach(cleanup);

    it('plays and stops with the button and the Space bar', async () => {
        render(<App />);
        const play = screen.getByTestId('play-toggle');
        await act(async () => { fireEvent.click(play); });
        expect(scheduler().playing).toBe(true);
        expect(play).toHaveTextContent('DETENER');

        await act(async () => { fireEvent.keyDown(document.body, { code: 'Space' }); });
        expect(scheduler().playing).toBe(false);
        expect(play).toHaveTextContent('INICIAR');
    });

    it('loads a preset with its recommended tempo when stopped', async () => {
        render(<App />);
        await choose('Ritmo Predefinido', 'Chacarera Trunca');
        expect(scheduler().pattern?.id).toBe('chacarera_trunca');
        expect(bpmInput().value).toBe('135');
        expect(screen.getByTestId('bpm-unit')).toHaveTextContent('♩.=90');
    });

    it('queues a preset while playing and follows the engine when it switches', async () => {
        render(<App />);
        await act(async () => { fireEvent.click(screen.getByTestId('play-toggle')); });
        await choose('Ritmo Predefinido', 'Samba Brasilera');
        expect(scheduler().getQueuedPatternId()).toBe('samba');
        expect(screen.getByTestId('queued-pattern')).toHaveTextContent('SAMBA');

        const samba = scheduler().queued!;
        scheduler().pattern = samba;
        scheduler().queued = null;
        act(() => scheduler().emit({ pattern: samba, bpm: 115, totalBars: 3 }));
        expect(bpmInput().value).toBe('115');
        expect(screen.queryByTestId('queued-pattern')).toBeNull();
        expect(screen.getByTestId('bars-practiced')).toHaveTextContent('3');
    });

    it('commits typed BPM on Enter, clamps it and persists it', () => {
        const { unmount } = render(<App />);
        fireEvent.change(bpmInput(), { target: { value: '999' } });
        fireEvent.keyDown(bpmInput(), { key: 'Enter' });
        fireEvent.blur(bpmInput());
        expect(bpmInput().value).toBe('300');
        expect(localStorage.getItem(`${STORAGE_PREFIX}bpm`)).toBe('300');
        unmount();
        render(<App />);
        expect(bpmInput().value).toBe('300');
    });

    it('nudges the tempo with the arrow keys', () => {
        render(<App />);
        fireEvent.keyDown(document.body, { code: 'ArrowUp' });
        fireEvent.keyDown(document.body, { code: 'ArrowUp', shiftKey: true });
        expect(bpmInput().value).toBe('126');
    });

    it('sends pattern edits to the engine and persists them', () => {
        const { unmount } = render(<App />);
        const before = scheduler().calls.setPattern.length;
        fireEvent.pointerDown(screen.getByTestId('cell-snare-2'), { button: 0 });
        expect(scheduler().calls.setPattern.length).toBe(before + 1);
        expect(scheduler().pattern?.steps.some(s => s.step === 2 && s.instrument === 'snare')).toBe(true);
        unmount();

        render(<App />);
        expect(screen.getByTestId('cell-snare-2')).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Restaurar ritmo original' }));
        expect(screen.getByTestId('cell-snare-2')).toHaveAttribute('aria-pressed', 'false');
    });

    it('enables the speed trainer and locks the tempo controls while it runs', async () => {
        render(<App />);
        fireEvent.click(screen.getByText('Modos de práctica'));
        fireEvent.click(screen.getByLabelText('Entrenador de velocidad'));
        const last = scheduler().calls.configureTrainer.at(-1)![0] as { active: boolean; startBpm: number };
        expect(last.active).toBe(true);
        expect(bpmInput().value).toBe(String(last.startBpm));

        await act(async () => { fireEvent.click(screen.getByTestId('play-toggle')); });
        expect(bpmInput()).toBeDisabled();
        act(() => scheduler().emit({ trainerBar: 1, bpm: 65 }));
        expect(screen.getByTestId('trainer-status')).toHaveTextContent('Compás 2 de 4');
        expect(bpmInput().value).toBe('65');

        // Keyboard shortcuts can't fight the trainer for the tempo either.
        fireEvent.keyDown(document.body, { code: 'ArrowUp' });
        fireEvent.keyDown(document.body, { code: 'KeyT' });
        expect(bpmInput().value).toBe('65');
    });

    it('configures silence mode and folk forms, and shows the form progress', async () => {
        render(<App />);
        fireEvent.click(screen.getByText('Modos de práctica'));
        fireEvent.click(screen.getByLabelText('Compases en silencio'));
        expect(scheduler().calls.setSilenceMode.at(-1)).toEqual([true, 0.3]);

        fireEvent.click(screen.getByLabelText('Formas folclóricas'));
        await choose('Forma', 'Zamba');
        expect(scheduler().calls.configureFormas.at(-1)).toEqual([true, 'Zamba', 8]);

        await act(async () => { fireEvent.click(screen.getByTestId('play-toggle')); });
        act(() => scheduler().emit({ formState: { sectionName: 'ESTROFA 1', sectionBar: 2, sectionTotalBars: 12, totalFormBars: 12, part: 1, isFinal: false } }));
        expect(screen.getByTestId('form-status')).toHaveTextContent('ESTROFA 1');
        expect(screen.getByTestId('form-status')).toHaveTextContent('Compás 3 / 12');

        act(() => scheduler().onStopped!());
        expect(screen.getByTestId('play-toggle')).toHaveTextContent('INICIAR');
    });

    it('builds a harmony progression and highlights the sounding chord', async () => {
        render(<App />);
        fireEvent.click(screen.getByText('IV'));
        fireEvent.click(screen.getByText('V'));
        expect(scheduler().calls.setHarmonyProgression.at(-1)![0]).toHaveLength(4);

        await choose('Estilo', 'Base Zamba');
        expect(scheduler().calls.setAccompanimentStyle.at(-1)).toEqual(['zamba_base']);

        await act(async () => { fireEvent.click(screen.getByTestId('play-toggle')); });
        act(() => scheduler().emit({ chordIndex: 2 }));
        const steps = screen.getAllByTestId('harmony-step');
        expect(steps[1]).toHaveAttribute('data-active', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Quitar IV' }));
        expect(screen.getAllByTestId('harmony-step')).toHaveLength(1);
    });

    it('opens the rhythm library and selects a rhythm with the keyboard', async () => {
        render(<App />);
        fireEvent.click(screen.getByRole('button', { name: 'Biblioteca de Ritmos' }));
        const card = await screen.findByTestId('genre-card-zamba');
        fireEvent.click(card);
        expect(scheduler().pattern?.id).toBe('zamba');
    });

    it('previews instruments through the accessible buttons', () => {
        render(<App />);
        fireEvent.click(screen.getByRole('button', { name: 'Tocar bombo legüero (aro)' }));
        return Promise.resolve().then(() => {
            expect(scheduler().calls.playOneShot.at(-1)).toEqual(['rim', undefined]);
        });
    });

    it('adds and completes a study task', async () => {
        render(<App />);
        fireEvent.click(screen.getByRole('button', { name: 'Agregar tarea' }));
        fireEvent.change(await screen.findByLabelText('Título de la tarea'), { target: { value: 'Escalas' } });
        fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
        await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
        expect(screen.getByText('Escalas')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Completar Escalas' }));
        expect(screen.getByRole('button', { name: 'Reabrir Escalas' })).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}study.tasks`)!)[0].isCompleted).toBe(true);
    });

    it('releases the engine when unmounted', () => {
        const { unmount } = render(<App />);
        const s = scheduler();
        unmount();
        expect(s.calls.dispose).toHaveLength(1);
    });
});
