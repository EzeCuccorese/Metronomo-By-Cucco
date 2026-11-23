import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_PREFIX } from '../state/storage';
import {
  DEFAULT_SKIN,
  SKINS,
  SKIN_IDS,
  SKIN_STORAGE_KEY,
  applySkinToDocument,
  getSkinTheme,
  isSkinId,
  readInitialSkin,
} from './skins';

describe('skins', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.skin;
  });

  it('exposes obsidian, cosmos, and esmeralda skins with valid themes', () => {
    expect(SKIN_IDS).toEqual(['obsidian', 'cosmos', 'esmeralda']);
    for (const id of SKIN_IDS) {
      expect(isSkinId(id)).toBe(true);
      const theme = getSkinTheme(id);
      expect(theme.palette.mode).toBe('dark');
      expect(theme.palette.primary.main).toBe(SKINS[id].accent);
    }
    expect(isSkinId('brown')).toBe(false);
    expect(isSkinId(123)).toBe(false);
  });

  it('reads initial skin from localStorage and applies document attributes', () => {
    expect(readInitialSkin()).toBe(DEFAULT_SKIN);
    localStorage.setItem(`${STORAGE_PREFIX}${SKIN_STORAGE_KEY}`, JSON.stringify('cosmos'));
    expect(readInitialSkin()).toBe('cosmos');

    applySkinToDocument('esmeralda');
    expect(document.documentElement.dataset.skin).toBe('esmeralda');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
