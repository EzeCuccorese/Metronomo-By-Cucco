/**
 * Manages the Web Audio API Context.
 * Singleton pattern to ensure only one context exists.
 * Handles the "resume" logic required by browsers.
 *
 * (ES) Gestiona el Contexto de Web Audio API.
 * Patrón Singleton para asegurar que solo exista un contexto.
 * Maneja la lógica de "resume" requerida por los navegadores.
 */
class AudioContextManager {
    private static instance: AudioContextManager;
    private audioContext: AudioContext;

    private constructor() {
        // (ES) Inicializa el AudioContext estándar con optimizaciones
        const AudioContextClass = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
            throw new Error("Web Audio API not supported in this browser");
        }
        this.audioContext = new AudioContextClass({
            latencyHint: 'interactive',
            sampleRate: 44100,
        });
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
     * Returns the raw AudioContext.
     * (ES) Retorna el AudioContext crudo.
     */
    public getContext(): AudioContext {
        return this.audioContext;
    }

    /**
     * Resumes the context if it is suspended (e.g., after user gesture).
     * (ES) Reanuda el contexto si está suspendido (ej. después de un gesto del usuario).
     */
    public async resume(): Promise<void> {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }
}

export default AudioContextManager;
