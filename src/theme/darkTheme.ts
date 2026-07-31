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
  },
  shape: {
    borderRadius: 20,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#161412',
          border: '1px solid rgba(215, 204, 200, 0.06)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        },
      },
    },
  },
});
