import { createTheme } from '@mui/material/styles';
import { BREAKPOINT_VALUES, COARSE_POINTER_QUERY, TOUCH_TARGET } from './breakpoints';

const coarse = `@media ${COARSE_POINTER_QUERY}`;

export const darkTheme = createTheme({
  breakpoints: { values: { ...BREAKPOINT_VALUES } },
  palette: {
    mode: 'dark',
    primary: {
      main: '#e5a95f',
      contrastText: '#181512',
    },
    secondary: {
      main: '#ff6d00',
    },
    // White text on this red reaches 4.98:1 (MUI's default red is 3.7:1).
    error: { main: '#d32f2f' },
    background: {
      default: '#070605',
      paper: '#161412',
    },
    text: {
      primary: '#f4f1ed',
      secondary: '#bfae9e',
    },
    divider: 'rgba(215, 204, 200, 0.08)',
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
  // MUI multiplies numeric `borderRadius` props by this value (`borderRadius: 4` = 16px).
  // The previous value of 20 turned every `borderRadius: 3/4` into 60/80px pills.
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#161412',
          border: '1px solid rgba(215, 204, 200, 0.06)',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
        },
      },
    },
    // Touch targets of at least 44 px on coarse pointers (phones/tablets).
    MuiToggleButton: {
      styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET } } },
    },
    MuiIconButton: {
      styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET } } },
    },
    MuiButton: {
      styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET } } },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET } } },
    },
    MuiChip: {
      styleOverrides: { root: { [coarse]: { height: TOUCH_TARGET, minWidth: TOUCH_TARGET } } },
    },
    MuiCheckbox: {
      styleOverrides: { root: { [coarse]: { minHeight: TOUCH_TARGET, minWidth: TOUCH_TARGET } } },
    },
    // The visible track is thin; the hit area (root padding) is what must reach 44 px.
    MuiSlider: {
      styleOverrides: { root: { [coarse]: { paddingBlock: 20, '&.MuiSlider-vertical': { paddingBlock: 0, paddingInline: 20 } } } },
    },
  },
});
