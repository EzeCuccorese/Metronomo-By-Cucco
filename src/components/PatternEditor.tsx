import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Stack,
    Select,
    MenuItem,
    ToggleButton,
    ToggleButtonGroup,
    IconButton,
    Tooltip,
    Divider
} from '@mui/material';
import { Eraser, Pen, Circle, Trash2 } from 'lucide-react';

import { InstrumentIcons } from '../rhythms/RhythmPatterns';
import type { RhythmPattern, InstrumentType, RhythmStep } from '../rhythms/RhythmPatterns';

interface PatternEditorProps {
    pattern: RhythmPattern;
    onPatternUpdate: (newPattern: RhythmPattern) => void;
    currentStepIndex?: number;
    onPreviewInstrument?: (instrument: string) => void;
}

const INSTRUMENTS_DISPLAY: { type: InstrumentType; label: string; group: string }[] = [
    { type: 'bombo_leguero', label: 'Bombo', group: 'bombo' },
    { type: 'surdo', label: 'Surdo', group: 'latino' },
    { type: 'rim', label: 'Aro', group: 'latino' },
    { type: 'clave', label: 'Clave', group: 'latino' },
    { type: 'shaker', label: 'Shaker', group: 'latino' },
    { type: 'kick', label: 'Kick', group: 'drums' },
    { type: 'snare', label: 'Snare', group: 'drums' },
    { type: 'hihat', label: 'Hi-Hat', group: 'drums' },
    { type: 'hihat_foot', label: 'HH Foot', group: 'drums' },
    { type: 'ride', label: 'Ride', group: 'drums' },
    { type: 'crash', label: 'Crash', group: 'drums' },
    { type: 'tom_high', label: 'Tom 1', group: 'drums' },
    { type: 'tom_low', label: 'Tom 2', group: 'drums' },
    { type: 'tom_floor', label: 'Floor', group: 'drums' },
    { type: 'click', label: 'Click', group: 'metronome' },
];

const TIME_SIGNATURES = [
    { label: '4/4', beats: 4, accum: 4 },
    { label: '3/4', beats: 3, accum: 4 },
    { label: '6/8', beats: 2, accum: 8 },
    { label: '12/8', beats: 4, accum: 8 },
];

const SUBDIVISION_OPTIONS = [
    { value: 2, label: 'Corchea (1/2)', icon: '♪' },
    { value: 3, label: 'Tresillo (1/3)', icon: '♪₃' },
    { value: 4, label: 'Semicorchea (1/4)', icon: '𝅘𝅥𝅯' },
    { value: 6, label: 'Sextillo (1/6)', icon: '𝅘𝅥𝅯₆' },
];

// Tools for "Painting" steps
type ToolType = 'ghost' | 'piano' | 'pen' | 'forte' | 'accent' | 'eraser';

export default function PatternEditor({ pattern, onPatternUpdate, currentStepIndex = 0, onPreviewInstrument }: PatternEditorProps) {

    // UI State
    const [viewSubdivision, setViewSubdivision] = useState(pattern.subdivision);
    const [activeFilter, setActiveFilter] = useState('all');
    const [selectedIntensity, setSelectedIntensity] = useState<ToolType>('pen');
    const [selectedModifier, setSelectedModifier] = useState<'open' | 'closed'>('closed');
    const [isMouseDown, setIsMouseDown] = useState(false);

    // Sync subdivision if pattern changes externally
    useEffect(() => {
        if (viewSubdivision > pattern.subdivision || (pattern.subdivision % viewSubdivision !== 0)) {
            setViewSubdivision(pattern.subdivision);
        }
    }, [pattern.subdivision]);

    const handleFilterChange = (_: React.MouseEvent<HTMLElement>, newFilter: string) => {
        if (newFilter) setActiveFilter(newFilter);
    };

    const clearPattern = () => {
        if (window.confirm('¿Borrar todo el patrón actual?')) {
            onPatternUpdate({ ...pattern, steps: [] });
        }
    };

    const handleTimeSignatureChange = (val: string) => {
        const ts = TIME_SIGNATURES.find(t => t.label === val);
        if (!ts) return;

        let newSub = pattern.subdivision;
        const oldBeats = pattern.timeSignature[0];
        const newBeats = ts.beats;

        // Maintain subdivision ratio per beat if possible
        const subPerBeat = pattern.subdivision / oldBeats;
        newSub = newBeats * subPerBeat;

        // SPECIAL HEMIOLA RULE: Preserve 12 steps when switching between 6/8 (beats: 2) and 3/4 (beats: 3)
        if ((oldBeats === 2 && newBeats === 3) || (oldBeats === 3 && newBeats === 2)) {
            if (pattern.subdivision % 6 === 0) {
                newSub = pattern.subdivision;
            }
        }

        onPatternUpdate({
            ...pattern,
            timeSignature: [ts.beats, ts.accum] as [number, number],
            subdivision: newSub,
            // Keep all steps for "memory"
        });
        setViewSubdivision(newSub);
    };

    const handleSubdivisionChange = (newSub: number) => {
        // Rhythmic Mapping logic for Binary <-> Ternary
        const oldSub = pattern.subdivision;
        const beats = pattern.timeSignature[0];
        const oldStepsPerBeat = oldSub / beats;
        const newStepsPerBeat = newSub / beats;

        const mappedSteps = pattern.steps.map(step => {
            const beatIdx = Math.floor((step.step - 1) / oldStepsPerBeat);
            const stepInBeat = (step.step - 1) % oldStepsPerBeat;
            const posInBeat = stepInBeat / oldStepsPerBeat;

            let newStepInBeat = Math.round(posInBeat * newStepsPerBeat);

            // SPECIAL MAPPING RULE: 
            // Binary 2nd 8th (pos 0.5) -> Ternary 3rd triplet (pos 0.66)
            if (oldStepsPerBeat === 4 && newStepsPerBeat === 3) {
                if (stepInBeat === 2) newStepInBeat = 2; // pos 2/3 = 0.66
            }
            // Ternary 3rd triplet (pos 0.66) -> Binary 2nd 8th (pos 0.5)
            if (oldStepsPerBeat === 3 && newStepsPerBeat === 4) {
                if (stepInBeat === 2) newStepInBeat = 2; // pos 2/4 = 0.5
            }

            return { ...step, step: (beatIdx * newStepsPerBeat) + newStepInBeat + 1 };
        });

        onPatternUpdate({ ...pattern, subdivision: newSub, steps: mappedSteps });
        setViewSubdivision(newSub);
    };

    const handleSubdivisionSelection = (stepsPerBeat: number) => {
        const b = pattern.timeSignature[0];
        handleSubdivisionChange(b * stepsPerBeat);
    };

    const currentStepsPerBeat = pattern.subdivision / pattern.timeSignature[0];

    const gridCols = viewSubdivision;
    const stepsPerViewStep = pattern.subdivision / viewSubdivision;
    const beats = pattern.timeSignature[0];
    const notesPerBeat = gridCols / beats;

    const getStepAtViewCol = (colIdx: number, instrument: InstrumentType) => {
        const stepNum = Math.round(colIdx * stepsPerViewStep) + 1;
        // Memory: only return if it's within current subdivision bounds
        return pattern.steps.find(s => s.step === stepNum && s.instrument === instrument && s.step <= pattern.subdivision);
    };

    // Main Interaction Logic
    const handleCellInteraction = (viewColIndex: number, instrument: InstrumentType, forceErase = false) => {
        const stepNum = Math.round(viewColIndex * stepsPerViewStep) + 1;
        let newSteps = [...pattern.steps];
        const existingStep = newSteps.find(s => s.step === stepNum && s.instrument === instrument);

        if (selectedIntensity === 'eraser' || forceErase) {
            if (!existingStep) return;
            onPatternUpdate({ ...pattern, steps: newSteps.filter(s => !(s.step === stepNum && s.instrument === instrument)) });
            return;
        }

        // Intensity mapping
        const velocities: Record<string, number> = { ghost: 0.2, piano: 0.4, pen: 0.7, forte: 0.9, accent: 1.0 };
        const velocity = velocities[selectedIntensity] || 0.7;

        // Modifier logic
        let modifier: RhythmStep['modifier'] = undefined;
        if (instrument === 'hihat') modifier = selectedModifier === 'open' ? 'open' : 'closed';
        if (instrument === 'snare') modifier = selectedModifier === 'open' ? 'snares_off' : undefined;
        if (instrument === 'bombo_leguero') modifier = selectedModifier === 'open' ? 'aro' : 'parche';

        const newStep: RhythmStep = { step: stepNum, instrument, velocity, modifier };

        const filtered = newSteps.filter(s => !(s.step === stepNum && s.instrument === instrument));
        filtered.push(newStep);
        onPatternUpdate({ ...pattern, steps: filtered });

        if (onPreviewInstrument && !isMouseDown) onPreviewInstrument(instrument);
    };

    const noteChar = getNoteSymbol(viewSubdivision);

    const visibleInstruments = activeFilter === 'all'
        ? INSTRUMENTS_DISPLAY
        : INSTRUMENTS_DISPLAY.filter(i => {
            if (activeFilter === 'latino') return i.group === 'latino' || i.group === 'bombo';
            return i.group === activeFilter;
        });

    return (
        <Box
            sx={{ width: '100%', mt: 2 }}
            onMouseDown={() => setIsMouseDown(true)}
            onMouseUp={() => setIsMouseDown(false)}
            onMouseLeave={() => setIsMouseDown(false)}
        >

            {/* Toolbar Row 1: Filters & TimeSig */}
            <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                <Stack direction="row" spacing={2}>
                    <ToggleButtonGroup value={activeFilter} exclusive onChange={handleFilterChange} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                        <ToggleButton value="all">Todos</ToggleButton>
                        <ToggleButton value="drums">Batería</ToggleButton>
                        <ToggleButton value="latino">Latino</ToggleButton>
                    </ToggleButtonGroup>

                    <Divider orientation="vertical" flexItem />

                    {/* Intensities Section */}
                    <ToggleButtonGroup
                        value={selectedIntensity}
                        exclusive
                        onChange={(_, v) => v && setSelectedIntensity(v)}
                        size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .Mui-selected': { bgcolor: 'primary.main !important', color: 'white !important' } }}
                    >
                        <ToggleButton value="ghost" title="Ghost (pp)"><Typography variant="caption" sx={{ fontSize: '0.6rem' }}>pp</Typography></ToggleButton>
                        <ToggleButton value="piano" title="Piano (p)"><Typography variant="caption">p</Typography></ToggleButton>
                        <ToggleButton value="pen" title="Normal (m)"><Pen size={14} /></ToggleButton>
                        <ToggleButton value="forte" title="Forte (f)"><Typography variant="button">f</Typography></ToggleButton>
                        <ToggleButton value="accent" title="Accent (ff)"><Typography variant="button" fontWeight="bold">ff</Typography></ToggleButton>
                        <ToggleButton value="eraser" title="Goma / Borrar"><Eraser size={14} /></ToggleButton>
                    </ToggleButtonGroup>

                    <Divider orientation="vertical" flexItem />

                    {/* Modifiers Section (Open/Closed selection) */}
                    <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, p: 0.2, display: 'flex' }}>
                        <ToggleButtonGroup
                            value={selectedModifier}
                            exclusive
                            onChange={(_, v) => v && setSelectedModifier(v)}
                            size="small"
                            sx={{ '& .Mui-selected': { bgcolor: 'secondary.main !important', color: 'white !important' } }}
                        >
                            <Tooltip title="Cerrado / Parche / Bordonas ON">
                                <ToggleButton value="closed"><Circle size={8} fill="currentColor" /></ToggleButton>
                            </Tooltip>
                            <Tooltip title="Abierto / Aro / Bordonas OFF">
                                <ToggleButton value="open"><Circle size={12} strokeWidth={3} /></ToggleButton>
                            </Tooltip>
                        </ToggleButtonGroup>
                    </Box>
                </Stack>

                <Stack direction="row" spacing={1}>
                    <Select
                        size="small"
                        value={currentStepsPerBeat}
                        onChange={(e) => handleSubdivisionSelection(Number(e.target.value))}
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', minWidth: 100 }}
                        renderValue={(val) => {
                            const opt = SUBDIVISION_OPTIONS.find(o => o.value === val);
                            return opt ? `${opt.icon} ${opt.label.split(' ')[0]}` : val;
                        }}
                    >
                        {SUBDIVISION_OPTIONS.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontSize: '1.2rem', minWidth: 24 }}>{opt.icon}</Typography>
                                    <Typography variant="body2">{opt.label}</Typography>
                                </Stack>
                            </MenuItem>
                        ))}
                    </Select>

                    <Select size="small" value={TIME_SIGNATURES.find(ts => ts.beats === pattern.timeSignature[0] && ts.accum === pattern.timeSignature[1])?.label || '4/4'}
                        onChange={(e) => handleTimeSignatureChange(e.target.value)} sx={{ width: 80, bgcolor: 'rgba(255,255,255,0.05)' }}>
                        {TIME_SIGNATURES.map(ts => <MenuItem key={ts.label} value={ts.label}>{ts.label}</MenuItem>)}
                    </Select>

                    <IconButton size="small" color="error" onClick={clearPattern} sx={{ ml: 1, opacity: 0.6 }}><Trash2 size={18} /></IconButton>
                </Stack>
            </Stack>

            {/* Grid */}
            <Box sx={{ overflowX: 'auto', pb: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: `140px repeat(${gridCols}, 1fr)`, gap: '1px', minWidth: 600 }}>

                    {/* Beats Header */}
                    <Box sx={{ p: 1 }}><Typography variant="caption" color="text.secondary">TIEMPO</Typography></Box>
                    {Array.from({ length: gridCols }).map((_, idx) => {
                        const isBeatStart = (idx % notesPerBeat) === 0;
                        const beatNum = Math.floor(idx / notesPerBeat) + 1;
                        return (
                            <Box key={idx} sx={{
                                display: 'flex', justifyContent: 'center', alignItems: 'flex-end', pb: 0.5,
                                bgcolor: isBeatStart ? 'rgba(255,255,255,0.05)' : 'transparent',
                                borderBottom: '1px solid #444'
                            }}>
                                {isBeatStart ? <Typography variant="caption" fontWeight="bold" color="text.primary">{beatNum}</Typography> : <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>•</Typography>}
                            </Box>
                        );
                    })}

                    {visibleInstruments.map((inst) => {
                        const Icon = InstrumentIcons[inst.type];

                        return (
                            <React.Fragment key={inst.type}>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.02)', borderRight: '1px solid #333' }}>
                                    {Icon && <Icon size={16} strokeWidth={1.5} color="#888" />}
                                    <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem', color: '#ccc' }}>{inst.label}</Typography>
                                </Stack>

                                {Array.from({ length: gridCols }).map((_, idx) => {
                                    const currentStep = getStepAtViewCol(idx, inst.type);
                                    const isCurrent = currentStepIndex !== undefined && Math.floor(currentStepIndex / stepsPerViewStep) === idx;
                                    const hasNote = !!currentStep;
                                    const isBeatStart = (idx % notesPerBeat) === 0;

                                    let noteVisual: React.ReactNode = hasNote ? noteChar : null;
                                    if (hasNote) {
                                        if (inst.type === 'hihat') noteVisual = currentStep?.modifier === 'open' ? <Circle size={10} strokeWidth={3} /> : noteChar;
                                        else if (inst.type === 'hihat_foot') noteVisual = <Typography variant="caption" sx={{ fontSize: '1.2rem', lineHeight: 1 }}>△</Typography>;
                                        else if (inst.type === 'snare') noteVisual = currentStep?.modifier === 'snares_off' ? <Typography variant="caption" sx={{ fontSize: '0.7rem', border: '1px solid', px: 0.3, borderRadius: '2px' }}>T</Typography> : noteChar;
                                        else if (inst.type === 'bombo_leguero' || inst.type === 'rim') noteVisual = (currentStep?.modifier === 'aro' || inst.type === 'rim') ? '×' : noteChar;
                                    }

                                    const getIntensityColor = (v: number) => {
                                        if (v > 0.95) return 'error.main';
                                        if (v > 0.85) return 'secondary.main';
                                        if (v > 0.6) return 'primary.main';
                                        if (v > 0.3) return 'primary.light';
                                        return 'text.disabled';
                                    };

                                    return (
                                        <Box
                                            key={idx}
                                            onMouseDown={(e) => { e.preventDefault(); handleCellInteraction(idx, inst.type); }}
                                            onMouseEnter={() => isMouseDown && handleCellInteraction(idx, inst.type, selectedIntensity === 'eraser')}
                                            sx={{
                                                height: 40,
                                                bgcolor: isBeatStart ? 'rgba(255,255,255,0.015)' : 'transparent',
                                                borderRight: isBeatStart ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.03)',
                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                border: isCurrent ? '1px solid #f48fb1' : undefined,
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.2rem',
                                                color: hasNote ? getIntensityColor(currentStep?.velocity || 0.7) : 'transparent',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                                                userSelect: 'none'
                                            }}
                                        >
                                            {hasNote && <Box sx={{ filter: (inst.type === 'hihat' && currentStep?.modifier === 'open') ? 'drop-shadow(0 0 4px rgba(244, 143, 177, 0.5))' : 'none', transform: currentStep?.velocity! < 0.6 ? 'scale(0.8)' : 'scale(1)' }}>{noteVisual}</Box>}
                                        </Box>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}

const getNoteSymbol = (subdivision: number) => {
    if (subdivision <= 4) return '♩';
    if (subdivision <= 12) return '♪';
    return '𝅘𝅥𝅯';
};
