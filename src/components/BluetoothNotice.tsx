import { useEffect, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import BluetoothAudioIcon from '@mui/icons-material/BluetoothAudio';
import CloseIcon from '@mui/icons-material/Close';
import AudioContextManager from '../audio/AudioContextManager';
import { usePersistentState } from '../hooks/usePersistentState';
import { isBoolean } from '../state/storage';

/** Above this output latency (seconds) the measured value is shown: almost always Bluetooth. */
export const HIGH_LATENCY_S = 0.05;

interface BluetoothNoticeProps {
  isPlaying: boolean;
}

/**
 * Dismissible one-line note: Bluetooth headphones add a fixed delay, so precise practice
 * should use wired headphones or the phone speaker. Dismissal is remembered.
 *
 * (ES) Aviso descartable sobre la latencia de los auriculares Bluetooth.
 */
export function BluetoothNotice({ isPlaying }: BluetoothNoticeProps) {
  const [dismissed, setDismissed] = usePersistentState('bluetoothNoticeDismissed', false, isBoolean);
  const [latency, setLatency] = useState(0);

  // The output latency is only meaningful once the context runs; read it when playback starts.
  useEffect(() => {
    if (!isPlaying || dismissed) return;
    const timer = setTimeout(() => setLatency(AudioContextManager.getInstance().getOutputLatency()), 500);
    return () => clearTimeout(timer);
  }, [isPlaying, dismissed]);

  if (dismissed) return null;

  return (
    <Box
      role="note"
      aria-label="Aviso sobre auriculares Bluetooth"
      data-testid="bluetooth-notice"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        borderRadius: '10px',
        border: '1px solid rgba(229, 169, 95, 0.14)',
        bgcolor: 'rgba(20, 18, 16, 0.6)',
        color: '#c9bba8',
      }}
    >
      <BluetoothAudioIcon sx={{ fontSize: 18, color: '#e5a95f', flexShrink: 0 }} aria-hidden />
      <Typography variant="caption" sx={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
        Los auriculares Bluetooth suman un retraso fijo al sonido. Para practicar con precisión, usá auriculares con cable o el parlante del teléfono.
        {latency > HIGH_LATENCY_S && (
          <> <strong>Latencia de salida actual: {Math.round(latency * 1000)} ms.</strong></>
        )}
      </Typography>
      <IconButton size="small" aria-label="Cerrar aviso de Bluetooth" onClick={() => setDismissed(true)} sx={{ color: '#c9bba8' }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
