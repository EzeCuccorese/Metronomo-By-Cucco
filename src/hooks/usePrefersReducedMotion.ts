import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Current `prefers-reduced-motion: reduce` preference. */
export function getPrefersReducedMotion(): boolean {
    return window.matchMedia(QUERY).matches;
}

function subscribe(callback: () => void): () => void {
    const mql = window.matchMedia(QUERY);
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
}

/** Tracks `prefers-reduced-motion: reduce`, updating when the OS setting changes. */
export function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, getPrefersReducedMotion);
}
