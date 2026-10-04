import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SpeedIcon from '@mui/icons-material/Speed';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { BeatLeds, BpmStepButton } from './TransportControls';

interface CompactTransportProps {
  pattern: RhythmPattern;
  bpm: number;
  isPlaying: boolean;
  tempoLocked?: boolean;
  onTogglePlay: () => void;
  onNudgeBpm: (delta: number) => void;
  onTapTempo: () => void;
  /** The "Vista" control, so layouts stay one tap away while scrolled. */
  viewControl?: React.ReactNode;
}

/**
 * Slim transport bar fixed to the top while the full header is scrolled out of view
 * (desktop, tablet and phones on their side). On a portrait phone the bottom bar already plays that role.
 *
 * (ES) Barra compacta fija: detener, tempo, tap y pulso siempre a mano al bajar por la página.
 */
export const CompactTransport: React.FC<CompactTransportProps> = ({ pattern, bpm, isPlaying, tempoLocked, onTogglePlay, onNudgeBpm, onTapTempo, viewControl }) => (
  <Box
    role="toolbar"
    aria-label="Transporte"
    className="compact-transport"
    data-testid="compact-transport"
    sx={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', gap: 1.5,
      px: 'calc(12px + var(--safe-right, 0px))', pl: 'calc(12px + var(--safe-left, 0px))',
      pt: 'calc(5px + var(--safe-top, 0px))', pb: '5px',
      background: 'linear-gradient(180deg, #1a1612 0%, #100e0c 100%)',
      borderBottom: '1px solid rgba(229, 169, 95, 0.28)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
      '@keyframes compactIn': { from: { transform: 'translateY(-100%)' }, to: { transform: 'none' } },
      animation: 'compactIn 0.18s ease-out',
      '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
    }}
  >
    <Button
      variant="contained"
      onClick={onTogglePlay}
      aria-pressed={isPlaying}
      aria-label={isPlaying ? 'Detener (Espacio)' : 'Iniciar (Espacio)'}
      data-testid="compact-play-toggle"
      startIcon={isPlaying ? <StopIcon /> : <PlayArrowIcon />}
      sx={{
        height: 44, minWidth: 124, px: 2, borderRadius: 2, fontWeight: 900, letterSpacing: '0.08em', fontSize: '0.85rem', whiteSpace: 'nowrap',
        background: isPlaying ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)' : 'linear-gradient(135deg, #ffd54f 0%, #e5a95f 100%)',
        color: isPlaying ? '#fff' : '#181512',
      }}
    >
      {isPlaying ? 'DETENER' : 'INICIAR'}
    </Button>

    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <BpmStepButton direction={-1} onStep={onNudgeBpm} disabled={tempoLocked} size={44} />
      <Typography data-testid="compact-bpm" aria-label={`${bpm} BPM`} sx={{ fontFamily: '"Share Tech Mono", monospace', fontWeight: 900, fontSize: '1.4rem', color: '#e5a95f', minWidth: '3.4ch', textAlign: 'center', lineHeight: 1 }}>
        {bpm}
      </Typography>
      <BpmStepButton direction={1} onStep={onNudgeBpm} disabled={tempoLocked} size={44} />
    </Box>

    <Button
      variant="contained"
      size="small"
      onClick={onTapTempo}
      disabled={tempoLocked}
      startIcon={<SpeedIcon />}
      aria-label="Tap tempo"
      sx={{ height: 44, bgcolor: 'rgba(229, 169, 95, 0.15)', color: '#e5a95f', border: '1px solid rgba(229, 169, 95, 0.3)', fontWeight: 800, boxShadow: 'none', '&:hover': { bgcolor: 'rgba(229, 169, 95, 0.3)', boxShadow: 'none' } }}
    >
      TAP
    </Button>

    <BeatLeds pattern={pattern} isPlaying={isPlaying} />

    <Typography className="compact-transport__name" noWrap sx={{ flex: 1, minWidth: 0, color: 'text.secondary', fontSize: '0.85rem', fontWeight: 600 }}>
      {pattern.name}
    </Typography>
    {viewControl && <Box sx={{ ml: 'auto', flexShrink: 0 }}>{viewControl}</Box>}
  </Box>
);
