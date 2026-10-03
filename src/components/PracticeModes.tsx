import React from 'react';
import {
    Box,
    Paper,
    Stack,
    Switch,
    FormControlLabel,
    TextField,
    Typography,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Slider,
    ToggleButton,
    ToggleButtonGroup,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { FORM_GENRES } from '../audio/Scheduler';
import type { FormGenre, TrainerConfig, TrainerMode } from '../audio/Scheduler';
import { MAX_BPM, MIN_BPM, clampBpm } from '../rhythms/meter';
import { usePlayback } from '../state/PlaybackContext';

export interface SilenceSettings {
    active: boolean;
    chance: number;
}

export interface FormasSettings {
    enabled: boolean;
    genre: FormGenre;
    introBars: number;
}

interface PracticeModesProps {
    trainer: TrainerConfig;
    onTrainerChange: (config: TrainerConfig) => void;
    silence: SilenceSettings;
    onSilenceChange: (settings: SilenceSettings) => void;
    formas: FormasSettings;
    onFormasChange: (settings: FormasSettings) => void;
    isPlaying: boolean;
}

const NumberField: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    disabled?: boolean;
    onChange: (value: number) => void;
}> = ({ label, value, min, max, disabled, onChange }) => (
    <TextField
        label={label}
        type="number"
        size="small"
        value={value}
        disabled={disabled}
        onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && e.target.value !== '') onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        slotProps={{ htmlInput: { min, max } }}
        sx={{ width: 110 }}
    />
);

const FormStatus: React.FC = () => {
    const formState = usePlayback(s => s.formState);
    if (!formState) return null;
    return (
        <Box role="status" data-testid="form-status" sx={{ mt: 1, p: 1, borderRadius: 2, bgcolor: 'rgba(229,169,95,0.08)', border: '1px solid rgba(229,169,95,0.25)' }}>
            <Typography
                variant="subtitle2"
                sx={{
                    color: "primary.main",
                    fontWeight: 800
                }}>{formState.sectionName}</Typography>
            {!formState.finished && (
                <Typography variant="caption" sx={{
                    color: "text.secondary"
                }}>
                    Compás {formState.sectionBar + 1} / {formState.sectionTotalBars} · Parte {formState.part}
                </Typography>
            )}
        </Box>
    );
};

const TrainerStatus: React.FC<{ barsPerStep: number }> = ({ barsPerStep }) => {
    const trainerBar = usePlayback(s => s.trainerBar);
    return (
        <Typography variant="caption" data-testid="trainer-status" sx={{
            color: "text.secondary"
        }}>
            Compás {Math.min(trainerBar + 1, barsPerStep)} de {barsPerStep} hasta el próximo cambio
        </Typography>
    );
};

/**
 * Practice modes: speed trainer, silence (gap click) training and folk forms.
 * (ES) Modos de práctica: entrenador de velocidad, silencios y formas folclóricas.
 */
export const PracticeModes: React.FC<PracticeModesProps> = ({
    trainer,
    onTrainerChange,
    silence,
    onSilenceChange,
    formas,
    onFormasChange,
    isPlaying
}) => {
    const activeCount = [trainer.active, silence.active, formas.enabled].filter(Boolean).length;
    const updateTrainer = (patch: Partial<TrainerConfig>) => onTrainerChange({ ...trainer, ...patch });

    return (
        <Paper className="brass-trim" sx={{ bgcolor: '#141210', borderRadius: 4, overflow: 'hidden' }}>
            <Accordion disableGutters defaultExpanded={activeCount > 0} sx={{ bgcolor: 'transparent', backgroundImage: 'none' }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="practice-modes-content" id="practice-modes-header">
                    <Stack direction="row" spacing={1} sx={{
                        alignItems: "center"
                    }}>
                        <Typography variant="subtitle1" sx={{
                            fontWeight: "bold"
                        }}>Modos de práctica</Typography>
                        {activeCount > 0 && <Chip size="small" color="primary" label={`${activeCount} activo${activeCount > 1 ? 's' : ''}`} />}
                    </Stack>
                </AccordionSummary>
                <AccordionDetails id="practice-modes-content">
                    <Stack spacing={2.5}>
                        {/* SPEED TRAINER */}
                        <Box>
                            <FormControlLabel
                                control={<Switch checked={trainer.active} onChange={(e) => updateTrainer({ active: e.target.checked })} />}
                                label={<Typography sx={{
                                    fontWeight: 700
                                }}>Entrenador de velocidad</Typography>}
                            />
                            <Stack
                                direction="row"
                                spacing={1}
                                useFlexGap
                                sx={{
                                    flexWrap: "wrap",
                                    mt: 1
                                }}>
                                <NumberField label="BPM inicial" value={trainer.startBpm} min={MIN_BPM} max={MAX_BPM} disabled={isPlaying && trainer.active}
                                    onChange={(v) => updateTrainer({ startBpm: clampBpm(v) })} />
                                <NumberField label="BPM objetivo" value={trainer.targetBpm} min={MIN_BPM} max={MAX_BPM}
                                    onChange={(v) => updateTrainer({ targetBpm: clampBpm(v) })} />
                                <NumberField label="Cada (compases)" value={trainer.barsPerStep} min={1} max={64}
                                    onChange={(v) => updateTrainer({ barsPerStep: v })} />
                                <NumberField label="Paso (BPM)" value={trainer.bpmIncrement} min={1} max={50}
                                    onChange={(v) => updateTrainer({ bpmIncrement: v })} />
                            </Stack>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={trainer.mode}
                                onChange={(_, v: TrainerMode | null) => v && updateTrainer({ mode: v })}
                                sx={{ mt: 1 }}
                                aria-label="Modo del entrenador"
                            >
                                <ToggleButton value="linear">Lineal</ToggleButton>
                                <ToggleButton value="resistance_loop">Resistencia</ToggleButton>
                            </ToggleButtonGroup>
                            {trainer.active && isPlaying && <Box sx={{ mt: 0.5 }}><TrainerStatus barsPerStep={trainer.barsPerStep} /></Box>}
                        </Box>

                        {/* SILENCE MODE */}
                        <Box>
                            <FormControlLabel
                                control={<Switch checked={silence.active} onChange={(e) => onSilenceChange({ ...silence, active: e.target.checked })} />}
                                label={<Typography sx={{
                                    fontWeight: 700
                                }}>Compases en silencio</Typography>}
                            />
                            <Typography variant="caption" component="p" sx={{
                                color: "text.secondary"
                            }}>
                                Silencia compases al azar para que sostengas el tempo solo.
                            </Typography>
                            <Stack
                                direction="row"
                                spacing={2}
                                sx={{
                                    alignItems: "center",
                                    px: 1
                                }}>
                                <Typography variant="body2" sx={{ minWidth: 90 }}>Probabilidad</Typography>
                                <Slider
                                    value={Math.round(silence.chance * 100)}
                                    min={0}
                                    max={100}
                                    step={5}
                                    valueLabelDisplay="auto"
                                    valueLabelFormat={(v) => `${v}%`}
                                    aria-label="Probabilidad de compás en silencio"
                                    onChange={(_, v) => onSilenceChange({ ...silence, chance: (v as number) / 100 })}
                                />
                            </Stack>
                        </Box>

                        {/* FOLK FORMS */}
                        <Box>
                            <FormControlLabel
                                control={<Switch checked={formas.enabled} disabled={isPlaying} onChange={(e) => onFormasChange({ ...formas, enabled: e.target.checked })} />}
                                label={<Typography sx={{
                                    fontWeight: 700
                                }}>Formas folclóricas</Typography>}
                            />
                            <Stack
                                direction="row"
                                spacing={1}
                                useFlexGap
                                sx={{
                                    flexWrap: "wrap",
                                    mt: 1
                                }}>
                                <FormControl size="small" sx={{ minWidth: 180 }}>
                                    <InputLabel id="formas-genre-label">Forma</InputLabel>
                                    <Select
                                        labelId="formas-genre-label"
                                        label="Forma"
                                        value={formas.genre}
                                        disabled={isPlaying}
                                        onChange={(e) => onFormasChange({ ...formas, genre: e.target.value as FormGenre })}
                                    >
                                        {FORM_GENRES.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <NumberField label="Intro (compases)" value={formas.introBars} min={1} max={32} disabled={isPlaying}
                                    onChange={(v) => onFormasChange({ ...formas, introBars: v })} />
                            </Stack>
                            {formas.enabled && <FormStatus />}
                        </Box>
                    </Stack>
                </AccordionDetails>
            </Accordion>
        </Paper>
    );
};
