import { useState, useEffect } from 'react';
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

    // UI State: What grid size are we looking at?
    // Initialize with pattern's subdivision, but allow it to diverge for "Zoom Out" (Reduction).
    const [viewSubdivision, setViewSubdivision] = useState(pattern.subdivision);

    // Sync view if pattern updates externally (e.g. preset load), but ONLY if the families match or strictly required.
    // Actually, just syncing on mount or major change is safer.
    useEffect(() => {
        // If the pattern's subdivision changes to something incompatible with current view, snap view to it.
        // e.g. View is 4, Pattern changes to 12. View 4 is compatible (12/3=4).
        // e.g. View is 16, Pattern changes to 12. Incompatible.
        if (pattern.subdivision % viewSubdivision !== 0 && viewSubdivision % pattern.subdivision !== 0) {
            setViewSubdivision(pattern.subdivision);
        }
        // Also if pattern resolution expands beyond view? 
        // Let's just trust the user's view unless it's impossible.
    }, [pattern.subdivision]);

    const handleTimeSignatureChange = (val: string) => {
        const ts = TIME_SIGNATURES.find(t => t.label === val);
        if (!ts) return;

        let newSub = pattern.subdivision;
        if (ts.accum === 8 && pattern.timeSignature[1] === 4) newSub = 6;
        if (ts.accum === 4 && pattern.timeSignature[1] === 8) newSub = 16;

        onPatternUpdate({
            ...pattern,
            timeSignature: [ts.beats, ts.accum] as [number, number],
            subdivision: newSub,
            steps: pattern.steps.filter(s => s.step <= newSub)
        });
        setViewSubdivision(newSub); // Reset view on TS change
    };

    const handleSubdivisionChange = (newSub: number) => {
        const currentDataSub = pattern.subdivision;

        // Case 1: Pure View Reduction (Zoom Out)
        // e.g. Data is 16, User wants 4. 16 is divisible by 4.
        // We DO NOT change data. We just change View.
        if (currentDataSub > newSub && currentDataSub % newSub === 0) {
            setViewSubdivision(newSub);
            return;
        }

        // Case 2: Expansion or Complex Change (Data Transformation Required)
        // e.g. Data 4 -> 16 (Expansion)
        // e.g. Data 16 -> 12 (Complex)
        // e.g. Data 4 -> 12 (Expansion + Change)

        // We perform the transformation logic primarily on the DATA.
        const oldSub = currentDataSub;
        const ratio = newSub / oldSub;
        let newSteps: import('../rhythms/RhythmPatterns').RhythmStep[] = [];

        // Strategy 1: Perfect Expansion (Integer Multiplier)
        if (Number.isInteger(ratio) && ratio > 1) {
            newSteps = pattern.steps.map(s => ({
                ...s,
                step: Math.round((s.step - 1) * ratio + 1)
            }));
        }
        // Strategy 2: Strategy 2 (Reduction) is skipped here because we handled it in Case 1!
        // Wait, what if User WANTS to destructively reduce? 
        // For now, we assume "Subdivision" dropdown is View-Priority based on user feedback.
        // If they select 16 -> 12, that is Case 3.

        // Strategy 3: Complex / Irregular Mapping
        else {
            const beats = pattern.timeSignature ? pattern.timeSignature[0] : 4;
            const oldStepsPerBeat = oldSub / beats;
            const newStepsPerBeat = newSub / beats;

            const isBinaryToTernary = (oldStepsPerBeat === 2 && newStepsPerBeat === 3); // 8ths -> Trips
            const isTernaryToBinary = (oldStepsPerBeat === 3 && newStepsPerBeat === 2); // Trips -> 8ths
            const isTripletsToSemis = (oldStepsPerBeat === 3 && newStepsPerBeat === 4); // Trips -> 16ths

            newSteps = [];

            pattern.steps.forEach(s => {
                const idx = s.step - 1;
                const beatIdx = Math.floor(idx / oldStepsPerBeat);
                const localIdx = idx % oldStepsPerBeat;

                let newLocalIndex = 0;

                if (isBinaryToTernary) {
                    newLocalIndex = (localIdx === 0) ? 0 : 2; // Shuffle
                } else if (isTernaryToBinary) {
                    if (localIdx === 0) newLocalIndex = 0;
                    else newLocalIndex = 1;
                } else if (isTripletsToSemis) {
                    // Triplets (0,1,2) -> Semis (0,1,2,3)
                    // Map 3rd triplet (index 2) to 3rd semi (index 2, the '+')
                    // instead of rounding to index 3 (the 'a').
                    if (localIdx === 0) newLocalIndex = 0;      // 1 -> 1
                    else if (localIdx === 1) newLocalIndex = 1; // 2 -> e
                    else if (localIdx === 2) newLocalIndex = 2; // 3 -> + (Fix)
                } else {
                    const beatOffset = localIdx / oldStepsPerBeat;
                    newLocalIndex = Math.round(beatOffset * newStepsPerBeat);
                }

                newLocalIndex = Math.min(newLocalIndex, newStepsPerBeat - 1);

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
        setViewSubdivision(newSub);
    };

    // Rendering Logic
    const gridCols = viewSubdivision;
    const stepsPerViewStep = pattern.subdivision / viewSubdivision;

    // Map ViewCol -> DataStep
    // If Data=16, View=4. Ratio=4.
    // View Col 0 -> Step 1 (0*4 + 1)
    // View Col 1 -> Step 5 (1*4 + 1)
    const getStepAtViewCol = (colIdx: number, instrument: InstrumentType) => {
        const stepNum = Math.round(colIdx * stepsPerViewStep) + 1;
        return pattern.steps.find(s => s.step === stepNum && s.instrument === instrument);
    };

    const cycleStep = (viewColIndex: number, instrument: InstrumentType) => {
        const stepNum = Math.round(viewColIndex * stepsPerViewStep) + 1;

        const currentStep = pattern.steps.find(s => s.step === stepNum && s.instrument === instrument);
        const currentRefVelocity = currentStep ? currentStep.velocity : 0;

        let newVelocity = 0;
        if (currentRefVelocity === 0) newVelocity = 0.7;
        else if (currentRefVelocity > 0.6 && currentRefVelocity < 0.9) newVelocity = 1.0;
        else if (currentRefVelocity >= 0.9) newVelocity = 0.3;
        else newVelocity = 0;

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
        const stepsPerBeat = viewSubdivision / pattern.timeSignature[0];
        const beatNum = Math.floor(index / stepsPerBeat) + 1;
        const subIndex = index % stepsPerBeat;

        // Downbeat (Always Show Number)
        if (subIndex === 0) return `${beatNum}`;

        // 4/4 Subdivisions
        if (pattern.timeSignature[0] === 4 && pattern.timeSignature[1] === 4) {
            // 16ths: 1 e + a
            if (viewSubdivision === 16) {
                if (subIndex === 1) return 'e';
                if (subIndex === 2) return '+';
                if (subIndex === 3) return 'a';
            }
            // 8ths: 1 +
            if (viewSubdivision === 8) {
                return '+';
            }
            // Triplets: Use dots
            if (viewSubdivision === 12) {
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

    // Choose Icon based on View
    const getIconForView = () => {
        if (viewSubdivision % pattern.timeSignature[0] !== 0) return QuarterNoteIcon;
        const subPerBeat = viewSubdivision / pattern.timeSignature[0];

        if (subPerBeat === 1) return QuarterNoteIcon;
        if (subPerBeat === 2) return EighthNoteIcon;
        if (subPerBeat === 4) return SixteenthNoteIcon;
        if (subPerBeat === 3) return TripletIcon;
        return EighthNoteIcon;
    }
    const SubIcon = getIconForView();

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
                        value={viewSubdivision}
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
                            const stepsPerBeat = viewSubdivision / pattern.timeSignature[0];
                            if (idx % stepsPerBeat === 0) active = true;

                            // Calculate IsCurrent based on Data Position mapping
                            // CurrentStep is 0..DataSub.
                            // We need to match it to ViewCol.
                            // ViewCol * Ratio = DataStep.
                            // So DataStep / Ratio = ViewCol.
                            const stepsPerViewStep = pattern.subdivision / viewSubdivision;
                            const currentViewIndex = Math.floor(currentStepIndex / stepsPerViewStep);
                            const isCurrent = currentViewIndex === idx;

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
                                const currentStep = getStepAtViewCol(idx, inst.type);
                                const vel = currentStep ? currentStep.velocity : 0;

                                const stepsPerBeat = viewSubdivision / pattern.timeSignature[0];
                                const isBeat = idx % stepsPerBeat === 0;

                                const stepsPerViewStep = pattern.subdivision / viewSubdivision;
                                const currentViewIndex = Math.floor(currentStepIndex / stepsPerViewStep);
                                const isCurrent = currentViewIndex === idx;

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
