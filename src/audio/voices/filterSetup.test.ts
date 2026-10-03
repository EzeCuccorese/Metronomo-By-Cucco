import { describe, it, expect, vi } from 'vitest';
import { scheduleFilter } from './filterSetup';

describe('scheduleFilter', () => {
    it('schedules frequency and a reset Q at the given time without touching .value', () => {
        const filter = {
            frequency: { value: 0, setValueAtTime: vi.fn() },
            Q: { value: 0, setValueAtTime: vi.fn() },
        } as unknown as BiquadFilterNode;
        scheduleFilter(filter, 1.5, 7000);
        expect(filter.frequency.setValueAtTime).toHaveBeenCalledWith(7000, 1.5);
        expect(filter.Q.setValueAtTime).toHaveBeenCalledWith(1, 1.5);
        expect(filter.frequency.value).toBe(0);
        scheduleFilter(filter, 2, 6000, 5);
        expect(filter.Q.setValueAtTime).toHaveBeenLastCalledWith(5, 2);
    });
});
