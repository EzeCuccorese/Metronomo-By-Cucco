import { useEffect, useState } from 'react';

/**
 * Element fullscreen is not dependable on iPhone Safari (it only exists for video there), so the control is
 * detected and hidden instead of shown and failing. iPad, macOS and Android Chrome do support it.
 */
export function isFullscreenSupported(): boolean {
    if (typeof document === 'undefined' || document.fullscreenEnabled !== true) return false;
    return !/iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Enters fullscreen with the whole page. It is called synchronously from the click / key press that opens the stage:
 * browsers only allow it while that user activation is fresh (it would expire before a dialog animation ends).
 * A refusal is fine, the stage still works as a full-window view.
 */
export async function enterFullscreen(): Promise<void> {
    if (!isFullscreenSupported() || document.fullscreenElement) return;
    try {
        await document.documentElement.requestFullscreen();
    } catch {
        // Refused (policy): nothing to do.
    }
}

export async function exitFullscreen(): Promise<void> {
    if (!document.fullscreenElement) return;
    try {
        await document.exitFullscreen();
    } catch {
        // Already leaving.
    }
}

/** Fullscreen state for the stage's own button. `supported` is false where the control should not appear. */
export function useFullscreen() {
    const supported = isFullscreenSupported();
    const [active, setActive] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));
    useEffect(() => {
        const onChange = () => setActive(Boolean(document.fullscreenElement));
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);
    return { supported, active, enter: enterFullscreen, exit: exitFullscreen };
}
