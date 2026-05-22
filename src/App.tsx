import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Slider,
  Paper,
  Switch,
  TextField,
  Stack,
  useMediaQuery,
  useTheme,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SpeedIcon from '@mui/icons-material/Speed';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';

import Scheduler from './audio/Scheduler';
import { PRESET_PATTERNS } from './rhythms/RhythmPatterns';
import PatternEditor from './components/PatternEditor';
import ConductorVisual from './components/ConductorVisual';
import StudyTools from './components/StudyTools';
import HarmonyBuilder from './components/HarmonyBuilder'; // Updated Import
import InteractiveInstrumentVisual from './components/InteractiveInstrumentVisual';
import type { RhythmPattern } from './rhythms/RhythmPatterns';
import { MixerConsole } from './components/MixerConsole';

// Dark Theme - Warm Organic Premium
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e5a95f', // Warm Golden Honey / Oak
      contrastText: '#181512',
    },
    secondary: {
      main: '#ff6d00', // Amber Orange / Flame
    },
    background: {
      default: '#0c0b0a', // Rich charcoal dark warm
      paper: '#161412',   // Burned wood warm paper
    },
    text: {
      primary: '#f4f1ed',
      secondary: '#bfae9e',
    },
    divider: 'rgba(215, 204, 200, 0.08)',
  },
  typography: {
    fontFamily: '"Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '4rem', fontWeight: 900, letterSpacing: '-0.02em' },
    h3: { fontSize: '3rem', fontWeight: 800, fontFamily: '"Share Tech Mono", monospace' },
    h5: { fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.05em' },
    subtitle2: { fontWeight: 700 },
  },
  shape: {
    borderRadius: 20,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#161412',
          border: '1px solid rgba(215, 204, 200, 0.06)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        },
      },
    },
  },
});

function App() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [selectedPatternId, setSelectedPatternId] = useState('rock_basic'); // Default to a groove for demo
  const [queuedPatternId, setQueuedPatternId] = useState<string | null>(null);

  // Visualization State
  const [currentStep, setCurrentStep] = useState(0);
  const [currentBarProgress, setCurrentBarProgress] = useState(0);

  // Trainer State
  const [trainerActive, setTrainerActive] = useState(false);
  const [trainerStart, setTrainerStart] = useState(60);
  const [trainerEnd, setTrainerEnd] = useState(120);
  const [trainerBars, setTrainerBars] = useState(4);
  const [trainerStep, setTrainerStep] = useState(5);
  const [trainerMode, setTrainerMode] = useState<'linear' | 'resistance_loop'>('linear');

  // Study State
  const [totalBarsPracticed, setTotalBarsPracticed] = useState(0);

  // Trainer Timing
  const [practiceTimeSeconds, setPracticeTimeSeconds] = useState(0);
  const [totalEstimatedSeconds, setTotalEstimatedSeconds] = useState(0);

  // Active Pattern State
  const [currentPattern, setCurrentPattern] = useState<RhythmPattern>(() => {
    // Default load rock basic
    const p = PRESET_PATTERNS.find(x => x.id === 'rock_basic');
    return p ? { ...p } : PRESET_PATTERNS[0];
  });

  const schedulerRef = useRef<Scheduler | null>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimesRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    schedulerRef.current = new Scheduler();
    schedulerRef.current.setPattern(currentPattern);

    schedulerRef.current.setOnPlaybackUpdate((step, newBpm, barCount, totalBars, activePattern) => {
      setBpm(newBpm);
      setCurrentStep(step);
      setCurrentBarProgress(barCount);
      setTotalBarsPracticed(totalBars);
      if (activePattern) {
        setCurrentPattern(activePattern);
        setSelectedPatternId(activePattern.id);
      }
      setQueuedPatternId(schedulerRef.current?.getQueuedPatternId() || null);
    });

    return () => {
      schedulerRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    schedulerRef.current?.setTempo(bpm);
  }, [bpm]);

  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setPattern(currentPattern);
    }
  }, [currentPattern]);

  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.configureTrainer(trainerActive, trainerStart, trainerEnd, trainerBars, trainerStep, trainerMode);
    }
    const estimated = calculateTotalSeconds();
    setTotalEstimatedSeconds(estimated);
  }, [trainerActive, trainerStart, trainerEnd, trainerBars, trainerStep, currentPattern.timeSignature]);

  // Timer Effect for Practice Countdown
  useEffect(() => {
    if (isPlaying && trainerActive) {
      timerRef.current = window.setInterval(() => {
        setPracticeTimeSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, trainerActive]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const handleTogglePlay = () => {
    if (!schedulerRef.current) return;

    if (isPlaying) {
      schedulerRef.current.stop();
      setIsPlaying(false);
    } else {
      if (trainerActive) {
        setPracticeTimeSeconds(0);
      }
      schedulerRef.current.start();
      setIsPlaying(true);
    }
  };

  const loadPreset = (patternId: string) => {
    let newPattern: RhythmPattern | undefined;

    if (patternId === 'metronome') {
      newPattern = PRESET_PATTERNS.find(p => p.id === 'metronome_4_4');
    } else if (patternId === 'custom') {
      newPattern = {
        id: 'custom',
        name: 'Custom',
        description: '',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['kick', 'snare', 'hihat', 'click'],
        countingMode: 'numbers',
        steps: []
      };
    } else {
      const p = PRESET_PATTERNS.find(x => x.id === patternId);
      if (p) newPattern = { ...p };
    }

    if (newPattern) {
      if (isPlaying) {
        schedulerRef.current?.setPattern(newPattern);
        setQueuedPatternId(schedulerRef.current?.getQueuedPatternId() || null);
      } else {
        setCurrentPattern(newPattern);
        setSelectedPatternId(patternId);
        setQueuedPatternId(null);
      }
    }
  };

  const handleTap = () => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last > 0 && (now - last) < 2000) {
      const diff = now - last;
      tapTimesRef.current.push(diff);
      if (tapTimesRef.current.length > 4) tapTimesRef.current.shift();
      if (tapTimesRef.current.length >= 2) {
        const avg = tapTimesRef.current.reduce((a, b) => a + b, 0) / tapTimesRef.current.length;
        const newBpm = Math.round(60000 / avg);
        if (newBpm >= 40 && newBpm <= 300) setBpm(newBpm);
      }
    } else {
      tapTimesRef.current = [];
    }
    lastTapRef.current = now;
  };

  const handlePreviewSound = (instrument: string) => {
    if (isPlaying) return;
    schedulerRef.current?.playOneShot(instrument);
  };

  const calculateTotalSeconds = () => {
    if (!trainerActive) return 0;
    if (trainerStep === 0) return 0;
    const range = Math.abs(trainerEnd - trainerStart);
    const stepsCount = Math.ceil(range / trainerStep);
    const beatsPerBar = currentPattern.timeSignature[0];
    let totalSeconds = 0;
    let currentBpm = trainerStart;
    const direction = trainerEnd > trainerStart ? 1 : -1;
    for (let i = 0; i <= stepsCount; i++) {
      const segmentTime = (trainerBars * beatsPerBar * 60) / (currentBpm || 60);
      totalSeconds += segmentTime;
      if ((direction === 1 && currentBpm >= trainerEnd) || (direction === -1 && currentBpm <= trainerEnd)) break;
      currentBpm += (trainerStep * direction);
    }
    return totalSeconds;
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${mins} min ${s} seg`;
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', p: 1, bgcolor: '#070605', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
        
        <Box className="studio-chassis console-wood-edge" sx={{ width: '100%', height: '100%', maxWidth: '1440px', display: 'flex', flexDirection: 'column', p: 1.5, boxSizing: 'border-box' }}>
          
          {/* HEADER & GLOBAL CONTROLS */}
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
            {/* Title */}
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
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: '#ff6d00', 
                        fontWeight: '900', 
                        fontSize: '0.6rem', 
                        letterSpacing: '0.08em',
                        fontFamily: '"Outfit", sans-serif'
                      }}
                    >
                      COLA COMPÁS
                    </Typography>
                  </Box>
                )}
              </Stack>
              <Typography variant="caption" sx={{ color: 'rgba(229, 169, 95, 0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.6rem' }}>
                Estudio Académico & Armonía
              </Typography>
            </Box>

            {/* BPM Display & Slider */}
            <Stack direction="row" alignItems="center" spacing={2.5} sx={{ flex: 1, minWidth: 280 }}>
              <Box 
                className="retro-monospaced-screen" 
                sx={{ 
                  textAlign: 'center', 
                  minWidth: 80, 
                  py: 0.5, 
                  px: 1.5, 
                  borderRadius: 2,
                  border: '2px solid rgba(229, 169, 95, 0.4)',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.9), 0 0 8px rgba(229, 169, 95, 0.15)',
                }}
              >
                <Typography variant="h4" fontWeight="bold" sx={{ fontFamily: '"Share Tech Mono", monospace', lineHeight: 1, color: '#e5a95f', textShadow: '0 0 6px rgba(229, 169, 95, 0.8)' }}>
                  {bpm}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(229, 169, 95, 0.65)', fontWeight: 'bold', fontSize: '0.65rem', letterSpacing: '0.1em' }}>BPM</Typography>
              </Box>
              
              <Slider 
                value={bpm} 
                min={40} 
                max={240} 
                onChange={(_, val) => setBpm(val as number)} 
                sx={{ 
                  flex: 1,
                  height: 8,
                  '& .MuiSlider-track': {
                    border: 'none',
                    background: 'linear-gradient(90deg, #ff6d00 0%, #e5a95f 100%)',
                  },
                  '& .MuiSlider-rail': {
                    opacity: 0.35,
                    backgroundColor: '#271f1a',
                    height: 8,
                    borderRadius: 4,
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.9)'
                  },
                  '& .MuiSlider-thumb': {
                    width: 20,
                    height: 32,
                    borderRadius: '3px',
                    backgroundColor: '#f4f1ed',
                    backgroundImage: 'linear-gradient(to right, #cfd8dc 0%, #eceff1 40%, #ffffff 50%, #eceff1 60%, #b0bec5 100%)',
                    border: '2px solid #546e7a',
                    boxShadow: '0 3px 6px rgba(0,0,0,0.75), inset 0 1px 1px #fff',
                    transition: 'transform 0.1s ease',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      width: '2px',
                      height: '100%',
                      backgroundColor: '#e53935',
                      left: 'calc(50% - 1px)',
                      top: 0
                    },
                    '&:hover, &.Mui-focusVisible': {
                      boxShadow: '0 0 0 6px rgba(229, 169, 95, 0.25)',
                      transform: 'scale(1.05)'
                    },
                    '&.Mui-active': {
                      boxShadow: '0 0 0 10px rgba(229, 169, 95, 0.35)',
                      transform: 'scale(1.1)'
                    },
                  },
                }} 
              />
            </Stack>

            {/* Transport */}
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button 
                variant="contained" 
                onClick={handleTap} 
                sx={{ 
                  borderRadius: '50%', 
                  width: 44, 
                  height: 44, 
                  minWidth: 44,
                  fontWeight: '900',
                  fontSize: '0.75rem',
                  border: '2px solid rgba(229, 169, 95, 0.3)',
                  bgcolor: '#1c1815',
                  color: '#e5a95f',
                  boxShadow: '0 3px 5px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)',
                  '&:hover': {
                    bgcolor: '#2d2621',
                    borderColor: '#e5a95f',
                    boxShadow: '0 5px 10px rgba(229, 169, 95, 0.15)'
                  },
                  '&:active': {
                    transform: 'scale(0.95)'
                  }
                }}
              >
                TAP
              </Button>
              <Button
                variant="contained"
                className={isPlaying ? "tactile-button-red" : "tactile-button-amber"}
                onClick={handleTogglePlay}
                startIcon={isPlaying ? <StopIcon sx={{ fontSize: '1.2rem' }} /> : <PlayArrowIcon sx={{ fontSize: '1.2rem' }} />}
                sx={{ 
                  borderRadius: 3, 
                  px: 4, 
                  py: 1,
                  fontSize: '0.9rem',
                  letterSpacing: '0.08em',
                  fontFamily: '"Outfit", sans-serif',
                  fontWeight: '900',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                {isPlaying ? "STOP" : "PLAY"}
              </Button>
            </Stack>
          </Paper>

          {/* MIDDLE SECTION: 3 Columns Grid */}
          <Stack direction={isDesktop ? 'row' : 'column'} spacing={2} sx={{ flex: 1, minHeight: 0, mb: 1.5, alignItems: 'stretch', overflow: 'hidden' }}>

            {/* LEFT: Harmony, Visualizer & Config */}
            <Stack spacing={2} sx={{ flex: '0 0 310px', width: isDesktop ? 310 : '100%', height: '100%', overflowY: 'auto', pr: 0.5, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(229,169,95,0.1)', borderRadius: '2px' } }}>
              {/* Visualizer */}
              <Paper className="brass-trim" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#141210' }}>
                <ConductorVisual
                  pattern={currentPattern}
                  currentStepIndex={currentStep}
                  trainerActive={trainerActive}
                  currentBarProgress={currentBarProgress}
                  totalBarsInterval={trainerBars}
                  bpm={bpm}
                />
              </Paper>

              {/* Harmony Builder */}
              <Box>
                <HarmonyBuilder
                  onUpdateProgression={useCallback((chords) => schedulerRef.current?.setHarmonyProgression(chords), [])}
                  onVolumeChange={useCallback((vol) => schedulerRef.current?.setHarmonyVolume(vol), [])}
                  onStyleChange={useCallback((style) => schedulerRef.current?.setAccompanimentStyle(style), [])}
                />
              </Box>

              {/* Trainer Config */}
              <Paper 
                className="brass-trim" 
                sx={{ 
                  p: 1.5, 
                  borderRadius: 3, 
                  bgcolor: '#141210',
                  borderColor: trainerActive ? '#ff6d00 !important' : 'rgba(229, 169, 95, 0.25) !important',
                  transition: 'border-color 0.3s ease'
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SpeedIcon fontSize="small" color={trainerActive ? "secondary" : "disabled"} />
                    <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: '0.03em', fontSize: '0.75rem' }}>AUTO-ENTRENADOR</Typography>
                  </Stack>
                  <Switch size="small" checked={trainerActive} onChange={(e) => setTrainerActive(e.target.checked)} color="secondary" />
                </Stack>

                {trainerActive && (
                  <Stack spacing={1.2} mt={0.5}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: '0.75rem' }}>Modo</InputLabel>
                      <Select sx={{ fontSize: '0.75rem' }} value={trainerMode} label="Modo" onChange={(e) => setTrainerMode(e.target.value as any)}>
                        <MenuItem value="linear">Lineal</MenuItem>
                        <MenuItem value="resistance_loop">Resistencia (Loop)</MenuItem>
                      </Select>
                    </FormControl>
                    <Stack direction="row" spacing={1}>
                      <TextField label="Inicio" type="number" size="small" inputProps={{ style: { fontSize: '0.75rem', padding: '6px' } }} value={trainerStart} onChange={(e) => setTrainerStart(Number(e.target.value))} />
                      <TextField label="Fin" type="number" size="small" inputProps={{ style: { fontSize: '0.75rem', padding: '6px' } }} value={trainerEnd} onChange={(e) => setTrainerEnd(Number(e.target.value))} />
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <TextField label="Compases" type="number" size="small" inputProps={{ style: { fontSize: '0.75rem', padding: '6px' } }} value={trainerBars} onChange={(e) => setTrainerBars(Number(e.target.value))} />
                      <TextField label="Step" type="number" size="small" inputProps={{ style: { fontSize: '0.75rem', padding: '6px' } }} value={trainerStep} onChange={(e) => setTrainerStep(Number(e.target.value))} />
                    </Stack>
                    <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: '#0b0908', border: '1px solid rgba(229, 169, 95, 0.1)', textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ fontFamily: '"Share Tech Mono", monospace', color: '#e5a95f', fontWeight: 'bold', fontSize: '0.7rem' }}>
                        {isPlaying ? `RESTANTE: ${formatSeconds(Math.max(0, totalEstimatedSeconds - practiceTimeSeconds))}` : `TOTAL: ${formatSeconds(totalEstimatedSeconds)}`}
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Paper>
            </Stack>

            {/* CENTER: Pattern Editor (Caja de Ritmos) */}
            <Box sx={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <Paper className="brass-trim" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#141210', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Presets Row */}
                <Stack 
                  direction="row" 
                  spacing={1} 
                  overflow="auto" 
                  pb={1} 
                  mb={1.5} 
                  sx={{
                    flexShrink: 0,
                    '&::-webkit-scrollbar': { height: '4px' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(229, 169, 95, 0.2)', borderRadius: '2px' }
                  }}
                >
                  <Chip
                    size="small"
                    label="Metrónomo"
                    onClick={() => loadPreset('metronome')}
                    clickable
                    variant={selectedPatternId === 'metronome' ? 'filled' : 'outlined'}
                    color={selectedPatternId === 'metronome' ? 'primary' : 'default'}
                    sx={{
                      fontFamily: '"Outfit", sans-serif',
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                      px: 0.5
                    }}
                  />
                  {PRESET_PATTERNS.filter(p => p.id !== 'metronome_4_4').map(p => {
                    const isSelected = selectedPatternId === p.id;
                    const isQueued = queuedPatternId === p.id;
                    return (
                      <Chip
                        key={p.id}
                        size="small"
                        label={p.name}
                        onClick={() => loadPreset(p.id)}
                        clickable
                        variant={isSelected ? 'filled' : 'outlined'}
                        color={isSelected ? 'primary' : (isQueued ? 'secondary' : 'default')}
                        sx={{
                          fontFamily: '"Outfit", sans-serif',
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                          px: 0.5,
                          ...(isQueued && {
                            '@keyframes pulseGlow': {
                              '0%': { boxShadow: '0 0 0 0 rgba(255, 109, 0, 0.6)', borderColor: '#ff6d00' },
                              '70%': { boxShadow: '0 0 0 6px rgba(255, 109, 0, 0)', borderColor: '#ff6d00' },
                              '100%': { boxShadow: '0 0 0 0 rgba(255, 109, 0, 0)', borderColor: '#ff6d00' }
                            },
                            animation: 'pulseGlow 1.4s infinite ease-in-out',
                            color: '#ff6d00',
                            fontWeight: '900',
                            borderWidth: '1.5px'
                          })
                        }}
                      />
                    );
                  })}
                  <Chip
                    size="small"
                    label="Personalizado"
                    onClick={() => loadPreset('custom')}
                    clickable
                    variant={selectedPatternId === 'custom' ? 'filled' : 'outlined'}
                    color={selectedPatternId === 'custom' ? 'primary' : 'default'}
                    sx={{
                      fontFamily: '"Outfit", sans-serif',
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                      px: 0.5
                    }}
                  />
                </Stack>

                {/* Interactive Wood Instruments Visualizer */}
                <Box sx={{ mb: 1.5, flexShrink: 0 }}>
                  <InteractiveInstrumentVisual
                    pattern={currentPattern}
                    currentStepIndex={currentStep}
                    onPreviewInstrument={handlePreviewSound}
                  />
                </Box>

                {/* Secuenciador Editor - Internally Scrollable if needed */}
                <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(229,169,95,0.1)', borderRadius: '2px' } }}>
                  <PatternEditor
                    pattern={currentPattern}
                    onPatternUpdate={(updated) => setCurrentPattern(updated)}
                    currentStepIndex={currentStep}
                    onPreviewInstrument={handlePreviewSound}
                  />
                </Box>
              </Paper>
            </Box>

            {/* RIGHT: Study Tools (Pomodoro) */}
            <Box sx={{ flex: '0 0 280px', width: isDesktop ? 280 : '100%', height: '100%', overflowY: 'auto', '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(229,169,95,0.1)', borderRadius: '2px' } }}>
              <StudyTools
                onStopRequest={() => {
                  schedulerRef.current?.stop();
                  setIsPlaying(false);
                }}
                totalBarsPracticed={totalBarsPracticed}
              />
            </Box>

          </Stack>

          {/* STUDIO MIXING CONSOLE ROW */}
          <MixerConsole
            pattern={currentPattern}
            currentStep={currentStep}
            isPlaying={isPlaying}
            onVolumeChange={useCallback((channel, vol) => schedulerRef.current?.setChannelVolume(channel, vol), [])}
            onPanChange={useCallback((channel, pan) => schedulerRef.current?.setChannelPan(channel, pan), [])}
            onMuteChange={useCallback((channel, muted) => schedulerRef.current?.setChannelMute(channel, muted), [])}
          />
          
        </Box>

      </Box>
    </ThemeProvider>
  );
}

export default App;
