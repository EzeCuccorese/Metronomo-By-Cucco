import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
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
import StudyTools from './components/StudyTools';
import { useStudySession } from './hooks/useStudySession';
import { StudyTrigger } from './components/StudyTrigger';
import type { FormasSettings, SilenceSettings } from './components/PracticeModes';
import { SKIN_IDS, SKINS } from './theme/skins';
import { useSkin } from './hooks/useSkin';
import { HeaderToolbar } from './components/HeaderToolbar';
import { PwaUpdater } from './pwa/PwaUpdater';
import { GenreSelectorModal } from './components/GenreSelectorModal';
import { useMetronomeEngine } from './hooks/useMetronomeEngine';
import { usePersistentState } from './hooks/usePersistentState';
import { useTapTempo } from './hooks/useTapTempo';
import { useShortcutDispatcher, useShortcutHandlers } from './shortcuts/dispatcher';
import ShortcutsDialog from './components/ShortcutsDialog';
import CommandPalette from './components/CommandPalette';
import type { PaletteCommand } from './components/CommandPalette';
import { useWakeLock } from './hooks/useWakeLock';
import { useLayout } from './hooks/useLayout';
import { useMixer } from './hooks/useMixer';
import { useHarmonySync, useMelodySync } from './hooks/useEngineSync';
import { LayoutContext } from './state/LayoutContext';
import { PANEL_IDS, PANEL_LABELS, PANEL_PRESET_ORDER, PRESET_LABELS } from './state/layout';
import type { LayoutPreset, PanelId, PanelState } from './state/layout';
import {
  DEFAULT_WORKSPACE_TAB,
  TAB_FOR_PANEL,
  TAB_FOR_PRESET,
  WORKSPACE_TABS,
  WORKSPACE_TAB_PANELS,
  WORKSPACE_TAB_STORAGE_KEY,
  isWorkspaceTab,
  type WorkspaceTabId,
} from './state/workspaceTabs';
import { runViewTransition } from './state/viewTransition';
import { WorkspaceTabs } from './components/WorkspaceTabs';
import { WorkspaceContent } from './components/WorkspaceContent';
import { ViewMenu } from './components/ViewMenu';
import { FirstUseTips } from './components/FirstUseTips';
import { enterFullscreen, exitFullscreen } from './hooks/useFullscreen';
import { StageMode } from './components/StageMode';
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
  const skinState = useSkin();
  const [bpm, setBpmRaw] = usePersistentState('bpm', 120, isBpm);
  const [selectedPatternId, setSelectedPatternId] = usePersistentState('pattern', DEFAULT_PATTERN_ID, isPatternId);
  const [overrides, setOverrides] = usePersistentState<Record<string, RhythmPattern>>('patternOverrides', {}, { sanitize: sanitizeOverrides });
  const [trainer, setTrainer] = usePersistentState('trainer', DEFAULT_TRAINER, isTrainer);
  const [silence, setSilence] = usePersistentState('silence', DEFAULT_SILENCE, isSilence);
  const [formas, setFormas] = usePersistentState('formas', DEFAULT_FORMAS, isFormas);
  const [activeTab, setActiveTab] = usePersistentState<WorkspaceTabId>(WORKSPACE_TAB_STORAGE_KEY, DEFAULT_WORKSPACE_TAB, isWorkspaceTab);
  const [studyPinned, setStudyPinned] = usePersistentState<boolean>('ui.studyPinned.v1', false, isBoolean);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const openStage = useCallback(() => { void enterFullscreen(); setStageOpen(true); }, []);
  const closeStage = useCallback(() => { void exitFullscreen(); setStageOpen(false); }, []);

  const setBpm = useCallback((value: number) => setBpmRaw(clampBpm(value)), [setBpmRaw]);

  const overrideForSelected = overrides[normalizePatternId(selectedPatternId)];
  const currentPattern = useMemo(
    () => resolvePattern(selectedPatternId, overrideForSelected ? { [overrideForSelected.id]: overrideForSelected } : {}),
    [selectedPatternId, overrideForSelected],
  );

  const engine = useMetronomeEngine({
    pattern: currentPattern,
    bpm,
    onBpmChange: setBpm,
    onPatternChange: useCallback((p: RhythmPattern) => setSelectedPatternId(p.id), [setSelectedPatternId]),
  });
  const { isPlaying, toggle, queuePattern, configureTrainer, setSilenceMode, configureFormas } = engine;

  useWakeLock(isPlaying);
  useEffect(() => { configureTrainer(trainer); }, [trainer, configureTrainer]);
  useEffect(() => { setSilenceMode(silence.active, silence.chance); }, [silence, setSilenceMode]);
  useEffect(() => { configureFormas(formas.enabled, formas.genre, formas.introBars); }, [formas, configureFormas]);
  useEffect(() => {
    if (trainer.active && !isPlaying) setBpm(trainer.startBpm);
  }, [trainer.active, trainer.startBpm, isPlaying, setBpm]);

  const loadPreset = useCallback((patternId: string) => {
    const id = normalizePatternId(patternId);
    const isCustom = id === CUSTOM_PATTERN_ID;
    const wasOverridden = !isCustom && id in overrides;
    if (wasOverridden) {
      setOverrides(prev => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    const next = isCustom ? resolvePattern(id, overrides) : (getBasePattern(id) ?? PRESET_PATTERNS[0]);
    if (isPlaying) {
      if (id === currentPattern.id && !wasOverridden) {
        queuePattern(currentPattern);
        setSelectedPatternId(id);
        return;
      }
      queuePattern(next);
      return;
    }
    setSelectedPatternId(id);
    if (next.recommendedTempo && !trainer.active) setBpm(next.recommendedTempo);
  }, [isPlaying, overrides, currentPattern, queuePattern, setOverrides, setSelectedPatternId, setBpm, trainer.active]);

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
  const tempoLocked = trainer.active && isPlaying;
  const guardedTap = useCallback(() => { if (!tempoLocked) handleTap(); }, [tempoLocked, handleTap]);
  const nudgeBpm = useCallback((delta: number) => {
    if (!tempoLocked) setBpmRaw(prev => clampBpm(prev + delta));
  }, [tempoLocked, setBpmRaw]);

  const rawLayout = useLayout();
  const selectTab = useCallback((nextTab: WorkspaceTabId) => {
    const tabPanels = WORKSPACE_TAB_PANELS[nextTab];
    const needsAutoOpen = rawLayout.preset === 'personalizado'
      ? tabPanels.every(id => rawLayout.panels[id] === 'hidden')
      : tabPanels.every(id => rawLayout.panels[id] !== 'open');
    runViewTransition(() => {
      setActiveTab(nextTab);
      if (needsAutoOpen) rawLayout.openPanels(tabPanels, false);
    });
  }, [rawLayout, setActiveTab]);

  const setPanelAndFocus = useCallback((id: PanelId, state: PanelState) => {
    rawLayout.setPanelState(id, state);
    if (state === 'open') setActiveTab(TAB_FOR_PANEL[id]);
  }, [rawLayout, setActiveTab]);

  const setPresetAndTab = useCallback((preset: LayoutPreset) => {
    rawLayout.setPreset(preset);
    const targetTab = TAB_FOR_PRESET[preset];
    if (targetTab) setActiveTab(targetTab);
  }, [rawLayout, setActiveTab]);

  const layout = useMemo(
    () => ({ ...rawLayout, setPanelState: setPanelAndFocus, setPreset: setPresetAndTab }),
    [rawLayout, setPanelAndFocus, setPresetAndTab],
  );

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const rhythmCommands = useMemo<PaletteCommand[]>(() => PRESET_PATTERNS.map(p => ({
    id: `rhythm.${p.id}`, label: `Ritmo: ${p.name}`, group: 'Ritmos', keywords: ['ritmo', 'rhythm'], run: () => loadPreset(p.id),
  })), [loadPreset]);
  const viewCommands = useMemo<PaletteCommand[]>(() => [
    ...WORKSPACE_TABS.map(t => ({
      id: `tab.${t.id}`, label: `Pestaña: ${t.label}`, group: 'Secciones', keywords: ['pestaña', 'tab', 'seccion'], run: () => selectTab(t.id),
    })),
    ...SKIN_IDS.map(id => ({
      id: `skin.${id}`, label: `Skin: ${SKINS[id].name} (${SKINS[id].subtitle})`, group: 'Apariencia', keywords: ['skin', 'tema', 'theme', 'color'], run: () => skinState.setSkin(id),
    })),
    ...PANEL_PRESET_ORDER.map(preset => ({
      id: `view.preset.${preset}`, label: `Vista: ${PRESET_LABELS[preset]}`, group: 'Vista', keywords: ['vista', 'preset', 'paneles', 'layout'], run: () => layout.setPreset(preset),
    })),
    ...PANEL_IDS.map(id => ({
      id: `view.panel.${id}`,
      label: `${layout.panels[id] === 'hidden' ? 'Mostrar' : 'Ocultar'} panel: ${PANEL_LABELS[id]}`,
      group: 'Vista',
      keywords: ['vista', 'panel', 'paneles'],
      run: () => layout.setPanelState(id, layout.panels[id] === 'hidden' ? 'open' : 'hidden'),
    })),
  ], [layout, selectTab, skinState]);
  const paletteCommands = useMemo(() => [...rhythmCommands, ...viewCommands], [rhythmCommands, viewCommands]);
  const setBpmFromPalette = useCallback((value: number) => { if (!tempoLocked) setBpmRaw(clampBpm(value)); }, [tempoLocked, setBpmRaw]);

  const stepPreset = useCallback((delta: 1 | -1) => {
    const ids = PRESET_PATTERNS.map(p => p.id);
    const at = ids.indexOf(currentPattern.id);
    const next = at < 0 ? (delta > 0 ? 0 : ids.length - 1) : (at + delta + ids.length) % ids.length;
    loadPreset(ids[next]);
  }, [currentPattern.id, loadPreset]);

  useShortcutDispatcher();
  useShortcutHandlers({
    'transport.play': e => { if (!e.repeat) toggle(); },
    'transport.tap': e => { if (!e.repeat) guardedTap(); },
    'transport.bpm-up': e => { if (!tempoLocked) setBpmRaw(prev => clampBpm(prev + (e.shiftKey ? 5 : 1))); },
    'transport.bpm-down': e => { if (!tempoLocked) setBpmRaw(prev => clampBpm(prev - (e.shiftKey ? 5 : 1))); },
    'transport.prev-rhythm': () => stepPreset(-1),
    'transport.next-rhythm': () => stepPreset(1),
    'view.stage': e => { if (!e.repeat) { if (stageOpen) closeStage(); else openStage(); } },
    'help.shortcuts': () => setShortcutsOpen(true),
    'palette.open': () => setPaletteOpen(prev => !prev),
  });

  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const headerOutOfView = useElementOutOfView(headerEl);
  const mixer = useMixer(currentPattern, {
    onVolumeChange: engine.setChannelVolume,
    onPanChange: engine.setChannelPan,
    onMuteChange: engine.setChannelMute,
  });
  const harmonySummary = useHarmonySync(engine);
  useMelodySync(engine);

  const shown = (id: PanelId) => layout.panels[id] !== 'hidden';
  const canRestore = currentPattern.id !== CUSTOM_PATTERN_ID && !!overrides[currentPattern.id];
  const studySession = useStudySession(engine.stop);
  const studyDockRef = useRef<HTMLDivElement | null>(null);
  const toggleStudyPin = useCallback(() => setStudyPinned(prev => !prev), [setStudyPinned]);
  const focusPinnedStudy = useCallback(() => {
    studyDockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <ThemeProvider theme={skinState.theme}>
      <CssBaseline />
      <LayoutContext.Provider value={layout}>
      <PlaybackContext.Provider value={engine.store}>
        <Box component="main" className="app-shell" sx={{ minHeight: '100dvh', width: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--skin-bg)', overflowX: 'hidden', alignItems: 'center', boxSizing: 'border-box' }}>
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
              viewControl={<ViewMenu onStageMode={openStage} skin={skinState.skin} onSelectSkin={skinState.setSkin} />}
              studyControl={<StudyTrigger session={studySession} pinned={studyPinned} onTogglePin={toggleStudyPin} onFocusPinned={focusPinnedStudy} />}
              pattern={currentPattern}
              onNudgeBpm={nudgeBpm}
              headerRef={setHeaderEl}
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
                viewControl={<ViewMenu compact onStageMode={openStage} skin={skinState.skin} onSelectSkin={skinState.setSkin} />}
              />
            )}

            <BluetoothNotice isPlaying={isPlaying} />

            <WorkspaceTabs activeTab={activeTab} onSelectTab={selectTab} skin={skinState.skin} onSelectSkin={skinState.setSkin} />

            {studyPinned && activeTab !== 'practica' && (
              <Box ref={studyDockRef} className="area-study">
                <StudyTools onStopRequest={engine.stop} session={studySession} pinned={studyPinned} onTogglePin={toggleStudyPin} />
              </Box>
            )}

            <WorkspaceContent
              activeTab={activeTab}
              shown={shown}
              onRestoreTabPanels={(tab) => rawLayout.openPanels(WORKSPACE_TAB_PANELS[tab])}
              skin={skinState.skin}
              bpm={bpm}
              isPlaying={isPlaying}
              currentPattern={currentPattern}
              canRestorePattern={canRestore}
              onPatternUpdate={handlePatternUpdate}
              onRestorePattern={handleRestorePattern}
              engine={engine}
              mixer={mixer}
              harmonySummary={harmonySummary}
              trainer={trainer}
              onTrainerChange={setTrainer}
              silence={silence}
              onSilenceChange={setSilence}
              formas={formas}
              onFormasChange={setFormas}
              studySession={studySession}
              studyPinned={studyPinned}
              onToggleStudyPin={toggleStudyPin}
            />
          </Box>
        </Box>

        <StageMode open={stageOpen} onClose={closeStage} pattern={currentPattern} bpm={bpm} isPlaying={isPlaying} tempoLocked={tempoLocked} onTogglePlay={toggle} onNudgeBpm={nudgeBpm} />
        <FirstUseTips />
        <PwaUpdater isPlaying={isPlaying} />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={paletteCommands} onSetBpm={setBpmFromPalette} tempoLocked={tempoLocked} />
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <GenreSelectorModal open={libraryOpen} onClose={() => setLibraryOpen(false)} selectedPatternId={currentPattern.id} isPlaying={isPlaying} onSelectPattern={loadPreset} />
      </PlaybackContext.Provider>
      </LayoutContext.Provider>
    </ThemeProvider>
  );
}

export default App;
