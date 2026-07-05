import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  IconButton
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SpeedIcon from '@mui/icons-material/Speed';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import CloseIcon from '@mui/icons-material/Close';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';

import Scheduler from './audio/Scheduler';
import type { FormState } from './audio/Scheduler';
import type { AccompanimentStyle } from './audio/PolyphonicSynth';
import AudioContextManager from './audio/AudioContextManager';
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
  const [libraryOpen, setLibraryOpen] = useState(false);

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
  // Formas (Folk Structures) State
  const [formasMode, setFormasMode] = useState(false);
  const [formasGenre, setFormasGenre] = useState<'Chacarera Simple' | 'Chacarera Doble' | 'Zamba' | 'Cueca Norteña' | 'Gato Norteño'>('Chacarera Simple');
  const [formasIntroBars, setFormasIntroBars] = useState<number>(8);
  const [currentFormState, setCurrentFormState] = useState<FormState | null>(null);

  const [activeHarmonyIndex, setActiveHarmonyIndex] = useState<number>(-1);

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

  const calculateTotalSeconds = useCallback(() => {
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
  }, [trainerActive, trainerStep, trainerStart, trainerEnd, trainerBars, currentPattern.timeSignature]);

  const formatSeconds = useCallback((sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${mins} min ${s} seg`;
  }, []);

  const handleTogglePlay = useCallback(async () => {
    if (!schedulerRef.current) return;

    if (isPlaying) {
      schedulerRef.current.stop();
      setIsPlaying(false);
      setActiveHarmonyIndex(-1);
    } else {
      await AudioContextManager.getInstance().resume();
      if (trainerActive) {
        setPracticeTimeSeconds(0);
        setBpm(trainerStart);
      }
      schedulerRef.current.start();
      setIsPlaying(true);
    }
  }, [isPlaying, trainerActive, trainerStart]);

  const handlePreviewSound = useCallback(async (instrument: string) => {
    if (isPlaying) return;
    await AudioContextManager.getInstance().resume();
    schedulerRef.current?.playOneShot(instrument);
  }, [isPlaying]);

  const handleUpdateProgression = useCallback((chords: string[][]) => {
    schedulerRef.current?.setHarmonyProgression(chords);
  }, []);

  const handleHarmonyVolumeChange = useCallback((vol: number) => {
    schedulerRef.current?.setHarmonyVolume(vol);
  }, []);

  const handleAccompanimentStyleChange = useCallback((style: string) => {
    schedulerRef.current?.setAccompanimentStyle(style as AccompanimentStyle);
  }, []);

  const handleChannelVolumeChange = useCallback((channel: string, vol: number) => {
    schedulerRef.current?.setChannelVolume(channel, vol);
  }, []);

  const handleChannelPanChange = useCallback((channel: string, pan: number) => {
    schedulerRef.current?.setChannelPan(channel, pan);
  }, []);

  const handleChannelMuteChange = useCallback((channel: string, muted: boolean) => {
    schedulerRef.current?.setChannelMute(channel, muted);
  }, []);

  useEffect(() => {
    schedulerRef.current = new Scheduler();
    schedulerRef.current.setPattern(currentPattern);

    schedulerRef.current.setOnPlaybackUpdate((step, newBpm, barCount, totalBars, activePattern, formUpdate, chordIndex) => {
      setBpm(newBpm);
      setCurrentStep(step);
      setCurrentBarProgress(barCount);
      setTotalBarsPracticed(totalBars);
      if (activePattern) {
        setCurrentPattern(activePattern);
        setSelectedPatternId(activePattern.id);
      }
      setQueuedPatternId(schedulerRef.current?.getQueuedPatternId() || null);
      setCurrentFormState(formUpdate || null);
      setActiveHarmonyIndex(chordIndex);
    });

    return () => {
      schedulerRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.configureFormas(formasMode, formasGenre, formasIntroBars);
    }
  }, [formasMode, formasGenre, formasIntroBars]);

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
  }, [trainerActive, trainerStart, trainerEnd, trainerBars, trainerStep, trainerMode]);

  const totalEstimatedSeconds = useMemo(() => calculateTotalSeconds(), [calculateTotalSeconds]);

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
  }, [handleTogglePlay]);

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
      if (newPattern.recommendedTempo) {
        setBpm(newPattern.recommendedTempo);
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

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ height: isDesktop ? '100vh' : 'auto', minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', p: 1, bgcolor: '#070605', overflowY: isDesktop ? 'hidden' : 'auto', overflowX: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
        
        <Box className="studio-chassis console-wood-edge" sx={{ width: '100%', height: isDesktop ? '100%' : 'auto', minHeight: isDesktop ? 'none' : '100%', maxWidth: '1440px', display: 'flex', flexDirection: 'column', p: 1.5, boxSizing: 'border-box' }}>
          
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
            <Box sx={{ flex: isDesktop ? '0 0 310px' : 'none', width: isDesktop ? 310 : '100%', height: isDesktop ? '100%' : 'auto', overflowY: isDesktop ? 'auto' : 'visible', pr: isDesktop ? 0.5 : 0 }}>
              <Stack spacing={2} sx={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(229,169,95,0.1)', borderRadius: '2px' } }}>
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
                  onUpdateProgression={handleUpdateProgression}
                  onVolumeChange={handleHarmonyVolumeChange}
                  onStyleChange={handleAccompanimentStyleChange}
                  activeHalfBarIndex={activeHarmonyIndex}
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
                      <Select sx={{ fontSize: '0.75rem' }} value={trainerMode} label="Modo" onChange={(e) => setTrainerMode(e.target.value as 'linear' | 'resistance_loop')}>
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

              {/* MODO FORMAS DE FOLKLORE */}
              <Paper 
                className="brass-trim" 
                sx={{ 
                  p: 1.5, 
                  borderRadius: 3, 
                  bgcolor: '#141210',
                  borderColor: formasMode ? '#e5a95f !important' : 'rgba(229, 169, 95, 0.25) !important',
                  transition: 'border-color 0.3s ease'
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <MusicNoteIcon fontSize="small" color={formasMode ? "primary" : "disabled"} />
                    <Typography variant="caption" fontWeight="900" sx={{ letterSpacing: '0.03em', fontSize: '0.75rem' }}>MODO ESTRUCTURAS (FORMAS)</Typography>
                  </Stack>
                  <Switch 
                    size="small" 
                    checked={formasMode} 
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setFormasMode(enabled);
                      if (enabled) {
                        let matchedPresetId = 'chacarera';
                        if (formasGenre === 'Zamba') matchedPresetId = 'zamba';
                        else if (formasGenre === 'Gato Norteño') matchedPresetId = 'gato';
                        else if (formasGenre === 'Cueca Norteña') matchedPresetId = 'chacarera';
                        loadPreset(matchedPresetId);
                      }
                    }} 
                    color="primary" 
                  />
                </Stack>

                {formasMode && (
                  <Stack spacing={1.2} mt={0.5}>
                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: '0.75rem' }}>Danza</InputLabel>
                      <Select 
                        sx={{ fontSize: '0.75rem' }} 
                        value={formasGenre} 
                        label="Danza" 
                        onChange={(e) => {
                          const val = e.target.value as typeof formasGenre;
                          setFormasGenre(val);
                          
                          let matchedPresetId = 'chacarera';
                          if (val === 'Zamba') {
                            matchedPresetId = 'zamba';
                            setFormasIntroBars(12);
                          } else if (val === 'Cueca Norteña') {
                            matchedPresetId = 'chacarera';
                            setFormasIntroBars(12);
                          } else if (val === 'Gato Norteño') {
                            matchedPresetId = 'gato';
                            setFormasIntroBars(8);
                          } else {
                            setFormasIntroBars(8);
                          }
                          loadPreset(matchedPresetId);
                        }}
                      >
                        <MenuItem value="Chacarera Simple">Chacarera Simple</MenuItem>
                        <MenuItem value="Chacarera Doble">Chacarera Doble</MenuItem>
                        <MenuItem value="Zamba">Zamba</MenuItem>
                        <MenuItem value="Cueca Norteña">Cueca Norteña</MenuItem>
                        <MenuItem value="Gato Norteño">Gato Norteño</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small" fullWidth>
                      <InputLabel sx={{ fontSize: '0.75rem' }}>Compases Intro</InputLabel>
                      <Select 
                        sx={{ fontSize: '0.75rem' }} 
                        value={formasIntroBars} 
                        label="Compases Intro" 
                        onChange={(e) => setFormasIntroBars(Number(e.target.value))}
                      >
                        <MenuItem value={6}>6 Compases</MenuItem>
                        <MenuItem value={8}>8 Compases</MenuItem>
                        {(formasGenre === 'Zamba' || formasGenre === 'Cueca Norteña') && <MenuItem value={9}>9 Compases</MenuItem>}
                        {(formasGenre === 'Zamba' || formasGenre === 'Cueca Norteña') && <MenuItem value={12}>12 Compases</MenuItem>}
                      </Select>
                    </FormControl>

                    {currentFormState && (
                      <Box sx={{ p: 1.2, borderRadius: 1.5, bgcolor: '#0b0908', border: '1px solid rgba(229, 169, 95, 0.12)' }}>
                        <Stack direction="row" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" sx={{ color: '#ff6d00', fontWeight: '900', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
                            {currentFormState.sectionName.toUpperCase()}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#e5a95f', fontWeight: 'bold', fontSize: '0.65rem' }}>
                            PARTE {currentFormState.part === 1 ? '1ra' : '2da'}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ fontFamily: '"Share Tech Mono", monospace', color: '#f4f1ed', fontWeight: 'bold', fontSize: '0.75rem', textAlign: 'center', my: 0.5 }}>
                          Compás {currentFormState.sectionBar + 1} de {currentFormState.sectionTotalBars}
                        </Typography>
                        
                        {/* Progress bar */}
                        <Box sx={{ width: '100%', height: 4, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                          <Box 
                            sx={{ 
                              width: `${((currentFormState.sectionBar + 1) / currentFormState.sectionTotalBars) * 100}%`, 
                              height: '100%', 
                              bgcolor: '#e5a95f',
                              transition: 'width 0.1s linear'
                            }} 
                          />
                        </Box>
                      </Box>
                    )}
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Box>

            {/* CENTER: Pattern Editor (Caja de Ritmos) */}
            <Box sx={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', height: isDesktop ? '100%' : 'auto', overflow: isDesktop ? 'hidden' : 'visible' }}>
              <Paper className="brass-trim" sx={{ p: 1.5, borderRadius: 3, bgcolor: '#141210', display: 'flex', flexDirection: 'column', height: isDesktop ? '100%' : 'auto', overflow: isDesktop ? 'hidden' : 'visible' }}>
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
                    icon={<LibraryMusicIcon style={{ fontSize: '0.9rem', color: '#181512' }} />}
                    label="Explorar Biblioteca"
                    onClick={() => setLibraryOpen(true)}
                    clickable
                    color="primary"
                    sx={{
                      fontFamily: '"Outfit", sans-serif',
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                      px: 0.5,
                      bgcolor: '#e5a95f',
                      color: '#181512',
                      '& .MuiChip-icon': { color: '#181512' }
                    }}
                  />
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
                <Box sx={{ flex: isDesktop ? 1 : 'none', minHeight: 0, overflowY: isDesktop ? 'auto' : 'visible', '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(229,169,95,0.1)', borderRadius: '2px' } }}>
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
            <Box sx={{ flex: isDesktop ? '0 0 280px' : 'none', width: isDesktop ? 280 : '100%', height: isDesktop ? '100%' : 'auto', overflowY: isDesktop ? 'auto' : 'visible', '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(229,169,95,0.1)', borderRadius: '2px' } }}>
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
            onVolumeChange={handleChannelVolumeChange}
            onPanChange={handleChannelPanChange}
            onMuteChange={handleChannelMuteChange}
          />
          
        </Box>

      </Box>

      {/* DIÁLOGO MODAL: BIBLIOTECA RÍTMICA PREMIUM */}
      <Dialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#141210',
            borderRadius: 4,
            border: '1.5px solid rgba(229, 169, 95, 0.2)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
            backgroundImage: 'none'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, borderBottom: '1px solid rgba(229,169,95,0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LibraryMusicIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 'bold', color: 'primary.main' }}>
              Biblioteca Rítmica de la EMPA
            </Typography>
          </Box>
          <IconButton onClick={() => setLibraryOpen(false)} sx={{ color: 'text.secondary', ml: 'auto' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, mt: 1.5 }}>
          <Grid container spacing={2.5}>
            {PRESET_PATTERNS.filter(p => p.id !== 'metronome_4_4').map((p) => {
              const isSelected = selectedPatternId === p.id;
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                  <Box
                    onClick={() => {
                      loadPreset(p.id);
                      setLibraryOpen(false);
                    }}
                    sx={{
                      position: 'relative',
                      height: 180,
                      borderRadius: 3,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #e5a95f' : '1px solid rgba(215,204,200,0.1)',
                      boxShadow: isSelected ? '0 0 15px rgba(229,169,95,0.3)' : '0 4px 12px rgba(0,0,0,0.4)',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: 'primary.main',
                        boxShadow: '0 8px 24px rgba(229,169,95,0.25)'
                      }
                    }}
                  >
                    {/* Imagen de Portada de Fondo */}
                    <Box
                      component="img"
                      src={p.coverImage || '/genres/genre_rock.jpg'}
                      alt={p.name}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 0
                      }}
                    />
                    {/* Degradado oscuro para legibilidad del texto */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(to top, rgba(12,11,10,0.95) 20%, rgba(12,11,10,0.4) 70%, rgba(12,11,10,0.1) 100%)',
                        zIndex: 1
                      }}
                    />

                    {/* Contenido de la Tarjeta */}
                    <Box
                      sx={{
                        position: 'relative',
                        zIndex: 2,
                        height: '100%',
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'end'
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontFamily: '"Outfit", sans-serif', fontWeight: 'bold', color: 'primary.main', mb: 0.2, lineHeight: 1.2 }}>
                        {p.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1, fontSize: '0.68rem', lineHeight: 1.3 }}>
                        {p.description}
                      </Typography>
                      
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          label={`${p.timeSignature[0]}/${p.timeSignature[1]}`}
                          sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(255,255,255,0.08)', color: 'text.primary', border: '1px solid rgba(255,255,255,0.15)' }}
                        />
                        {p.recommendedTempo && (
                          <Chip
                            size="small"
                            label={`${p.recommendedTempo} BPM`}
                            sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(229,169,95,0.12)', color: 'primary.main', border: '1px solid rgba(229,169,95,0.2)' }}
                          />
                        )}
                      </Stack>
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;
