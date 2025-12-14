import { useState, useEffect, useRef } from 'react';
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
  Chip
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
import type { RhythmPattern, RhythmStep } from './rhythms/RhythmPatterns';

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
  // Responsive: lg for 3 columns, md for 2, sm for 1
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));


  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [selectedPatternId, setSelectedPatternId] = useState('metronome_4_4');

  // Visualization State
  const [currentStep, setCurrentStep] = useState(0);
  const [currentBarProgress, setCurrentBarProgress] = useState(0);

  // Trainer State
  const [trainerActive, setTrainerActive] = useState(false);
  const [trainerStart, setTrainerStart] = useState(60);
  const [trainerEnd, setTrainerEnd] = useState(120);
  const [trainerBars, setTrainerBars] = useState(4);
  const [trainerStep, setTrainerStep] = useState(5);

  // Trainer Timing
  const [practiceTimeSeconds, setPracticeTimeSeconds] = useState(0); // Elapsed
  const [totalEstimatedSeconds, setTotalEstimatedSeconds] = useState(0);

  // Active Pattern State
  const [currentPattern, setCurrentPattern] = useState<RhythmPattern>(() => {
    // Default to Metronome 4/4
    return {
      id: 'metronome_4_4',
      name: 'Metrónomo Básico',
      description: 'Click simple',
      timeSignature: [4, 4],
      subdivision: 4,
      instruments: ['click'],
      steps: [
        { step: 1, instrument: 'click', velocity: 1.0 },
        { step: 2, instrument: 'click', velocity: 0.5 },
        { step: 3, instrument: 'click', velocity: 0.5 },
        { step: 4, instrument: 'click', velocity: 0.5 }
      ]
    };
  });

  const schedulerRef = useRef<Scheduler | null>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimesRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    schedulerRef.current = new Scheduler();
    schedulerRef.current.setPattern(currentPattern);

    schedulerRef.current.setOnPlaybackUpdate((step, newBpm, barCount) => {
      setBpm(newBpm);
      setCurrentStep(step);
      setCurrentBarProgress(barCount);
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
      schedulerRef.current.configureTrainer(trainerActive, trainerStart, trainerEnd, trainerBars, trainerStep);
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

  const handleTogglePlay = () => {
    if (isPlaying) {
      schedulerRef.current?.stop();
      setIsPlaying(false);
    } else {
      if (trainerActive) {
        setPracticeTimeSeconds(0);
      }
      schedulerRef.current?.start();
      setIsPlaying(true);
    }
  };

  const generateMetronomePattern = (sub: number, timeSignature: [number, number] = [4, 4]): RhythmPattern => {
    const cleanSteps: RhythmStep[] = [];
    const beats = timeSignature[0];
    const stepsPerBeat = sub / beats;

    for (let i = 1; i <= sub; i++) {
      let vel = 0.5;
      // Logic for clicks: Accent on beat 1, normal on other beats, ghost on subdivisions?
      // Metronome usually just clicks on BEATS.
      const isBeat = (i - 1) % stepsPerBeat === 0;

      if (isBeat) {
        const beatIndex = (i - 1) / stepsPerBeat;
        vel = beatIndex === 0 ? 1.0 : 0.7; // Strong 1, Med others
        cleanSteps.push({ step: i, instrument: 'click', velocity: vel });
      }
      // Subdivisions? Optional. Keep simple for "Metronome" preset.
    }

    return {
      id: `metronome`,
      name: `Metrónomo ${timeSignature[0]}/${timeSignature[1]}`,
      description: 'Click',
      timeSignature: timeSignature,
      subdivision: sub,
      instruments: ['click'],
      steps: cleanSteps
    };
  };

  const loadPreset = (patternId: string) => {
    setSelectedPatternId(patternId);
    let newPattern: RhythmPattern | undefined;

    if (patternId === 'metronome_4_4') {
      newPattern = generateMetronomePattern(4, [4, 4]);
    } else if (patternId === 'custom') {
      // Basic custom template
      newPattern = {
        id: 'custom',
        name: 'Custom',
        description: '',
        timeSignature: [4, 4],
        subdivision: 16,
        instruments: ['kick', 'snare', 'hihat_closed', 'click'],
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

  const calculateTotalSeconds = () => {
    if (!trainerActive) return 0;
    if (trainerStep === 0) return 0;

    const range = Math.abs(trainerEnd - trainerStart);
    const stepsCount = Math.ceil(range / trainerStep);
    const beatsPerBar = currentPattern.timeSignature[0];

    let totalSeconds = 0;
    let currentBpm = trainerStart;
    const direction = trainerEnd > trainerStart ? 1 : -1;

    // Simple approximation
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
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', p: 4, overflowX: 'hidden' }}>

        <Typography variant="h4" component="h1" fontWeight="900" sx={{ color: 'primary.main', mb: 3, textAlign: 'left' }}>
          METRÓNOMO PRO
        </Typography>

        {/* 3 COLUMN LAYOUT */}
        <Stack direction={isDesktop ? 'row' : 'column'} spacing={4} alignItems="flex-start" sx={{ width: '100%' }}>

          {/* LEFT COLUMN: Controls */}
          <Box sx={{ flex: '0 0 320px', width: isDesktop ? 320 : '100%' }}>
            <Paper sx={{ p: 4, borderRadius: 4, bgcolor: '#1e1e1e' }}>

              {/* BPM */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
                <Box sx={{
                  width: 180, height: 180, borderRadius: '50%', border: '6px solid #222',
                  display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center',
                  boxShadow: isPlaying ? '0 0 50px rgba(144, 202, 249, 0.15)' : 'none',
                  background: '#121212',
                  mb: 3
                }}>
                  <Typography variant="h2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {bpm}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">BPM</Typography>
                </Box>

                <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
                  <Button variant="outlined" color="secondary" fullWidth onClick={handleTap} sx={{ borderRadius: 8, height: 48 }}>
                    PULSAR
                  </Button>
                  <Button
                    variant="contained" fullWidth
                    color={isPlaying ? "error" : "primary"}
                    onClick={handleTogglePlay}
                    startIcon={isPlaying ? <StopIcon /> : <PlayArrowIcon />}
                    sx={{ borderRadius: 8, height: 48, fontSize: '1.1rem' }}
                  >
                    {isPlaying ? "STOP" : "START"}
                  </Button>
                </Stack>
              </Box>

              <Slider value={bpm} min={40} max={240} onChange={(_, val) => setBpm(val as number)} sx={{ mb: 4 }} />

              <Typography variant="overline" color="text.secondary" display="block" mb={1}>MODO DE RITMO</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} mb={4}>
                <Chip label="Metrónomo" onClick={() => loadPreset('metronome_4_4')}
                  color={selectedPatternId === 'metronome_4_4' ? 'primary' : 'default'} variant={selectedPatternId === 'metronome_4_4' ? 'filled' : 'outlined'} clickable />
                {PRESET_PATTERNS.slice(0, 3).map(p => (
                  <Chip key={p.id} label={p.name} onClick={() => loadPreset(p.id)}
                    color={selectedPatternId === p.id ? 'primary' : 'default'} variant={selectedPatternId === p.id ? 'filled' : 'outlined'} clickable />
                ))}
                <Chip label="Custom" onClick={() => loadPreset('custom')}
                  color={selectedPatternId === 'custom' ? 'secondary' : 'default'} variant={selectedPatternId === 'custom' ? 'filled' : 'outlined'} clickable />
              </Stack>

              {/* TRAINER SETTINGS */}
              <Paper variant="outlined" sx={{
                p: 2, borderRadius: 3,
                borderColor: trainerActive ? 'secondary.main' : 'rgba(255,255,255,0.1)',
                bgcolor: trainerActive ? 'rgba(244, 143, 177, 0.05)' : 'transparent',
              }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SpeedIcon fontSize="small" color={trainerActive ? "secondary" : "disabled"} />
                    <Typography variant="subtitle2" fontWeight="bold">ENTRENADOR</Typography>
                  </Stack>
                  <Switch size="small" checked={trainerActive} onChange={(e) => setTrainerActive(e.target.checked)} color="secondary" />
                </Stack>

                <Stack spacing={2}>
                  <Stack direction="row" spacing={2}>
                    <TextField label="Inicio" type="number" size="small" disabled={!trainerActive}
                      value={trainerStart} onChange={(e) => setTrainerStart(Number(e.target.value))} />
                    <TextField label="Fin" type="number" size="small" disabled={!trainerActive}
                      value={trainerEnd} onChange={(e) => setTrainerEnd(Number(e.target.value))} />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField label="Compases" type="number" size="small" disabled={!trainerActive}
                      value={trainerBars} onChange={(e) => setTrainerBars(Number(e.target.value))} />
                    <TextField label="Step (BPM)" type="number" size="small" disabled={!trainerActive}
                      value={trainerStep} onChange={(e) => setTrainerStep(Number(e.target.value))} />
                  </Stack>
                  {trainerActive && (
                    <Box sx={{ borderRadius: 2, bgcolor: 'rgba(0,0,0,0.3)', p: 1, textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">TIEMPO {isPlaying ? 'RESTANTE' : 'ESTIMADO'}</Typography>
                      <Typography variant="h6" color="white" fontWeight="bold">
                        {formatSeconds(Math.max(0, totalEstimatedSeconds - practiceTimeSeconds))}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Paper>

            </Paper>
          </Box>

          {/* MIDDLE COLUMN: Editor */}
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            {/* Conductor Visual */}
            <Box sx={{ mb: 3 }}>
              <ConductorVisual
                subdivision={currentPattern.subdivision}
                timeSignature={currentPattern.timeSignature}
                currentStepIndex={currentStep}
                trainerActive={trainerActive}
                currentBarProgress={currentBarProgress}
                totalBarsInterval={trainerBars}
              />
            </Box>

            {/* Pattern Editor */}
            <PatternEditor
              pattern={currentPattern}
              onPatternUpdate={(updated) => setCurrentPattern(updated)}
              currentStepIndex={currentStep}
            />
          </Box>

          {/* RIGHT COLUMN: Study Tools */}
          <Box sx={{ flex: '0 0 300px', width: isDesktop ? 300 : '100%' }}>
            <StudyTools />
          </Box>

        </Stack>
      </Box>
    </ThemeProvider>
  );
}

export default App;
