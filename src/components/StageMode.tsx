import React from 'react';
import { Box, Button, Dialog, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { usePlayback } from '../state/PlaybackContext';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { exitFullscreen, useFullscreen } from '../hooks/useFullscreen';
import { usePersistentState } from '../hooks/usePersistentState';
import { isNumber, isPlainObject, isString } from '../state/storage';
import { noteToMidi, spanishNoteName } from '../audio/piano/notes';
import { BpmStepButton } from './TransportControls';

interface ChordStep { degree: string; durationUnits: number; notes: string[] }
const isChordSequence = (v: unknown): v is ChordStep[] =>
  Array.isArray(v) && v.every(c => isPlainObject(c) && isString(c.degree) && isNumber(c.durationUnits) && Array.isArray(c.notes) && c.notes.every(isString));

/** The chord of the harmony that is sounding ("V · Sol"), read from the saved progression. */
function chordLabelAt(sequence: ChordStep[], halfBarIndex: number): string | null {
  if (halfBarIndex < 0) return null;
  let acc = 0;
  for (const step of sequence) {
    acc += step.durationUnits;
    if (halfBarIndex < acc) {
      const root = step.notes[0] ? noteToMidi(step.notes[0]) : null;
      return root === null ? step.degree : `${step.degree} · ${spanishNoteName(root)}`;
    }
  }
  return null;
}

interface StageModeProps {
  open: boolean;
  onClose: () => void;
  pattern: RhythmPattern;
  bpm: number;
  isPlaying: boolean;
  tempoLocked?: boolean;
  onTogglePlay: () => void;
  onNudgeBpm: (delta: number) => void;
}

/**
 * Music-stand view: a giant pulse and tempo, readable from a couple of metres, with only the controls needed
 * to start, stop and nudge the tempo. Fullscreen where the browser can do it (not on iPhone).
 * Reduced motion: no flashing, the lit beat just changes colour and size.
 *
 * (ES) Modo escenario / atril: pulso y BPM gigantes. Pantalla completa solo donde existe.
 */
/** The stage itself: only mounted while it is open, so the pulse subscriptions cost nothing the rest of the time. */
const StageContent: React.FC<Omit<StageModeProps, 'open'>> = ({ onClose, pattern, bpm, isPlaying, tempoLocked, onTogglePlay, onNudgeBpm }) => {
  const fullscreen = useFullscreen();
  const step = usePlayback(s => s.step);
  const reduceMotion = usePrefersReducedMotion();
  const [sequence] = usePersistentState<ChordStep[]>('harmony.sequence', [], isChordSequence);
  const chordIndex = usePlayback(s => s.chordIndex);
  const chordLabel = isPlaying ? chordLabelAt(sequence, chordIndex) : null;

  const beats = pattern.timeSignature[0];
  const stepsPerBeat = pattern.subdivision / beats;
  // Wraps, so a transient out-of-range step can never read "Pulso 5 de 4".
  const current = isPlaying && beats > 0 ? Math.floor(step / stepsPerBeat) % beats : -1;
  const downbeat = current === 0;

  const close = () => {
    void exitFullscreen();
    onClose();
  };

  return (
    <>
      <Box
        data-downbeat={downbeat}
        sx={{
          height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
          pt: 'calc(8px + env(safe-area-inset-top, 0px))', pb: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          pl: 'calc(16px + env(safe-area-inset-left, 0px))', pr: 'calc(16px + env(safe-area-inset-right, 0px))',
          // The screen flashes softly on the downbeat; with reduced motion only the circles change.
          bgcolor: downbeat && !reduceMotion ? '#1d1509' : '#070605',
          transition: reduceMotion ? 'none' : 'background-color 0.12s ease-out',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {fullscreen.supported && (
            <IconButton aria-label={fullscreen.active ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={() => { void (fullscreen.active ? fullscreen.exit() : fullscreen.enter()); }} sx={{ color: 'text.secondary', minWidth: 44, minHeight: 44 }}>
              {fullscreen.active ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          )}
          <Button onClick={close} startIcon={<CloseIcon />} aria-label="Salir del modo escenario" data-testid="stage-close" sx={{ color: 'text.secondary', minHeight: 44, textTransform: 'none' }}>
            Salir
          </Button>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'min(2.5vmin, 20px)', textAlign: 'center' }}>
          <Box role="img" aria-label={isPlaying ? `Pulso ${current + 1} de ${beats}` : `${beats} pulsos por compás`} data-testid="stage-beats" sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 'min(3vmin, 28px)' }}>
            {Array.from({ length: beats }, (_, i) => {
              const lit = i === current;
              const size = `clamp(36px, ${Math.min(16, 90 / beats)}vmin, 140px)`;
              return (
                <Box
                  key={i}
                  aria-hidden
                  data-active={lit}
                  sx={{
                    width: size, height: size, borderRadius: '50%',
                    bgcolor: lit ? (i === 0 ? '#ffd54f' : '#e5a95f') : 'rgba(255,255,255,0.14)',
                    boxShadow: lit && !reduceMotion ? '0 0 40px rgba(229, 169, 95, 0.7)' : 'none',
                    transform: lit ? 'scale(1.12)' : 'none',
                    transition: reduceMotion ? 'none' : 'background-color 0.06s, transform 0.06s',
                  }}
                />
              );
            })}
          </Box>

          <Typography data-testid="stage-bpm" aria-label={`${bpm} BPM`} sx={{ fontFamily: '"Share Tech Mono", monospace', fontWeight: 900, color: '#e5a95f', lineHeight: 1, fontSize: 'clamp(80px, 30vmin, 340px)' }}>
            {bpm}
          </Typography>
          <Typography sx={{ color: 'text.primary', fontWeight: 700, fontSize: 'clamp(18px, 4.5vmin, 44px)' }}>
            {pattern.name}
          </Typography>
          {chordLabel && (
            <Typography data-testid="stage-chord" sx={{ color: '#ffd54f', fontWeight: 800, fontSize: 'clamp(28px, 8vmin, 84px)', lineHeight: 1.1 }}>
              {chordLabel}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'min(4vmin, 32px)' }}>
          <BpmStepButton direction={-1} onStep={onNudgeBpm} disabled={tempoLocked} size={64} testId="stage-bpm-down" />
          <Button
            variant="contained"
            onClick={onTogglePlay}
            aria-pressed={isPlaying}
            aria-label={isPlaying ? 'Detener (Espacio)' : 'Iniciar (Espacio)'}
            data-testid="stage-play-toggle"
            startIcon={isPlaying ? <StopIcon sx={{ fontSize: 32 }} /> : <PlayArrowIcon sx={{ fontSize: 32 }} />}
            sx={{
              height: 72, flex: 1, minWidth: 0, maxWidth: 320, borderRadius: 3, fontWeight: 900, fontSize: '1.2rem', letterSpacing: '0.08em',
              background: isPlaying ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)' : 'linear-gradient(135deg, #ffd54f 0%, #e5a95f 100%)',
              color: isPlaying ? '#fff' : '#181512',
            }}
          >
            {isPlaying ? 'DETENER' : 'INICIAR'}
          </Button>
          <BpmStepButton direction={1} onStep={onNudgeBpm} disabled={tempoLocked} size={64} testId="stage-bpm-up" />
        </Box>
      </Box>
    </>
  );
};

export const StageMode: React.FC<StageModeProps> = ({ open, onClose, ...rest }) => (
  <Dialog
    fullScreen
    open={open}
    onClose={() => { void exitFullscreen(); onClose(); }}
    slotProps={{ paper: { 'data-testid': 'stage-mode', 'aria-label': 'Modo escenario' } as never }}
    sx={{ '& .MuiDialog-paper': { bgcolor: '#070605', backgroundImage: 'none' } }}
  >
    {open && <StageContent onClose={onClose} {...rest} />}
  </Dialog>
);
