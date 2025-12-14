import {
    Box,
    Typography,
    Stack,
    FormControl,
    Select,
    MenuItem,
    InputLabel
} from '@mui/material';
import { QuarterNoteIcon, EighthNoteIcon, SixteenthNoteIcon, TripletIcon } from './MusicIcons';

import type { RhythmPattern, InstrumentType } from '../rhythms/RhythmPatterns';

interface PatternEditorProps {
    pattern: RhythmPattern;
    onPatternUpdate: (newPattern: RhythmPattern) => void;
    currentStepIndex?: number;
}

const INSTRUMENTS_DISPLAY: { type: InstrumentType; label: string }[] = [
    { type: 'bombo_parche', label: 'Bombo (Parche)' },
    { type: 'bombo_aro', label: 'Bombo (Aro)' },
    { type: 'kick', label: 'Batería: Kick' },
    { type: 'snare', label: 'Batería: Redolante' },
    { type: 'hihat_closed', label: 'Hi-Hat Cerrado' },
    { type: 'hihat_open', label: 'Hi-Hat Abierto' },
    { type: 'click', label: 'Click Metrónomo' },
];

const TIME_SIGNATURES = [
    { label: '4/4', beats: 4, accum: 4 },
    { label: '3/4', beats: 3, accum: 4 },
    { label: '6/8', beats: 2, accum: 8 },
    { label: '12/8', beats: 4, accum: 8 },
    { label: '2/4', beats: 2, accum: 4 },
    { label: '2/2', beats: 2, accum: 2 },
];

export default function PatternEditor({ pattern, onPatternUpdate, currentStepIndex = -1 }: PatternEditorProps) {

    const handleTimeSignatureChange = (val: string) => {
        const ts = TIME_SIGNATURES.find(t => t.label === val);
        if (!ts) return;

        let newSub = pattern.subdivision;
        // Basic smart default if switching "families"
        if (ts.accum === 8 && pattern.timeSignature[1] === 4) newSub = 6; // 4/4 -> 6/8 default to eighths (6)
        if (ts.accum === 4 && pattern.timeSignature[1] === 8) newSub = 16; // 6/8 -> 4/4 default to sixteenths

        onPatternUpdate({
            ...pattern,
            timeSignature: [ts.beats, ts.accum] as [number, number],
            subdivision: newSub,
            // Keep steps that fit in new subdivision. 
            // Ideally we shouldn't delete if we just change signature but keep subdivision same (e.g. 4/4 -> 3/4).
            // We just cut off the end.
            steps: pattern.steps.filter(s => s.step <= newSub)
        });
    };

    const handleSubdivisionChange = (newSub: number) => {
        const oldSub = pattern.subdivision;
        const ratio = newSub / oldSub;
        let newSteps: import('../rhythms/RhythmPatterns').RhythmStep[] = [];

        // Strategy 1: Perfect Expansion (Integer Multiplier)
        if (Number.isInteger(ratio) && ratio > 1) {
            newSteps = pattern.steps.map(s => ({
                ...s,
                step: Math.round((s.step - 1) * ratio + 1)
            }));
        }
        // Strategy 2: Perfect Reduction (Integer Divisor)
        else if (Number.isInteger(1 / ratio) && ratio < 1) {
            const invRatio = 1 / ratio;
            newSteps = [];
            pattern.steps.forEach(s => {
                if ((s.step - 1) % invRatio === 0) {
                    newSteps.push({
                        ...s,
                        step: ((s.step - 1) / invRatio) + 1
                    });
                }
            });
        }
        // Strategy 3: Complex / Irregular Mapping (Per-Beat Preserving)
        else {
            const beats = pattern.timeSignature ? pattern.timeSignature[0] : 4;
            const oldStepsPerBeat = oldSub / beats;
            const newStepsPerBeat = newSub / beats;

            // Explicit Shuffle Mapping for 8ths <-> Triplets
            const isBinaryToTernary = (oldStepsPerBeat === 2 && newStepsPerBeat === 3);
            const isTernaryToBinary = (oldStepsPerBeat === 3 && newStepsPerBeat === 2);

            newSteps = []; // Clear for full rebuild

            pattern.steps.forEach(s => {
                const idx = s.step - 1;
                const beatIdx = Math.floor(idx / oldStepsPerBeat);
                const localIdx = idx % oldStepsPerBeat;

                let newLocalIndex = 0;

                if (isBinaryToTernary) {
                    // 8ths -> Triplets: 0->0, 1->2 (Shuffle)
                    newLocalIndex = (localIdx === 0) ? 0 : 2;
                } else if (isTernaryToBinary) {
                    // Triplets -> 8ths: 0->0, 2->1 (Shuffle), 1->1 (Clash/Center)
                    if (localIdx === 0) newLocalIndex = 0;
                    else newLocalIndex = 1;
                } else {
                    // General Case: Proportional Mapping
                    const beatOffset = localIdx / oldStepsPerBeat;
                    newLocalIndex = Math.round(beatOffset * newStepsPerBeat);
                }

                // Clamp
                newLocalIndex = Math.min(newLocalIndex, newStepsPerBeat - 1);

                // Final Calc
                const newBeatStart = Math.floor(beatIdx * newStepsPerBeat);
                const newStep = newBeatStart + newLocalIndex + 1;

                if (newStep <= newSub && !newSteps.some(ns => ns.step === newStep && ns.instrument === s.instrument)) {
                    newSteps.push({ ...s, step: newStep });
                }
            });
        }

        onPatternUpdate({
            ...pattern,
            subdivision: newSub,
            steps: newSteps
        });
    };

    const gridCols = pattern.subdivision;
    let SubIcon = QuarterNoteIcon;
    if (pattern.subdivision === 4) { SubIcon = QuarterNoteIcon; }
    else if (pattern.subdivision === 8) { SubIcon = EighthNoteIcon; }
    else if (pattern.subdivision === 16) { SubIcon = SixteenthNoteIcon; }
    else if (pattern.subdivision === 6) { SubIcon = EighthNoteIcon; }
    else if (pattern.subdivision === 12) {
        if (pattern.timeSignature[0] === 3) { SubIcon = SixteenthNoteIcon; }
        else { SubIcon = TripletIcon; }
    }

    const cycleStep = (stepIndex: number, instrument: InstrumentType) => {
        const stepNum = stepIndex + 1;
        const currentStep = pattern.steps.find(s => s.step === stepNum && s.instrument === instrument);
        const currentRefVelocity = currentStep ? currentStep.velocity : 0;
        let newVelocity = 0;
        if (currentRefVelocity === 0) newVelocity = 0.7;        // Normal
        else if (currentRefVelocity > 0.6 && currentRefVelocity < 0.9) newVelocity = 1.0; // Accent
        else if (currentRefVelocity >= 0.9) newVelocity = 0.3; // Ghost
        else newVelocity = 0; // Off
        let newSteps = [...pattern.steps];
        newSteps = newSteps.filter(s => !(s.step === stepNum && s.instrument === instrument));
        if (newVelocity > 0) newSteps.push({ step: stepNum, instrument, velocity: newVelocity });
        onPatternUpdate({ ...pattern, steps: newSteps });
    };

    const clearInstrumentRow = (instrument: InstrumentType) => {
        const newSteps = pattern.steps.filter(s => s.instrument !== instrument);
        onPatternUpdate({ ...pattern, steps: newSteps });
    };

    const getCountingLabel = (index: number) => {
        const stepsPerBeat = pattern.subdivision / pattern.timeSignature[0];
        const beatNum = Math.floor(index / stepsPerBeat) + 1;
        const subIndex = index % stepsPerBeat;

        // Downbeat (Always Show Number)
        if (subIndex === 0) return `${beatNum}`;

        // 4/4 Subdivisions
        if (pattern.timeSignature[0] === 4 && pattern.timeSignature[1] === 4) {
            // 16ths: 1 e + a
            if (pattern.subdivision === 16) {
                if (subIndex === 1) return 'e';
                if (subIndex === 2) return '+';
                if (subIndex === 3) return 'a';
            }
            // 8ths: 1 +
            if (pattern.subdivision === 8) {
                return '+';
            }
            // Triplets: Use dots
            if (pattern.subdivision === 12) {
                return '•';
            }
        }
        // 6/8
        if (pattern.timeSignature[0] === 2 && pattern.timeSignature[1] === 8) {
            return '•';
        }
        return '•';
    };

    const getColor = (vel: number) => {
        if (vel === 0) return 'text.disabled';
        if (vel >= 0.9) return '#ff1744';
        if (vel <= 0.4) return 'rgba(144, 202, 249, 0.4)';
        return 'primary.main';
    };

    return (
        <Box sx={{ width: '100%', mt: 4, textAlign: 'left' }}>
            {/* Controls */}
            <Stack direction="row" spacing={3} sx={{ mb: 3 }} alignItems="center" justifyContent="center">
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Editor de Ritmos</Typography>

                <FormControl size="small" variant="outlined" sx={{ minWidth: 100 }}>
                    <InputLabel>Compás</InputLabel>
                    <Select
                        value={TIME_SIGNATURES.find(t => t.beats === pattern.timeSignature[0] && t.accum === pattern.timeSignature[1])?.label || ''}
                        label="Compás"
                        onChange={(e) => handleTimeSignatureChange(e.target.value)}
                    >
                        {TIME_SIGNATURES.map(ts => (
                            <MenuItem key={ts.label} value={ts.label}>{ts.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" variant="outlined" sx={{ minWidth: 150 }}>
                    <InputLabel id="sub-label">Subdivisión</InputLabel>
                    <Select
                        labelId="sub-label"
                        value={pattern.subdivision}
                        label="Subdivisión"
                        onChange={(e) => handleSubdivisionChange(Number(e.target.value))}
                    >
                        {(() => {
                            const [num, den] = pattern.timeSignature;
                            const opts = [];

                            if (den === 4) {
                                opts.push({ val: num, label: 'Negras' });
                                opts.push({ val: num * 2, label: 'Corcheas' });
                                opts.push({ val: num * 3, label: 'Tresillos' });
                                opts.push({ val: num * 4, label: 'Semicorcheas' });
                            } else if (den === 8) {
                                opts.push({ val: num, label: 'Corcheas (Natural)' });
                                opts.push({ val: num * 2, label: 'Semicorcheas' });
                            } else if (den === 2) {
                                opts.push({ val: num, label: 'Blancas' });
                                opts.push({ val: num * 2, label: 'Negras' });
                                opts.push({ val: num * 4, label: 'Corcheas' });
                            }

                            return opts.map(o => (
                                <MenuItem key={o.val} value={o.val}>{o.label}</MenuItem>
                            ));
                        })()}
                    </Select>
                </FormControl>
            </Stack>

            {/* Grid Container */}
            <Box sx={{
                p: 3, width: '100%', background: '#121212', borderRadius: 4,
                border: '1px solid #333', overflowX: 'auto', whiteSpace: 'nowrap'
            }}>
                <Box sx={{ minWidth: 700, display: 'inline-block', width: '100%' }}>
                    {/* Header */}
                    <Stack direction="row" spacing={1} sx={{ pl: 18, mb: 1 }}>
                        {Array.from({ length: gridCols }).map((_, idx) => {
                            let active = false;
                            const stepsPerBeat = pattern.subdivision / pattern.timeSignature[0];
                            if (idx % stepsPerBeat === 0) active = true;

                            const isCurrent = currentStepIndex === idx;

                            return (
                                <Box key={idx} sx={{ width: 32, textAlign: 'center', opacity: active ? 1 : 0.5 }}>
                                    <Typography variant="caption" sx={{
                                        color: isCurrent ? 'secondary.main' : (active ? 'white' : 'grey.600'),
                                        fontWeight: 'bold',
                                        fontSize: isCurrent ? '0.9rem' : '0.7rem',
                                        transition: 'all 0.1s'
                                    }}>
                                        {getCountingLabel(idx)}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Stack>

                    {/* Instruments */}
                    {INSTRUMENTS_DISPLAY.map((inst) => (
                        <Stack key={inst.type} direction="row" alignItems="center" spacing={1} sx={{
                            mb: 1, p: 1, borderRadius: 2,
                            '&:hover .clear-btn': { opacity: 1 },
                            '&:hover': { background: 'rgba(255,255,255,0.03)' }
                        }}>
                            <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1} sx={{ width: 140, mr: 2 }}>
                                <Typography className="clear-btn" variant="caption" onClick={() => clearInstrumentRow(inst.type)}
                                    sx={{ cursor: 'pointer', color: 'error.main', opacity: 0, transition: 'opacity 0.2s', fontSize: '0.7em', mr: 1 }}>
                                    LIMPIAR
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 'medium', textAlign: 'right' }}>
                                    {inst.label}
                                </Typography>
                            </Stack>

                            {/* Steps Grid */}
                            {Array.from({ length: gridCols }).map((_, idx) => {
                                const stepNum = idx + 1;
                                const currentStep = pattern.steps.find(s => s.step === stepNum && s.instrument === inst.type);
                                const vel = currentStep ? currentStep.velocity : 0;

                                const stepsPerBeat = pattern.subdivision / pattern.timeSignature[0];
                                const isBeat = idx % stepsPerBeat === 0;
                                const isCurrent = currentStepIndex === idx;

                                return (
                                    <Box key={idx} onClick={() => cycleStep(idx, inst.type)} sx={{
                                        width: 32, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                        background: isCurrent ? 'rgba(244, 143, 177, 0.15)' : (isBeat ? 'rgba(255,255,255,0.03)' : 'transparent'),
                                        border: isCurrent ? '1px solid rgba(244, 143, 177, 0.3)' : '1px solid transparent',
                                        borderRadius: 1, position: 'relative', transition: 'background 0.05s'
                                    }}>
                                        <SubIcon sx={{
                                            fontSize: vel >= 0.9 ? 32 : 24,
                                            color: getColor(vel),
                                            opacity: vel === 0 ? 0.05 : (vel <= 0.4 ? 0.6 : 1),
                                            filter: vel >= 0.9 ? 'drop-shadow(0 0 8px #ff1744)' : 'none',
                                            transform: vel >= 0.9 ? 'scale(1.15)' : 'scale(1)',
                                            transition: 'all 0.1s ease-in-out'
                                        }} />
                                        {vel > 0 && <Box sx={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: '50%', bgcolor: getColor(vel), opacity: 0.5 }} />}
                                    </Box>
                                );
                            })}
                        </Stack>
                    ))}
                </Box>
            </Box>
        </Box>
    );
}
