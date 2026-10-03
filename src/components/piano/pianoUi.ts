import type { MelodyRecordState } from '../../audio/Scheduler';
import type { Melody } from '../../audio/piano/melody';

/** Velocity from where the key was hit: like a real key, deeper (lower) is louder. */
export function velocityFromPointer(clientY: number, rect: { top: number; height: number }): number {
    if (!(rect.height > 0)) return 0.8;
    const depth = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return Math.round((0.35 + 0.65 * depth) * 100) / 100;
}

export const barsLabel = (n: number) => `${n} ${n === 1 ? 'compás' : 'compases'}`;

export interface MelodyStatusInput {
    melody: Melody | null;
    recordState: MelodyRecordState;
    recordingBar: number;
    recordingBars: number;
    isPlaying: boolean;
    loopOn: boolean;
}

/** One-line state of the melody looper (announced politely to screen readers). */
export function melodyStatusText(p: MelodyStatusInput): string {
    if (p.recordState === 'armed') return 'Precuenta… la grabación empieza en el próximo compás';
    if (p.recordState === 'recording') return `Grabando compás ${Math.min(p.recordingBar + 1, p.recordingBars)} de ${p.recordingBars}`;
    if (!p.melody || p.melody.notes.length === 0) return 'Sin melodía grabada';
    const count = p.melody.notes.length;
    const notes = `${count} ${count === 1 ? 'nota' : 'notas'} · ${barsLabel(p.melody.bars)}`;
    if (!p.loopOn) return `${notes} · loop apagado`;
    return p.isPlaying ? `${notes} · sonando en loop` : `${notes} · suena en loop al reproducir`;
}
