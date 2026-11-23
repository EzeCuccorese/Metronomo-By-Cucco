import type { LayoutPreset, PanelId } from './layout';

export const WORKSPACE_TAB_IDS = ['ritmos', 'armonia', 'mezcla', 'practica'] as const;
export type WorkspaceTabId = (typeof WORKSPACE_TAB_IDS)[number];
export const DEFAULT_WORKSPACE_TAB: WorkspaceTabId = 'ritmos';
export const WORKSPACE_TAB_STORAGE_KEY = 'ui.tab.v1';

export interface WorkspaceTabMeta {
  id: WorkspaceTabId;
  label: string;
  panels: readonly PanelId[];
}

export const WORKSPACE_TABS: readonly WorkspaceTabMeta[] = [
  { id: 'ritmos', label: 'Ritmos', panels: ['pulse', 'instruments', 'sequencer'] },
  { id: 'armonia', label: 'Armonía y Piano', panels: ['harmony', 'piano'] },
  { id: 'mezcla', label: 'Mezclador', panels: ['mixer'] },
  { id: 'practica', label: 'Práctica y Estudio', panels: ['practice', 'study'] },
];

export const WORKSPACE_TAB_PANELS: Record<WorkspaceTabId, readonly PanelId[]> = {
  ritmos: ['pulse', 'instruments', 'sequencer'],
  armonia: ['harmony', 'piano'],
  mezcla: ['mixer'],
  practica: ['practice', 'study'],
};

export const TAB_FOR_PANEL: Record<PanelId, WorkspaceTabId> = {
  pulse: 'ritmos',
  instruments: 'ritmos',
  sequencer: 'ritmos',
  harmony: 'armonia',
  piano: 'armonia',
  mixer: 'mezcla',
  practice: 'practica',
  study: 'practica',
};

export const TAB_FOR_PRESET: Record<LayoutPreset, WorkspaceTabId | null> = {
  solo: 'ritmos',
  ritmos: 'ritmos',
  armonia: 'armonia',
  estudio: 'practica',
  todo: null,
  personalizado: null,
};

export const isWorkspaceTab = (v: unknown): v is WorkspaceTabId =>
  typeof v === 'string' && WORKSPACE_TAB_IDS.includes(v as WorkspaceTabId);
