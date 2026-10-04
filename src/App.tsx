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
import { Panel } from './components/Panel';
import { PwaUpdater } from './pwa/PwaUpdater';
import { GenreSelectorModal } from './components/GenreSelectorModal';
import { useMetronomeEngine } from './hooks/useMetronomeEngine';
import { usePersistentState } from './hooks/usePersistentState';
import { useTapTempo } from './hooks/useTapTempo';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWakeLock } from './hooks/useWakeLock';
import { useLayout } from './hooks/useLayout';
import { CHANNEL_LABELS, useMixer } from './hooks/useMixer';
import { useHarmonySync, useMelodySync } from './hooks/useEngineSync';
import { LayoutContext } from './state/LayoutContext';
import type { PanelId } from './state/layout';
import { ViewMenu } from './components/ViewMenu';
import { CompactTransport } from './components/CompactTransport';
import { useElementOutOfView } from './hooks/useElementOutOfView';
import { BluetoothNotice } from './components/BluetoothNotice';
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

  // Keep the screen on while the metronome sounds (the system would otherwise lock the phone mid-practice).
  useWakeLock(isPlaying);

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

  const nudgeBpm = useCallback((delta: number) => {
    if (!tempoLocked) setBpmRaw(prev => clampBpm(prev + delta));
  }, [tempoLocked, setBpmRaw]);

  useKeyboardShortcuts({
    onTogglePlay: toggle,
    onTap: guardedTap,
    onNudgeBpm: nudgeBpm,
  });

  // The slim bar appears once the full header has scrolled away (not on portrait phones: their bar is always there).
  const headerOutOfView = useElementOutOfView('header.app-header');

  // Settings edited inside a card reach the engine from here, so a hidden or folded card keeps its sound.
  const layout = useLayout();
  const mixer = useMixer(currentPattern, {
    onVolumeChange: engine.setChannelVolume,
    onPanChange: engine.setChannelPan,
    onMuteChange: engine.setChannelMute,
  });
  const harmonySummary = useHarmonySync(engine);
  useMelodySync(engine);

  const shown = (id: PanelId) => layout.panels[id] !== 'hidden';
  const mutedChannels = mixer.visibleChannels.filter(ch => ch.isMuted);
  const soloNames = mixer.visibleChannels.filter(ch => mixer.solo.has(ch.id)).map(ch => CHANNEL_LABELS[ch.id]);
  const mixerSummary = [
    `${mixer.visibleChannels.length} canales`,
    mutedChannels.length === 0 ? 'sin mutes' : mutedChannels.length === 1 ? `${CHANNEL_LABELS[mutedChannels[0].id]} en mute` : `${mutedChannels.length} en mute`,
    ...(soloNames.length > 0 ? [`Solo ${soloNames.join(', ')}`] : []),
  ].join(' · ');

  const canRestore = currentPattern.id !== CUSTOM_PATTERN_ID && !!overrides[currentPattern.id];

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <LayoutContext.Provider value={layout}>
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
              viewControl={<ViewMenu />}
              pattern={currentPattern}
              onNudgeBpm={nudgeBpm}
            />

            {headerOutOfView && (
              <CompactTransport
                pattern={currentPattern}
                bpm={bpm}
                isPlaying={isPlaying}
                tempoLocked={tempoLocked}
                onTogglePlay={toggle}
                onNudgeBpm={nudgeBpm}
                onTapTempo={guardedTap}
                viewControl={<ViewMenu compact />}
              />
            )}

            <BluetoothNotice isPlaying={isPlaying} />

            {/* Rows of an aligned 12-column grid; cells stretch to the row height. Hidden panels leave no gap. */}
            <Grid container spacing={{ xs: 1.5, md: 2 }} sx={{ width: '100%' }}>

              {/* Row 1: pulse (primary) + instruments */}
              {shown('pulse') && (
                <Grid size={{ xs: 12, md: shown('instruments') ? 5 : 12, lg: shown('instruments') ? 4 : 12 }} className="area-pulse">
                  <Panel id="pulse" title="Pulso" summary={`${bpm} BPM · ${currentPattern.name}`}>
                    <ConductorVisual
                      pattern={currentPattern}
                      isPlaying={isPlaying}
                      trainerActive={trainer.active}
                      totalBarsInterval={trainer.barsPerStep}
                      bpm={bpm}
                    />
                  </Panel>
                </Grid>
              )}
              {shown('instruments') && (
                <Grid size={{ xs: 12, md: shown('pulse') ? 7 : 12, lg: shown('pulse') ? 8 : 12 }}>
                  <Panel id="instruments" title="Instrumentos" summary={currentPattern.name} sx={{ justifyContent: 'center' }}>
                    <InteractiveInstrumentVisual
                      pattern={currentPattern}
                      isPlaying={isPlaying}
                      onPreviewInstrument={(instrument, modifier) => void engine.previewInstrument(instrument, modifier)}
                    />
                  </Panel>
                </Grid>
              )}

              {/* Row 2: step sequencer, full width */}
              {shown('sequencer') && (
                <Grid size={12}>
                  <Panel id="sequencer" title="Secuenciador" summary={currentPattern.name} sx={{ '& section': { mt: 0 } }}>
                    <PatternEditor
                      pattern={currentPattern}
                      onPatternUpdate={handlePatternUpdate}
                      isPlaying={isPlaying}
                      onPreviewInstrument={(instrument, modifier) => void engine.previewInstrument(instrument, modifier)}
                      canRestore={canRestore}
                      onRestore={handleRestorePattern}
                    />
                  </Panel>
                </Grid>
              )}

              {/* Row 3: mixer + practice modes and harmony */}
              {shown('mixer') && (
                <Grid size={{ xs: 12, lg: shown('practice') || shown('harmony') ? 8 : 12 }}>
                  <Panel id="mixer" title="Mezclador" summary={mixerSummary}>
                    <MixerConsole
                      channels={mixer.visibleChannels}
                      view={mixer.view}
                      onViewChange={mixer.setView}
                      showAll={mixer.showAll}
                      onShowAllChange={mixer.setShowAll}
                      solo={mixer.solo}
                      onToggleSolo={mixer.toggleSolo}
                      onVolume={mixer.setVolume}
                      onPan={mixer.setPan}
                      onToggleMute={mixer.toggleMute}
                      pattern={currentPattern}
                      isPlaying={isPlaying}
                      getChannelLevel={engine.getChannelLevel}
                    />
                  </Panel>
                </Grid>
              )}
              {(shown('practice') || shown('harmony')) && (
                <Grid size={{ xs: 12, lg: shown('mixer') ? 4 : 12 }} sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, md: 2 } }}>
                  {shown('practice') && (
                    <PracticeModes
                      trainer={trainer}
                      onTrainerChange={setTrainer}
                      silence={silence}
                      onSilenceChange={setSilence}
                      formas={formas}
                      onFormasChange={setFormas}
                      isPlaying={isPlaying}
                    />
                  )}
                  {shown('harmony') && (
                    <Panel id="harmony" title="Armonía" summary={harmonySummary} sx={{ flex: 1, height: 'auto' }}>
                      <HarmonyBuilder isPlaying={isPlaying} />
                    </Panel>
                  )}
                </Grid>
              )}

              {/* Row 4: study tools, full width (laid out horizontally inside) */}
              {shown('study') && (
                <Grid size={12}>
                  <StudyTools onStopRequest={engine.stop} />
                </Grid>
              )}

              {/* Row 5: piano (harmony, playable keyboard, melody looper) */}
              {shown('piano') && (
                <Grid size={12}>
                  <Panel id="piano" title="Piano" summary="Teclado y melodías">
                    <PianoPanel engine={engine} isPlaying={isPlaying} />
                  </Panel>
                </Grid>
              )}

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
      </LayoutContext.Provider>
    </ThemeProvider>
  );
}

export default App;
