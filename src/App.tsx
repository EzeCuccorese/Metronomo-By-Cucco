import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Grid
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
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
import HarmonyBuilder from './components/HarmonyBuilder';
import InteractiveInstrumentVisual from './components/InteractiveInstrumentVisual';
import type { RhythmPattern } from './rhythms/RhythmPatterns';
import { MixerConsole } from './components/MixerConsole';
import { darkTheme } from './theme/darkTheme';
import { HeaderToolbar } from './components/HeaderToolbar';
import { GenreSelectorModal } from './components/GenreSelectorModal';

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [selectedPatternId, setSelectedPatternId] = useState('rock_basic');
  const [queuedPatternId, setQueuedPatternId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Visualization State
  const [currentStep, setCurrentStep] = useState(0);
  const [currentBarProgress, setCurrentBarProgress] = useState(0);

  // Trainer State
  const [trainerActive] = useState(false);
  const [trainerStart] = useState(60);
  const [trainerEnd] = useState(120);
  const [trainerBars] = useState(4);
  const [trainerStep] = useState(5);
  const [trainerMode] = useState<'linear' | 'resistance_loop'>('linear');

  // Study State
  const [totalBarsPracticed, setTotalBarsPracticed] = useState(0);

  // Formas (Folk Structures) State
  const [formasMode] = useState(false);
  const [formasGenre] = useState<'Chacarera Simple' | 'Chacarera Doble' | 'Zamba' | 'Cueca Norteña' | 'Gato Norteño'>('Chacarera Simple');
  const [formasIntroBars] = useState<number>(8);
  const [, setCurrentFormState] = useState<FormState | null>(null);

  const [activeHarmonyIndex, setActiveHarmonyIndex] = useState<number>(-1);

  // Active Pattern State
  const [currentPattern, setCurrentPattern] = useState<RhythmPattern>(() => {
    const p = PRESET_PATTERNS.find(x => x.id === 'rock_basic');
    return p ? { ...p } : PRESET_PATTERNS[0];
  });

  const schedulerRef = useRef<Scheduler | null>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimesRef = useRef<number[]>([]);

  const handleTogglePlay = useCallback(async () => {
    if (!schedulerRef.current) return;

    if (isPlaying) {
      schedulerRef.current.stop();
      setIsPlaying(false);
      setActiveHarmonyIndex(-1);
    } else {
      await AudioContextManager.getInstance().resume();
      if (trainerActive) {
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
      <Box sx={{ minHeight: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', p: { xs: 1, md: 2 }, bgcolor: '#070605', overflowY: 'auto', overflowX: 'hidden', alignItems: 'center' }}>
        
        <Box className="studio-chassis console-wood-edge" sx={{ width: '100%', maxWidth: '1440px', display: 'flex', flexDirection: 'column', p: 1.5, boxSizing: 'border-box' }}>
          
          {/* HEADER & GLOBAL CONTROLS */}
          <HeaderToolbar
            isPlaying={isPlaying}
            bpm={bpm}
            onBpmChange={setBpm}
            onTogglePlay={handleTogglePlay}
            onTapTempo={handleTap}
            onOpenLibrary={() => setLibraryOpen(true)}
            selectedPatternId={selectedPatternId}
            queuedPatternId={queuedPatternId}
            availablePresets={PRESET_PATTERNS}
            onSelectPreset={loadPreset}
          />

          {/* MAIN DASHBOARD CONTENT */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, width: '100%' }}>
            <Grid container spacing={1.5} sx={{ width: '100%' }}>
              
              {/* LEFT COLUMN: Visualizer & Mixer */}
              <Grid size={{ xs: 12, lg: 7 }} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <InteractiveInstrumentVisual 
                  pattern={currentPattern}
                  currentStepIndex={isPlaying ? currentStep : undefined}
                  onPreviewInstrument={handlePreviewSound}
                />
                
                <Box sx={{ flex: 1, minHeight: 320 }}>
                  <MixerConsole 
                    pattern={currentPattern}
                    currentStep={currentStep}
                    isPlaying={isPlaying}
                    onVolumeChange={handleChannelVolumeChange}
                    onPanChange={handleChannelPanChange}
                    onMuteChange={handleChannelMuteChange}
                  />
                </Box>
              </Grid>

              {/* RIGHT COLUMN: Sequencer & Practice Tools */}
              <Grid size={{ xs: 12, lg: 5 }} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                
                {/* 1. Visual Conductor Metronome */}
                <ConductorVisual 
                  pattern={currentPattern}
                  currentStepIndex={currentStep}
                  trainerActive={trainerActive}
                  currentBarProgress={currentBarProgress}
                  totalBarsInterval={trainerBars}
                  bpm={bpm}
                />

                {/* 2. Pattern Sequencer Editor */}
                <PatternEditor 
                  pattern={currentPattern}
                  onPatternUpdate={setCurrentPattern}
                  currentStepIndex={isPlaying ? currentStep : undefined}
                />

                {/* 3. Harmony Sequencer Builder */}
                <HarmonyBuilder 
                  onUpdateProgression={handleUpdateProgression}
                  onVolumeChange={handleHarmonyVolumeChange}
                  onStyleChange={handleAccompanimentStyleChange}
                  activeHalfBarIndex={activeHarmonyIndex}
                />

                {/* 4. Study Tools & Tracker */}
                <StudyTools 
                  totalBarsPracticed={totalBarsPracticed}
                />
              </Grid>

            </Grid>
          </Box>

        </Box>

      </Box>

      {/* Library Dialog Modal */}
      <GenreSelectorModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        selectedPatternId={selectedPatternId}
        queuedPatternId={queuedPatternId}
        isPlaying={isPlaying}
        onSelectPattern={loadPreset}
      />
    </ThemeProvider>
  );
}

export default App;
