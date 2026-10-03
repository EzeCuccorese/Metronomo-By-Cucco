import { useEffect, useCallback } from 'react';
import { Box, Typography, Select, MenuItem, Stack, Slider, FormControl, InputLabel, Button, Divider, Chip } from '@mui/material';
import { Music, Trash2, RotateCcw } from 'lucide-react';
import type { AccompanimentStyle } from '../audio/PolyphonicSynth';
import { usePersistentState } from '../hooks/usePersistentState';
import { usePlayback } from '../state/PlaybackContext';
import { isNumber, isPlainObject, isString } from '../state/storage';

interface HarmonyBuilderProps {
    onUpdateProgression: (progression: string[][]) => void;
    onVolumeChange: (vol: number) => void;
    onStyleChange: (style: AccompanimentStyle) => void;
    isPlaying?: boolean;
}

const STYLES: { id: AccompanimentStyle; label: string }[] = [
    { id: 'pad', label: 'Pad (Sostenido)' },
    { id: 'quarters', label: 'Negras (Marcato)' },
    { id: 'offbeats', label: 'Contratiempos (Reggae/Ska)' },
    { id: 'arpeggio_8', label: 'Arpegio (8 corcheas)' },
    { id: 'zamba_base', label: 'Base Zamba' },
];

const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const OCTAVES = [3, 4, 5];

type ModeType = 'major' | 'minor' | 'dorian' | 'mixolydian';

const MODES: { id: ModeType; label: string }[] = [
    { id: 'major', label: 'Mayor (Natural)' },
    { id: 'minor', label: 'Menor (Natural)' },
    { id: 'dorian', label: 'Dórico (Jazzy)' },
    { id: 'mixolydian', label: 'Mixolidio (Bluesy)' }
];

// 1 unit = Half Bar (1/2 compás)
interface ChordStep {
    id: string;
    degree: string;
    durationUnits: number; // Number of half-bars. 1 = 1/2 bar, 2 = 1 bar.
    notes: string[];
}

const getScaleIntervals = (m: ModeType) => {
    // Semitones from root
    switch (m) {
        case 'major': return [0, 2, 4, 5, 7, 9, 11]; // I, ii, iii, IV, V, vi, viidim
        case 'minor': return [0, 2, 3, 5, 7, 8, 10]; // i, iidim, III, iv, v, VI, VII
        case 'dorian': return [0, 2, 3, 5, 7, 9, 10]; // i, ii, III, IV, v, vidim, VII
        case 'mixolydian': return [0, 2, 4, 5, 7, 9, 10]; // I, ii, iii, IV, V, vi, VII
    }
};

const getChordType = (degreeIndex: number, m: ModeType) => {
    // Simplified Triad mapping
    const map: Record<ModeType, string[]> = {
        'major': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
        'minor': ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
        'dorian': ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII'],
        'mixolydian': ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII']
    };

    return map[m][degreeIndex];
};

const isChordStep = (v: unknown): v is ChordStep =>
    isPlainObject(v) && isString(v.id) && isString(v.degree) && isNumber(v.durationUnits) && v.durationUnits >= 1 &&
    Array.isArray(v.notes) && v.notes.every(n => isString(n) && /^[A-G][#b]?[0-8]$/.test(n));

const isSequence = (v: unknown): v is ChordStep[] => Array.isArray(v) && v.every(isChordStep);
const isKey = (v: unknown): v is string => isString(v) && KEYS.includes(v);
const isMode = (v: unknown): v is ModeType => MODES.some(m => m.id === v);
const isOctave = (v: unknown): v is number => isNumber(v) && OCTAVES.includes(v);
const isVolume = (v: unknown): v is number => isNumber(v) && v >= 0 && v <= 1;
const isStyle = (v: unknown): v is AccompanimentStyle => STYLES.some(s => s.id === v);

export default function HarmonyBuilder({ onUpdateProgression, onVolumeChange, onStyleChange, isPlaying = false }: HarmonyBuilderProps) {
    const [rootKey, setRootKey] = usePersistentState('harmony.key', 'C', isKey);
    const [mode, setMode] = usePersistentState<ModeType>('harmony.mode', 'major', isMode);
    const [octave, setOctave] = usePersistentState('harmony.octave', 4, isOctave);
    const [volume, setVolume] = usePersistentState('harmony.volume', 0.3, isVolume);
    const [style, setStyle] = usePersistentState<AccompanimentStyle>('harmony.style', 'pad', isStyle);
    const chordIndex = usePlayback(s => s.chordIndex);
    const activeHalfBarIndex = isPlaying ? chordIndex : -1;

    // Sequence
    const [sequence, setSequence] = usePersistentState<ChordStep[]>('harmony.sequence', [], isSequence);

    // Restored settings must reach the audio engine too.
    useEffect(() => { onStyleChange(style); }, [style, onStyleChange]);
    useEffect(() => { onVolumeChange(volume); }, [volume, onVolumeChange]);

    const availableDegrees = [0, 1, 2, 3, 4, 5, 6].map(i => ({
        index: i,
        label: getChordType(i, mode)
    }));

    const addChord = useCallback((degreeIndex: number) => {
        // Calculate actual notes
        // 1. Get Root Note Index
        const NOTE_ORDER = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
        const rootIdx = NOTE_ORDER.indexOf(rootKey);

        const scaleIntervals = getScaleIntervals(mode);

        // Chord Intervals (Triad)
        // Root
        const i1 = scaleIntervals[degreeIndex];
        // Third (Scale degree + 2)
        const i2 = scaleIntervals[(degreeIndex + 2) % 7] + (degreeIndex + 2 >= 7 ? 12 : 0);
        // Fifth (Scale degree + 4)
        const i3 = scaleIntervals[(degreeIndex + 4) % 7] + (degreeIndex + 4 >= 7 ? 12 : 0);

        const getNoteName = (semitoneOffset: number) => {
            const idx = (rootIdx + semitoneOffset) % 12;
            const octaveOffset = Math.floor((rootIdx + semitoneOffset) / 12);
            return `${NOTE_ORDER[idx]}${octave + octaveOffset}`;
        };

        const notes = [
            getNoteName(i1),
            getNoteName(i2),
            getNoteName(i3)
        ];

        const newChord: ChordStep = {
            id: Math.random().toString(36).slice(2, 11),
            degree: getChordType(degreeIndex, mode),
            durationUnits: 2, // Default to 1 Bar (2 half-bars)
            notes: notes
        };

        setSequence(prev => [...prev, newChord]);
    }, [rootKey, mode, octave, setSequence]);

    const removeChord = useCallback((id: string) => {
        setSequence(prev => prev.filter(c => c.id !== id));
    }, [setSequence]);

    // Sync with Parent
    useEffect(() => {
        const progression: string[][] = [];

        sequence.forEach(step => {
            // Push N copies of the chord, where N is durationUnits
            // Each copy represents 1/2 bar of music
            for (let i = 0; i < step.durationUnits; i++) {
                progression.push(step.notes);
            }
        });

        onUpdateProgression(progression);
    }, [sequence, onUpdateProgression]);

    const handleVolume = (_: Event, val: number | number[]) => {
        setVolume(val as number);
    };

    const handleStyleChange = (val: AccompanimentStyle) => {
        setStyle(val);
    };

    // Find which sequence step corresponds to activeHalfBarIndex
    let activeSequenceIdx = -1;
    if (activeHalfBarIndex !== undefined && activeHalfBarIndex >= 0) {
        let accUnits = 0;
        for (let i = 0; i < sequence.length; i++) {
            accUnits += sequence[i].durationUnits;
            if (activeHalfBarIndex < accUnits) {
                activeSequenceIdx = i;
                break;
            }
        }
    }

    return (
        <Box sx={{
            p: 2,
            borderRadius: 3,
            bgcolor: '#1a1a1a',
            border: '1px solid #333',
            height: '100%',
            overflow: 'auto'
        }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <Music size={20} color="#c0c0c0" />
                <Typography variant="subtitle1" fontWeight="bold" color="white">
                    Constructor Armónico
                </Typography>
            </Stack>

            {/* Global Settings */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
                <FormControl size="small">
                    <InputLabel id="harmony-key-label">Tono</InputLabel>
                    <Select value={rootKey} labelId="harmony-key-label" label="Tono" onChange={(e) => setRootKey(e.target.value)}>
                        {KEYS.map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}
                    </Select>
                </FormControl>

                <FormControl size="small">
                    <InputLabel id="harmony-mode-label">Modo</InputLabel>
                    <Select value={mode} labelId="harmony-mode-label" label="Modo" onChange={(e) => setMode(e.target.value as ModeType)}>
                        {MODES.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
                    </Select>
                </FormControl>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 1, mb: 2 }}>
                <FormControl size="small">
                    <InputLabel id="harmony-style-label">Estilo</InputLabel>
                    <Select value={style} labelId="harmony-style-label" label="Estilo" onChange={(e) => handleStyleChange(e.target.value as AccompanimentStyle)}>
                        {STYLES.map(st => <MenuItem key={st.id} value={st.id}>{st.label}</MenuItem>)}
                    </Select>
                </FormControl>

                <FormControl size="small">
                    <InputLabel id="harmony-octave-label">Oct</InputLabel>
                    <Select value={octave} labelId="harmony-octave-label" label="Oct" onChange={(e) => setOctave(Number(e.target.value))}>
                        {OCTAVES.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </Select>
                </FormControl>
            </Box>

            <Divider sx={{ mb: 2, borderColor: '#333' }} />

            {/* Chord Palette */}
            <Typography variant="caption" color="text.secondary" mb={1} display="block">
                AGREGAR ACORDE (GRADO)
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} mb={3}>
                {availableDegrees.map(d => (
                    <Chip
                        key={d.index}
                        label={d.label}
                        onClick={() => addChord(d.index)}
                        clickable
                        color="primary"
                        variant="outlined"
                        sx={{ minWidth: 40, fontWeight: 'bold' }}
                    />
                ))}
            </Stack>

            {/* Sequencer List */}
            <Typography variant="caption" color="text.secondary" mb={1} display="block">
                SECUENCIA (LOOP)
            </Typography>
            <Stack spacing={1} sx={{ mb: 3 }}>
                {sequence.map((step, idx) => (
                    <Box key={step.id} data-testid="harmony-step" data-active={idx === activeSequenceIdx} sx={{
                        p: 1, borderRadius: 1,
                        bgcolor: idx === activeSequenceIdx ? 'rgba(229, 169, 95, 0.15)' : 'background.paper',
                        border: idx === activeSequenceIdx ? '1px solid #e5a95f' : '1px solid transparent',
                        boxShadow: idx === activeSequenceIdx ? '0 0 10px rgba(229, 169, 95, 0.2)' : 'none',
                        transition: 'all 0.2s ease-in-out',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                            <Box sx={{
                                width: 24, height: 24, borderRadius: '50%',
                                bgcolor: 'secondary.main', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.8rem', fontWeight: 'bold'
                            }}>
                                {idx + 1}
                            </Box>
                            <Typography fontWeight="bold" variant="body1">{step.degree}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {step.notes.join(', ')}
                            </Typography>
                        </Stack>

                        <Stack direction="row" alignItems="center" spacing={1}>
                            <Select
                                size="small" variant="standard"
                                value={step.durationUnits}
                                onChange={(e) => {
                                    const units = Number(e.target.value);
                                    setSequence(prev => prev.map(c => c.id === step.id ? { ...c, durationUnits: units } : c));
                                }}
                                inputProps={{ 'aria-label': `Duración de ${step.degree}` }}
                                sx={{ width: 100 }}
                            >
                                <MenuItem value={1}>1/2 Compás</MenuItem>
                                <MenuItem value={2}>1 Compás</MenuItem>
                                <MenuItem value={4}>2 Compases</MenuItem>
                                <MenuItem value={8}>4 Compases</MenuItem>
                            </Select>

                            <Button
                                size="small" sx={{ minWidth: 30, p: 0.5, color: 'error.main' }}
                                onClick={() => removeChord(step.id)}
                                aria-label={`Quitar ${step.degree}`}
                            >
                                <Trash2 size={16} />
                            </Button>
                        </Stack>
                    </Box>
                ))}

                {sequence.length === 0 && (
                    <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic', textAlign: 'center', p: 2 }}>
                        No hay acordes. Agrega uno arriba.
                    </Typography>
                )}
            </Stack>

            <Box sx={{ mt: 'auto' }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="caption">Volumen</Typography>
                    <Slider
                        value={volume}
                        min={0} max={1} step={0.01}
                        onChange={handleVolume}
                        aria-label="Volumen de la armonía"
                        size="small"
                        sx={{ flex: 1 }}
                    />
                </Stack>
            </Box>

            <Button
                startIcon={<RotateCcw size={16} />}
                fullWidth variant="outlined"
                size="small" sx={{ mt: 2 }}
                onClick={() => setSequence([])}
            >
                Limpiar Secuencia
            </Button>
        </Box>
    );
}
