import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { COMPUTER_KEY_VELOCITY } from '../../hooks/usePianoComputerKeyboard';
import PianoPanel from '../PianoPanel';
import { PlaybackContext } from '../../state/PlaybackContext';
import { createPlaybackStore } from '../../state/playbackStore';
import type { PlaybackStore } from '../../state/playbackStore';
import { STORAGE_PREFIX } from '../../state/storage';
import type { Melody } from '../../audio/piano/melody';
import { FakeMidiAccess, stubRequestMidiAccess, unstubRequestMidiAccess } from '../../test/fakeMidi';
import { useShortcutDispatcher } from '../../shortcuts/dispatcher';
import { melodyStatusText, velocityFromPointer } from '../piano/pianoUi';

type Listener = (m: Melody, late: boolean) => void;

const makeEngine = (overrides: Partial<Record<string, unknown>> = {}) => {
    const listeners = new Set<Listener>();
    return {
        harmonyProgression: [] as string[][],
        pianoStatus: 'idle' as const,
        pianoNoteOn: vi.fn(),
        pianoNoteOff: vi.fn(),
        setPianoSustain: vi.fn(),
        releaseAllPianoKeys: vi.fn(),
        preloadPiano: vi.fn(),
        setMelody: vi.fn(),
        subscribeMelodyRecorded: vi.fn((l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; }),
        recordMelody: vi.fn(async () => {}),
        cancelMelodyRecording: vi.fn(),
        emitTake: (m: Melody, late = false) => listeners.forEach(l => l(m, late)),
        ...overrides,
    };
};

const TAKE: Melody = { bars: 1, subdivision: 4, notes: [{ step: 0, midi: 60, velocity: 0.9, length: 1 }] };

/** The app mounts the single keyboard dispatcher at its root; the panel alone needs it too. */
function WithDispatcher({ children }: { children: React.ReactNode }) {
    useShortcutDispatcher();
    return children;
}

function renderPanel(engine = makeEngine(), isPlaying = false, store: PlaybackStore = createPlaybackStore()) {
    const utils = render(
        <PlaybackContext.Provider value={store}>
            <WithDispatcher><PianoPanel engine={engine as never} isPlaying={isPlaying} /></WithDispatcher>
        </PlaybackContext.Provider>
    );
    return { ...utils, engine, store };
}

const keyEl = (midi: number) => screen.getByTestId(`piano-key-${midi}`);
const stored = (key: string) => JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) ?? 'null');

describe('PianoPanel', () => {
    beforeEach(() => localStorage.clear());
    afterEach(cleanup);

    it('renders two octaves of keys named in Spanish', () => {
        renderPanel();
        const group = screen.getByRole('group', { name: 'Teclado de piano' });
        expect(group.querySelectorAll('button')).toHaveLength(25);
        expect(keyEl(48)).toHaveAccessibleName('Do 3');
        expect(keyEl(49)).toHaveAccessibleName('Do sostenido 3');
        expect(keyEl(72)).toHaveAccessibleName('Do 5');
        expect(screen.getByTestId('piano-range')).toHaveTextContent('Do3–Do5');
    });

    it('pressing a key plays it (velocity from the depth of the hit) and releasing it stops it', () => {
        const { engine } = renderPanel();
        const key = keyEl(60);
        key.getBoundingClientRect = () => ({ top: 0, height: 100 } as DOMRect);
        fireEvent.pointerDown(key, { pointerId: 1, clientY: 100, button: 0, pointerType: 'mouse' });
        expect(engine.pianoNoteOn).toHaveBeenCalledWith(60, 1);
        expect(key).toHaveAttribute('aria-pressed', 'true');
        fireEvent.pointerUp(key, { pointerId: 1 });
        expect(engine.pianoNoteOff).toHaveBeenCalledWith(60);
        expect(key).toHaveAttribute('aria-pressed', 'false');
    });

    it('handles several fingers at once and pointer cancel', () => {
        const { engine } = renderPanel();
        fireEvent.pointerDown(keyEl(60), { pointerId: 1, pointerType: 'touch' });
        fireEvent.pointerDown(keyEl(64), { pointerId: 2, pointerType: 'touch' });
        expect(keyEl(60)).toHaveAttribute('aria-pressed', 'true');
        expect(keyEl(64)).toHaveAttribute('aria-pressed', 'true');
        fireEvent.pointerCancel(keyEl(60), { pointerId: 1 });
        expect(engine.pianoNoteOff).toHaveBeenCalledWith(60);
        expect(keyEl(64)).toHaveAttribute('aria-pressed', 'true');
        fireEvent(keyEl(64), new Event('lostpointercapture', { bubbles: true }));
    });

    it('ignores right clicks and presses outside the keys', () => {
        const { engine } = renderPanel();
        fireEvent.pointerDown(keyEl(60), { pointerId: 1, button: 2, pointerType: 'mouse' });
        fireEvent.pointerDown(screen.getByRole('group', { name: 'Teclado de piano' }), { pointerId: 2, pointerType: 'mouse' });
        expect(engine.pianoNoteOn).not.toHaveBeenCalled();
    });

    it('slides from key to key (glissando) without leaving notes stuck', () => {
        const { engine } = renderPanel();
        const original = document.elementFromPoint;
        let under: Element | null = keyEl(62);
        document.elementFromPoint = () => under;
        try {
            fireEvent.pointerDown(keyEl(60), { pointerId: 3, pointerType: 'touch' });
            fireEvent.pointerMove(keyEl(60), { pointerId: 3 });
            expect(engine.pianoNoteOff).toHaveBeenCalledWith(60);
            expect(engine.pianoNoteOn).toHaveBeenLastCalledWith(62, 0.7);
            fireEvent.pointerMove(keyEl(60), { pointerId: 3 }); // still on 62: nothing new
            expect(engine.pianoNoteOn).toHaveBeenCalledTimes(2);
            under = document.body; // slid off the keyboard
            fireEvent.pointerMove(keyEl(60), { pointerId: 3 });
            expect(engine.pianoNoteOff).toHaveBeenCalledWith(62);
            fireEvent.pointerMove(keyEl(60), { pointerId: 99 }); // unknown pointer: ignored
            expect(screen.getByRole('group').querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
        } finally {
            document.elementFromPoint = original;
        }
    });

    it('clicking a key moves focus onto it (preventDefault would otherwise skip it)', () => {
        renderPanel();
        fireEvent.pointerDown(keyEl(64), { pointerId: 1, pointerType: 'mouse', button: 0 });
        expect(document.activeElement).toBe(keyEl(64));
    });

    it('is playable from the keyboard: Enter plays the focused key, arrows move between keys', () => {
        const { engine } = renderPanel();
        const first = keyEl(48);
        expect(first).toHaveAttribute('tabindex', '0');
        expect(keyEl(49)).toHaveAttribute('tabindex', '-1');
        first.focus();
        fireEvent.keyDown(first, { key: 'Enter' });
        fireEvent.keyDown(first, { key: 'Enter', repeat: true });
        expect(engine.pianoNoteOn).toHaveBeenCalledTimes(1);
        fireEvent.keyUp(first, { key: 'Enter' });
        expect(engine.pianoNoteOff).toHaveBeenCalledWith(48);
        fireEvent.keyUp(first, { key: 'Enter' }); // already released
        expect(engine.pianoNoteOff).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(first, { key: 'ArrowRight' });
        expect(keyEl(49)).toHaveFocus();
        fireEvent.keyDown(keyEl(49), { key: 'End' });
        expect(keyEl(72)).toHaveFocus();
        fireEvent.keyDown(keyEl(72), { key: 'ArrowRight' }); // stays at the edge
        expect(keyEl(72)).toHaveFocus();
        fireEvent.keyDown(keyEl(72), { key: 'Home' });
        expect(keyEl(48)).toHaveFocus();
        fireEvent.keyDown(keyEl(48), { key: 'ArrowLeft' });
        fireEvent.keyDown(keyEl(48), { key: 'a' }); // other keys: untouched
        expect(keyEl(48)).toHaveFocus();

        // Holding Enter and tabbing away releases the note.
        fireEvent.keyDown(keyEl(48), { key: 'Enter' });
        fireEvent.blur(keyEl(48));
        expect(engine.pianoNoteOff).toHaveBeenCalledTimes(2);
    });

    it('the computer keyboard plays while the panel has focus; the "Teclado PC" toggle shows the letters', () => {
        const { engine } = renderPanel();
        keyEl(48).focus();
        fireEvent.keyDown(keyEl(48), { code: 'KeyD' });
        expect(engine.pianoNoteOn).toHaveBeenCalledWith(52, COMPUTER_KEY_VELOCITY);
        fireEvent.keyUp(keyEl(48), { code: 'KeyD' });
        expect(engine.pianoNoteOff).toHaveBeenCalledWith(52);
        // Two sources holding the same key: it sounds until both let go.
        fireEvent.keyDown(keyEl(48), { code: 'KeyA' });
        fireEvent.pointerDown(keyEl(48), { pointerId: 5, pointerType: 'mouse' });
        fireEvent.keyUp(keyEl(48), { code: 'KeyA' });
        expect(engine.pianoNoteOff).not.toHaveBeenCalledWith(48);
        fireEvent.pointerUp(keyEl(48), { pointerId: 5 });
        expect(engine.pianoNoteOff).toHaveBeenCalledWith(48);

        const toggle = screen.getByRole('button', { name: 'Teclado PC' });
        expect(toggle).toHaveAttribute('aria-pressed', 'false');
        // The letters are always there (hidden by CSS on touch devices), and the toggle turns the global mode on.
        expect(keyEl(48)).toHaveTextContent('A');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        expect(stored('piano.settings').computerKeys).toBe(true);
    });

    it('can hide the letters, and shows the mapped-range band only with them', () => {
        renderPanel();
        expect(screen.getByTestId('piano-band')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('switch', { name: 'Mostrar letras' }));
        expect(keyEl(48)).not.toHaveTextContent('A');
        expect(screen.queryByTestId('piano-band')).not.toBeInTheDocument();
        expect(stored('piano.settings').showLetters).toBe(false);
    });

    it('shows the "Teclado PC activo" indicator and Esc turns the mode off', () => {
        renderPanel();
        const status = screen.getByTestId('piano-pc-status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        fireEvent.click(screen.getByRole('button', { name: 'Teclado PC' }));
        expect(status).toHaveTextContent('Teclado PC activo');
        expect(status).toHaveTextContent('Esc para salir');
        fireEvent.keyDown(document.body, { code: 'Escape' });
        expect(screen.getByRole('button', { name: 'Teclado PC' })).toHaveAttribute('aria-pressed', 'false');
        expect(status).not.toHaveTextContent('Teclado PC activo');
    });

    it('lights up the panel while the focus is inside it', () => {
        renderPanel();
        const panel = screen.getByTestId('piano-panel');
        expect(panel).toHaveAttribute('data-pc-keys', 'off');
        act(() => keyEl(48).focus());
        expect(panel).toHaveAttribute('data-pc-keys', 'focus');
        expect(screen.getByTestId('piano-pc-status')).toHaveTextContent('Tocando con el teclado de la PC');
        act(() => keyEl(48).blur());
        expect(panel).toHaveAttribute('data-pc-keys', 'off');
    });

    it('C / V change the keyboard velocity and the notes use it', () => {
        const { engine } = renderPanel();
        const meter = screen.getByTestId('piano-velocity');
        expect(meter).toHaveAttribute('data-level', '3');
        keyEl(48).focus();
        fireEvent.keyDown(keyEl(48), { code: 'KeyC' });
        fireEvent.keyDown(keyEl(48), { code: 'KeyC' });
        expect(meter).toHaveAttribute('data-level', '1');
        fireEvent.keyDown(keyEl(48), { code: 'KeyA' });
        expect(engine.pianoNoteOn).toHaveBeenCalledWith(48, 0.55);
        for (let i = 0; i < 6; i++) fireEvent.keyDown(keyEl(48), { code: 'KeyV' });
        expect(meter).toHaveAttribute('data-level', '4');
        expect(stored('piano.settings').velocityLevel).toBe(4);
    });

    it('sustain: holding Shift or the Pedal button shares one pedal', () => {
        const { engine } = renderPanel();
        keyEl(48).focus();
        fireEvent.keyDown(keyEl(48), { code: 'ShiftLeft' });
        expect(engine.setPianoSustain).toHaveBeenLastCalledWith(true);
        fireEvent.keyUp(keyEl(48), { code: 'ShiftLeft' });
        expect(engine.setPianoSustain).toHaveBeenLastCalledWith(false);

        const pedal = screen.getByRole('button', { name: 'Pedal de sustain' });
        fireEvent.click(pedal);
        expect(pedal).toHaveAttribute('aria-pressed', 'true');
        expect(engine.setPianoSustain).toHaveBeenLastCalledWith(true);
        // Shift on top of the button does not lift the pedal.
        fireEvent.keyDown(keyEl(48), { code: 'ShiftRight' });
        fireEvent.keyUp(keyEl(48), { code: 'ShiftRight' });
        expect(engine.setPianoSustain).toHaveBeenLastCalledWith(true);
        fireEvent.click(pedal);
        expect(engine.setPianoSustain).toHaveBeenLastCalledWith(false);
    });

    it('Esc releases held keys and the Shift pedal on its way out', () => {
        const { engine } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: 'Teclado PC' }));
        fireEvent.keyDown(document.body, { code: 'KeyA' });
        fireEvent.keyDown(document.body, { code: 'ShiftLeft' });
        fireEvent.keyDown(document.body, { code: 'Escape' });
        expect(engine.pianoNoteOff).toHaveBeenCalledWith(48);
        expect(engine.setPianoSustain).toHaveBeenLastCalledWith(false);
        expect(screen.getByRole('button', { name: 'Teclado PC' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('lifts the Shift pedal when the window loses focus', () => {
        const { engine } = renderPanel();
        keyEl(48).focus();
        fireEvent.keyDown(keyEl(48), { code: 'ShiftLeft' });
        act(() => { window.dispatchEvent(new Event('blur')); });
        expect(engine.setPianoSustain).toHaveBeenLastCalledWith(false);
    });

    it('shows the octave next to the range', () => {
        renderPanel();
        expect(screen.getByTestId('piano-octave')).toHaveTextContent('Octava 3');
    });

    it('shifts octaves with the buttons and with Z / X, within C2..C6', () => {
        renderPanel();
        fireEvent.click(screen.getByRole('button', { name: 'Subir octava' }));
        expect(screen.getByTestId('piano-range')).toHaveTextContent('Do4–Do6');
        expect(screen.getByRole('button', { name: 'Subir octava' })).toBeDisabled();
        keyEl(60).focus();
        fireEvent.keyDown(keyEl(60), { code: 'KeyZ' });
        fireEvent.keyDown(keyEl(60), { code: 'KeyZ' });
        expect(screen.getByTestId('piano-range')).toHaveTextContent('Do2–Do4');
        expect(screen.getByRole('button', { name: 'Bajar octava' })).toBeDisabled();
        expect(stored('piano.settings').octave).toBe(2);
    });

    it('highlights the chord that is sounding, with its root', () => {
        const store = createPlaybackStore();
        const engine = makeEngine({ harmonyProgression: [['C4', 'E4', 'G4'], ['A3', 'C4', 'E4']] });
        renderPanel(engine, true, store);
        expect(document.querySelectorAll('[data-chord]')).toHaveLength(0);

        act(() => store.update({ chordIndex: 1 }));
        const chordKeys = Array.from(document.querySelectorAll<HTMLElement>('[data-chord]')).map(k => Number(k.dataset.midi));
        expect(chordKeys).toEqual([48, 52, 57, 60, 64, 69, 72]); // every C, E, A on screen
        expect(keyEl(57)).toHaveClass('is-root');
        expect(keyEl(57)).toHaveAccessibleName('La 3, fundamental del acorde');
        expect(keyEl(60)).toHaveAccessibleName('Do 4, nota del acorde');
        expect(screen.getByTestId('piano-chord')).toHaveTextContent('La · Do · Mi');
    });

    it('shows no chord when stopped', () => {
        const store = createPlaybackStore();
        renderPanel(makeEngine({ harmonyProgression: [['C4', 'E4', 'G4']] }), false, store);
        act(() => store.update({ chordIndex: 0 }));
        expect(document.querySelectorAll('[data-chord]')).toHaveLength(0);
        expect(screen.queryByTestId('piano-chord')).toBeNull();
    });

    it('marks the keys of the selected scale', () => {
        localStorage.setItem(`${STORAGE_PREFIX}piano.settings`, JSON.stringify({ octave: 3, computerKeys: false, scale: '7-major', bars: 2, loop: true }));
        renderPanel();
        expect(keyEl(54)).toHaveClass('is-scale'); // F# in G major
        expect(keyEl(53)).toHaveClass('is-outside'); // F natural
    });

    it('rejects corrupted stored settings and melodies', () => {
        localStorage.setItem(`${STORAGE_PREFIX}piano.settings`, JSON.stringify({ octave: 9 }));
        localStorage.setItem(`${STORAGE_PREFIX}piano.melody.v1`, JSON.stringify({ bars: 1, subdivision: 4, notes: [{ step: 9 }] }));
        const { engine } = renderPanel();
        expect(screen.getByTestId('piano-range')).toHaveTextContent('Do3–Do5');
        expect(screen.getByTestId('melody-status')).toHaveTextContent('Sin melodía grabada');
        expect(engine.setMelody).toHaveBeenLastCalledWith(null);
    });

    it('restores a stored melody into the engine', () => {
        localStorage.setItem(`${STORAGE_PREFIX}piano.melody.v1`, JSON.stringify(TAKE));
        const { engine } = renderPanel();
        expect(engine.setMelody).toHaveBeenLastCalledWith(TAKE);
        expect(screen.getByTestId('melody-status')).toHaveTextContent('1 nota · 1 compás · suena en loop al reproducir');
    });

    it('records, loops, undoes and clears the melody', async () => {
        const { engine } = renderPanel(makeEngine(), true);
        fireEvent.click(screen.getByRole('button', { name: 'Grabar' }));
        expect(engine.preloadPiano).toHaveBeenCalled();
        expect(engine.recordMelody).toHaveBeenCalledWith(2);

        act(() => engine.emitTake(TAKE));
        expect(stored('piano.melody.v1')).toEqual(TAKE);
        expect(engine.setMelody).toHaveBeenLastCalledWith(TAKE);
        expect(screen.getByTestId('melody-status')).toHaveTextContent('1 nota · 1 compás · sonando en loop');

        // A late note updates the same take (no extra undo step).
        const withLate = { ...TAKE, notes: [...TAKE.notes, { step: 0, midi: 64, velocity: 0.5, length: 1 }] };
        act(() => engine.emitTake(withLate, true));
        expect(screen.getByTestId('melody-status')).toHaveTextContent('2 notas');

        const loop = screen.getByRole('button', { name: 'Loop' });
        fireEvent.click(loop);
        expect(loop).toHaveAttribute('aria-pressed', 'false');
        expect(engine.setMelody).toHaveBeenLastCalledWith(null);
        expect(screen.getByTestId('melody-status')).toHaveTextContent('loop apagado');
        // A new take switches the loop back on.
        act(() => engine.emitTake(TAKE));
        expect(screen.getByRole('button', { name: 'Loop' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
        expect(stored('piano.melody.v1')).toBeNull();
        expect(screen.getByRole('button', { name: 'Borrar' })).toBeDisabled();

        fireEvent.click(screen.getByRole('button', { name: 'Deshacer' })); // back to the second take
        expect(stored('piano.melody.v1')).toEqual(TAKE);
        fireEvent.click(screen.getByRole('button', { name: 'Deshacer' })); // back to the first take (with the late note)
        expect(stored('piano.melody.v1')).toEqual(withLate);
        fireEvent.click(screen.getByRole('button', { name: 'Deshacer' })); // before anything was recorded
        expect(stored('piano.melody.v1')).toBeNull();
        expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    });

    it('shows the count-in and recording progress, and cancels', async () => {
        const store = createPlaybackStore();
        const { engine } = renderPanel(makeEngine(), true, store);
        act(() => store.update({ melodyState: 'armed' }));
        expect(screen.getByTestId('melody-status')).toHaveTextContent('Precuenta');
        act(() => store.update({ melodyState: 'recording', recordingBar: 1 }));
        expect(screen.getByTestId('melody-status')).toHaveTextContent('Grabando compás 2 de 2');
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(engine.cancelMelodyRecording).toHaveBeenCalled();
    });

    it('downloads the samples on first interest only, and lifts held keys on unmount', () => {
        const { engine, unmount } = renderPanel(makeEngine({ pianoStatus: 'ready' }));
        expect(screen.getByTestId('piano-status')).toHaveTextContent('Piano de cola');
        const panel = screen.getByTestId('piano-panel');
        fireEvent.pointerEnter(panel);
        fireEvent.focus(keyEl(48));
        expect(engine.preloadPiano).toHaveBeenCalledTimes(1);
        unmount();
        expect(engine.releaseAllPianoKeys).toHaveBeenCalled();
    });

    it('labels a synthesized fallback', () => {
        renderPanel(makeEngine({ pianoStatus: 'failed' }));
        expect(screen.getByTestId('piano-status')).toHaveTextContent('Sonido sintetizado');
    });
});

describe('piano UI helpers', () => {
    it('derives velocity from the depth of the hit', () => {
        expect(velocityFromPointer(0, { top: 0, height: 100 })).toBe(0.35);
        expect(velocityFromPointer(50, { top: 0, height: 100 })).toBe(0.68);
        expect(velocityFromPointer(500, { top: 0, height: 100 })).toBe(1);
        expect(velocityFromPointer(10, { top: 0, height: 0 })).toBe(0.8);
    });

    it('describes the looper state', () => {
        const base = { melody: null, recordState: 'idle' as const, recordingBar: 0, recordingBars: 4, isPlaying: false, loopOn: true };
        expect(melodyStatusText(base)).toBe('Sin melodía grabada');
        expect(melodyStatusText({ ...base, recordState: 'recording', recordingBar: 7 })).toBe('Grabando compás 4 de 4');
        expect(melodyStatusText({ ...base, melody: { bars: 3, subdivision: 4, notes: [TAKE.notes[0], TAKE.notes[0]] } })).toBe('2 notas · 3 compases · suena en loop al reproducir');
    });

    describe('MIDI input', () => {
        beforeEach(() => localStorage.clear());
        afterEach(() => { unstubRequestMidiAccess(); vi.unstubAllGlobals(); });

        it('connects from the button and routes notes, velocity and the pedal into the normal piano path', async () => {
            const access = new FakeMidiAccess();
            const keyboard = access.plug('k1', 'Arturia KeyLab');
            const request = stubRequestMidiAccess(access);
            const { engine } = renderPanel();
            expect(screen.queryByTestId('midi-notice')).not.toBeInTheDocument();
            fireEvent.click(screen.getByTestId('midi-connect'));
            expect(await screen.findByTestId('midi-status')).toHaveTextContent('MIDI activo · Arturia KeyLab');
            expect(request).toHaveBeenCalledWith({ sysex: false });

            act(() => keyboard.send(0x90, 60, 127));
            expect(engine.pianoNoteOn).toHaveBeenCalledWith(60, 1);
            expect(keyEl(60)).toHaveAttribute('aria-pressed', 'true');
            act(() => keyboard.send(0x80, 60, 0));
            expect(engine.pianoNoteOff).toHaveBeenCalledWith(60);

            act(() => keyboard.send(0xb0, 64, 127));
            expect(engine.setPianoSustain).toHaveBeenLastCalledWith(true);
            expect(screen.getByRole('button', { name: 'Pedal de sustain' })).toHaveAttribute('aria-pressed', 'true');
            act(() => keyboard.send(0xb0, 64, 0));
            expect(engine.setPianoSustain).toHaveBeenLastCalledWith(false);
        });

        it('requests access only once when connect is triggered twice', async () => {
            const access = new FakeMidiAccess();
            const request = stubRequestMidiAccess(access);
            renderPanel();
            const button = screen.getByTestId('midi-connect');
            fireEvent.click(button);
            fireEvent.click(button);
            await screen.findByTestId('midi-status');
            expect(request).toHaveBeenCalledTimes(1);
            expect(screen.getByRole('combobox', { name: /Teclado MIDI/ })).toHaveAttribute('aria-disabled', 'true');
        });

        it('releases the held notes when the keyboard is unplugged', async () => {
            const access = new FakeMidiAccess();
            const keyboard = access.plug('k1', 'Keys');
            stubRequestMidiAccess(access);
            const { engine } = renderPanel();
            fireEvent.click(screen.getByTestId('midi-connect'));
            await screen.findByTestId('midi-status');
            act(() => keyboard.send(0x90, 64, 90));
            act(() => access.unplug('k1'));
            expect(engine.pianoNoteOff).toHaveBeenCalledWith(64);
            expect(screen.getByTestId('midi-status')).toHaveTextContent('No hay teclados MIDI conectados');
        });

        it('lets the player choose which device to listen to', async () => {
            const access = new FakeMidiAccess();
            const a = access.plug('a', 'Keys A');
            const b = access.plug('b', 'Keys B');
            stubRequestMidiAccess(access);
            const { engine } = renderPanel();
            fireEvent.click(screen.getByTestId('midi-connect'));
            await screen.findByTestId('midi-status');
            fireEvent.mouseDown(screen.getByRole('combobox', { name: /Teclado MIDI/ }));
            fireEvent.click(await screen.findByRole('option', { name: 'Keys B' }));
            act(() => a.send(0x90, 60, 100));
            expect(engine.pianoNoteOn).not.toHaveBeenCalled();
            act(() => b.send(0x90, 62, 100));
            expect(engine.pianoNoteOn).toHaveBeenCalledWith(62, 100 / 127);
        });

        it('says so when the permission is denied', async () => {
            stubRequestMidiAccess(new Error('denied'));
            renderPanel();
            fireEvent.click(screen.getByTestId('midi-connect'));
            expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo acceder a MIDI');
        });

        it('shows the dismissible iPhone/iPad notice when Web MIDI does not exist', () => {
            vi.stubGlobal('navigator', Object.create(navigator, {
                userAgent: { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1' },
            }));
            renderPanel();
            expect(screen.getByTestId('midi-notice')).toHaveTextContent('MIDI no está disponible en iPhone/iPad');
            expect(screen.queryByTestId('midi-connect')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /close|cerrar/i }));
            expect(screen.queryByTestId('midi-notice')).not.toBeInTheDocument();
            expect(stored('piano.midiNoticeDismissed')).toBe(true);
        });

        it('shows the Chrome suggestion on desktop Safari', () => {
            vi.stubGlobal('navigator', Object.create(navigator, {
                userAgent: { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15' },
                maxTouchPoints: { value: 0 },
            }));
            renderPanel();
            expect(screen.getByTestId('midi-notice')).toHaveTextContent('Para conectar un teclado MIDI, abrí la app en Chrome.');
        });
    });
});
