import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresetManager } from './usePresetManager';
import { PRESET_PATTERNS } from '../rhythms/RhythmPatterns';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

describe('usePresetManager', () => {
  it('should initialize with default initialPatternId (rock_basic)', () => {
    const { result } = renderHook(() => usePresetManager());

    expect(result.current.selectedPatternId).toBe('rock_basic');
    expect(result.current.queuedPatternId).toBeNull();
    expect(result.current.activePattern.id).toBe('rock_basic');
    expect(result.current.availablePresets).toBe(PRESET_PATTERNS);
  });

  it('should initialize with a custom initialPatternId', () => {
    const { result } = renderHook(() => usePresetManager('chacarera'));

    expect(result.current.selectedPatternId).toBe('chacarera');
    expect(result.current.activePattern.id).toBe('chacarera');
  });

  it('should update selectedPatternId immediately when not playing', () => {
    const { result } = renderHook(() => usePresetManager());

    act(() => {
      result.current.selectPattern('chacarera', false);
    });

    expect(result.current.selectedPatternId).toBe('chacarera');
    expect(result.current.queuedPatternId).toBeNull();
    expect(result.current.activePattern.id).toBe('chacarera');
  });

  it('should queue pattern when selecting while playing', () => {
    const { result } = renderHook(() => usePresetManager());

    act(() => {
      result.current.selectPattern('samba', true);
    });

    expect(result.current.selectedPatternId).toBe('rock_basic');
    expect(result.current.queuedPatternId).toBe('samba');
    expect(result.current.activePattern.id).toBe('rock_basic');
  });

  it('should apply queued pattern successfully when present', () => {
    const { result } = renderHook(() => usePresetManager());

    act(() => {
      result.current.selectPattern('samba', true);
    });

    let applied = false;
    act(() => {
      applied = result.current.applyQueuedPattern();
    });

    expect(applied).toBe(true);
    expect(result.current.selectedPatternId).toBe('samba');
    expect(result.current.queuedPatternId).toBeNull();
    expect(result.current.activePattern.id).toBe('samba');
  });

  it('should return false when applying queued pattern with no pattern queued', () => {
    const { result } = renderHook(() => usePresetManager());

    let applied = true;
    act(() => {
      applied = result.current.applyQueuedPattern();
    });

    expect(applied).toBe(false);
    expect(result.current.selectedPatternId).toBe('rock_basic');
  });

  it('should allow updating and activating a custom pattern', () => {
    const { result } = renderHook(() => usePresetManager());

    const customPattern: RhythmPattern = {
      id: 'custom_rock',
      name: 'Custom Rock',
      description: 'Modified rock pattern',
      timeSignature: [4, 4],
      subdivision: 8,
      instruments: ['kick'],
      countingMode: 'numbers',
      steps: [{ step: 1, instrument: 'kick', velocity: 1.0 }]
    };

    act(() => {
      result.current.updatePattern(customPattern);
      result.current.selectPattern('custom_rock', false);
    });

    expect(result.current.selectedPatternId).toBe('custom_rock');
    expect(result.current.activePattern.name).toBe('Custom Rock');
  });

  it('should fallback to first PRESET_PATTERNS if pattern ID is unknown', () => {
    const { result } = renderHook(() => usePresetManager('unknown_id_xyz'));

    expect(result.current.activePattern).toBe(PRESET_PATTERNS[0]);
  });
});
