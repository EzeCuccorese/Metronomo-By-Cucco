import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Current preference; false where matchMedia is unavailable (SSR, jsdom). */
export function getPrefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(QUERY).matches;
}

/** Tracks `prefers-reduced-motion: reduce`, updating when the OS setting changes. */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(getPrefersReducedMotion);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mql = window.matchMedia(QUERY);
        const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    return reduced;
}
