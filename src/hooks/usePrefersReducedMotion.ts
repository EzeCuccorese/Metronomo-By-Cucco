import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Current preference; false where matchMedia is unavailable (SSR, jsdom). */
export function getPrefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(QUERY).matches;
}

function subscribe(callback: () => void): () => void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const mql = window.matchMedia(QUERY);
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
}

/** Tracks `prefers-reduced-motion: reduce`, updating when the OS setting changes. */
export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, getPrefersReducedMotion, () => false);
}
