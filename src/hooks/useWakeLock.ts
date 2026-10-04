import { useEffect } from 'react';

/**
 * Keeps the screen on while `active` (Screen Wake Lock API). The system releases the lock
 * whenever the page is hidden, so it is requested again when the page becomes visible.
 * A refused request (NotAllowedError: low battery, power saving...) is ignored: playback goes on.
 *
 * (ES) Mantiene la pantalla encendida mientras `active`. Si el sistema rechaza el pedido
 * (batería baja, ahorro de energía), se sigue sin wake lock.
 */
export function useWakeLock(active: boolean): void {
    useEffect(() => {
        if (!active || !('wakeLock' in navigator)) return;

        let sentinel: WakeLockSentinel | null = null;
        let cancelled = false;

        const request = async () => {
            if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
            try {
                const lock = await navigator.wakeLock.request('screen');
                if (cancelled) {
                    void lock.release().catch(() => undefined);
                    return;
                }
                sentinel = lock;
            } catch (error) {
                console.warn('Screen wake lock unavailable; the screen may turn off', error);
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') void request();
        };

        void request();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined);
            sentinel = null;
        };
    }, [active]);
}
