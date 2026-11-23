import { createTheme, type Theme } from '@mui/material/styles';
import { BREAKPOINT_VALUES, COARSE_POINTER_QUERY, TOUCH_TARGET } from './breakpoints';
import { STORAGE_PREFIX, readStored } from '../state/storage';

export const SKIN_IDS = ['obsidian', 'cosmos', 'esmeralda'] as const;
export type SkinId = (typeof SKIN_IDS)[number];
export const DEFAULT_SKIN: SkinId = 'obsidian';
export const SKIN_STORAGE_KEY = 'ui.skin.v1';

export interface SkinCanvasPalette {
  bodyStops: readonly [string, string, string];
  faceStops: readonly [string, string];
  accent: string;
  accentBright: string;
  accentSecondary: string;
  text: string;
  gridBorder: string;
  glowRgb: string;
}

export interface SkinDefinition {
  id: SkinId;
  name: string;
  subtitle: string;
  bg: string;
  chassis: string;
  surface: string;
  recessed: string;
  elevated: string;
  accent: string;
  accentStrong: string;
  accentText: string;
  secondary: string;
  warm: string;
  text: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
  accentRgb: string;
  secondaryRgb: string;
  themeColor: string;
  canvas: SkinCanvasPalette;
}

export const SKINS: Record<SkinId, SkinDefinition> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidiana',
    subtitle: 'Pizarra y oro',
    bg: '#090c12',
    chassis: '#0d1118',
    surface: '#121722',
    recessed: '#0b0e15',
    elevated: '#171e2c',
    accent: '#f5b851',
    accentStrong: '#ffd54f',
    accentText: '#0b0e15',
    secondary: '#38bdf8',
    warm: '#f97316',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.16)',
    borderStrong: 'rgba(148, 163, 184, 0.28)',
    accentRgb: '245, 184, 81',
    secondaryRgb: '56, 189, 248',
    themeColor: '#0d1118',
    canvas: {
      bodyStops: ['#182030', '#253147', '#30405c'],
      faceStops: ['#0b0e15', '#151c29'],
      accent: '#e5a95f',
      accentBright: '#ffe082',
      accentSecondary: '#ff6d00',
      text: '#f4f1ed',
      gridBorder: 'rgba(148, 163, 184, 0.25)',
      glowRgb: '245, 184, 81',
    },
  },
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    subtitle: 'Espacio y nebulosa',
    bg: '#040612',
    chassis: '#080c1f',
    surface: '#0e142c',
    recessed: '#070b1a',
    elevated: '#141d40',
    accent: '#38e8ff',
    accentStrong: '#7dd3fc',
    accentText: '#040612',
    secondary: '#c084fc',
    warm: '#e879f9',
    text: '#eef4ff',
    textSecondary: '#a5b8de',
    border: 'rgba(125, 211, 252, 0.22)',
    borderStrong: 'rgba(167, 139, 250, 0.38)',
    accentRgb: '56, 232, 255',
    secondaryRgb: '192, 132, 252',
    themeColor: '#040612',
    canvas: {
      bodyStops: ['#0d1430', '#162048', '#22306b'],
      faceStops: ['#050817', '#0e1535'],
      accent: '#38e8ff',
      accentBright: '#a5f3fc',
      accentSecondary: '#c084fc',
      text: '#eef4ff',
      gridBorder: 'rgba(125, 211, 252, 0.28)',
      glowRgb: '56, 232, 255',
    },
  },
  esmeralda: {
    id: 'esmeralda',
    name: 'Esmeralda',
    subtitle: 'Sintetizador nocturno',
    bg: '#060f0d',
    chassis: '#0a1613',
    surface: '#0f201b',
    recessed: '#081210',
    elevated: '#142a24',
    accent: '#34d399',
    accentStrong: '#6ee7b7',
    accentText: '#05120e',
    secondary: '#2dd4bf',
    warm: '#a3e635',
    text: '#ecfdf5',
    textSecondary: '#94b8ad',
    border: 'rgba(52, 211, 153, 0.20)',
    borderStrong: 'rgba(52, 211, 153, 0.36)',
    accentRgb: '52, 211, 153',
    secondaryRgb: '45, 212, 191',
    themeColor: '#060f0d',
    canvas: {
      bodyStops: ['#0e211c', '#16332b', '#1e463b'],
      faceStops: ['#07120f', '#10241e'],
      accent: '#34d399',
      accentBright: '#a7f3d0',
      accentSecondary: '#a3e635',
      text: '#ecfdf5',
      gridBorder: 'rgba(52, 211, 153, 0.28)',
      glowRgb: '52, 211, 153',
    },
  },
};

export const isSkinId = (v: unknown): v is SkinId =>
  typeof v === 'string' && SKIN_IDS.includes(v as SkinId);

/** Reads the persisted skin synchronously before first paint (CSP-safe replacement for inline script). */
export function readInitialSkin(): SkinId {
  try {
    if (typeof window === 'undefined' || window.localStorage.getItem(STORAGE_PREFIX + SKIN_STORAGE_KEY) === null) {
      return DEFAULT_SKIN;
    }
    return readStored(SKIN_STORAGE_KEY, DEFAULT_SKIN, isSkinId);
  } catch {
    return DEFAULT_SKIN;
  }
}

/** Applies data-skin, color-scheme, and theme-color meta tag onto documentElement. */
export function applySkinToDocument(skinId: SkinId): void {
  if (typeof document === 'undefined') return;
  const skin = SKINS[skinId];
  document.documentElement.dataset.skin = skin.id;
  document.documentElement.style.colorScheme = 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', skin.themeColor);
}

const coarse = `@media ${COARSE_POINTER_QUERY}`;
const themeCache = new Map<SkinId, Theme>();

function buildSkinComponents(skin: SkinDefinition): Theme['components'] {
  return {
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none', backgroundColor: skin.surface, border: `1px solid ${skin.border}`, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)' } },
    },
    MuiPopover: {
      styleOverrides: { paper: { backgroundImage: 'none', backgroundColor: skin.elevated, border: `1px solid ${skin.borderStrong}`, boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)' } },
    },
    MuiSnackbarContent: {
      styleOverrides: { root: { backgroundColor: skin.elevated, color: skin.text, border: `1px solid rgba(${skin.accentRgb}, 0.35)`, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)' } },
    },
    MuiToggleButton: { styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET } } } },
    MuiIconButton: { styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET } } } },
    MuiButton: { styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET } } } },
    MuiOutlinedInput: { styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET } } } },
    MuiChip: { styleOverrides: { root: { [coarse]: { height: TOUCH_TARGET, minWidth: TOUCH_TARGET } } } },
    MuiCheckbox: { styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET } } } },
    MuiSlider: { styleOverrides: { root: { [coarse]: { paddingBlock: 20, '&.MuiSlider-vertical': { paddingBlock: 0, paddingInline: 20 } } } } },
  };
}

function buildSkinTheme(skin: SkinDefinition): Theme {
  return createTheme({
    breakpoints: { values: { ...BREAKPOINT_VALUES } },
    palette: {
      mode: 'dark',
      primary: { main: skin.accent, contrastText: skin.accentText },
      secondary: { main: skin.warm },
      error: { main: '#dc2626' },
      background: { default: skin.bg, paper: skin.surface },
      text: { primary: skin.text, secondary: skin.textSecondary },
      divider: skin.border,
    },
    typography: {
      fontFamily: '"Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '4rem', fontWeight: 900, letterSpacing: '-0.02em' },
      h3: { fontSize: '3rem', fontWeight: 800, fontFamily: '"Share Tech Mono", monospace' },
      h5: { fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.05em' },
      subtitle2: { fontWeight: 700 },
      overline: { fontWeight: 800, letterSpacing: '0.14em', lineHeight: 1.6 },
      caption: { lineHeight: 1.4 },
    },
    shape: { borderRadius: 4 },
    components: buildSkinComponents(skin),
  });
}

/** Returns a cached MUI Theme for the requested skin. */
export function getSkinTheme(skinId: SkinId): Theme {
  const cached = themeCache.get(skinId);
  if (cached) return cached;
  const built = buildSkinTheme(SKINS[skinId]);
  themeCache.set(skinId, built);
  return built;
}
