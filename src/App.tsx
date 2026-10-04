import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Grid } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';
import './adaptive.css';

import type { FormGenre, TrainerConfig } from './audio/Scheduler';
import { FORM_GENRES } from './audio/Scheduler';
import { PRESET_PATTERNS } from './rhythms/RhythmPatterns';
import type { RhythmPattern } from './rhythms/RhythmPatterns';
import {
  CUSTOM_PATTERN_ID,
  DEFAULT_PATTERN_ID,
  getBasePattern,
  normalizePatternId,
  resolvePattern,
  sanitizeOverrides,
  withUsedInstruments,
} from './rhythms/patternLibrary';
import { clampBpm } from './rhythms/meter';
import PatternEditor from './components/PatternEditor';
import ConductorVisual from './components/ConductorVisual';
import StudyTools from './components/StudyTools';
import HarmonyBuilder from './components/HarmonyBuilder';
import InteractiveInstrumentVisual from './components/InteractiveInstrumentVisual';
import { MixerConsole } from './components/MixerConsole';
import { PracticeModes } from './components/PracticeModes';
import PianoPanel from './components/PianoPanel';
import type { FormasSettings, SilenceSettings } from './components/PracticeModes';
import { darkTheme } from './theme/darkTheme';
import { HeaderToolbar } from './components/HeaderToolbar';
import { Fill, Panel } from './components/Panel';
import type { SxProps, Theme } from '@mui/material/styles';
import { PwaUpdater } from './pwa/PwaUpdater';
import { GenreSelectorModal } from './components/GenreSelectorModal';
import { useMetronomeEngine } from './hooks/useMetronomeEngine';
import { usePersistentState } from './hooks/usePersistentState';
import { useTapTempo } from './hooks/useTapTempo';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { PlaybackContext } from './state/PlaybackContext';
import { isBoolean, isNumber, isPlainObject, isString } from './state/storage';

const DEFAULT_TRAINER: TrainerConfig = { active: false, startBpm: 60, targetBpm: 120, barsPerStep: 4, bpmIncrement: 5, mode: 'linear' };
const DEFAULT_SILENCE: SilenceSettings = { active: false, chance: 0.3 };
const DEFAULT_FORMAS: FormasSettings = { enabled: false, genre: 'Chacarera Simple', introBars: 8 };

const isBpm = (v: unknown): v is number => isNumber(v) && clampBpm(v) === v;
const isPatternId = (v: unknown): v is string => isString(v) && getBasePattern(v) !== undefined;
const isTrainer = (v: unknown): v is TrainerConfig =>
  isPlainObject(v) && isBoolean(v.active) && isBpm(v.startBpm) && isBpm(v.targetBpm) &&
  isNumber(v.barsPerStep) && v.barsPerStep >= 1 && isNumber(v.bpmIncrement) && v.bpmIncrement >= 1 &&
  (v.mode === 'linear' || v.mode === 'resistance_loop');
const isSilence = (v: unknown): v is SilenceSettings =>
  isPlainObject(v) && isBoolean(v.active) && isNumber(v.chance) && v.chance >= 0 && v.chance <= 1;
const isFormas = (v: unknown): v is FormasSettings =>
  isPlainObject(v) && isBoolean(v.enabled) && FORM_GENRES.includes(v.genre as FormGenre) &&
  isNumber(v.introBars) && v.introBars >= 1;

const CARD_BORDER = '1px solid rgba(229, 169, 95, 0.14)';

/** Chrome shared with {@link Panel}, passed to components that draw their own card. */
const cardChildSx: SxProps<Theme> = {
  bgcolor: '#141210',
  border: CARD_BORDER,
  borderRadius: '16px',
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
};

const instrumentsCardSx: SxProps<Theme> = [cardChildSx, { p: { xs: 1.5, md: 2 }, justifyContent: 'center' }];

function App() {
  const [bpm, setBpmRaw] = usePersistentState('bpm', 120, isBpm);
  const [selectedPatternId, setSelectedPatternId] = usePersistentState('pattern', DEFAULT_PATTERN_ID, isPatternId);
  const [overrides, setOverrides] = usePersistentState<Record<string, RhythmPattern>>('patternOverrides', {}, { sanitize: sanitizeOverrides });
  const [trainer, setTrainer] = usePersistentState('trainer', DEFAULT_TRAINER, isTrainer);
  const [silence, setSilence] = usePersistentState('silence', DEFAULT_SILENCE, isSilence);
  const [formas, setFormas] = usePersistentState('formas', DEFAULT_FORMAS, isFormas);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const setBpm = useCallback((value: number) => setBpmRaw(clampBpm(value)), [setBpmRaw]);

  const overrideForSelected = overrides[normalizePatternId(selectedPatternId)];
  const currentPattern = useMemo(
    () => resolvePattern(selectedPatternId, overrideForSelected ? { [overrideForSelected.id]: overrideForSelected } : {}),
    [selectedPatternId, overrideForSelected]
  );

  const engine = useMetronomeEngine({
    pattern: currentPattern,
    bpm,
    onBpmChange: setBpm,
    onPatternChange: useCallback((p: RhythmPattern) => setSelectedPatternId(p.id), [setSelectedPatternId]),
  });
  const { isPlaying, toggle, queuePattern, configureTrainer, setSilenceMode, configureFormas } = engine;

  useEffect(() => { configureTrainer(trainer); }, [trainer, configureTrainer]);
  useEffect(() => { setSilenceMode(silence.active, silence.chance); }, [silence, setSilenceMode]);
  useEffect(() => { configureFormas(formas.enabled, formas.genre, formas.introBars); }, [formas, configureFormas]);

  // While the trainer drives the tempo, the visible BPM starts from its start value.
  useEffect(() => {
    if (trainer.active && !isPlaying) setBpm(trainer.startBpm);
  }, [trainer.active, trainer.startBpm, isPlaying, setBpm]);

  const loadPreset = useCallback((patternId: string) => {
    const id = normalizePatternId(patternId);
    const next = resolvePattern(id, overrides);
    if (isPlaying) {
      queuePattern(next);
      return;
    }
    setSelectedPatternId(id);
    if (next.recommendedTempo && !trainer.active) setBpm(next.recommendedTempo);
  }, [isPlaying, overrides, queuePattern, setSelectedPatternId, setBpm, trainer.active]);

  const handlePatternUpdate = useCallback((pattern: RhythmPattern) => {
    const normalized = withUsedInstruments(pattern);
    setOverrides(prev => ({ ...prev, [normalized.id]: normalized }));
  }, [setOverrides]);

  const handleRestorePattern = useCallback(() => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[currentPattern.id];
      return next;
    });
  }, [setOverrides, currentPattern.id]);

  const handleTap = useTapTempo(setBpm);

  // While the speed trainer runs it owns the tempo: every manual path (controls,
  // Tap button, keyboard) is locked the same way.
  const tempoLocked = trainer.active && isPlaying;
  const guardedTap = useCallback(() => { if (!tempoLocked) handleTap(); }, [tempoLocked, handleTap]);

  useKeyboardShortcuts({
    onTogglePlay: toggle,
    onTap: guardedTap,
    onNudgeBpm: useCallback((delta: number) => {
      if (!tempoLocked) setBpmRaw(prev => clampBpm(prev + delta));
    }, [tempoLocked, setBpmRaw]),
  });

  const canRestore = currentPattern.id !== CUSTOM_PATTERN_ID && !!overrides[currentPattern.id];

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <PlaybackContext.Provider value={engine.store}>
        <Box component="main" className="app-shell" sx={{ minHeight: '100dvh', width: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#070605', overflowX: 'hidden', alignItems: 'center', boxSizing: 'border-box' }}>

          <Box className="studio-chassis console-wood-edge" sx={{ width: '100%', maxWidth: '1440px', display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 }, p: { xs: 1, md: 2 }, boxSizing: 'border-box' }}>

            <HeaderToolbar
              isPlaying={isPlaying}
              bpm={bpm}
              timeSignature={currentPattern.timeSignature}
              onBpmChange={setBpm}
              onTogglePlay={toggle}
              onTapTempo={guardedTap}
              onOpenLibrary={() => setLibraryOpen(true)}
              selectedPatternId={currentPattern.id}
              availablePresets={PRESET_PATTERNS}
              onSelectPreset={loadPreset}
              tempoLocked={tempoLocked}
            />

            {/* Rows of an aligned 12-column grid; every cell stretches to the row height. */}
            <Grid container spacing={{ xs: 1.5, md: 2 }} sx={{ width: '100%' }}>

              {/* Row 1: pulse (primary) + instruments */}
              <Grid size={{ xs: 12, md: 5, lg: 4 }} className="area-pulse">
                <Panel title="Pulso">
                  <ConductorVisual
                    pattern={currentPattern}
                    isPlaying={isPlaying}
                    trainerActive={trainer.active}
                    totalBarsInterval={trainer.barsPerStep}
                    bpm={bpm}
                  />
                </Panel>
              </Grid>
              <Grid size={{ xs: 12, md: 7, lg: 8 }}>
                <Fill>
                  <InteractiveInstrumentVisual
                    pattern={currentPattern}
                    isPlaying={isPlaying}
                    onPreviewInstrument={engine.previewInstrument}
                    sx={instrumentsCardSx}
                  />
                </Fill>
              </Grid>

              {/* Row 2: step sequencer, full width */}
              <Grid size={12}>
                <Panel title="Secuenciador" sx={{ '& > section': { mt: 0 } }}>
                  <PatternEditor
                    pattern={currentPattern}
                    onPatternUpdate={handlePatternUpdate}
                    isPlaying={isPlaying}
                    onPreviewInstrument={engine.previewInstrument}
                    canRestore={canRestore}
                    onRestore={handleRestorePattern}
                  />
                </Panel>
              </Grid>

              {/* Row 3: mixer + practice modes */}
              <Grid size={{ xs: 12, lg: 8 }}>
                <Fill>
                  <MixerConsole
                    pattern={currentPattern}
                    isPlaying={isPlaying}
                    onVolumeChange={engine.setChannelVolume}
                    onPanChange={engine.setChannelPan}
                    onMuteChange={engine.setChannelMute}
                  />
                </Fill>
              </Grid>
              <Grid size={{ xs: 12, lg: 4 }} sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
                <PracticeModes
                  trainer={trainer}
                  onTrainerChange={setTrainer}
                  silence={silence}
                  onSilenceChange={setSilence}
                  formas={formas}
                  onFormasChange={setFormas}
                  isPlaying={isPlaying}
                />
                <Fill>
                  <HarmonyBuilder
                    onUpdateProgression={engine.setHarmonyProgression}
                    onVolumeChange={engine.setHarmonyVolume}
                    onStyleChange={engine.setAccompanimentStyle}
                    isPlaying={isPlaying}
                    sx={cardChildSx}
                  />
                </Fill>
              </Grid>

              {/* Row 4: study tools, full width (laid out horizontally inside) */}
              <Grid size={12}>
                <Fill>
                  <StudyTools onStopRequest={engine.stop} />
                </Fill>
              </Grid>

              {/* Row 5: piano (harmony, playable keyboard, melody looper) */}
              <Grid size={12}>
                <PianoPanel engine={engine} isPlaying={isPlaying} />
              </Grid>

            </Grid>
          </Box>
        </Box>

        <PwaUpdater isPlaying={isPlaying} />
        <GenreSelectorModal
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          selectedPatternId={currentPattern.id}
          isPlaying={isPlaying}
          onSelectPattern={loadPreset}
        />
      </PlaybackContext.Provider>
    </ThemeProvider>
  );
}

export default App;
