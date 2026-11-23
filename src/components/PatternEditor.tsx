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
import BackspaceIcon from '@mui/icons-material/Backspace';
import EditIcon from '@mui/icons-material/Edit';
import CircleIcon from '@mui/icons-material/Circle';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';

import { InstrumentIcons } from '../constants/instrumentIcons';
import type { RhythmPattern, InstrumentType, RhythmStep } from '../rhythms/RhythmPatterns';
import { INSTRUMENT_IMAGES } from '../constants/instrumentAssets';
import { getGroupCount } from '../rhythms/meter';
import { TIME_SIGNATURES, changeTimeSignature, remapSteps, sameSignature } from '../rhythms/patternEditing';
import type { PatternSource } from '../rhythms/patternEditing';
import { usePlaybackStore } from '../state/PlaybackContext';
import { NoteGlyph } from './NoteGlyph';
import type { NoteGlyphKind } from './NoteGlyph';

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
    { type: 'kick', label: 'Bombo bat.', group: 'drums' },
    { type: 'snare', label: 'Redoblante', group: 'drums' },
    { type: 'hihat', label: 'Hi-hat', group: 'drums' },
    { type: 'hihat_foot', label: 'Hi-hat pie', group: 'drums' },
    { type: 'ride', label: 'Ride', group: 'drums' },
    { type: 'crash', label: 'Crash', group: 'drums' },
    { type: 'tom_high', label: 'Tom 1', group: 'drums' },
    { type: 'tom_low', label: 'Tom 2', group: 'drums' },
    { type: 'tom_floor', label: 'Tom piso', group: 'drums' },
    { type: 'click', label: 'Click', group: 'metronome' },
];

/** Steps per pulse (per denominator note). Labels depend on the pulse unit. */
const SUBDIVISION_OPTIONS: Record<4 | 8, { value: number; label: string; glyph: NoteGlyphKind }[]> = {
    4: [
        { value: 1, label: 'Negras', glyph: 'quarter' },
        { value: 2, label: 'Corcheas', glyph: 'eighth' },
        { value: 3, label: 'Tresillos', glyph: 'triplet' },
        { value: 4, label: 'Semicorcheas', glyph: 'sixteenth' },
        { value: 6, label: 'Sextillos', glyph: 'sextuplet' },
    ],
    8: [
        { value: 1, label: 'Corcheas', glyph: 'eighth' },
        { value: 2, label: 'Semicorcheas', glyph: 'sixteenth' },
        { value: 3, label: 'Tresillos', glyph: 'triplet' },
        { value: 4, label: 'Fusas', glyph: 'thirtysecond' },
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

const getNoteGlyphKind = (stepsPerPulse: number, den: number): NoteGlyphKind => {
    const perQuarter = stepsPerPulse * (4 / den);
    if (perQuarter <= 1) return 'quarter';
    if (perQuarter <= 2) return 'eighth';
    if (perQuarter === 3) return 'triplet';
    if (perQuarter <= 4) return 'sixteenth';
    if (perQuarter <= 6) return 'sextuplet';
    return 'thirtysecond';
};

interface PatternRowProps {
    inst: { type: InstrumentType; label: string; group: string };
    sub: number;
    stepsPerPulse: number;
    cellsPerGroup: number;
    noteGlyph: NoteGlyphKind;
    rowNotes: (RhythmStep | undefined)[];
    onPaintStart: (col: number, instrument: InstrumentType) => void;
    onPaintMove: (col: number, instrument: InstrumentType) => void;
}

function renderCellVisual(inst: InstrumentType, note: RhythmStep, noteGlyph: NoteGlyphKind): React.ReactNode {
    if (inst === 'hihat' && note.modifier === 'open') return <NoteGlyph kind="open" size={16} />;
    if (inst === 'hihat_foot') return '△';
    if (inst === 'snare' && note.modifier === 'snares_off') return 'T';
    if (inst === 'rim' || note.modifier === 'aro') return <NoteGlyph kind="rim" size={16} />;
    if (note.modifier === 'open') return <NoteGlyph kind="open" size={16} />;
    return <NoteGlyph kind={noteGlyph} size={18} />;
}

const PatternRow = React.memo<PatternRowProps>(({
    inst, sub, stepsPerPulse, cellsPerGroup, noteGlyph, rowNotes, onPaintStart, onPaintMove,
}) => {
    const Icon = InstrumentIcons[inst.type];
    return (
        <Box sx={{ display: 'contents' }}>
            <Stack
                direction="row"
                spacing={1}
                sx={{
                    alignItems: 'center',
                    p: 1,
                    bgcolor: 'rgba(255,255,255,0.02)',
                    borderRight: '1px solid rgba(148, 163, 184, 0.16)',
                    minWidth: 0,
                }}
            >
                {INSTRUMENT_IMAGES[inst.type] ? (
                    <Avatar
                        src={INSTRUMENT_IMAGES[inst.type]}
                        alt=""
                        sx={{ width: 18, height: 18, border: '1px solid rgba(var(--skin-accent-rgb), 0.4)', boxShadow: '0 0 4px rgba(var(--skin-accent-rgb), 0.2)' }}
                    />
                ) : (
                    Icon && <Icon sx={{ fontSize: 16, color: '#94a3b8' }} />
                )}
                <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{inst.label}</Typography>
            </Stack>

            {Array.from({ length: sub }).map((_, idx) => {
                const note = rowNotes[idx];
                const isGroupStart = Number.isInteger(cellsPerGroup) ? idx % cellsPerGroup === 0 : idx === 0;
                const isPulseStart = Number.isInteger(stepsPerPulse) ? idx % stepsPerPulse === 0 : false;
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
                            onPaintStart(idx, inst.type);
                        }}
                        onPointerEnter={() => onPaintMove(idx, inst.type)}
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onPaintStart(idx, inst.type);
                            }
                        }}
                        sx={{
                            all: 'unset',
                            boxSizing: 'border-box',
                            height: 40,
                            '@media (pointer: coarse)': { height: 44 },
                            bgcolor: isGroupStart ? 'rgba(255,255,255,0.03)' : isPulseStart ? 'rgba(255,255,255,0.015)' : 'transparent',
                            borderRight: isGroupStart ? '1px solid rgba(148,163,184,0.16)' : '1px solid rgba(255,255,255,0.04)',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.1rem',
                            touchAction: 'none',
                            color: note ? getIntensityColor(note.velocity) : 'transparent',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                            '&:focus-visible': { outline: '2px solid var(--skin-accent)', outlineOffset: '-2px' },
                            userSelect: 'none',
                        }}
                    >
                        {note && (
                            <Box component="span" aria-hidden sx={{ display: 'inline-flex', alignItems: 'center', transform: note.velocity < 0.6 ? 'scale(0.8)' : 'scale(1)' }}>
                                {renderCellVisual(inst.type, note, noteGlyph)}
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
});

export default function PatternEditor({ pattern, onPatternUpdate, isPlaying = false, onPreviewInstrument, canRestore = false, onRestore }: PatternEditorProps) {
    const [activeFilter, setActiveFilter] = useState<'used' | 'all' | 'drums' | 'latino'>('used');
    const [selectedTool, setSelectedTool] = useState<ToolType>('pen');
    const [selectedModifier, setSelectedModifier] = useState<'open' | 'closed'>('closed');
    const [undoState, setUndoState] = useState<{ patternId: string; steps: RhythmStep[] } | null>(null);
    const undoSteps = undoState?.patternId === pattern.id ? undoState.steps : null;
    const paintingRef = useRef(false);
    const gridRef = useRef<HTMLDivElement | null>(null);
    const sourceRef = useRef<{ patternId: string; source: PatternSource } | null>(null);
    const store = usePlaybackStore();

    const getSource = (): PatternSource => {
        if (sourceRef.current?.patternId === pattern.id) {
            return sourceRef.current.source;
        }
        const captured: PatternSource = {
            timeSignature: pattern.timeSignature,
            subdivision: pattern.subdivision,
            steps: pattern.steps,
        };
        sourceRef.current = { patternId: pattern.id, source: captured };
        return captured;
    };

    const prevExternalCleanRef = useRef(canRestore);
    useEffect(() => {
        if (prevExternalCleanRef.current && !canRestore && pattern.id !== 'custom') {
            sourceRef.current = null;
        }
        prevExternalCleanRef.current = canRestore;
    }, [canRestore, pattern.id]);

    const commitManualEdit = (next: RhythmPattern) => {
        sourceRef.current = {
            patternId: next.id,
            source: { timeSignature: next.timeSignature, subdivision: next.subdivision, steps: next.steps },
        };
        onPatternUpdate(next);
    };

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
        const columns = new Map<number, HTMLElement[]>();
        grid.querySelectorAll<HTMLElement>('[data-col]').forEach(el => {
            const col = Number(el.dataset.col);
            const list = columns.get(col);
            if (list) list.push(el);
            else columns.set(col, [el]);
        });
        let lastCol = -1;
        const paint = (col: number) => {
            if (col === lastCol) return;
            if (lastCol >= 0) columns.get(lastCol)?.forEach(el => el.classList.remove('is-current'));
            if (col >= 0) columns.get(col)?.forEach(el => el.classList.add('is-current'));
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
        setUndoState({ patternId: pattern.id, steps: pattern.steps });
        commitManualEdit({ ...pattern, steps: [] });
    };

    const undoClear = () => {
        if (undoSteps) commitManualEdit({ ...pattern, steps: undoSteps });
        setUndoState(null);
    };

    const handleTimeSignatureChange = (label: string) => {
        const ts = TIME_SIGNATURES.find(t => t.label === label);
        if (!ts || sameSignature(ts.value, pattern.timeSignature)) return;
        const source = getSource();
        onPatternUpdate({ ...pattern, ...changeTimeSignature(source, ts.value) });
    };

    const handleSubdivisionChange = (newStepsPerPulse: number) => {
        const newSub = num * newStepsPerPulse;
        if (newSub === sub) return;
        const source = getSource();
        const aligned = sameSignature(source.timeSignature, pattern.timeSignature)
            ? source
            : changeTimeSignature(source, pattern.timeSignature);
        onPatternUpdate({ ...pattern, subdivision: newSub, steps: remapSteps(aligned.steps, aligned.subdivision, newSub) });
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
            if (existing) commitManualEdit({ ...pattern, steps: others });
            return;
        }

        const velocity = VELOCITIES[selectedTool];
        const modifier = modifierFor(instrument);
        if (existing && existing.velocity === velocity && existing.modifier === modifier) {
            if (!dragging) commitManualEdit({ ...pattern, steps: others });
            return;
        }

        commitManualEdit({ ...pattern, steps: [...others, { step: stepNum, instrument, velocity, modifier }] });
        if (!dragging && !isPlaying) onPreviewInstrument?.(instrument, modifier);
    };

    const instrumentsInUse = new Set(pattern.steps.map(s => s.instrument));
    const visibleInstruments = INSTRUMENTS_DISPLAY.filter(i => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'used') return instrumentsInUse.has(i.type) || pattern.instruments.includes(i.type);
        return i.group === activeFilter;
    });
    const rows = visibleInstruments.length > 0 ? visibleInstruments : INSTRUMENTS_DISPLAY.filter(i => i.group === 'drums');
    const noteGlyph = getNoteGlyphKind(stepsPerPulse, den);
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
                        <ToggleButton value="pen" aria-label="Normal (mf)" title="Normal (mf)"><EditIcon sx={{ fontSize: 14 }} /></ToggleButton>
                        <ToggleButton value="forte" aria-label="Forte (f)" title="Forte (f)"><Typography variant="button">f</Typography></ToggleButton>
                        <ToggleButton value="accent" aria-label="Acento (ff)" title="Acento (ff)"><Typography variant="button" sx={{
                            fontWeight: "bold"
                        }}>ff</Typography></ToggleButton>
                        <ToggleButton value="eraser" aria-label="Goma de borrar" title="Goma / Borrar"><BackspaceIcon sx={{ fontSize: 14 }} /></ToggleButton>
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
                                <ToggleButton value="closed" aria-label="Cerrado o parche"><CircleIcon sx={{ fontSize: 8 }} /></ToggleButton>
                            </Tooltip>
                            <Tooltip title="Abierto / Aro / Bordonas OFF">
                                <ToggleButton value="open" aria-label="Abierto o aro"><CircleOutlinedIcon sx={{ fontSize: 12 }} /></ToggleButton>
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
                            return opt ? (
                                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                    <NoteGlyph kind={opt.glyph} size={16} />
                                    <span>{opt.label}</span>
                                </Stack>
                            ) : `${sub} pasos`;
                        }}
                    >
                        {pulseOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                    <Box sx={{ minWidth: 24, display: 'flex', justifyContent: 'center' }}>
                                        <NoteGlyph kind={opt.glyph} size={18} />
                                    </Box>
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
                            <IconButton size="small" onClick={onRestore} aria-label="Restaurar ritmo original"><ReplayIcon sx={{ fontSize: 18 }} /></IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Borrar todo el patrón">
                        <span>
                            <IconButton size="small" color="error" onClick={clearPattern} disabled={pattern.steps.length === 0} aria-label="Borrar patrón" sx={{ ml: 0.5, opacity: 0.7 }}><DeleteIcon sx={{ fontSize: 18 }} /></IconButton>
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
                        // Touch: 44 px cells; the grid scrolls inside its own container.
                        '@media (pointer: coarse)': {
                            gridTemplateColumns: `120px repeat(${sub}, minmax(44px, 1fr))`,
                            minWidth: 120 + sub * 45,
                        },
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

                    {rows.map((inst) => (
                        <PatternRow
                            key={inst.type}
                            inst={inst}
                            sub={sub}
                            stepsPerPulse={stepsPerPulse}
                            cellsPerGroup={cellsPerGroup}
                            noteGlyph={noteGlyph}
                            rowNotes={Array.from({ length: sub }, (_, idx) => stepIndex.get(`${idx + 1}:${inst.type}`))}
                            onPaintStart={(col, type) => {
                                paintingRef.current = true;
                                applyTool(col, type, false);
                            }}
                            onPaintMove={(col, type) => {
                                if (paintingRef.current) applyTool(col, type, true);
                            }}
                        />
                    ))}
                </Box>
            </Box>

            <Snackbar
                open={undoSteps !== null}
                autoHideDuration={6000}
                onClose={(_, reason) => { if (reason !== 'clickaway') setUndoState(null); }}
                message="Patrón borrado"
                action={<Button color="primary" size="small" onClick={undoClear}>Deshacer</Button>}
            />
        </Box>
    );
}
