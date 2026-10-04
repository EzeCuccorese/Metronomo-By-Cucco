import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Chip, Divider, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Tooltip, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import type { MetronomeEngine } from '../hooks/useMetronomeEngine';
import { usePersistentState } from '../hooks/usePersistentState';
import { usePianoComputerKeyboard } from '../hooks/usePianoComputerKeyboard';
import { usePlayback } from '../state/PlaybackContext';
import { isBoolean, isNumber, isPlainObject, isString } from '../state/storage';
import { chordPitchClasses, noteToMidi, pitchClass, scalePitchClasses, spanishNoteName } from '../audio/piano/notes';
import type { ScaleMode } from '../audio/piano/notes';
import { isMelody, MELODY_BAR_OPTIONS } from '../audio/piano/melody';
import type { Melody } from '../audio/piano/melody';
import type { PianoStatus } from '../audio/piano/PianoSampler';
import PianoKeyboard from './piano/PianoKeyboard';
import MelodyControls from './piano/MelodyControls';

type PianoEngine = Pick<MetronomeEngine,
    'harmonyProgression' | 'pianoStatus' | 'pianoNoteOn' | 'pianoNoteOff' | 'releaseAllPianoKeys' | 'preloadPiano' |
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
}

const MIN_OCTAVE = 2;
const MAX_OCTAVE = 4;
const DEFAULT_SETTINGS: PianoSettings = { octave: 3, computerKeys: false, scale: 'none', bars: 2, loop: true };
const HISTORY_LIMIT = 20;

const SCALES: { id: string; label: string }[] = [
    { id: 'none', label: 'Sin escala' },
    ...Array.from({ length: 12 }, (_, pc) => (['major', 'minor'] as ScaleMode[]).map(mode => ({
        id: `${pc}-${mode}`,
        label: `${spanishNoteName(pc + 60)} ${mode === 'major' ? 'mayor' : 'menor'}`,
    }))).flat(),
];

const isSettings = (v: unknown): v is PianoSettings =>
    isPlainObject(v) && isNumber(v.octave) && Number.isInteger(v.octave) && v.octave >= MIN_OCTAVE && v.octave <= MAX_OCTAVE &&
    isBoolean(v.computerKeys) && isString(v.scale) && SCALES.some(s => s.id === v.scale) &&
    isNumber(v.bars) && (MELODY_BAR_OPTIONS as readonly number[]).includes(v.bars) && isBoolean(v.loop);

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
    const { pianoNoteOn, pianoNoteOff, releaseAllPianoKeys, preloadPiano, subscribeMelodyRecorded, recordMelody, cancelMelodyRecording } = engine;
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

    usePianoComputerKeyboard({
        globalEnabled: settings.computerKeys,
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
            sx={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}
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
                        Acorde: {chord.map(n => { const m = noteToMidi(n); return m === null ? n : spanishNoteName(m); }).join(' · ')}
                    </Typography>
                )}
            </Stack>

            <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                <Stack direction="row" sx={{ alignItems: 'center' }}>
                    <Tooltip title="Bajar octava (Z)">
                        <span>
                            <IconButton size="small" aria-label="Bajar octava" disabled={settings.octave <= MIN_OCTAVE} onClick={() => shiftOctave(-1)}>
                                <ChevronLeftIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Typography variant="caption" sx={{ minWidth: 64, textAlign: 'center', fontFamily: '"Share Tech Mono", monospace' }} data-testid="piano-range">
                        Do{settings.octave}–Do{settings.octave + 2}
                    </Typography>
                    <Tooltip title="Subir octava (X)">
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
                    title="Tocá con A W S E D F T G Y H U J K (Z / X cambian de octava). Apagado: sólo con el foco en el piano"
                >
                    Teclado PC
                </Button>

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
                showKeyHints={settings.computerKeys}
                onNoteOn={noteOn}
                onNoteOff={noteOff}
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
