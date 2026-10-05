import { createContext, useContext } from 'react';
import { DEFAULT_PANELS } from './layout';
import type { PanelId, PanelState } from './layout';

export interface LayoutApi {
    panels: Record<PanelId, PanelState>;
    setPanelState: (id: PanelId, state: PanelState) => void;
}

/** Without a provider (a panel rendered on its own) every panel is simply open. */
const FALLBACK: LayoutApi = {
    panels: Object.fromEntries(Object.keys(DEFAULT_PANELS).map(id => [id, 'open'])) as Record<PanelId, PanelState>,
    setPanelState: () => {},
};

export const LayoutContext = createContext<LayoutApi>(FALLBACK);

export const useLayoutApi = (): LayoutApi => useContext(LayoutContext);
