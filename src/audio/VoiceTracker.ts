/**
 * Keeps track of every scheduled source node so playback can be cut instantly.
 * Web Audio has no "cancel everything" call: notes scheduled ahead of time keep
 * playing after the transport stops unless each source is stopped explicitly.
 *
 * (ES) Lleva registro de cada fuente agendada para poder cortar la reproducción al instante.
 */
export class VoiceTracker {
    private voices = new Set<AudioScheduledSourceNode>();

    public add(node: AudioScheduledSourceNode) {
        this.voices.add(node);
        node.addEventListener('ended', () => this.voices.delete(node), { once: true });
    }

    /** Stops every tracked voice at `when` (pending ones never sound). */
    public stopAll(when: number) {
        this.voices.forEach(node => {
            try {
                node.stop(when);
            } catch {
                // Already stopped: nothing to do.
            }
        });
        this.voices.clear();
    }

    public get size(): number {
        return this.voices.size;
    }
}
