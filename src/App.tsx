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

import Scheduler from './audio/Scheduler';
import { PRESET_PATTERNS } from './rhythms/RhythmPatterns';
import PatternEditor from './components/PatternEditor';
import ConductorVisual from './components/ConductorVisual';
import StudyTools from './components/StudyTools';
import HarmonyBuilder from './components/HarmonyBuilder'; // Updated Import
import type { RhythmPattern } from './rhythms/RhythmPatterns';

// Dark Theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#90caf9' },
    secondary: { main: '#f48fb1' },
    background: { default: '#0a0a0a', paper: '#1e1e1e' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '4rem', fontWeight: 700 },
  },
  shape: {
    borderRadius: 16,
  },
});

function App() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [selectedPatternId, setSelectedPatternId] = useState('rock_basic'); // Default to a groove for demo

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

    schedulerRef.current.setOnPlaybackUpdate((step, newBpm, barCount, totalBars) => {
      setBpm(newBpm);
      setCurrentStep(step);
      setCurrentBarProgress(barCount);
      setTotalBarsPracticed(totalBars);
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
    setSelectedPatternId(patternId);
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
    if (newPattern) setCurrentPattern(newPattern);
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
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', p: 3, overflowX: 'hidden' }}>

        {/* HEADER & GLOBAL CONTROLS */}
        <Paper elevation={3} sx={{ p: 2, mb: 3, borderRadius: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
          {/* Title */}
          <Box sx={{ mr: 'auto' }}>
            <Typography variant="h5" fontWeight="900" color="primary">METRÓNOMO PRO</Typography>
            <Typography variant="caption" color="text.secondary">Estudio & Armonía</Typography>
          </Box>

          {/* BPM Display & Slider */}
          <Stack direction="row" alignItems="center" spacing={3} sx={{ flex: 1, minWidth: 300 }}>
            <Box sx={{ textAlign: 'center', minWidth: 80 }}>
              <Typography variant="h3" fontWeight="bold" sx={{ fontFamily: 'monospace', lineHeight: 1 }}>{bpm}</Typography>
              <Typography variant="caption" color="text.secondary">BPM</Typography>
            </Box>
            <Slider value={bpm} min={40} max={240} onChange={(_, val) => setBpm(val as number)} sx={{ flex: 1 }} />
          </Stack>

          {/* Transport */}
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" color="secondary" onClick={handleTap} sx={{ borderRadius: 8 }}>TAP</Button>
            <Button
              variant="contained"
              color={isPlaying ? "error" : "primary"}
              onClick={handleTogglePlay}
              startIcon={isPlaying ? <StopIcon /> : <PlayArrowIcon />}
              sx={{ borderRadius: 8, px: 4, fontWeight: 'bold' }}
            >
              {isPlaying ? "STOP" : "PLAY"}
            </Button>
          </Stack>
        </Paper>

        {/* MIDDLE SECTION: 3 Columns */}
        <Stack direction={isDesktop ? 'row' : 'column'} spacing={3} sx={{ flex: 1, mb: 3, alignItems: 'flex-start' }}>

          {/* LEFT: Harmony, Visualizer & Config */}
          <Stack spacing={3} sx={{ flex: '0 0 340px', width: isDesktop ? 340 : '100%' }}>
            {/* Visualizer */}
            <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#1e1e1e' }}>
              <ConductorVisual
                pattern={currentPattern}
                currentStepIndex={currentStep}
                trainerActive={trainerActive}
                currentBarProgress={currentBarProgress}
                totalBarsInterval={trainerBars}
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

            {/* Trainer Config (Collapsed or Small) */}
            <Paper sx={{ p: 2, borderRadius: 3, borderColor: trainerActive ? 'secondary.main' : 'rgba(255,255,255,0.1)', border: '1px solid' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <SpeedIcon fontSize="small" color={trainerActive ? "secondary" : "disabled"} />
                  <Typography variant="subtitle2" fontWeight="bold">Auto-Speed</Typography>
                </Stack>
                <Switch size="small" checked={trainerActive} onChange={(e) => setTrainerActive(e.target.checked)} color="secondary" />
              </Stack>

              {trainerActive && (
                <Stack spacing={2} mt={1}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Modo</InputLabel>
                    <Select value={trainerMode} label="Modo" onChange={(e) => setTrainerMode(e.target.value as any)}>
                      <MenuItem value="linear">Lineal</MenuItem>
                      <MenuItem value="resistance_loop">Resistencia (Loop)</MenuItem>
                    </Select>
                  </FormControl>
                  <Stack direction="row" spacing={1}>
                    <TextField label="Inicio" type="number" size="small" value={trainerStart} onChange={(e) => setTrainerStart(Number(e.target.value))} />
                    <TextField label="Fin" type="number" size="small" value={trainerEnd} onChange={(e) => setTrainerEnd(Number(e.target.value))} />
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <TextField label="Compases" type="number" size="small" value={trainerBars} onChange={(e) => setTrainerBars(Number(e.target.value))} />
                    <TextField label="Step" type="number" size="small" value={trainerStep} onChange={(e) => setTrainerStep(Number(e.target.value))} />
                  </Stack>
                  <Typography variant="caption" align="center" display="block">
                    {isPlaying ? `Restante: ${formatSeconds(Math.max(0, totalEstimatedSeconds - practiceTimeSeconds))}` : `Estimado: ${formatSeconds(totalEstimatedSeconds)}`}
                  </Typography>
                </Stack>
              )}
            </Paper>
          </Stack>

          {/* CENTER: Pattern Editor (Caja de Ritmos) */}
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#1e1e1e' }}>
              <Stack direction="row" spacing={2} overflow="auto" pb={1} mb={2}>
                <Chip label="Metrónomo" onClick={() => loadPreset('metronome')} clickable variant={selectedPatternId === 'metronome' ? 'filled' : 'outlined'} />
                {PRESET_PATTERNS.slice(0, 5).map(p => (
                  <Chip key={p.id} label={p.name} onClick={() => loadPreset(p.id)} clickable variant={selectedPatternId === p.id ? 'filled' : 'outlined'} />
                ))}
                <Chip label="Custom" onClick={() => loadPreset('custom')} clickable variant={selectedPatternId === 'custom' ? 'filled' : 'outlined'} />
              </Stack>

              <PatternEditor
                pattern={currentPattern}
                onPatternUpdate={(updated) => setCurrentPattern(updated)}
                currentStepIndex={currentStep}
                onPreviewInstrument={handlePreviewSound}
              />
            </Paper>
          </Box>

          {/* RIGHT: Study Tools (Pomodoro) */}
          <Box sx={{ flex: '0 0 300px', width: isDesktop ? 300 : '100%' }}>
            <StudyTools
              onStopRequest={() => {
                schedulerRef.current?.stop();
                setIsPlaying(false);
              }}
              totalBarsPracticed={totalBarsPracticed}
            />
          </Box>

        </Stack>

      </Box>
    </ThemeProvider>
  );
}

export default App;
