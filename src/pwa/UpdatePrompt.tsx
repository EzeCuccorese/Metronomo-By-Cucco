import { Alert, Button, Snackbar } from '@mui/material';

export interface UpdatePromptProps {
  /** A new service worker is installed and waiting. */
  needRefresh: boolean;
  /** The metronome is sounding: reloading now would cut the practice, so the prompt waits. */
  isPlaying: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

/** "Hay una versión nueva": only offered while stopped, never reloads by itself. */
export function UpdatePrompt({ needRefresh, isPlaying, onUpdate, onDismiss }: UpdatePromptProps) {
  return (
    <Snackbar
      open={needRefresh && !isPlaying}
      onClose={(_, reason) => { if (reason !== 'clickaway') onDismiss(); }}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ top: 'calc(8px + env(safe-area-inset-top)) !important' }}
    >
      <Alert
        severity="info"
        variant="filled"
        role="status"
        data-testid="update-prompt"
        action={
          <>
            <Button color="inherit" size="small" onClick={onUpdate} data-testid="update-now">Actualizar</Button>
            <Button color="inherit" size="small" onClick={onDismiss}>Luego</Button>
          </>
        }
      >
        Hay una versión nueva
      </Alert>
    </Snackbar>
  );
}
