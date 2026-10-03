import React, { useEffect, useMemo, useRef, useState } from 'react';
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
    Divider,
    Avatar,
    Snackbar,
    Button
} from '@mui/material';
import { Eraser, Pen, Circle, Trash2, RotateCcw } from 'lucide-react';

import { InstrumentIcons } from '../constants/instrumentIcons';
import type { RhythmPattern, InstrumentType, RhythmStep } from '../rhythms/RhythmPatterns';
import { INSTRUMENT_IMAGES } from '../constants/instrumentAssets';
import { getGroupCount } from '../rhythms/meter';
import { TIME_SIGNATURES, changeTimeSignature, remapSteps, sameSignature } from '../rhythms/patternEditing';
import { usePlaybackStore } from '../state/PlaybackContext';

interface PatternEditorProps {
    pattern: RhythmPattern;
    onPatternUpdate: (newPattern: RhythmPattern) => void;
    isPlaying?: boolean;
    onPreviewInstrument?: (instrument: string, modifier?: string) => void;
    /** The pattern is an edited preset that can be restored to its original. */
    canRestore?: boolean;
    onRestore?: () => void;
}

const INSTRUMENTS_DISPLAY: { type: InstrumentType; label: string; group: string }[] = [
    { type: 'bombo_leguero', label: 'Bombo', group: 'latino' },
    { type: 'caja', label: 'Caja Coplera', group: 'latino' },
    { type: 'cajon', label: 'Cajón', group: 'latino' },
    { type: 'palmas', label: 'Palmas', group: 'latino' },
    { type: 'candombe_chico', label: 'Chico', group: 'latino' },
    { type: 'candombe_repique', label: 'Repique', group: 'latino' },
    { type: 'candombe_piano', label: 'Piano C.', group: 'latino' },
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

/** Steps per pulse (per denominator note). Labels depend on the pulse unit. */
const SUBDIVISION_OPTIONS: Record<4 | 8, { value: number; label: string; icon: string }[]> = {
    4: [
        { value: 1, label: 'Negras', icon: '♩' },
        { value: 2, label: 'Corcheas', icon: '♪' },
        { value: 3, label: 'Tresillos', icon: '♪₃' },
        { value: 4, label: 'Semicorcheas', icon: '𝅘𝅥𝅯' },
        { value: 6, label: 'Sextillos', icon: '𝅘𝅥𝅯₆' },
    ],
    8: [
        { value: 1, label: 'Corcheas', icon: '♪' },
        { value: 2, label: 'Semicorcheas', icon: '𝅘𝅥𝅯' },
        { value: 3, label: 'Tresillos', icon: '𝅘𝅥𝅯₃' },
        { value: 4, label: 'Fusas', icon: '𝅘𝅥𝅰' },
    ],
};

const VELOCITIES: Record<Exclude<ToolType, 'eraser'>, number> = { ghost: 0.2, piano: 0.4, pen: 0.7, forte: 0.9, accent: 1.0 };

type ToolType = 'ghost' | 'piano' | 'pen' | 'forte' | 'accent' | 'eraser';

const getIntensityColor = (v: number) => {
    if (v > 0.95) return 'error.main';
    if (v > 0.85) return 'secondary.main';
    if (v > 0.6) return 'primary.main';
    if (v > 0.3) return 'primary.light';
    return 'text.disabled';
};

const getNoteSymbol = (stepsPerPulse: number, den: number) => {
    const perQuarter = stepsPerPulse * (4 / den);
    if (perQuarter <= 1) return '♩';
    if (perQuarter <= 3) return '♪';
    return '𝅘𝅥𝅯';
};

export default function PatternEditor({ pattern, onPatternUpdate, isPlaying = false, onPreviewInstrument, canRestore = false, onRestore }: PatternEditorProps) {
    const [activeFilter, setActiveFilter] = useState<'used' | 'all' | 'drums' | 'latino'>('used');
    const [selectedTool, setSelectedTool] = useState<ToolType>('pen');
    const [selectedModifier, setSelectedModifier] = useState<'open' | 'closed'>('closed');
    const [undoSteps, setUndoSteps] = useState<RhythmStep[] | null>(null);
    const paintingRef = useRef(false);
    const gridRef = useRef<HTMLDivElement | null>(null);
    const store = usePlaybackStore();

    const sub = pattern.subdivision;
    const [num, den] = pattern.timeSignature;
    const stepsPerPulse = sub / num;
    const groupCount = getGroupCount(pattern.timeSignature);
    const cellsPerGroup = sub / groupCount;
    const pulseOptions = SUBDIVISION_OPTIONS[den === 8 ? 8 : 4];

    const stepIndex = useMemo(() => {
        const map = new Map<string, RhythmStep>();
        pattern.steps.forEach(s => map.set(`${s.step}:${s.instrument}`, s));
        return map;
    }, [pattern.steps]);

    // Highlight the playing column imperatively: avoids re-rendering hundreds of cells per step.
    useEffect(() => {
        const grid = gridRef.current;
        if (!grid) return;
        let lastCol = -1;
        const paint = (col: number) => {
            if (col === lastCol) return;
            grid.querySelectorAll('.is-current').forEach(el => el.classList.remove('is-current'));
            if (col >= 0) grid.querySelectorAll(`[data-col="${col}"]`).forEach(el => el.classList.add('is-current'));
            lastCol = col;
        };
        paint(isPlaying ? store.getSnapshot().step : -1);
        if (!isPlaying) return;
        const unsubscribe = store.subscribe(() => paint(store.getSnapshot().step));
        return () => {
            unsubscribe();
            paint(-1);
        };
    }, [store, isPlaying, sub, activeFilter]);

    useEffect(() => {
        const stopPainting = () => { paintingRef.current = false; };
        window.addEventListener('pointerup', stopPainting);
        window.addEventListener('pointercancel', stopPainting);
        return () => {
            window.removeEventListener('pointerup', stopPainting);
            window.removeEventListener('pointercancel', stopPainting);
        };
    }, []);

    const clearPattern = () => {
        if (pattern.steps.length === 0) return;
        setUndoSteps(pattern.steps);
        onPatternUpdate({ ...pattern, steps: [] });
    };

    const undoClear = () => {
        if (undoSteps) onPatternUpdate({ ...pattern, steps: undoSteps });
        setUndoSteps(null);
    };

    const handleTimeSignatureChange = (label: string) => {
        const ts = TIME_SIGNATURES.find(t => t.label === label);
        if (!ts || sameSignature(ts.value, pattern.timeSignature)) return;
        onPatternUpdate({ ...pattern, ...changeTimeSignature(pattern, ts.value) });
    };

    const handleSubdivisionChange = (newStepsPerPulse: number) => {
        const newSub = num * newStepsPerPulse;
        if (newSub === sub) return;
        onPatternUpdate({ ...pattern, subdivision: newSub, steps: remapSteps(pattern.steps, sub, newSub) });
    };

    const modifierFor = (instrument: InstrumentType): RhythmStep['modifier'] => {
        if (instrument === 'hihat') return selectedModifier === 'open' ? 'open' : 'closed';
        if (instrument === 'snare') return selectedModifier === 'open' ? 'snares_off' : undefined;
        if (instrument === 'bombo_leguero' || instrument === 'caja' || instrument === 'cajon') {
            return selectedModifier === 'open' ? 'aro' : 'parche';
        }
        return undefined;
    };

    /**
     * @param dragging painting across cells only adds/erases; a single click on an identical note toggles it off.
     */
    const applyTool = (col: number, instrument: InstrumentType, dragging: boolean) => {
        const stepNum = col + 1;
        const existing = stepIndex.get(`${stepNum}:${instrument}`);
        const others = pattern.steps.filter(s => !(s.step === stepNum && s.instrument === instrument));

        if (selectedTool === 'eraser') {
            if (existing) onPatternUpdate({ ...pattern, steps: others });
            return;
        }

        const velocity = VELOCITIES[selectedTool];
        const modifier = modifierFor(instrument);
        if (existing && existing.velocity === velocity && existing.modifier === modifier) {
            if (!dragging) onPatternUpdate({ ...pattern, steps: others });
            return;
        }

        onPatternUpdate({ ...pattern, steps: [...others, { step: stepNum, instrument, velocity, modifier }] });
        if (!dragging && !isPlaying) onPreviewInstrument?.(instrument, modifier);
    };

    const instrumentsInUse = new Set(pattern.steps.map(s => s.instrument));
    const visibleInstruments = INSTRUMENTS_DISPLAY.filter(i => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'used') return instrumentsInUse.has(i.type) || pattern.instruments.includes(i.type);
        return i.group === activeFilter;
    });
    const rows = visibleInstruments.length > 0 ? visibleInstruments : INSTRUMENTS_DISPLAY.filter(i => i.group === 'drums');
    const noteChar = getNoteSymbol(stepsPerPulse, den);
    const currentTs = TIME_SIGNATURES.find(t => sameSignature(t.value, pattern.timeSignature));

    return (
        <Box component="section" aria-label="Editor de patrón" sx={{ width: '100%', mt: 2 }}>
            {/* Toolbar Row 1: Filters & TimeSig */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', width: '100%' }}>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <ToggleButtonGroup value={activeFilter} exclusive onChange={(_, v) => v && setActiveFilter(v)} size="small" aria-label="Filtrar instrumentos" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                        <ToggleButton value="used">En uso</ToggleButton>
                        <ToggleButton value="all">Todos</ToggleButton>
                        <ToggleButton value="drums">Batería</ToggleButton>
                        <ToggleButton value="latino">Latino</ToggleButton>
                    </ToggleButtonGroup>

                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

                    <ToggleButtonGroup
                        value={selectedTool}
                        exclusive
                        onChange={(_, v) => v && setSelectedTool(v)}
                        size="small"
                        aria-label="Intensidad"
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .Mui-selected': { bgcolor: 'primary.main !important', color: 'white !important' } }}
                    >
                        <ToggleButton value="ghost" aria-label="Ghost (pp)" title="Ghost (pp)"><Typography variant="caption" sx={{ fontSize: '0.6rem' }}>pp</Typography></ToggleButton>
                        <ToggleButton value="piano" aria-label="Piano (p)" title="Piano (p)"><Typography variant="caption">p</Typography></ToggleButton>
                        <ToggleButton value="pen" aria-label="Normal (mf)" title="Normal (mf)"><Pen size={14} /></ToggleButton>
                        <ToggleButton value="forte" aria-label="Forte (f)" title="Forte (f)"><Typography variant="button">f</Typography></ToggleButton>
                        <ToggleButton value="accent" aria-label="Acento (ff)" title="Acento (ff)"><Typography variant="button" sx={{
                            fontWeight: "bold"
                        }}>ff</Typography></ToggleButton>
                        <ToggleButton value="eraser" aria-label="Goma de borrar" title="Goma / Borrar"><Eraser size={14} /></ToggleButton>
                    </ToggleButtonGroup>

                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />

                    <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1, p: 0.2, display: 'flex' }}>
                        <ToggleButtonGroup
                            value={selectedModifier}
                            exclusive
                            onChange={(_, v) => v && setSelectedModifier(v)}
                            size="small"
                            aria-label="Articulación"
                            sx={{ '& .Mui-selected': { bgcolor: 'secondary.main !important', color: 'white !important' } }}
                        >
                            <Tooltip title="Cerrado / Parche / Bordonas ON">
                                <ToggleButton value="closed" aria-label="Cerrado o parche"><Circle size={8} fill="currentColor" /></ToggleButton>
                            </Tooltip>
                            <Tooltip title="Abierto / Aro / Bordonas OFF">
                                <ToggleButton value="open" aria-label="Abierto o aro"><Circle size={12} strokeWidth={3} /></ToggleButton>
                            </Tooltip>
                        </ToggleButtonGroup>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Select
                        size="small"
                        value={Number.isInteger(stepsPerPulse) && pulseOptions.some(o => o.value === stepsPerPulse) ? stepsPerPulse : ''}
                        displayEmpty
                        onChange={(e) => handleSubdivisionChange(Number(e.target.value))}
                        slotProps={{ input: { 'aria-label': 'Subdivisión' } }}
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', minWidth: 120 }}
                        renderValue={(val) => {
                            const opt = pulseOptions.find(o => o.value === val);
                            return opt ? `${opt.icon} ${opt.label}` : `${sub} pasos`;
                        }}
                    >
                        {pulseOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>
                                <Stack direction="row" spacing={1} sx={{
                                    alignItems: "center"
                                }}>
                                    <Typography sx={{ fontSize: '1.2rem', minWidth: 24 }}>{opt.icon}</Typography>
                                    <Typography variant="body2">{opt.label}</Typography>
                                </Stack>
                            </MenuItem>
                        ))}
                    </Select>

                    <Select
                        size="small"
                        value={currentTs?.label ?? ''}
                        displayEmpty
                        renderValue={(v) => v || `${num}/${den}`}
                        onChange={(e) => handleTimeSignatureChange(e.target.value)}
                        slotProps={{ input: { 'aria-label': 'Compás' } }}
                        sx={{ width: 84, bgcolor: 'rgba(255,255,255,0.05)' }}
                    >
                        {TIME_SIGNATURES.map(ts => <MenuItem key={ts.label} value={ts.label}>{ts.label}</MenuItem>)}
                    </Select>

                    {canRestore && (
                        <Tooltip title="Restaurar el ritmo original">
                            <IconButton size="small" onClick={onRestore} aria-label="Restaurar ritmo original"><RotateCcw size={18} /></IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Borrar todo el patrón">
                        <span>
                            <IconButton size="small" color="error" onClick={clearPattern} disabled={pattern.steps.length === 0} aria-label="Borrar patrón" sx={{ ml: 0.5, opacity: 0.7 }}><Trash2 size={18} /></IconButton>
                        </span>
                    </Tooltip>
                </Box>
            </Box>

            {/* Grid */}
            <Box sx={{ overflowX: 'auto', pb: 2 }}>
                <Box
                    ref={gridRef}
                    role="group"
                    aria-label={`Grilla de ${sub} pasos en ${num}/${den}`}
                    data-testid="pattern-grid"
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: `120px repeat(${sub}, minmax(22px, 1fr))`,
                        gap: '1px',
                        minWidth: 120 + sub * 24,
                        '& .is-current': { boxShadow: 'inset 0 0 0 1px #f48fb1' }
                    }}
                >
                    {/* Beats Header */}
                    <Box sx={{ display: 'contents' }} aria-hidden>
                        <Box sx={{ p: 1 }}><Typography variant="caption" sx={{
                            color: "text.secondary"
                        }}>TIEMPO</Typography></Box>
                        {Array.from({ length: sub }).map((_, idx) => {
                            const isGroupStart = Number.isInteger(cellsPerGroup) ? idx % cellsPerGroup === 0 : idx === 0;
                            return (
                                <Box key={idx} data-col={idx} sx={{
                                    display: 'flex', justifyContent: 'center', alignItems: 'flex-end', pb: 0.5,
                                    bgcolor: isGroupStart ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    borderBottom: '1px solid #444'
                                }}>
                                    {isGroupStart
                                        ? <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight: "bold",
                                            color: "text.primary"
                                        }}>{Math.floor(idx / cellsPerGroup) + 1}</Typography>
                                        : <Typography
                                        variant="caption"
                                        sx={{
                                            color: "text.disabled",
                                            fontSize: '0.6rem'
                                        }}>•</Typography>}
                                </Box>
                            );
                        })}
                    </Box>

                    {rows.map((inst) => {
                        const Icon = InstrumentIcons[inst.type];

                        return (
                            <Box key={inst.type} sx={{ display: 'contents' }}>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        alignItems: "center",
                                        p: 1,
                                        bgcolor: 'rgba(255,255,255,0.02)',
                                        borderRight: '1px solid #333',
                                        minWidth: 0
                                    }}>
                                    {INSTRUMENT_IMAGES[inst.type] ? (
                                        <Avatar
                                            src={INSTRUMENT_IMAGES[inst.type]}
                                            alt=""
                                            sx={{ width: 18, height: 18, border: '1px solid rgba(229, 169, 95, 0.4)', boxShadow: '0 0 4px rgba(229, 169, 95, 0.2)' }}
                                        />
                                    ) : (
                                        Icon && <Icon size={16} strokeWidth={1.5} color="#888" />
                                    )}
                                    <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem', color: '#ccc' }}>{inst.label}</Typography>
                                </Stack>

                                {Array.from({ length: sub }).map((_, idx) => {
                                    const note = stepIndex.get(`${idx + 1}:${inst.type}`);
                                    const isGroupStart = Number.isInteger(cellsPerGroup) ? idx % cellsPerGroup === 0 : idx === 0;
                                    const isPulseStart = Number.isInteger(stepsPerPulse) ? idx % stepsPerPulse === 0 : false;

                                    let noteVisual: React.ReactNode = note ? noteChar : null;
                                    if (note) {
                                        if (inst.type === 'hihat') noteVisual = note.modifier === 'open' ? <Circle size={10} strokeWidth={3} /> : noteChar;
                                        else if (inst.type === 'hihat_foot') noteVisual = '△';
                                        else if (inst.type === 'snare' && note.modifier === 'snares_off') noteVisual = 'T';
                                        else if (inst.type === 'rim' || note.modifier === 'aro') noteVisual = '×';
                                    }

                                    return (
                                        <Box
                                            key={idx}
                                            component="button"
                                            type="button"
                                            data-col={idx}
                                            data-testid={`cell-${inst.type}-${idx + 1}`}
                                            aria-label={`${inst.label}, paso ${idx + 1}${note ? `, intensidad ${Math.round(note.velocity * 100)}%` : ''}`}
                                            aria-pressed={!!note}
                                            onPointerDown={(e: React.PointerEvent) => {
                                                if (e.button !== 0) return;
                                                e.preventDefault();
                                                paintingRef.current = true;
                                                applyTool(idx, inst.type, false);
                                            }}
                                            onPointerEnter={() => { if (paintingRef.current) applyTool(idx, inst.type, true); }}
                                            onKeyDown={(e: React.KeyboardEvent) => {
                                                // Enter paints; Space stays the global play/stop shortcut.
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    applyTool(idx, inst.type, false);
                                                }
                                            }}
                                            sx={{
                                                all: 'unset',
                                                boxSizing: 'border-box',
                                                height: 40,
                                                bgcolor: isGroupStart ? 'rgba(255,255,255,0.03)' : isPulseStart ? 'rgba(255,255,255,0.015)' : 'transparent',
                                                borderRight: isGroupStart ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.03)',
                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.2rem',
                                                touchAction: 'none',
                                                color: note ? getIntensityColor(note.velocity) : 'transparent',
                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                                                '&:focus-visible': { outline: '2px solid #ffd54f', outlineOffset: '-2px' },
                                                userSelect: 'none'
                                            }}
                                        >
                                            {note && <Box component="span" aria-hidden sx={{ transform: note.velocity < 0.6 ? 'scale(0.8)' : 'scale(1)' }}>{noteVisual}</Box>}
                                        </Box>
                                    );
                                })}
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            <Snackbar
                open={undoSteps !== null}
                autoHideDuration={6000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setUndoSteps(null); }}
                message="Patrón borrado"
                action={<Button color="primary" size="small" onClick={undoClear}>Deshacer</Button>}
            />
        </Box>
    );
}
