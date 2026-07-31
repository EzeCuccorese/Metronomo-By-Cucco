import { describe, it, expect } from 'vitest';
import { PRESET_PATTERNS, InstrumentIcons } from './RhythmPatterns';
import type { InstrumentType } from './RhythmPatterns';

describe('RhythmPatterns', () => {
    it('should export a non-empty array of PRESET_PATTERNS', () => {
        expect(Array.isArray(PRESET_PATTERNS)).toBe(true);
        expect(PRESET_PATTERNS.length).toBeGreaterThan(0);
    });

    it('should have required fields for every preset pattern', () => {
        PRESET_PATTERNS.forEach(pattern => {
            expect(pattern.id).toBeTypeOf('string');
            expect(pattern.name).toBeTypeOf('string');
            expect(pattern.description).toBeTypeOf('string');
            expect(Array.isArray(pattern.timeSignature)).toBe(true);
            expect(pattern.timeSignature.length).toBe(2);
            expect(pattern.subdivision).toBeTypeOf('number');
            expect(Array.isArray(pattern.instruments)).toBe(true);
            expect(Array.isArray(pattern.steps)).toBe(true);
            expect(pattern.countingMode).toBeTypeOf('string');
        });
    });

    it('should contain valid steps with proper velocity and instrument properties', () => {
        PRESET_PATTERNS.forEach(pattern => {
            pattern.steps.forEach(step => {
                expect(step.step).toBeGreaterThan(0);
                expect(step.velocity).toBeGreaterThanOrEqual(0);
                expect(step.velocity).toBeLessThanOrEqual(1.5);
                expect(pattern.instruments).toContain(step.instrument);
            });
        });
    });

    it('should have icon mappings for all defined instrument types', () => {
        const expectedInstruments: InstrumentType[] = [
            'kick', 'snare', 'hihat', 'ride',
            'tom_high', 'tom_low', 'tom_floor',
            'crash', 'bombo_leguero', 'click',
            'shaker', 'clave', 'rim', 'surdo', 'hihat_foot',
            'caja', 'cajon', 'palmas', 'candombe_chico',
            'candombe_repique', 'candombe_piano'
        ];

        expectedInstruments.forEach(inst => {
            expect(InstrumentIcons[inst]).toBeDefined();
        });
    });

    it('should include core rhythm presets such as rock_basic, chacarera, and metronome_4_4', () => {
        const ids = PRESET_PATTERNS.map(p => p.id);
        expect(ids).toContain('rock_basic');
        expect(ids).toContain('chacarera');
        expect(ids).toContain('metronome_4_4');
        expect(ids).toContain('samba');
        expect(ids).toContain('bossa_nova');
    });
});
