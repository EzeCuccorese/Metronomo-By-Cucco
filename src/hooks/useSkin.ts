import { useEffect, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import {
  DEFAULT_SKIN,
  SKIN_STORAGE_KEY,
  SKINS,
  applySkinToDocument,
  getSkinTheme,
  isSkinId,
  type SkinId,
} from '../theme/skins';

/** Persists and applies the active visual skin across MUI, CSS tokens, and document metadata. */
export function useSkin() {
  const [skin, setSkin] = usePersistentState<SkinId>(SKIN_STORAGE_KEY, DEFAULT_SKIN, isSkinId);

  useEffect(() => {
    applySkinToDocument(skin);
  }, [skin]);

  const theme = useMemo(() => getSkinTheme(skin), [skin]);
  const definition = SKINS[skin];

  return useMemo(() => ({ skin, setSkin, definition, theme }), [skin, setSkin, definition, theme]);
}
