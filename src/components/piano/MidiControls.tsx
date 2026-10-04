import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import PianoIcon from '@mui/icons-material/Piano';
import { ALL_DEVICES, MIDI_NOTICE } from '../../audio/midi/midiInput';
import type { MidiDevice, MidiSupport } from '../../audio/midi/midiInput';
import type { MidiStatus } from '../../hooks/useMidiInput';

interface MidiControlsProps {
    support: MidiSupport;
    status: MidiStatus;
    devices: MidiDevice[];
    selected: string;
    onSelect: (id: string) => void;
    onConnect: () => void;
    /** The "unavailable" notice was dismissed (persisted by the parent). */
    noticeDismissed: boolean;
    onDismissNotice: () => void;
}

/**
 * Device selector where Web MIDI exists, a dismissible explanation where it does not.
 *
 * (ES) Selector de dispositivo MIDI o aviso descartable cuando el navegador no lo soporta.
 */
export default function MidiControls({ support, status, devices, selected, onSelect, onConnect, noticeDismissed, onDismissNotice }: MidiControlsProps) {
    if (support.kind !== 'available') {
        if (noticeDismissed) return null;
        return (
            <Alert severity="info" onClose={onDismissNotice} data-testid="midi-notice" sx={{ mt: 1.5, alignItems: 'center' }}>
                {MIDI_NOTICE[support.kind]}
            </Alert>
        );
    }

    return (
        <Box data-testid="midi-controls" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
            {status === 'connected' ? (
                <>
                    <FormControl size="small" sx={{ minWidth: 200 }} disabled={devices.length === 0}>
                        <InputLabel id="piano-midi-label">Teclado MIDI</InputLabel>
                        <Select labelId="piano-midi-label" label="Teclado MIDI" value={selected} onChange={e => onSelect(e.target.value)} data-testid="midi-device-select">
                            <MenuItem value={ALL_DEVICES}>Todos los dispositivos</MenuItem>
                            {devices.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Typography variant="caption" role="status" aria-live="polite" sx={{ color: devices.length ? '#9fdcf7' : 'text.secondary' }} data-testid="midi-status">
                        {devices.length === 0 ? 'No hay teclados MIDI conectados: enchufá uno y se detecta solo.' : `MIDI activo · ${devices.length === 1 ? devices[0].name : `${devices.length} dispositivos`}`}
                    </Typography>
                </>
            ) : (
                <>
                    <Button size="small" variant="outlined" startIcon={<PianoIcon sx={{ fontSize: 16 }} />} disabled={status === 'connecting'} onClick={onConnect} data-testid="midi-connect">
                        Conectar teclado MIDI
                    </Button>
                    {status === 'denied' && (
                        <Typography variant="caption" role="alert" sx={{ color: '#e5a95f' }}>
                            No se pudo acceder a MIDI: habilitá el permiso del sitio en el navegador y probá de nuevo.
                        </Typography>
                    )}
                </>
            )}
        </Box>
    );
}
