import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePersistentState } from './usePersistentState';
import { LAYOUT_NEW_USER, LAYOUT_TODO, PRESET_PANELS, sanitizeLayout } from '../state/layout';
import type { LayoutPreset, PanelId, PanelState } from '../state/layout';
import type { LayoutApi } from '../state/LayoutContext';
import { STORAGE_PREFIX, writeStored } from '../state/storage';

const LAYOUT_KEY = 'ui.layout.v1';

/** Someone who already used the app has other saved settings (tempo, rhythm, mix...). */
function hasSavedSettings(): boolean {
    try {
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key?.startsWith(STORAGE_PREFIX) && key !== STORAGE_PREFIX + LAYOUT_KEY) return true;
        }
    } catch {
        // Storage unavailable: treat as a new user.
    }
    return false;
}

/**
 * Persisted panel layout (`ui.layout.v1`): a preset ("Vista") plus the state of every panel.
 * New users start on "Ritmos"; people who already had saved settings start on "Todo" so nothing is hidden
 * from them without notice. The first choice is written right away so it does not depend on later saves.
 */
export function useLayout(): LayoutApi {
    const [layout, setLayout] = usePersistentState(LAYOUT_KEY, hasSavedSettings() ? LAYOUT_TODO : LAYOUT_NEW_USER, { sanitize: sanitizeLayout });

    const first = useRef(layout);
    useEffect(() => {
        // Only the very first mount decides; later changes are saved by usePersistentState.
        if (window.localStorage.getItem(STORAGE_PREFIX + LAYOUT_KEY) === null) writeStored(LAYOUT_KEY, first.current);
    }, []);

    const setPanelState = useCallback((id: PanelId, state: PanelState) => {
        setLayout(prev => {
            if (prev.panels[id] === state) return prev;
            const panels = { ...prev.panels, [id]: state };
            return { preset: 'personalizado', panels, custom: panels };
        });
    }, [setLayout]);

    const setPreset = useCallback((preset: LayoutPreset) => {
        setLayout(prev => preset === 'personalizado'
            ? { ...prev, preset, panels: prev.custom }
            : { ...prev, preset, panels: PRESET_PANELS[preset] });
    }, [setLayout]);

    return useMemo(() => ({ preset: layout.preset, panels: layout.panels, setPanelState, setPreset }), [layout.preset, layout.panels, setPanelState, setPreset]);
}
