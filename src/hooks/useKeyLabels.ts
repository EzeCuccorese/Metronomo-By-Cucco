import { useEffect, useMemo, useState } from 'react';
import { fallbackKeyLabel } from '../audio/piano/notes';

interface KeyboardLayoutMap { get(code: string): string | undefined }
/** Chromium's `navigator.keyboard` is not an EventTarget (no `layoutchange`), so the listener methods are optional. */
interface NavigatorKeyboard {
    getLayoutMap?: () => Promise<KeyboardLayoutMap>;
    addEventListener?: EventTarget['addEventListener'];
    removeEventListener?: EventTarget['removeEventListener'];
}

/** Label for a physical key given the browser's layout map (Chromium); QWERTY/Ñ fallback otherwise. */
export function labelFor(code: string, map: KeyboardLayoutMap | null): string {
    const mapped = map?.get(code);
    // Dead keys or empty entries: fall back instead of showing nothing.
    if (!mapped || mapped.length === 0) return fallbackKeyLabel(code);
    return mapped.length === 1 ? mapped.toUpperCase() : mapped;
}

/**
 * Returns a `code -> label` function. In Chromium it uses `navigator.keyboard.getLayoutMap()`
 * so AZERTY, QWERTZ and Spanish keyboards show the letter that is really printed on the key
 * (and follows layout changes); Safari and Firefox do not have it and get the fallback.
 *
 * (ES) Etiquetas de teclas según el layout real del teclado.
 */
export function useKeyLabels(): (code: string) => string {
    const [map, setMap] = useState<KeyboardLayoutMap | null>(null);

    useEffect(() => {
        const keyboard = (navigator as Navigator & { keyboard?: NavigatorKeyboard }).keyboard;
        if (typeof keyboard?.getLayoutMap !== 'function') return;
        let cancelled = false;
        const load = () => {
            keyboard.getLayoutMap!().then(m => { if (!cancelled) setMap(m); }).catch(() => undefined);
        };
        load();
        keyboard.addEventListener?.('layoutchange', load);
        return () => {
            cancelled = true;
            keyboard.removeEventListener?.('layoutchange', load);
        };
    }, []);

    return useMemo(() => (code: string) => labelFor(code, map), [map]);
}
