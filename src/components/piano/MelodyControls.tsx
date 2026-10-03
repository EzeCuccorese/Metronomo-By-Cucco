import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';
import { Circle, Repeat, Square, Trash2, Undo2 } from 'lucide-react';
import type { MelodyRecordState } from '../../audio/Scheduler';
import type { Melody } from '../../audio/piano/melody';
import { MELODY_BAR_OPTIONS } from '../../audio/piano/melody';
import { barsLabel, melodyStatusText } from './pianoUi';

interface MelodyControlsProps {
    melody: Melody | null;
    bars: number;
    onBarsChange: (bars: number) => void;
    loopOn: boolean;
    onLoopChange: (on: boolean) => void;
    recordState: MelodyRecordState;
    recordingBar: number;
    recordingBars: number;
    isPlaying: boolean;
    canUndo: boolean;
    onRecord: () => void;
    onCancel: () => void;
    onUndo: () => void;
    onClear: () => void;
}

/** Record / loop / undo / clear for the melody loop. */
export default function MelodyControls(props: MelodyControlsProps) {
    const { melody, bars, onBarsChange, loopOn, onLoopChange, recordState, canUndo, onRecord, onCancel, onUndo, onClear } = props;
    const busy = recordState !== 'idle';
    const hasMelody = !!melody && melody.notes.length > 0;

    return (
        <Box>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="melody-bars-label">Largo</InputLabel>
                    <Select
                        labelId="melody-bars-label"
                        label="Largo"
                        value={bars}
                        disabled={busy}
                        onChange={e => onBarsChange(Number(e.target.value))}
                    >
                        {MELODY_BAR_OPTIONS.map(n => <MenuItem key={n} value={n}>{barsLabel(n)}</MenuItem>)}
                    </Select>
                </FormControl>

                {busy ? (
                    <Button variant="contained" color="error" size="small" startIcon={<Square size={14} />} onClick={onCancel}>
                        Cancelar
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<Circle size={14} fill="currentColor" />}
                        onClick={onRecord}
                        title="Graba sobre el metrónomo: si está detenido, arranca con un compás de precuenta"
                    >
                        Grabar
                    </Button>
                )}

                <Button
                    variant={loopOn ? 'contained' : 'outlined'}
                    size="small"
                    startIcon={<Repeat size={14} />}
                    aria-pressed={loopOn}
                    disabled={!hasMelody}
                    onClick={() => onLoopChange(!loopOn)}
                >
                    Loop
                </Button>
                <Button variant="outlined" size="small" startIcon={<Undo2 size={14} />} disabled={!canUndo || busy} onClick={onUndo}>
                    Deshacer
                </Button>
                <Button variant="outlined" size="small" color="error" startIcon={<Trash2 size={14} />} disabled={!hasMelody || busy} onClick={onClear}>
                    Borrar
                </Button>
            </Stack>
            <Typography
                variant="caption"
                role="status"
                aria-live="polite"
                data-testid="melody-status"
                sx={{ display: 'block', mt: 1, color: recordState === 'recording' ? 'error.light' : 'text.secondary' }}
            >
                {melodyStatusText(props)}
            </Typography>
        </Box>
    );
}
