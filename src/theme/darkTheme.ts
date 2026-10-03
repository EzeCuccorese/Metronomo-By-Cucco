import { createTheme } from '@mui/material/styles';

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e5a95f',
      contrastText: '#181512',
    },
    secondary: {
      main: '#ff6d00',
    },
    background: {
      default: '#0c0b0a',
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
    // Comfortable touch targets on coarse pointers (phones/tablets).
    MuiToggleButton: {
      styleOverrides: { root: { '@media (pointer: coarse)': { minHeight: 40, minWidth: 40 } } },
    },
    MuiIconButton: {
      styleOverrides: { root: { '@media (pointer: coarse)': { minHeight: 40, minWidth: 40 } } },
    },
    MuiButton: {
      styleOverrides: { root: { '@media (pointer: coarse)': { minHeight: 40 } } },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { '@media (pointer: coarse)': { minHeight: 44 } } },
    },
  },
});
