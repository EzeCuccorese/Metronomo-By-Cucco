import { isPlainObject } from './storage';

/** Every section of the console that can be folded or hidden. */
export const PANEL_IDS = ['pulse', 'instruments', 'sequencer', 'mixer', 'practice', 'harmony', 'study', 'piano'] as const;
export type PanelId = (typeof PANEL_IDS)[number];

/** open: full panel · collapsed: title bar + summary only · hidden: not rendered at all. */
export type PanelState = 'open' | 'collapsed' | 'hidden';
export const PANEL_STATES: readonly PanelState[] = ['open', 'collapsed', 'hidden'];

export interface LayoutState {
    panels: Record<PanelId, PanelState>;
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

export const DEFAULT_LAYOUT: LayoutState = { panels: DEFAULT_PANELS };

export const isPanelState = (v: unknown): v is PanelState => PANEL_STATES.includes(v as PanelState);

/** Keeps every valid entry and fills the missing ones, so a newer panel never breaks an older saved layout. */
export function sanitizeLayout(value: unknown): LayoutState | undefined {
    if (!isPlainObject(value) || !isPlainObject(value.panels)) return undefined;
    const stored = value.panels;
    const panels = { ...DEFAULT_PANELS };
    for (const id of PANEL_IDS) {
        if (isPanelState(stored[id])) panels[id] = stored[id];
    }
    return { panels };
}
