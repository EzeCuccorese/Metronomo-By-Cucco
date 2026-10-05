import React from 'react';
import { Box, ButtonBase } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { usePlayback } from '../state/PlaybackContext';
import { useHoldRepeat } from '../hooks/useHoldRepeat';

/**
 * − / + tempo button: tap to step by 1 BPM, hold to repeat (and speed up).
 * (ES) Botón − / +: un toque suma 1 BPM, mantener repite y acelera.
 */
export const BpmStepButton: React.FC<{
  direction: -1 | 1;
  onStep: (deltaBpm: number) => void;
  disabled?: boolean;
  className?: string;
  size?: number;
  testId?: string;
}> = ({ direction, onStep, disabled, className, size = 44, testId }) => {
  const handlers = useHoldRepeat((multiplier) => onStep(direction * multiplier), disabled);
  return (
    <ButtonBase
      {...handlers}
      disabled={disabled}
      className={className}
      aria-label={direction < 0 ? 'Bajar tempo' : 'Subir tempo'}
      data-testid={testId}
      sx={{
        width: size, height: size, flexShrink: 0, borderRadius: 2,
        bgcolor: 'rgba(229, 169, 95, 0.15)', color: '#e5a95f', border: '1px solid rgba(229, 169, 95, 0.3)',
        touchAction: 'manipulation',
        '&:hover': { bgcolor: 'rgba(229, 169, 95, 0.3)' },
        '&:active': { bgcolor: 'rgba(229, 169, 95, 0.45)' },
        '&.Mui-disabled': { opacity: 0.4 },
        '&:focus-visible': { outline: '2px solid #e5a95f', outlineOffset: 2 },
      }}
    >
      {direction < 0 ? <RemoveIcon /> : <AddIcon />}
    </ButtonBase>
  );
};

/** One LED per beat of the bar; the current beat lights up, so the pulse is visible with the Pulso panel hidden. */
export const BeatLeds: React.FC<{ pattern: RhythmPattern; isPlaying: boolean; className?: string }> = ({ pattern, isPlaying, className }) => {
  const step = usePlayback(s => s.step);
  const beats = pattern.timeSignature[0];
  const stepsPerBeat = pattern.subdivision / beats;
  const current = isPlaying ? Math.floor(step / stepsPerBeat) : -1;
  return (
    <Box className={className} role="img" aria-label={isPlaying ? `Pulso ${current + 1} de ${beats}` : `${beats} pulsos por compás`} data-testid="beat-leds" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {Array.from({ length: beats }, (_, i) => (
        <Box
          key={i}
          aria-hidden
          data-active={i === current}
          sx={{
            width: 10, height: 10, borderRadius: '50%',
            bgcolor: i === current ? (i === 0 ? '#ffd54f' : '#e5a95f') : 'rgba(255,255,255,0.22)',
            boxShadow: i === current ? '0 0 8px rgba(229, 169, 95, 0.8)' : 'none',
          }}
        />
      ))}
    </Box>
  );
};
