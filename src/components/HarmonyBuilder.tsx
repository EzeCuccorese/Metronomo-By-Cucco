import { useState, useEffect } from 'react';
import { Box, Typography, Select, MenuItem, Stack, Slider, FormControl, InputLabel, Button, Divider, Chip } from '@mui/material';
import { Music, Trash2, RotateCcw } from 'lucide-react';

interface HarmonyBuilderProps {
    onUpdateProgression: (progression: string[][]) => void;
    onVolumeChange: (vol: number) => void;
}

const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const OCTAVES = [3, 4, 5];

type ModeType = 'major' | 'minor' | 'dorian' | 'mixolydian';

const MODES: { id: ModeType; label: string }[] = [
    { id: 'major', label: 'Mayor (Natural)' },
    { id: 'minor', label: 'Menor (Natural)' },
    { id: 'dorian', label: 'Dórico (Jazzy)' },
    { id: 'mixolydian', label: 'Mixolidio (Bluesy)' }
];

interface ChordStep {
    id: string;
    degree: string; // I, ii, etc.
    duration: number; // Bars
    notes: string[];
}

export default function HarmonyBuilder({ onUpdateProgression, onVolumeChange }: HarmonyBuilderProps) {
    const [rootKey, setRootKey] = useState('C');
    const [mode, setMode] = useState<ModeType>('major');
    const [octave, setOctave] = useState(4);
    const [volume, setVolume] = useState(0.3);

    // Sequence
    const [sequence, setSequence] = useState<ChordStep[]>([]);

    // Audio Generation Logic inside Component (or helper)
    // We map Degrees to Intervals based on Mode

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
        // 0=I, 1=II...
        // Major: I(Maj), ii(min), iii(min), IV(Maj), V(Maj), vi(min), vii(dim)

        // Let's use standard Roman Numerals map for simplicity

        const map: Record<ModeType, string[]> = {
            'major': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
            'minor': ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
            'dorian': ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII'],
            'mixolydian': ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII']
        };

        return map[m][degreeIndex];
    };

    const availableDegrees = [0, 1, 2, 3, 4, 5, 6].map(i => ({
        index: i,
        label: getChordType(i, mode)
    }));

    const addChord = (degreeIndex: number) => {
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
            id: Math.random().toString(36).substr(2, 9),
            degree: getChordType(degreeIndex, mode),
            duration: 1,
            notes: notes
        };

        setSequence(prev => [...prev, newChord]);
    };

    const removeChord = (id: string) => {
        setSequence(prev => prev.filter(c => c.id !== id));
    };

    // Sync with Parent
    useEffect(() => {
        const progression: string[][] = [];

        sequence.forEach(step => {
            for (let i = 0; i < step.duration; i++) {
                progression.push(step.notes);
            }
        });

        onUpdateProgression(progression);

    }, [sequence, onUpdateProgression]);

    const handleVolume = (_: Event, val: number | number[]) => {
        const v = val as number;
        setVolume(v);
        onVolumeChange(v);
    };

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
            <Box sx={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px', gap: 1, mb: 2 }}>
                <FormControl size="small">
                    <InputLabel>Tono</InputLabel>
                    <Select value={rootKey} label="Tono" onChange={(e) => setRootKey(e.target.value)}>
                        {KEYS.map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}
                    </Select>
                </FormControl>

                <FormControl size="small">
                    <InputLabel>Modo</InputLabel>
                    <Select value={mode} label="Modo" onChange={(e) => setMode(e.target.value as ModeType)}>
                        {MODES.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
                    </Select>
                </FormControl>

                <FormControl size="small">
                    <InputLabel>Oct</InputLabel>
                    <Select value={octave} label="Oct" onChange={(e) => setOctave(Number(e.target.value))}>
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
                    <Box key={step.id} sx={{
                        p: 1, borderRadius: 1,
                        bgcolor: 'background.paper',
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
                                value={step.duration}
                                onChange={(e) => {
                                    const newSeq = [...sequence];
                                    newSeq[idx].duration = Number(e.target.value);
                                    setSequence(newSeq);
                                }}
                                sx={{ width: 60 }}
                            >
                                <MenuItem value={1}>1 Bar</MenuItem>
                                <MenuItem value={2}>2 Bars</MenuItem>
                                <MenuItem value={4}>4 Bars</MenuItem>
                            </Select>

                            <Button
                                size="small" sx={{ minWidth: 30, p: 0.5, color: 'error.main' }}
                                onClick={() => removeChord(step.id)}
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
