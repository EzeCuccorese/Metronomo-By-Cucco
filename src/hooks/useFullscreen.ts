import { useCallback, useEffect, useState } from 'react';

/**
 * Element fullscreen is not dependable on iPhone Safari (it only exists for video there), so the control is
 * detected and hidden instead of shown and failing. iPad, macOS and Android Chrome do support it.
 */
export function isFullscreenSupported(): boolean {
    if (typeof document === 'undefined' || document.fullscreenEnabled !== true) return false;
    return !/iPhone|iPod/.test(navigator.userAgent);
}

/** Fullscreen for one element (the stage overlay). `supported` is false where the control should not appear. */
export function useFullscreen(element: HTMLElement | null) {
    const supported = isFullscreenSupported();
    const [active, setActive] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));

    useEffect(() => {
        const onChange = () => setActive(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const enter = useCallback(async () => {
        if (!supported || !element || document.fullscreenElement) return;
        try {
            await element.requestFullscreen();
        } catch {
            // Refused (no user gesture, policy): the stage still works as a full-window view.
        }
    }, [supported, element]);

    const exit = useCallback(async () => {
        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
            } catch {
                // Already leaving.
            }
        }
    }, []);

    return { supported, active, enter, exit };
}
