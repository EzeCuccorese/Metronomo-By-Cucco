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
    Tooltip
} from '@mui/material';
import { Volume2, VolumeX, Circle } from 'lucide-react';

import { InstrumentIcons } from '../rhythms/RhythmPatterns';
import type { RhythmPattern, InstrumentType, RhythmStep } from '../rhythms/RhythmPatterns';

interface PatternEditorProps {
    pattern: RhythmPattern;
    onPatternUpdate: (newPattern: RhythmPattern) => void;
    currentStepIndex?: number;
    onPreviewInstrument?: (instrument: string) => void;
}

const INSTRUMENTS_DISPLAY: { type: InstrumentType; label: string; group: string }[] = [
    { type: 'bombo_leguero', label: 'Bombo Legüero', group: 'bombo' },
    { type: 'surdo', label: 'Surdo', group: 'latino' },
    { type: 'rim', label: 'Aro (Rim)', group: 'latino' },
    { type: 'clave', label: 'Clave', group: 'latino' },
    { type: 'shaker', label: 'Shaker', group: 'latino' },
    { type: 'kick', label: 'Kick', group: 'drums' },
    { type: 'snare', label: 'Snare', group: 'drums' },
    { type: 'hihat', label: 'Hi-Hat', group: 'drums' },
    { type: 'ride', label: 'Ride Cymbal', group: 'drums' },
    { type: 'crash', label: 'Crash', group: 'drums' },
    { type: 'tom_high', label: 'Tom 1', group: 'drums' },
    { type: 'tom_low', label: 'Tom 2', group: 'drums' },
    { type: 'tom_floor', label: 'Tom Floor', group: 'drums' },
    { type: 'click', label: 'Click', group: 'metronome' },
];

const TIME_SIGNATURES = [
    { label: '4/4', beats: 4, accum: 4 },
    { label: '3/4', beats: 3, accum: 4 },
    { label: '6/8', beats: 2, accum: 8 },
    { label: '12/8', beats: 4, accum: 8 },
    { label: '2/4', beats: 2, accum: 4 },
    { label: '2/2', beats: 2, accum: 2 },
];

export default function PatternEditor({ pattern, onPatternUpdate, currentStepIndex = 0, onPreviewInstrument }: PatternEditorProps) {

    // UI State
    const [viewSubdivision, setViewSubdivision] = useState(pattern.subdivision);
    const [activeFilter, setActiveFilter] = useState('all');

    useEffect(() => {
        if (viewSubdivision > pattern.subdivision || (pattern.subdivision % viewSubdivision !== 0)) {
            setViewSubdivision(pattern.subdivision);
        }
    }, [pattern.subdivision]);

    const handleFilterChange = (_: React.MouseEvent<HTMLElement>, newFilter: string) => {
        if (newFilter) setActiveFilter(newFilter);
    };

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
        setViewSubdivision(newSub);
    };

    const handleSubdivisionChange = (newSub: number) => {
        // Logic kept simple for brevity: Reset view if invalid, otherwise just map new sub
        onPatternUpdate({ ...pattern, subdivision: newSub });
        setViewSubdivision(newSub);
    };

    const gridCols = viewSubdivision;
    const stepsPerViewStep = pattern.subdivision / viewSubdivision;

    const getStepAtViewCol = (colIdx: number, instrument: InstrumentType) => {
        const stepNum = Math.round(colIdx * stepsPerViewStep) + 1;
        return pattern.steps.find(s => s.step === stepNum && s.instrument === instrument);
    };

    const cycleStep = (viewColIndex: number, instrument: InstrumentType) => {
        const stepNum = Math.round(viewColIndex * stepsPerViewStep) + 1;

        const currentStep = pattern.steps.find(s => s.step === stepNum && s.instrument === instrument);
        // Default Velocity / State Cycle
        // 0 -> 0.7 -> 1.0 -> 0.3 -> 0

        let newVelocity = 0;
        let newModifier: RhythmStep['modifier'] = undefined;

        if (!currentStep) {
            // New Step
            newVelocity = 0.8;
            if (instrument === 'hihat') newModifier = 'closed';
            if (instrument === 'bombo_leguero') newModifier = 'parche';
        } else {
            // Existing Step: Cycle Modifier or Velocity
            if (instrument === 'hihat') {
                if (currentStep.modifier === 'closed') newModifier = 'open'; // Closed -> Open
                else if (currentStep.modifier === 'open') { newVelocity = 0; } // Open -> Off
                else { newModifier = 'closed'; } // Fallback

                if (newModifier) newVelocity = currentStep.velocity; // Keep vel
            }
            else if (instrument === 'bombo_leguero') {
                if (currentStep.modifier === 'parche') newModifier = 'aro';
                else if (currentStep.modifier === 'aro') { newVelocity = 0; }
                else newModifier = 'parche';

                if (newModifier) newVelocity = currentStep.velocity;
            }
            else {
                // Standard Velocity Cycle
                const v = currentStep.velocity;
                if (v >= 0.7 && v < 0.9) newVelocity = 1.0;
                else if (v >= 0.9) newVelocity = 0.4; // Ghost
                else if (v > 0) newVelocity = 0; // Off
            }
        }

        let newSteps = [...pattern.steps];
        newSteps = newSteps.filter(s => !(s.step === stepNum && s.instrument === instrument));

        if (newVelocity > 0) {
            const newStep: RhythmStep = {
                step: stepNum,
                instrument,
                velocity: newVelocity,
                modifier: newModifier
            };
            newSteps.push(newStep);

            if (onPreviewInstrument) {
                onPreviewInstrument(instrument);
            }
        }

        onPatternUpdate({ ...pattern, steps: newSteps });
    };

    // Toggle Snares for the whole pattern
    const toggleSnares = () => {
        const hasSnaresOff = pattern.steps.some(s => s.instrument === 'snare' && s.modifier === 'snares_off');
        const newModifier: RhythmStep['modifier'] = hasSnaresOff ? undefined : 'snares_off'; // Toggle

        const newSteps = pattern.steps.map(s => {
            if (s.instrument === 'snare') return { ...s, modifier: newModifier };
            return s;
        });

        onPatternUpdate({ ...pattern, steps: newSteps });
    };

    const visibleInstruments = activeFilter === 'all'
        ? INSTRUMENTS_DISPLAY
        : INSTRUMENTS_DISPLAY.filter(i => {
            if (activeFilter === 'latino') return i.group === 'latino' || i.group === 'bombo';
            return i.group === activeFilter;
        });

    return (
        <Box sx={{ width: '100%', mt: 2 }}>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" justifyContent="flex-start" flexWrap="wrap">
                <ToggleButtonGroup
                    value={activeFilter}
                    exclusive
                    onChange={handleFilterChange}
                    size="small"
                    sx={{
                        bgcolor: 'rgba(255,255,255,0.05)',
                        '& .MuiToggleButton-root': { color: '#888', borderColor: '#444' },
                        '& .Mui-selected': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                    }}
                >
                    <ToggleButton value="all">Todos</ToggleButton>
                    <ToggleButton value="drums">Batería</ToggleButton>
                    <ToggleButton value="latino">Latino</ToggleButton>
                    <ToggleButton value="metronome">Click</ToggleButton>
                </ToggleButtonGroup>

                <Stack direction="row" spacing={1}>
                    <Select size="small" value={TIME_SIGNATURES.find(ts => ts.beats === pattern.timeSignature[0] && ts.accum === pattern.timeSignature[1])?.label || '4/4'}
                        onChange={(e) => handleTimeSignatureChange(e.target.value)} sx={{ width: 80, bgcolor: 'rgba(255,255,255,0.05)' }}>
                        {TIME_SIGNATURES.map(ts => <MenuItem key={ts.label} value={ts.label}>{ts.label}</MenuItem>)}
                    </Select>

                    <Select size="small" value={viewSubdivision} onChange={(e) => handleSubdivisionChange(Number(e.target.value))} sx={{ width: 120, bgcolor: 'rgba(255,255,255,0.05)' }}>
                        <MenuItem value={pattern.subdivision}>Actual: {pattern.subdivision}</MenuItem>
                        <MenuItem value={4}>4 (Negras)</MenuItem>
                        <MenuItem value={8}>8 (Corcheas)</MenuItem>
                        <MenuItem value={12}>12 (Tresillos)</MenuItem>
                        <MenuItem value={16}>16 (Semi)</MenuItem>
                    </Select>
                </Stack>
            </Stack>

            <Box sx={{ overflowX: 'auto', pb: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: `180px repeat(${gridCols}, 1fr)`, gap: '2px', minWidth: 600 }}>

                    <Box sx={{ p: 1 }}><Typography variant="caption" color="text.secondary">INSTRUMENTO</Typography></Box>
                    {Array.from({ length: gridCols }).map((_, idx) => (
                        <Box key={idx} sx={{
                            display: 'flex', justifyContent: 'center', alignItems: 'center',
                            bgcolor: Math.floor(idx / stepsPerViewStep) % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                            borderBottom: '1px solid #333'
                        }}>
                            <Typography variant="caption" color="text.secondary">{idx + 1}</Typography>
                        </Box>
                    ))}

                    {visibleInstruments.map((inst) => {
                        const Icon = InstrumentIcons[inst.type];
                        // Check if snares are currently OFF in pattern data (heuristic)
                        const snaresOff = inst.type === 'snare' && pattern.steps.some(s => s.instrument === 'snare' && s.modifier === 'snares_off');

                        return (
                            <React.Fragment key={inst.type}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.03)', borderRight: '1px solid #333', pr: 2 }}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {Icon && <Icon size={18} strokeWidth={1.5} color="#aaa" />}
                                        <Typography variant="body2" noWrap sx={{ fontSize: '0.85rem' }}>{inst.label}</Typography>
                                    </Stack>

                                    {inst.type === 'snare' && (
                                        <Tooltip title={snaresOff ? "Bordonas OFF" : "Bordonas ON"}>
                                            <IconButton size="small" onClick={toggleSnares} sx={{ p: 0.5 }}>
                                                {snaresOff ? <VolumeX size={14} color="#f48fb1" /> : <Volume2 size={14} color="#66bb6a" />}
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Stack>

                                {Array.from({ length: gridCols }).map((_, idx) => {
                                    const currentStep = getStepAtViewCol(idx, inst.type);
                                    const currentViewIndex = currentStepIndex !== undefined
                                        ? Math.floor(currentStepIndex / stepsPerViewStep)
                                        : -1;

                                    const isCurrent = currentViewIndex === idx;
                                    const velocity = currentStep ? currentStep.velocity : 0;

                                    // Visual cues for modifiers
                                    let cellContent = null;
                                    if (inst.type === 'hihat' && currentStep?.modifier === 'open') {
                                        cellContent = <Circle size={8} strokeWidth={3} />; // Hollow circle for Open
                                    } else if (inst.type === 'bombo_leguero' && currentStep?.modifier === 'aro') {
                                        cellContent = <Circle size={6} />; // Small dot for Aro
                                    }

                                    return (
                                        <Box
                                            key={idx}
                                            onClick={() => cycleStep(idx, inst.type)}
                                            sx={{
                                                height: 38,
                                                bgcolor: velocity > 0
                                                    ? (velocity > 0.9 ? 'secondary.main' : 'rgba(244, 143, 177, 0.5)')
                                                    : 'rgba(255,255,255,0.02)',
                                                opacity: velocity > 0 ? 1 : 1,
                                                border: isCurrent ? '2px solid white' : '1px solid #333',
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                                                transition: 'all 0.05s',
                                                borderRadius: '2px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.5)'
                                            }}
                                        >
                                            {cellContent}
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
