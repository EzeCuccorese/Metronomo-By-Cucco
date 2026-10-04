/**
 * Manages the Web Audio API Context.
 * Singleton pattern to ensure only one context is alive at a time.
 * Handles the "resume" logic required by browsers and the iOS quirks around it:
 * - `navigator.audioSession.type = 'playback'` so the silent switch does not mute the metronome;
 * - automatic resume when the page becomes visible again or the context is interrupted (calls, lock screen);
 * - `resume()` rejected without user activation: retried on the next tap or key press;
 * - `resume()` that never settles or a context that stays muted (WebKit bug 291892): the context is
 *   recreated and every consumer rebuilds its nodes through `onContextReplaced`.
 *
 * (ES) Gestiona el Contexto de Web Audio API (uno solo vivo a la vez) y los problemas de iOS:
 * sesión de audio 'playback' (suena con el switch de silencio), reanudación automática al volver
 * a la app, reintento en el próximo gesto si WebKit rechaza `resume()`, y recreación del contexto
 * si `resume()` se cuelga o el contexto queda mudo.
 */

/** Longest wait for `resume()` before the context is considered stuck. */
export const RESUME_TIMEOUT_MS = 1000;
/** Delay after a successful resume before checking that the audio clock actually advances. */
export const MUTE_CHECK_MS = 500;
/** Recreations allowed in a row without the new context ever running (avoids loops without a gesture). */
const MAX_RECREATIONS = 2;

type ContextState = AudioContextState | 'interrupted';
type ContextReplacedListener = (context: AudioContext) => void;

/** Audio Session API (WebKit only, Safari 17+). Chrome lacks it, so it is always feature-checked. */
interface NavigatorAudioSession {
    audioSession?: { type: string };
}

const needsResume = (context: AudioContext): boolean => {
    const state = context.state as ContextState;
    return state === 'suspended' || state === 'interrupted';
};

const isPageVisible = (): boolean => document.visibilityState === 'visible';

class AudioContextManager {
    private static instance: AudioContextManager;
    private audioContext: AudioContext;
    private readonly listeners = new Set<ContextReplacedListener>();
    private resuming: Promise<void> | null = null;
    private gestureRetry: AbortController | null = null;
    /** Set once the app asked for sound; before that the context is left alone. */
    private wantsAudio = false;
    private recreations = 0;
    private muteCheck: ReturnType<typeof setTimeout> | undefined;

    /** A resume failed (no user activation, call in progress...) and waits for the next gesture. */
    public pendingResume = false;

    private constructor() {
        // Must be set before the context starts: the default 'auto'/'ambient' category obeys the silent switch.
        const session = (navigator as Navigator & NavigatorAudioSession).audioSession;
        if (session) {
            try {
                session.type = 'playback';
            } catch (error) {
                console.warn('Could not set the audio session type', error);
            }
        }
        this.audioContext = this.createContext();
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    /**
     * Returns the singleton instance.
     * (ES) Retorna la instancia única.
     */
    public static getInstance(): AudioContextManager {
        if (!AudioContextManager.instance) {
            AudioContextManager.instance = new AudioContextManager();
        }
        return AudioContextManager.instance;
    }

    /**
     * Returns the current AudioContext. It may be replaced later: keep it only together with
     * an `onContextReplaced` subscription.
     * (ES) Retorna el AudioContext actual (puede ser reemplazado).
     */
    public getContext(): AudioContext {
        return this.audioContext;
    }

    /** Output latency reported by the browser in seconds (Bluetooth adds a lot), 0 when unknown. */
    public getOutputLatency(): number {
        const latency = (this.audioContext as Partial<AudioContext>).outputLatency;
        return typeof latency === 'number' && Number.isFinite(latency) ? latency : 0;
    }

    /**
     * Subscribes to context replacements. Consumers must drop every node built on the old
     * context and rebuild on the one passed in. Returns the unsubscribe function.
     * (ES) Avisa cuando el contexto fue recreado: hay que reconstruir todos los nodos.
     */
    public onContextReplaced(listener: ContextReplacedListener): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    /**
     * Resumes the context if it is suspended or interrupted (e.g., after a user gesture).
     * Rejects when the browser refuses; the manager then retries on the next tap or key press.
     * (ES) Reanuda el contexto si está suspendido o interrumpido.
     */
    public resume(): Promise<void> {
        this.wantsAudio = true;
        const context = this.audioContext;
        if (!needsResume(context)) {
            this.pendingResume = false;
            return Promise.resolve();
        }
        if (this.resuming) return this.resuming;

        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<'timeout'>(resolve => {
            timer = setTimeout(() => resolve('timeout'), RESUME_TIMEOUT_MS);
        });
        const attempt = context.resume().then(() => 'resumed' as const);

        const resuming = Promise.race([attempt, timeout])
            .then(
                result => {
                    if (context !== this.audioContext) return; // replaced meanwhile
                    if (result === 'timeout') {
                        this.handleStuckResume();
                        return;
                    }
                    if (needsResume(context)) {
                        // Resolved but still not running: treat it like a refusal.
                        this.markPending();
                        return;
                    }
                    this.pendingResume = false;
                    this.scheduleMuteCheck(context);
                },
                (error: unknown) => {
                    if (context === this.audioContext) this.markPending();
                    throw error;
                },
            )
            .finally(() => {
                clearTimeout(timer);
                if (this.resuming === resuming) this.resuming = null;
            });
        this.resuming = resuming;
        return resuming;
    }

    /** Fire-and-forget resume used by the automatic triggers; failures are handled internally. */
    private autoResume() {
        void this.resume().catch(() => undefined);
    }

    private createContext(): AudioContext {
        // No forced sampleRate: using the device's native rate avoids resampling latency (most phones run at 48 kHz).
        const context = new window.AudioContext({ latencyHint: 'interactive' });
        context.addEventListener?.('statechange', this.handleStateChange);
        return context;
    }

    private readonly handleStateChange = () => {
        if (this.wantsAudio && isPageVisible() && needsResume(this.audioContext)) this.autoResume();
    };

    private readonly handleVisibilityChange = () => {
        if (this.wantsAudio && isPageVisible() && needsResume(this.audioContext)) this.autoResume();
    };

    private markPending() {
        this.pendingResume = true;
        if (this.gestureRetry) return;
        const controller = new AbortController();
        this.gestureRetry = controller;
        const retry = () => {
            controller.abort(); // removes the other listener too
            if (this.gestureRetry === controller) this.gestureRetry = null;
            this.recreations = 0; // a real gesture deserves a fresh attempt
            this.autoResume();
        };
        const options = { once: true, capture: true, signal: controller.signal };
        document.addEventListener('pointerdown', retry, options);
        document.addEventListener('keydown', retry, options);
    }

    private handleStuckResume() {
        // A hidden page may legitimately wait; only a visible one points at the WebKit bug.
        if (isPageVisible() && this.recreations < MAX_RECREATIONS) {
            this.recreate();
        } else {
            this.markPending();
        }
    }

    private scheduleMuteCheck(context: AudioContext) {
        clearTimeout(this.muteCheck);
        const startedAt = context.currentTime;
        this.muteCheck = setTimeout(() => {
            if (context !== this.audioContext || !isPageVisible() || context.state !== 'running') return;
            if (context.currentTime > startedAt) {
                this.recreations = 0; // healthy
            } else if (this.recreations < MAX_RECREATIONS) {
                // 'running' but the audio clock is frozen: the muted context of WebKit bug 291892.
                this.recreate();
            }
        }, MUTE_CHECK_MS);
    }

    /** Closes the current context, creates a new one and lets every consumer rebuild its graph. */
    private recreate() {
        this.recreations++;
        clearTimeout(this.muteCheck);
        const old = this.audioContext;
        old.removeEventListener?.('statechange', this.handleStateChange);
        try {
            void old.close().catch(() => undefined);
        } catch {
            // Already closed.
        }
        this.audioContext = this.createContext();
        this.resuming = null;
        console.warn('AudioContext was stuck; recreated it');
        this.listeners.forEach(listener => {
            try {
                listener(this.audioContext);
            } catch (error) {
                console.error('Context replacement listener failed', error);
            }
        });
        this.autoResume();
    }
}

export default AudioContextManager;
