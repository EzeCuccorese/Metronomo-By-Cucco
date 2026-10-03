/**
 * Schedules a pooled filter's frequency and Q at `time` (and resets Q to a neutral value),
 * instead of assigning `.value`, which applies immediately and could leak into a reused
 * node's still-pending/playing voice.
 *
 * (ES) Programa frecuencia y Q del filtro en `time`; `.value` se aplicaría de inmediato.
 */
export function scheduleFilter(filter: BiquadFilterNode, time: number, frequency: number, q = 1): void {
    filter.frequency.setValueAtTime(frequency, time);
    filter.Q.setValueAtTime(q, time);
}
