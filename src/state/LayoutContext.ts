import { createContext, useContext } from 'react';
import { DEFAULT_PANELS } from './layout';
import type { LayoutPreset, PanelId, PanelState } from './layout';

export interface LayoutApi {
    preset: LayoutPreset;
    panels: Record<PanelId, PanelState>;
    setPanelState: (id: PanelId, state: PanelState) => void;
    setPreset: (preset: LayoutPreset) => void;
}

/** Without a provider (a panel rendered on its own) every panel is simply open. */
const FALLBACK: LayoutApi = {
    preset: 'todo',
    panels: Object.fromEntries(Object.keys(DEFAULT_PANELS).map(id => [id, 'open'])) as Record<PanelId, PanelState>,
    setPanelState: () => {},
    setPreset: () => {},
};

export const LayoutContext = createContext<LayoutApi>(FALLBACK);

export const useLayoutApi = (): LayoutApi => useContext(LayoutContext);
