import { useState, useCallback, useMemo } from 'react';
import { PRESET_PATTERNS } from '../rhythms/RhythmPatterns';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

export function usePresetManager(initialPatternId = 'rock_basic') {
  const [selectedPatternId, setSelectedPatternId] = useState<string>(initialPatternId);
  const [queuedPatternId, setQueuedPatternId] = useState<string | null>(null);
  const [customPatterns, setCustomPatterns] = useState<Record<string, RhythmPattern>>({});

  const activePattern = useMemo(() => {
    return customPatterns[selectedPatternId] || 
           PRESET_PATTERNS.find(p => p.id === selectedPatternId) || 
           PRESET_PATTERNS[0];
  }, [selectedPatternId, customPatterns]);

  const selectPattern = useCallback((patternId: string, isPlaying = false) => {
    if (isPlaying) {
      setQueuedPatternId(patternId);
    } else {
      setSelectedPatternId(patternId);
      setQueuedPatternId(null);
    }
  }, []);

  const applyQueuedPattern = useCallback(() => {
    if (queuedPatternId) {
      setSelectedPatternId(queuedPatternId);
      setQueuedPatternId(null);
      return true;
    }
    return false;
  }, [queuedPatternId]);

  const updatePattern = useCallback((updatedPattern: RhythmPattern) => {
    setCustomPatterns(prev => ({
      ...prev,
      [updatedPattern.id]: updatedPattern
    }));
  }, []);

  return {
    selectedPatternId,
    queuedPatternId,
    activePattern,
    selectPattern,
    applyQueuedPattern,
    updatePattern,
    availablePresets: PRESET_PATTERNS
  };
}
