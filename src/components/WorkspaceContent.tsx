import React from 'react';
import { Box, Button, Grid } from '@mui/material';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import type { TrainerConfig } from '../audio/Scheduler';
import type { PanelId } from '../state/layout';
import { WORKSPACE_TAB_IDS, WORKSPACE_TAB_PANELS, type WorkspaceTabId } from '../state/workspaceTabs';
import type { SkinId } from '../theme/skins';
import type { StudySessionState } from '../hooks/useStudySession';
import type { useMetronomeEngine } from '../hooks/useMetronomeEngine';
import { CHANNEL_LABELS, type useMixer } from '../hooks/useMixer';
import { Panel } from './Panel';
import ConductorVisual from './ConductorVisual';
import InteractiveInstrumentVisual from './InteractiveInstrumentVisual';
import PatternEditor from './PatternEditor';
import HarmonyBuilder from './HarmonyBuilder';
import PianoPanel from './PianoPanel';
import { MixerConsole } from './MixerConsole';
import { PracticeModes, type FormasSettings, type SilenceSettings } from './PracticeModes';
import StudyTools from './StudyTools';

export interface WorkspaceContentProps {
  activeTab: WorkspaceTabId;
  shown: (id: PanelId) => boolean;
  onRestoreTabPanels: (tab: WorkspaceTabId) => void;
  skin: SkinId;
  bpm: number;
  isPlaying: boolean;
  currentPattern: RhythmPattern;
  canRestorePattern: boolean;
  onPatternUpdate: (pattern: RhythmPattern) => void;
  onRestorePattern: () => void;
  engine: ReturnType<typeof useMetronomeEngine>;
  mixer: ReturnType<typeof useMixer>;
  harmonySummary: string;
  trainer: TrainerConfig;
  onTrainerChange: (next: TrainerConfig) => void;
  silence: SilenceSettings;
  onSilenceChange: (next: SilenceSettings) => void;
  formas: FormasSettings;
  onFormasChange: (next: FormasSettings) => void;
  studySession: StudySessionState;
  studyPinned: boolean;
  onToggleStudyPin: () => void;
}

const formatMixerSummary = (mixer: ReturnType<typeof useMixer>): string => {
  const muted = mixer.visibleChannels.filter(ch => ch.isMuted);
  const soloNames = mixer.visibleChannels.filter(ch => mixer.solo.has(ch.id)).map(ch => CHANNEL_LABELS[ch.id]);
  return [
    `${mixer.visibleChannels.length} canales`,
    muted.length === 0 ? 'sin mutes' : muted.length === 1 ? `${CHANNEL_LABELS[muted[0].id]} en mute` : `${muted.length} en mute`,
    ...(soloNames.length > 0 ? [`Solo ${soloNames.join(', ')}`] : []),
  ].join(' · ');
};

const RitmosTab: React.FC<WorkspaceContentProps> = (p) => {
  const showPulse = p.shown('pulse');
  const showInstruments = p.shown('instruments');
  return (
    <>
      {showPulse && (
        <Grid size={{ xs: 12, md: showInstruments ? 4 : 12, lg: showInstruments ? 3 : 12 }} className="area-pulse">
          <Panel id="pulse" title="Pulso" summary={`${p.bpm} BPM · ${p.currentPattern.name}`}>
            <ConductorVisual pattern={p.currentPattern} isPlaying={p.isPlaying} trainerActive={p.trainer.active} totalBarsInterval={p.trainer.barsPerStep} bpm={p.bpm} skin={p.skin} />
          </Panel>
        </Grid>
      )}
      {showInstruments && (
        <Grid size={{ xs: 12, md: showPulse ? 8 : 12, lg: showPulse ? 9 : 12 }}>
          <Panel id="instruments" title="Instrumentos" summary={p.currentPattern.name} sx={{ height: 'auto' }}>
            <InteractiveInstrumentVisual pattern={p.currentPattern} isPlaying={p.isPlaying} skin={p.skin} onPreviewInstrument={(inst, mod) => void p.engine.previewInstrument(inst, mod)} />
          </Panel>
        </Grid>
      )}
      {p.shown('sequencer') && (
        <Grid size={12}>
          <Panel id="sequencer" title="Secuenciador" summary={p.currentPattern.name} sx={{ '& section': { mt: 0 } }}>
            <PatternEditor pattern={p.currentPattern} onPatternUpdate={p.onPatternUpdate} isPlaying={p.isPlaying} onPreviewInstrument={(inst, mod) => void p.engine.previewInstrument(inst, mod)} canRestore={p.canRestorePattern} onRestore={p.onRestorePattern} />
          </Panel>
        </Grid>
      )}
    </>
  );
};

const ArmoniaTab: React.FC<WorkspaceContentProps> = (p) => (
  <>
    {p.shown('harmony') && (
      <Grid size={12}>
        <Panel id="harmony" title="Armonía" summary={p.harmonySummary}>
          <HarmonyBuilder isPlaying={p.isPlaying} />
        </Panel>
      </Grid>
    )}
    {p.shown('piano') && (
      <Grid size={12}>
        <Panel id="piano" title="Piano" summary="Teclado y melodías">
          <PianoPanel engine={p.engine} isPlaying={p.isPlaying} />
        </Panel>
      </Grid>
    )}
  </>
);

const MezclaTab: React.FC<WorkspaceContentProps> = (p) => (
  p.shown('mixer') ? (
    <Grid size={12}>
      <Panel id="mixer" title="Mezclador" summary={formatMixerSummary(p.mixer)}>
        <MixerConsole
          channels={p.mixer.visibleChannels}
          view={p.mixer.view}
          onViewChange={p.mixer.setView}
          showAll={p.mixer.showAll}
          onShowAllChange={p.mixer.setShowAll}
          solo={p.mixer.solo}
          onToggleSolo={p.mixer.toggleSolo}
          onVolume={p.mixer.setVolume}
          onPan={p.mixer.setPan}
          onToggleMute={p.mixer.toggleMute}
          pattern={p.currentPattern}
          isPlaying={p.isPlaying}
          getChannelLevel={p.engine.getChannelLevel}
        />
      </Panel>
    </Grid>
  ) : null
);

const PracticaTab: React.FC<WorkspaceContentProps> = (p) => {
  const showPractice = p.shown('practice');
  const showStudy = p.shown('study');
  return (
    <>
      {showPractice && (
        <Grid size={{ xs: 12, lg: showStudy ? 7 : 12 }}>
          <PracticeModes trainer={p.trainer} onTrainerChange={p.onTrainerChange} silence={p.silence} onSilenceChange={p.onSilenceChange} formas={p.formas} onFormasChange={p.onFormasChange} isPlaying={p.isPlaying} />
        </Grid>
      )}
      {showStudy && (
        <Grid size={{ xs: 12, lg: showPractice ? 5 : 12 }}>
          <StudyTools onStopRequest={p.engine.stop} session={p.studySession} pinned={p.studyPinned} onTogglePin={p.onToggleStudyPin} />
        </Grid>
      )}
    </>
  );
};

const TAB_RENDERERS: Record<WorkspaceTabId, React.FC<WorkspaceContentProps>> = {
  ritmos: RitmosTab,
  armonia: ArmoniaTab,
  mezcla: MezclaTab,
  practica: PracticaTab,
};

/** Renders the 4 WAI-ARIA tabpanels, mounting only the active tab's content. */
export const WorkspaceContent: React.FC<WorkspaceContentProps> = (props) => (
  <>
    {WORKSPACE_TAB_IDS.map((tabId) => {
      const active = props.activeTab === tabId;
      const ActiveGrid = TAB_RENDERERS[tabId];
      const anyShown = WORKSPACE_TAB_PANELS[tabId].some(props.shown);
      return (
        <div
          key={tabId}
          role="tabpanel"
          id={`workspace-panel-${tabId}`}
          aria-labelledby={`workspace-tab-${tabId}`}
          hidden={!active}
          className={active ? 'workspace-tabpanel workspace-tabpanel--active' : 'workspace-tabpanel'}
        >
          {active && (
            anyShown ? (
              <Grid container spacing={{ xs: 1.5, md: 2 }} sx={{ width: '100%' }}>
                <ActiveGrid {...props} />
              </Grid>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <Button variant="outlined" size="small" onClick={() => props.onRestoreTabPanels(tabId)}>
                  Mostrar paneles de esta pestaña
                </Button>
              </Box>
            )
          )}
        </div>
      );
    })}
  </>
);
