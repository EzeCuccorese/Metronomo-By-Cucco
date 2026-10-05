import { useCallback, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import { DEFAULT_LAYOUT, sanitizeLayout } from '../state/layout';
import type { PanelId, PanelState } from '../state/layout';
import type { LayoutApi } from '../state/LayoutContext';

/** Persisted panel layout (`ui.layout.v1`): which panels are open, folded or hidden. */
export function useLayout(): LayoutApi {
    const [layout, setLayout] = usePersistentState('ui.layout.v1', DEFAULT_LAYOUT, { sanitize: sanitizeLayout });
    const setPanelState = useCallback((id: PanelId, state: PanelState) => {
        setLayout(prev => (prev.panels[id] === state ? prev : { ...prev, panels: { ...prev.panels, [id]: state } }));
    }, [setLayout]);
    return useMemo(() => ({ panels: layout.panels, setPanelState }), [layout.panels, setPanelState]);
}
