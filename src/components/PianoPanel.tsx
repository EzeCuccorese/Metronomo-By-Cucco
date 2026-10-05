import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Chip, Divider, FormControl, FormControlLabel, Switch, IconButton, InputLabel, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { shadowNote, shortcutById } from '../shortcuts/registry';
import { setPianoLayout } from '../shortcuts/pianoLayout';
import { useKeyLabels } from '../hooks/useKeyLabels';
import type { MetronomeEngine } from '../hooks/useMetronomeEngine';
import { usePersistentState } from '../hooks/usePersistentState';
import { DEFAULT_VELOCITY_LEVEL, VELOCITY_LEVELS, usePianoComputerKeyboard } from '../hooks/usePianoComputerKeyboard';
import { usePlayback } from '../state/PlaybackContext';
import { isBoolean, isNumber, isPlainObject, isString } from '../state/storage';
import { chordPitchClasses, noteToMidi, pitchClass, scalePitchClasses, spanishNoteName } from '../audio/piano/notes';
import { COMPUTER_LAYOUTS } from '../audio/piano/notes';
import type { PianoLayout, ScaleMode } from '../audio/piano/notes';
import { chordSymbol, MODES } from '../theory/harmony';
import { isMelody, MELODY_BAR_OPTIONS } from '../audio/piano/melody';
import type { Melody } from '../audio/piano/melody';
import type { PianoStatus } from '../audio/piano/PianoSampler';
import PianoKeyboard from './piano/PianoKeyboard';
import MelodyControls from './piano/MelodyControls';
import MidiControls from './piano/MidiControls';
import { useMidiInput } from '../hooks/useMidiInput';

type PianoEngine = Pick<MetronomeEngine,
    'harmonyProgression' | 'pianoStatus' | 'pianoNoteOn' | 'pianoNoteOff' | 'setPianoSustain' | 'releaseAllPianoKeys' | 'preloadPiano' |
    'subscribeMelodyRecorded' | 'recordMelody' | 'cancelMelodyRecording'>;

interface PianoPanelProps {
    engine: PianoEngine;
    isPlaying: boolean;
}

interface PianoSettings {
    /** Octave of the lowest visible C (2 -> C2..C4). */
    octave: number;
    /** Computer keyboard plays the piano from anywhere (not only with focus in the panel). */
    computerKeys: boolean;
    /** "none" or "<pitch class>-<mode>", e.g. "9-minor" (La menor). */
    scale: string;
    bars: number;
    loop: boolean;
    /** Computer-keyboard letters on the keys (desktop only). Absent in older saves: on. */
    showLetters?: boolean;
    /** Velocity level (C / V) of the computer keyboard, an index of VELOCITY_LEVELS. */
    velocityLevel?: number;
    /** Computer-keyboard layout: one row (Ableton, default) or two rows (tracker). */
    layout?: PianoLayout;
}

const MIN_OCTAVE = 2;
const MAX_OCTAVE = 4;
const DEFAULT_SETTINGS: PianoSettings = { octave: 3, computerKeys: false, scale: 'none', bars: 2, loop: true };
const HISTORY_LIMIT = 20;

const SCALES: { id: string; label: string }[] = [
    { id: 'none', label: 'Sin escala' },
    ...Array.from({ length: 12 }, (_, pc) => MODES.map(mode => ({
        id: `${pc}-${mode.id}`,
        label: `${spanishNoteName(pc + 60)} ${mode.short}`,
    }))).flat(),
];

const isSettings = (v: unknown): v is PianoSettings =>
    isPlainObject(v) && isNumber(v.octave) && Number.isInteger(v.octave) && v.octave >= MIN_OCTAVE && v.octave <= MAX_OCTAVE &&
    isBoolean(v.computerKeys) && isString(v.scale) && SCALES.some(s => s.id === v.scale) &&
    isNumber(v.bars) && (MELODY_BAR_OPTIONS as readonly number[]).includes(v.bars) && isBoolean(v.loop) &&
    (v.showLetters === undefined || isBoolean(v.showLetters)) &&
    (v.velocityLevel === undefined || (isNumber(v.velocityLevel) && Number.isInteger(v.velocityLevel) && v.velocityLevel >= 0 && v.velocityLevel < VELOCITY_LEVELS.length)) &&
    (v.layout === undefined || v.layout === 'ableton' || v.layout === 'tracker');

const isStoredMelody = (v: unknown): v is Melody | null => v === null || isMelody(v);

const STATUS_LABEL: Record<PianoStatus, string> = {
    idle: 'Piano',
    loading: 'Cargando piano…',
    ready: 'Piano de cola',
    failed: 'Sonido sintetizado',
};

/**
 * Playable piano: on-screen and computer keyboard, the sounding chord highlighted, an
 * optional scale guide and a melody looper recorded in time with the metronome.
 *
 * (ES) Piano tocable con resaltado del acorde, guía de escala y grabación de melodías en loop.
 */
export default function PianoPanel({ engine, isPlaying }: PianoPanelProps) {
    const { pianoNoteOn, pianoNoteOff, setPianoSustain, releaseAllPianoKeys, preloadPiano, subscribeMelodyRecorded, recordMelody, cancelMelodyRecording } = engine;
    const [settings, setSettings] = usePersistentState('piano.settings', DEFAULT_SETTINGS, isSettings);
    const [melody, setMelody] = usePersistentState<Melody | null>('piano.melody.v1', null, isStoredMelody);
    const [history, setHistory] = useState<(Melody | null)[]>([]);
    const [pressed, setPressed] = useState<ReadonlySet<number>>(() => new Set());
    const holdCounts = useRef(new Map<number, number>());
    const panelRef = useRef<HTMLElement | null>(null);
    const melodyRef = useRef(melody);
    useEffect(() => { melodyRef.current = melody; });

    const update = useCallback((patch: Partial<PianoSettings>) => setSettings(prev => ({ ...prev, ...patch })), [setSettings]);

    // --- Notes (several sources can hold the same key: count them) ---
    const noteOn = useCallback((midi: number, velocity: number) => {
        const count = holdCounts.current.get(midi) ?? 0;
        holdCounts.current.set(midi, count + 1);
        pianoNoteOn(midi, velocity);
        if (count === 0) setPressed(prev => new Set(prev).add(midi));
    }, [pianoNoteOn]);

    const noteOff = useCallback((midi: number) => {
        const count = holdCounts.current.get(midi) ?? 0;
        if (count <= 0) return;
        if (count > 1) {
            holdCounts.current.set(midi, count - 1);
            return;
        }
        holdCounts.current.delete(midi);
        pianoNoteOff(midi);
        setPressed(prev => {
            const next = new Set(prev);
            next.delete(midi);
            return next;
        });
    }, [pianoNoteOff]);

    useEffect(() => () => releaseAllPianoKeys(), [releaseAllPianoKeys]);

    const shiftOctave = useCallback((delta: number) => {
        setSettings(prev => ({ ...prev, octave: Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, prev.octave + delta)) }));
    }, [setSettings]);

    const startMidi = (settings.octave + 1) * 12;

    // --- Sustain pedal: Shift (held) and the on-screen button (toggle) share one pedal ---
    const [shiftPedal, setShiftPedal] = useState(false);
    const [buttonPedal, setButtonPedal] = useState(false);
    const [midiPedal, setMidiPedal] = useState(false);
    const pedalDown = shiftPedal || buttonPedal || midiPedal;
    useEffect(() => { setPianoSustain(pedalDown); }, [pedalDown, setPianoSustain]);
    useEffect(() => () => setPianoSustain(false), [setPianoSustain]);

    const velocityLevel = settings.velocityLevel ?? DEFAULT_VELOCITY_LEVEL;
    const shiftVelocity = useCallback((delta: number) => {
        setSettings(prev => ({ ...prev, velocityLevel: Math.min(VELOCITY_LEVELS.length - 1, Math.max(0, (prev.velocityLevel ?? DEFAULT_VELOCITY_LEVEL) + delta)) }));
    }, [setSettings]);

    const [focusInside, setFocusInside] = useState(false);

    // --- Layout of the computer keyboard (the shortcut registry follows it) and real key labels ---
    const layout: PianoLayout = settings.layout ?? 'ableton';
    const layoutDef = COMPUTER_LAYOUTS[layout];
    const labelOf = useKeyLabels();
    const tapNote = shadowNote(shortcutById('transport.tap'), layout);
    const tapConflict = tapNote ? `${labelOf('KeyT')} = ${tapNote}` : 'T sigue siendo tap';
    useEffect(() => { setPianoLayout(layout); }, [layout]);
    useEffect(() => () => setPianoLayout('ableton'), []);

    // --- MIDI keyboard (Chrome/Android): same noteOn / noteOff / pedal as the other sources ---
    const [midiNoticeDismissed, setMidiNoticeDismissed] = usePersistentState('piano.midiNoticeDismissed', false, isBoolean);
    const midi = useMidiInput({ onNoteOn: noteOn, onNoteOff: noteOff, onSustain: setMidiPedal });

    usePianoComputerKeyboard({
        globalEnabled: settings.computerKeys,
        velocity: VELOCITY_LEVELS[velocityLevel],
        onVelocityShift: shiftVelocity,
        onSustain: setShiftPedal,
        onExit: () => { if (settings.computerKeys) update({ computerKeys: false }); },
        containerRef: panelRef,
        baseMidi: startMidi,
        onNoteOn: noteOn,
        onNoteOff: noteOff,
        onOctaveShift: shiftOctave,
    });

    // --- Samples are downloaded on first interest, not on page load ---
    const preloaded = useRef(false);
    const preload = useCallback(() => {
        if (preloaded.current) return;
        preloaded.current = true;
        preloadPiano();
    }, [preloadPiano]);

    // --- Sounding chord and scale ---
    const chordIndex = usePlayback(s => s.chordIndex);
    const recordState = usePlayback(s => s.melodyState);
    const recordingBar = usePlayback(s => s.recordingBar);
    const chord = isPlaying && chordIndex >= 0 ? engine.harmonyProgression[chordIndex] : undefined;
    const chordKey = chord?.join(',') ?? '';
    const chordPcs = useMemo(() => chordPitchClasses(chordKey ? chordKey.split(',') : []), [chordKey]);
    const rootMidi = chord?.[0] ? noteToMidi(chord[0]) : null;
    const chordRootPc = rootMidi !== null ? pitchClass(rootMidi) : null;
    const scalePcs = useMemo(() => {
        if (settings.scale === 'none') return null;
        const [pc, mode] = settings.scale.split('-');
        return scalePitchClasses(Number(pc), mode as ScaleMode);
    }, [settings.scale]);

    // --- Melody (the loop reaches the engine through `useMelodySync` in App, so it plays with this card hidden) ---

    useEffect(() => subscribeMelodyRecorded((take, isLateUpdate) => {
        if (!isLateUpdate) setHistory(prev => [...prev, melodyRef.current].slice(-HISTORY_LIMIT));
        setMelody(take);
        setSettings(prev => (prev.loop ? prev : { ...prev, loop: true }));
    }), [subscribeMelodyRecorded, setMelody, setSettings]);

    const replaceMelody = (next: Melody | null) => {
        setHistory(prev => [...prev, melody].slice(-HISTORY_LIMIT));
        setMelody(next);
    };

    const undo = () => {
        if (history.length === 0) return;
        setMelody(history[history.length - 1]);
        setHistory(prev => prev.slice(0, -1));
    };

    return (
        <Box
            ref={panelRef}
            data-testid="piano-panel"
            onPointerEnter={preload}
            onFocusCapture={preload}
            onTouchStart={preload}
            onFocus={() => setFocusInside(true)}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusInside(false); }}
            data-pc-keys={settings.computerKeys ? 'global' : focusInside ? 'focus' : 'off'}
            sx={{ border: '1px solid', borderRadius: 3, p: 0.5, borderColor: settings.computerKeys || focusInside ? '#4fc3f7' : 'transparent', boxShadow: settings.computerKeys || focusInside ? '0 0 0 1px rgba(79,195,247,0.45)' : 'none', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}
        >
            <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                <Chip
                    size="small"
                    label={STATUS_LABEL[engine.pianoStatus]}
                    data-testid="piano-status"
                    data-status={engine.pianoStatus}
                    color={engine.pianoStatus === 'ready' ? 'success' : engine.pianoStatus === 'failed' ? 'warning' : 'default'}
                    variant="outlined"
                />
                {chord && (
                    <Typography variant="caption" sx={{ color: '#e5a95f' }} data-testid="piano-chord">
                        Acorde: {chordSymbol(chord)} ({chord.map(n => { const m = noteToMidi(n); return m === null ? n : spanishNoteName(m); }).join(' · ')})
                    </Typography>
                )}
            </Stack>

            <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                    <Tooltip title={`Bajar octava (${labelOf(layoutDef.octave.down)})`}>
                        <span>
                            <IconButton size="small" aria-label="Bajar octava" disabled={settings.octave <= MIN_OCTAVE} onClick={() => shiftOctave(-1)}>
                                <ChevronLeftIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Box sx={{ minWidth: 76, textAlign: 'center', lineHeight: 1.1 }}>
                        <Typography variant="caption" sx={{ display: 'block', fontFamily: '"Share Tech Mono", monospace' }} data-testid="piano-range">
                            Do{settings.octave}–Do{settings.octave + 2}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', fontSize: 10, color: 'text.secondary' }} data-testid="piano-octave">
                            Octava {settings.octave}
                        </Typography>
                    </Box>
                    <Tooltip title={`Subir octava (${labelOf(layoutDef.octave.up)})`}>
                        <span>
                            <IconButton size="small" aria-label="Subir octava" disabled={settings.octave >= MAX_OCTAVE} onClick={() => shiftOctave(1)}>
                                <ChevronRightIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>

                <Button
                    size="small"
                    variant={settings.computerKeys ? 'contained' : 'outlined'}
                    startIcon={<KeyboardIcon sx={{ fontSize: 16 }} />}
                    aria-pressed={settings.computerKeys}
                    onClick={() => update({ computerKeys: !settings.computerKeys })}
                    title="Tocá con las letras de tu teclado (Z / X cambian de octava). Apagado: solo con el foco en el piano"
                >
                    Teclado PC
                </Button>

                <Tooltip title={`Velocidad del Teclado PC (${labelOf(layoutDef.velocity.down)} / ${labelOf(layoutDef.velocity.up)})`}>
                    <Box role="img" aria-label={`Velocidad del teclado PC: nivel ${velocityLevel + 1} de ${VELOCITY_LEVELS.length}`} data-testid="piano-velocity" data-level={velocityLevel}
                        sx={{ display: 'inline-flex', alignItems: 'flex-end', gap: '2px', height: 20, px: 0.5 }}>
                        {VELOCITY_LEVELS.map((_, i) => (
                            <Box key={i} sx={{ width: 4, height: 6 + i * 3, borderRadius: '1px', bgcolor: i <= velocityLevel ? '#e5a95f' : '#4a4034' }} />
                        ))}
                    </Box>
                </Tooltip>

                <Tooltip title={`Pedal de sustain: mantené ${shortcutById('piano.sustain').display} o tocá el botón`}>
                    <Button
                        size="small"
                        variant={pedalDown ? 'contained' : 'outlined'}
                        aria-pressed={pedalDown}
                        onClick={() => setButtonPedal(p => !p)}
                        aria-label="Pedal de sustain"
                        data-testid="piano-pedal"
                    >
                        Pedal
                    </Button>
                </Tooltip>

                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="piano-layout-label">Distribución</InputLabel>
                    <Select labelId="piano-layout-label" label="Distribución" value={layout} onChange={e => update({ layout: e.target.value })} data-testid="piano-layout">
                        <MenuItem value="ableton">Ableton (1 fila)</MenuItem>
                        <MenuItem value="tracker">Tracker (2 filas)</MenuItem>
                    </Select>
                </FormControl>

                <FormControlLabel
                    sx={{ m: 0, '@media (pointer: coarse)': { display: 'none' }, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
                    control={<Switch size="small" checked={settings.showLetters !== false} onChange={e => update({ showLetters: e.target.checked })} />}
                    label="Mostrar letras"
                />

                <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel id="piano-scale-label">Escala</InputLabel>
                    <Select labelId="piano-scale-label" label="Escala" value={settings.scale} onChange={e => update({ scale: e.target.value })}>
                        {SCALES.map(s => <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}
                    </Select>
                </FormControl>
            </Stack>

            <PianoKeyboard
                startMidi={startMidi}
                pressed={pressed}
                chordPcs={chordPcs}
                chordRootPc={chordRootPc}
                scalePcs={scalePcs}
                showKeyHints={settings.showLetters !== false}
                layout={layout}
                labelOf={labelOf}
                onNoteOn={noteOn}
                onNoteOff={noteOff}
            />

            <Box role="status" aria-live="polite" data-testid="piano-pc-status"
                sx={{ mt: 0.5, minHeight: 20, color: settings.computerKeys || focusInside ? '#9fdcf7' : 'text.secondary', fontSize: 12, '@media (pointer: coarse)': { display: 'none' } }}>
                {settings.computerKeys
                    ? `⌨ Teclado PC activo · las letras tocan notas · ${tapConflict} (tap: botón TAP) · ${shortcutById('piano.exit').display} para salir`
                    : focusInside
                        ? 'Tocando con el teclado de la PC (el foco está en el piano)'
                        : 'Enfocá el piano o activá "Teclado PC" para tocar con las letras'}
            </Box>

            <MidiControls
                support={midi.support}
                status={midi.status}
                devices={midi.devices}
                selected={midi.selected}
                onSelect={midi.select}
                onConnect={() => { void midi.connect(); }}
                noticeDismissed={midiNoticeDismissed}
                onDismissNotice={() => setMidiNoticeDismissed(true)}
            />

            <Divider sx={{ my: 1.5, borderColor: '#333' }} />

            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                MELODÍA (LOOP CUANTIZADO A LA SUBDIVISIÓN)
            </Typography>
            <MelodyControls
                melody={melody}
                bars={settings.bars}
                onBarsChange={bars => update({ bars })}
                loopOn={settings.loop}
                onLoopChange={loop => update({ loop })}
                recordState={recordState}
                recordingBar={recordingBar}
                recordingBars={settings.bars}
                isPlaying={isPlaying}
                canUndo={history.length > 0}
                onRecord={() => { preload(); void recordMelody(settings.bars); }}
                onCancel={cancelMelodyRecording}
                onUndo={undo}
                onClear={() => replaceMelody(null)}
            />
        </Box>
    );
}
