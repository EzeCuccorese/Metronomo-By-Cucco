import React from 'react';
import {
  Box,
  Button,
  Typography,
  Slider,
  Paper,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SpeedIcon from '@mui/icons-material/Speed';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

export interface HeaderToolbarProps {
  isPlaying: boolean;
  bpm: number;
  onBpmChange: (newBpm: number) => void;
  onTogglePlay: () => void;
  onTapTempo: () => void;
  onOpenLibrary: () => void;
  selectedPatternId: string;
  queuedPatternId: string | null;
  availablePresets: RhythmPattern[];
  onSelectPreset: (patternId: string) => void;
}

export const HeaderToolbar: React.FC<HeaderToolbarProps> = ({
  isPlaying,
  bpm,
  onBpmChange,
  onTogglePlay,
  onTapTempo,
  onOpenLibrary,
  selectedPatternId,
  queuedPatternId,
  availablePresets,
  onSelectPreset
}) => {
  return (
    <Paper 
      className="brass-trim" 
      elevation={6} 
      sx={{ 
        p: 1.5, 
        mb: 1.5, 
        borderRadius: 4, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2.5, 
        bgcolor: '#13110f',
        boxShadow: '0 6px 16px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.02)'
      }}
    >
      {/* Title & Queue indicator */}
      <Box sx={{ mr: 'auto', display: 'flex', flexDirection: 'column', gap: 0.2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography 
            variant="h6" 
            fontWeight="900" 
            sx={{ 
              background: 'linear-gradient(135deg, #ffd54f 0%, #e5a95f 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.05em',
              textShadow: '0 2px 10px rgba(229, 169, 95, 0.15)',
              fontFamily: '"Outfit", sans-serif',
              fontSize: '1.2rem'
            }}
          >
            METRÓNOMO PRO
          </Typography>
          
          {queuedPatternId && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1.2,
                py: 0.2,
                borderRadius: 10,
                backgroundColor: 'rgba(255, 109, 0, 0.12)',
                border: '1.5px solid rgba(255, 109, 0, 0.4)',
                '@keyframes blinkQueue': {
                  '0%, 100%': { opacity: 0.55, transform: 'scale(0.97)' },
                  '50%': { opacity: 1.0, transform: 'scale(1.02)', boxShadow: '0 0 10px rgba(255, 109, 0, 0.4)' }
                },
                animation: 'blinkQueue 0.8s infinite ease-in-out',
              }}
            >
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#ff6d00' }} />
              <Typography variant="caption" sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#ff6d00', letterSpacing: '0.06em' }}>
                PRÓXIMO: {availablePresets.find(p => p.id === queuedPatternId)?.name.toUpperCase() || queuedPatternId}
              </Typography>
            </Box>
          )}
        </Stack>
        
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', letterSpacing: '0.08em', fontWeight: 600 }}>
          ESTUDIO RÍTMICO & ENTRENADOR | BY CUCCO
        </Typography>
      </Box>

      {/* Preset Selector Dropdown & Visual Library Button */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Button
          variant="outlined"
          color="primary"
          startIcon={<LibraryMusicIcon />}
          onClick={onOpenLibrary}
          sx={{
            borderRadius: 2,
            borderColor: 'rgba(229,169,95,0.4)',
            color: '#e5a95f',
            textTransform: 'none',
            fontWeight: 'bold',
            px: 2,
            '&:hover': {
              borderColor: '#e5a95f',
              bgcolor: 'rgba(229,169,95,0.1)'
            }
          }}
        >
          Biblioteca de Ritmos
        </Button>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="preset-select-label" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Ritmo Predefinido</InputLabel>
          <Select
            labelId="preset-select-label"
            value={selectedPatternId}
            label="Ritmo Predefinido"
            onChange={(e) => onSelectPreset(e.target.value)}
            sx={{
              bgcolor: 'rgba(0,0,0,0.4)',
              borderRadius: 2,
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'primary.main',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(229,169,95,0.2)' }
            }}
          >
            <MenuItem value="metronome"><em>Metrónomo Simple (4/4)</em></MenuItem>
            <MenuItem value="custom"><em>Patrón Personalizado (Editor)</em></MenuItem>
            {availablePresets.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/* BPM Controls & Tap Tempo */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ bgcolor: 'rgba(0,0,0,0.3)', px: 2, py: 0.8, borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: '"Share Tech Mono", monospace', color: '#e5a95f', lineHeight: 1 }}>
            {bpm}
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 700, letterSpacing: '0.1em' }}>
            BPM
          </Typography>
        </Box>

        <Slider
          value={bpm}
          min={40}
          max={280}
          onChange={(_, val) => onBpmChange(val as number)}
          sx={{
            width: 110,
            color: '#e5a95f',
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              boxShadow: '0 0 8px rgba(229,169,95,0.6)'
            }
          }}
        />

        <Button
          variant="contained"
          size="small"
          onClick={onTapTempo}
          startIcon={<SpeedIcon />}
          sx={{
            bgcolor: 'rgba(229, 169, 95, 0.15)',
            color: '#e5a95f',
            border: '1px solid rgba(229, 169, 95, 0.3)',
            fontWeight: 800,
            fontSize: '0.75rem',
            px: 1.5,
            minWidth: 75,
            boxShadow: 'none',
            '&:hover': {
              bgcolor: 'rgba(229, 169, 95, 0.3)',
              boxShadow: '0 0 10px rgba(229, 169, 95, 0.3)'
            }
          }}
        >
          TAP
        </Button>
      </Stack>

      {/* Main Play / Stop Button */}
      <Button
        variant="contained"
        onClick={onTogglePlay}
        startIcon={isPlaying ? <StopIcon sx={{ fontSize: 28 }} /> : <PlayArrowIcon sx={{ fontSize: 28 }} />}
        sx={{
          height: 48,
          px: 3.5,
          borderRadius: 3,
          fontWeight: 900,
          fontSize: '0.95rem',
          letterSpacing: '0.08em',
          background: isPlaying 
            ? 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)' 
            : 'linear-gradient(135deg, #ffd54f 0%, #e5a95f 100%)',
          color: isPlaying ? '#ffffff' : '#181512',
          boxShadow: isPlaying 
            ? '0 0 20px rgba(211, 47, 47, 0.5)' 
            : '0 0 20px rgba(229, 169, 95, 0.4)',
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            transform: 'scale(1.03)',
            background: isPlaying 
              ? 'linear-gradient(135deg, #f44336 0%, #c62828 100%)' 
              : 'linear-gradient(135deg, #ffe082 0%, #ffb74d 100%)',
          }
        }}
      >
        {isPlaying ? 'PAUSAR' : 'INICIAR'}
      </Button>
    </Paper>
  );
};
