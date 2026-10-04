import React, { useState } from 'react';
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
  MenuItem,
  TextField,
  Tooltip
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SpeedIcon from '@mui/icons-material/Speed';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { CUSTOM_PATTERN_ID } from '../rhythms/patternLibrary';
import { MAX_BPM, MIN_BPM, clampBpm, isCompoundMeter } from '../rhythms/meter';
import type { TimeSignature } from '../rhythms/meter';
import { usePlayback } from '../state/PlaybackContext';
import { shortcutById, withShortcut } from '../shortcuts/registry';
import { usePianoGlobalMode } from '../shortcuts/dispatcher';

export interface HeaderToolbarProps {
  isPlaying: boolean;
  bpm: number;
  timeSignature: TimeSignature;
  onBpmChange: (newBpm: number) => void;
  onTogglePlay: () => void;
  onTapTempo: () => void;
  onOpenLibrary: () => void;
  selectedPatternId: string;
  availablePresets: RhythmPattern[];
  onSelectPreset: (patternId: string) => void;
  /** The speed trainer owns the tempo while it runs. */
  tempoLocked?: boolean;
}

/** Text field that only commits a BPM on blur/Enter, so typing "1" on the way to "120" is harmless. */
const BpmInput: React.FC<{ bpm: number; disabled?: boolean; onCommit: (bpm: number) => void }> = ({ bpm, disabled, onCommit }) => {
  const [draft, setDraft] = useState(String(bpm));
  const [shownBpm, setShownBpm] = useState(bpm);
  if (shownBpm !== bpm) {
    // External tempo change (slider, tap, trainer): reflect it in the field.
    setShownBpm(bpm);
    setDraft(String(bpm));
  }

  const commit = () => {
    const value = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(value)) {
      onCommit(value);
      setDraft(String(clampBpm(value)));
    } else {
      setDraft(String(bpm));
    }
  };

  return (
    <TextField
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      variant="standard"
      slotProps={{
        htmlInput: {
          inputMode: 'numeric',
          'aria-label': 'Tempo en BPM',
          'data-testid': 'bpm-input',
          style: { textAlign: 'center', width: '3.2ch' }
        }
      }}
      sx={{
        '& input': { fontWeight: 900, fontFamily: '"Share Tech Mono", monospace', color: '#e5a95f', fontSize: '1.5rem', lineHeight: 1, p: 0 },
        '& .MuiInput-underline:before': { borderBottomColor: 'transparent' },
      }}
    />
  );
};

export const HeaderToolbar: React.FC<HeaderToolbarProps> = ({
  isPlaying,
  bpm,
  timeSignature,
  onBpmChange,
  onTogglePlay,
  onTapTempo,
  onOpenLibrary,
  selectedPatternId,
  availablePresets,
  onSelectPreset,
  tempoLocked = false
}) => {
  const queuedPatternId = usePlayback(s => s.queuedPatternId);
  const compound = isCompoundMeter(timeSignature);
  const pianoKeysOwnT = usePianoGlobalMode();
  const tapLabel = pianoKeysOwnT ? `Tap tempo (${shortcutById('transport.tap').display} no disponible con Teclado PC)` : withShortcut('Tap tempo', 'transport.tap');

  return (
    <Paper
      component="header"
      className="brass-trim app-header"
      elevation={6}
      sx={{
        p: { xs: 1.5, md: 2 },
        borderRadius: 4,
        display: 'grid',
        alignItems: 'center',
        columnGap: 2,
        rowGap: 1.5,
        // xs/sm: brand + play on top, tempo and library below; md: tempo joins the first row; lg: one row.
        gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', md: 'minmax(0, 1fr) auto auto', lg: 'minmax(0, 1fr) auto auto auto' },
        gridTemplateAreas: {
          xs: '"brand play" "tempo tempo" "lib lib"',
          md: '"brand tempo play" "lib lib lib"',
          lg: '"brand lib tempo play"',
        },
        bgcolor: '#13110f',
        boxShadow: '0 6px 16px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.02)'
      }}
    >
      {/* Title & Queue indicator */}
      <Box className="app-brand" sx={{ gridArea: 'brand', display: 'flex', flexDirection: 'column', gap: 0.2, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1.5}
          useFlexGap
          sx={{
            alignItems: "center",
            flexWrap: "wrap"
          }}>
          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontWeight: "900",
              background: 'linear-gradient(135deg, #ffd54f 0%, #e5a95f 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '0.05em',
              textShadow: '0 2px 10px rgba(229, 169, 95, 0.15)',
              fontFamily: '"Outfit", sans-serif',
              fontSize: { xs: '1.05rem', sm: '1.2rem' }
            }}>
            METRÓNOMO PRO
          </Typography>

          {queuedPatternId && (
            <Box
              role="status"
              data-testid="queued-pattern"
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
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
              }}
            >
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#ff6d00' }} />
              <Typography variant="caption" sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#ff6d00', letterSpacing: '0.06em' }}>
                PRÓXIMO: {availablePresets.find(p => p.id === queuedPatternId)?.name.toUpperCase() || queuedPatternId}
              </Typography>
            </Box>
          )}
        </Stack>

        <Typography
          variant="caption"
          className="app-tagline"
          sx={{
            color: "text.secondary",
            fontSize: '0.68rem',
            letterSpacing: '0.08em',
            fontWeight: 600
          }}>
          ESTUDIO RÍTMICO & ENTRENADOR | BY CUCCO
        </Typography>
      </Box>

      {/* Preset Selector Dropdown & Visual Library Button */}
      <Stack
        className="library-row"
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        useFlexGap
        sx={{
          gridArea: 'lib',
          alignItems: "center",
          minWidth: 0,
        }}>
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
            flexShrink: 0,
            width: { xs: '100%', sm: 'auto' },
            whiteSpace: 'nowrap',
            '&:hover': {
              borderColor: '#e5a95f',
              bgcolor: 'rgba(229,169,95,0.1)'
            }
          }}
        >
          Biblioteca de Ritmos
        </Button>

        <FormControl size="small" sx={{ minWidth: 0, flex: { sm: 1, lg: 'none' }, width: { xs: '100%', lg: 210 } }}>
          <InputLabel id="preset-select-label" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>Ritmo Predefinido</InputLabel>
          <Select
            labelId="preset-select-label"
            value={selectedPatternId}
            label="Ritmo Predefinido"
            onChange={(e) => onSelectPreset(e.target.value)}
            data-testid="preset-select"
            sx={{
              bgcolor: 'rgba(0,0,0,0.4)',
              borderRadius: 2,
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'primary.main',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(229,169,95,0.2)' }
            }}
          >
            <MenuItem value={CUSTOM_PATTERN_ID}><em>Patrón Personalizado (Editor)</em></MenuItem>
            {availablePresets.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {/*
        Tempo + play. Transparent wrapper (display: contents) on wide screens so both keep their own
        grid cell; on a portrait phone adaptive.css turns it into a thumb-reach bar fixed to the bottom.
      */}
      <Box className="transport-bar">
      {/* BPM Controls & Tap Tempo */}
      <Stack
        className="tempo-panel"
        direction="row"
        spacing={{ xs: 1.5, sm: 2 }}
        sx={{
          gridArea: 'tempo',
          alignItems: "center",
          bgcolor: 'rgba(0,0,0,0.3)',
          px: 2,
          py: 0.8,
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.05)',
          minWidth: 0,
        }}>
        {/* Fixed width: "♩ BPM" grows to "♩ BPM · ♩.=67" in compound meters and must not push the slider. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: { xs: 84, sm: 104 }, flexShrink: 0 }}>
          <BpmInput bpm={bpm} disabled={tempoLocked} onCommit={onBpmChange} />
          <Tooltip title={compound ? `En ${timeSignature[0]}/${timeSignature[1]} el pulso con puntillo (♩.) va a ${Math.round(bpm * 2 / 3)}` : 'Pulsos de negra por minuto'}>
            <Typography variant="caption" data-testid="bpm-unit" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 700, letterSpacing: '0.06em', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              ♩ BPM{compound ? ` · ♩.=${Math.round(bpm * 2 / 3)}` : ''}
            </Typography>
          </Tooltip>
        </Box>

        <Slider
          value={bpm}
          min={MIN_BPM}
          max={MAX_BPM}
          disabled={tempoLocked}
          onChange={(_, val) => onBpmChange(val)}
          aria-label="Tempo"
          sx={{
            minWidth: 80,
            width: { lg: 150 },
            flex: { xs: 1, lg: 'none' },
            color: '#e5a95f',
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              boxShadow: '0 0 8px rgba(229,169,95,0.6)'
            }
          }}
        />

        <Tooltip title={tapLabel}>
          <span style={{ display: 'inline-flex' }}>
            <Button
              variant="contained"
              size="small"
              onClick={onTapTempo}
              disabled={tempoLocked}
              startIcon={<SpeedIcon />}
              aria-label={tapLabel}
              sx={{
                bgcolor: 'rgba(229, 169, 95, 0.15)',
                color: '#e5a95f',
                border: '1px solid rgba(229, 169, 95, 0.3)',
                fontWeight: 800,
                fontSize: '0.75rem',
                px: 1.5,
                minWidth: { xs: 64, sm: 75 },
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: 'rgba(229, 169, 95, 0.3)',
                  boxShadow: '0 0 10px rgba(229, 169, 95, 0.3)'
                }
              }}
            >
              TAP
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Main Play / Stop Button */}
      <Button
        variant="contained"
        onClick={onTogglePlay}
        aria-pressed={isPlaying}
        aria-label={withShortcut(isPlaying ? 'Detener' : 'Iniciar', 'transport.play')}
        data-testid="play-toggle"
        className="play-button"
        startIcon={isPlaying ? <StopIcon sx={{ fontSize: 28 }} /> : <PlayArrowIcon sx={{ fontSize: 28 }} />}
        sx={{
          gridArea: 'play',
          height: 52,
          width: { xs: 132, sm: 148, md: 164 },
          px: 2,
          whiteSpace: 'nowrap',
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
        {isPlaying ? 'DETENER' : 'INICIAR'}
      </Button>
      </Box>
    </Paper>
  );
};
