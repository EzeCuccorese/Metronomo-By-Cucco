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
import { LAYOUT_TODO } from './state/layout';

const scheduler = () => FakeScheduler.last!;
const bpmInput = () => screen.getByTestId('bpm-input') as HTMLInputElement;

const choose = async (comboboxName: string | RegExp, option: string | RegExp) => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: comboboxName }));
    fireEvent.click(within(await screen.findByRole('listbox')).getByText(option));
};

describe('App (integration with a scripted engine)', () => {
    beforeEach(() => {
        localStorage.clear();
        // Most of these tests exercise every panel: start from the layout existing users get.
        localStorage.setItem(`${STORAGE_PREFIX}ui.layout.v1`, JSON.stringify(LAYOUT_TODO));
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

    it('opens the shortcut cheat sheet with ? and steps rhythms with . and ,', async () => {
        render(<App />);
        fireEvent.keyDown(document.body, { code: 'Period' });
        await act(async () => {});
        const next = scheduler().pattern?.id;
        fireEvent.keyDown(document.body, { code: 'Comma' });
        await act(async () => {});
        expect(scheduler().pattern?.id).not.toBe(next);
        fireEvent.keyDown(document.body, { code: 'Slash', key: '?', shiftKey: true });
        expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeInTheDocument();
    });

    it('opens the command palette with Ctrl+K and sets a typed tempo', async () => {
        render(<App />);
        fireEvent.keyDown(document.body, { code: 'KeyK', ctrlKey: true });
        const input = await screen.findByPlaceholderText(/Buscá un comando/);
        fireEvent.change(input, { target: { value: '88' } });
        fireEvent.click(screen.getByText('Poner tempo 88 BPM'));
        expect(bpmInput().value).toBe('88');
    });

    it('Ctrl+K toggles the command palette closed again', async () => {
        render(<App />);
        fireEvent.keyDown(document.body, { code: 'KeyK', ctrlKey: true });
        const input = await screen.findByPlaceholderText(/Buscá un comando/);
        fireEvent.keyDown(input, { code: 'KeyK', ctrlKey: true });
        await waitForElementToBeRemoved(() => screen.queryByPlaceholderText(/Buscá un comando/));
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

    describe('hiding or folding panels never changes the sound', () => {
        const put = (key: string, value: unknown) => localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
        const chord = { id: 'a', degree: 'I', durationUnits: 2, notes: ['C4', 'E4', 'G4'] };
        const take = { bars: 1, subdivision: 4, notes: [{ step: 0, midi: 60, velocity: 0.9, length: 1 }] };

        it('applies the stored mix, progression and melody with those panels hidden from the start', () => {
            put('ui.layout.v1', { panels: { mixer: 'hidden', harmony: 'hidden', piano: 'hidden' } });
            put('harmony.sequence', [chord]);
            put('harmony.style', 'zamba_base');
            put('piano.melody.v1', take);
            put('mixer', {
                clickRulePatternId: 'metronome',
                channels: [{ id: 'bombo', name: 'BOMBO', volume: 0.4, pan: 0, isMuted: true }],
            });
            render(<App />);
            expect(screen.queryByRole('region', { name: 'Mezclador' })).toBeNull();
            expect(screen.queryByRole('region', { name: 'Armonía' })).toBeNull();
            const calls = scheduler().calls;
            expect(calls.setChannelMute).toContainEqual(['bombo', true]);
            expect(calls.setChannelVolume).toContainEqual(['bombo', 0.4]);
            expect(calls.setHarmonyProgression.at(-1)![0]).toHaveLength(2);
            expect(calls.setAccompanimentStyle.at(-1)).toEqual(['zamba_base']);
            expect(calls.setMelody.at(-1)).toEqual([take]);
        });

        it('keeps the progression and the mutes when the panels are hidden and folded at run time', () => {
            render(<App />);
            fireEvent.click(screen.getByText('IV'));
            fireEvent.click(screen.getByTestId('mute-kick'));
            const progression = scheduler().calls.setHarmonyProgression.at(-1)![0];
            expect(progression).toHaveLength(2);

            // Fold the mixer, hide the harmony card.
            fireEvent.click(screen.getByTestId('panel-toggle-mixer'));
            fireEvent.click(screen.getByRole('button', { name: 'Opciones de Armonía' }));
            fireEvent.click(screen.getByRole('menuitem', { name: 'Ocultar panel' }));
            expect(screen.queryByTestId('harmony-step')).toBeNull();
            expect(scheduler().calls.setHarmonyProgression.at(-1)![0]).toEqual(progression);
            expect(scheduler().calls.setChannelMute.at(-1)).toEqual(['kick', true]);

            // Hide the mixer too, then change rhythm: the click rule still applies to the engine.
            fireEvent.click(screen.getByRole('button', { name: 'Opciones de Mezclador' }));
            fireEvent.click(screen.getByRole('menuitem', { name: 'Ocultar panel' }));
            expect(screen.queryByTestId('mute-click')).toBeNull();
            return choose('Ritmo Predefinido', 'Chacarera Trunca').then(() => {
                expect(scheduler().calls.setChannelMute).toContainEqual(['click', true]);
                expect(scheduler().calls.setChannelMute.filter(c => c[0] === 'kick').at(-1)).toEqual(['kick', true]);
            });
        });

        const openView = () => fireEvent.click(screen.getByTestId('view-menu-button'));

        it('restores a hidden panel from the Vista menu, with its state intact', () => {
            put('harmony.sequence', [chord]);
            put('ui.layout.v1', { panels: { harmony: 'hidden' } });
            render(<App />);
            expect(screen.queryByTestId('harmony-step')).toBeNull();
            openView();
            fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Armonía' }));
            expect(screen.getAllByTestId('harmony-step')).toHaveLength(1);
        });

        it('hides every panel leaving no cards at all', () => {
            put('ui.layout.v1', { panels: { pulse: 'hidden', instruments: 'hidden', sequencer: 'hidden', mixer: 'hidden', practice: 'hidden', harmony: 'hidden', study: 'hidden', piano: 'hidden' } });
            render(<App />);
            expect(document.querySelectorAll('[data-panel]')).toHaveLength(0);
        });
    });

    describe('view presets', () => {
        const openView = () => fireEvent.click(screen.getByTestId('view-menu-button'));
        const panels = () => [...document.querySelectorAll('[data-panel]')].map(r => r.getAttribute('aria-label'));

        it('gives a new user "Ritmos"', () => {
            localStorage.clear();
            render(<App />);
            expect(panels()).toEqual(['Pulso', 'Instrumentos', 'Secuenciador', 'Mezclador', 'Modos de práctica']);
            expect(screen.getByRole('button', { name: /^Mezclador/ })).toHaveAttribute('aria-expanded', 'false');
            expect(JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}ui.layout.v1`)!).preset).toBe('ritmos');
        });

        it('gives people who already have saved settings "Todo"', () => {
            localStorage.clear();
            localStorage.setItem(`${STORAGE_PREFIX}bpm`, '90');
            render(<App />);
            expect(panels()).toHaveLength(8);
            openView();
            expect(screen.getByRole('menuitemradio', { name: 'Todo' })).toHaveAttribute('aria-checked', 'true');
        });

        it('switches presets and falls back to Personalizado when a panel is toggled by hand', () => {
            render(<App />);
            openView();
            fireEvent.click(screen.getByRole('menuitemradio', { name: 'Solo metrónomo' }));
            expect(panels()).toEqual(['Pulso', 'Modos de práctica']);
            openView();
            fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Piano' }));
            expect(panels()).toEqual(['Pulso', 'Modos de práctica', 'Piano']);
            openView();
            expect(screen.getByRole('menuitemradio', { name: 'Personalizado' })).toHaveAttribute('aria-checked', 'true');
            // Trying another preset does not lose the custom arrangement.
            fireEvent.click(screen.getByRole('menuitemradio', { name: 'Estudio' }));
            openView();
            fireEvent.click(screen.getByRole('menuitemradio', { name: 'Personalizado' }));
            expect(panels()).toEqual(['Pulso', 'Modos de práctica', 'Piano']);
        });

        it('keeps the sound of a hidden mixer and harmony when a preset hides them', () => {
            render(<App />);
            fireEvent.click(screen.getByText('IV'));
            const progression = scheduler().calls.setHarmonyProgression.at(-1)![0];
            openView();
            fireEvent.click(screen.getByRole('menuitemradio', { name: 'Solo metrónomo' }));
            expect(screen.queryByTestId('harmony-step')).toBeNull();
            expect(scheduler().calls.setHarmonyProgression.at(-1)![0]).toEqual(progression);
        });
    });
});
