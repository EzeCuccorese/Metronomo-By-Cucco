import { isPlainObject } from './storage';

/** Every section of the console that can be folded or hidden. */
export const PANEL_IDS = ['pulse', 'instruments', 'sequencer', 'mixer', 'practice', 'harmony', 'study', 'piano'] as const;
export type PanelId = (typeof PANEL_IDS)[number];

/** open: full panel · collapsed: title bar + summary only · hidden: not rendered at all. */
export type PanelState = 'open' | 'collapsed' | 'hidden';
export const PANEL_STATES: readonly PanelState[] = ['open', 'collapsed', 'hidden'];

export const PRESET_IDS = ['solo', 'ritmos', 'armonia', 'estudio', 'todo'] as const;
export type PresetId = (typeof PRESET_IDS)[number];
/** A preset, or the user's own arrangement ("Personalizado"). */
export type LayoutPreset = PresetId | 'personalizado';

export interface LayoutState {
    preset: LayoutPreset;
    panels: Record<PanelId, PanelState>;
    /** The user's own arrangement, kept so "Personalizado" can be picked again after trying a preset. */
    custom: Record<PanelId, PanelState>;
}

/** Spanish names, shared by the panel titles and the view menu. */
export const PANEL_LABELS: Record<PanelId, string> = {
    pulse: 'Pulso',
    instruments: 'Instrumentos',
    sequencer: 'Secuenciador',
    mixer: 'Mezclador',
    practice: 'Modos de práctica',
    harmony: 'Armonía',
    study: 'Estudio',
    piano: 'Piano',
};

/** What the app looked like before panels could be folded; "practice" was a closed accordion. */
export const DEFAULT_PANELS: Record<PanelId, PanelState> = {
    pulse: 'open',
    instruments: 'open',
    sequencer: 'open',
    mixer: 'open',
    practice: 'collapsed',
    harmony: 'open',
    study: 'open',
    piano: 'open',
};

const only = (open: PanelId[], collapsed: PanelId[] = []): Record<PanelId, PanelState> =>
    Object.fromEntries(PANEL_IDS.map(id => [id, open.includes(id) ? 'open' : collapsed.includes(id) ? 'collapsed' : 'hidden'])) as Record<PanelId, PanelState>;

export const PRESET_LABELS: Record<LayoutPreset, string> = {
    solo: 'Solo metrónomo',
    ritmos: 'Ritmos',
    armonia: 'Armonía y piano',
    estudio: 'Estudio',
    todo: 'Todo',
    personalizado: 'Personalizado',
};

export const PRESET_PANELS: Record<PresetId, Record<PanelId, PanelState>> = {
    solo: only(['pulse', 'practice']),
    ritmos: only(['pulse', 'instruments', 'sequencer'], ['mixer', 'practice']),
    armonia: only(['pulse', 'harmony', 'piano'], ['mixer', 'practice']),
    estudio: only(['pulse', 'study', 'practice']),
    todo: DEFAULT_PANELS,
};

/** Everything as it was before panels could be folded: what people who already use the app keep. */
export const LAYOUT_TODO: LayoutState = { preset: 'todo', panels: DEFAULT_PANELS, custom: DEFAULT_PANELS };
/** New users start with the rhythm tools only; the rest is one tap away in "Vista". */
export const LAYOUT_NEW_USER: LayoutState = { preset: 'ritmos', panels: PRESET_PANELS.ritmos, custom: DEFAULT_PANELS };

export const isPanelState = (v: unknown): v is PanelState => PANEL_STATES.includes(v as PanelState);
const isPreset = (v: unknown): v is LayoutPreset => v === 'personalizado' || PRESET_IDS.includes(v as PresetId);

const sanitizePanels = (value: unknown, fallback: Record<PanelId, PanelState>): Record<PanelId, PanelState> => {
    const stored = isPlainObject(value) ? value : {};
    const panels = { ...fallback };
    for (const id of PANEL_IDS) {
        if (isPanelState(stored[id])) panels[id] = stored[id];
    }
    return panels;
};

/** The preset whose panels are exactly these, or "personalizado". */
export function detectPreset(panels: Record<PanelId, PanelState>): LayoutPreset {
    return PRESET_IDS.find(id => PANEL_IDS.every(p => PRESET_PANELS[id][p] === panels[p])) ?? 'personalizado';
}

/** Keeps every valid entry and fills the missing ones, so a newer panel never breaks an older saved layout. */
export function sanitizeLayout(value: unknown): LayoutState | undefined {
    if (!isPlainObject(value) || !isPlainObject(value.panels)) return undefined;
    const panels = sanitizePanels(value.panels, DEFAULT_PANELS);
    const preset = isPreset(value.preset) ? value.preset : detectPreset(panels);
    return { preset, panels, custom: sanitizePanels(value.custom, panels) };
}

export const PANEL_PRESET_ORDER: LayoutPreset[] = [...PRESET_IDS, 'personalizado'];
