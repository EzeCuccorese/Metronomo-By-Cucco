import { Box, Chip, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { groupedShortcuts, shadowNote, shadowedBy } from '../shortcuts/registry';
import type { ShortcutDef } from '../shortcuts/registry';

interface ShortcutsDialogProps {
    open: boolean;
    onClose: () => void;
}

const keycapSx = { fontFamily: '"Share Tech Mono", monospace', fontSize: 13, height: 24, borderRadius: '4px', bgcolor: '#26211b', border: '1px solid #4a4034', color: '#f0e6d8' } as const;

function conflictNote(def: ShortcutDef): string | null {
    const note = shadowNote(def);
    return note && shadowedBy(def).length > 0 ? `Con Teclado PC activo, ${def.display} toca ${note} (usá el botón TAP).` : null;
}

/**
 * Cheat sheet of every keyboard shortcut, generated from the registry.
 *
 * (ES) Hoja de atajos de teclado (se abre con ?).
 */
export default function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="shortcuts-title" data-testid="shortcuts-dialog">
            <DialogTitle id="shortcuts-title" sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
                <Box component="span" sx={{ flex: 1 }}>Atajos de teclado</Box>
                <IconButton aria-label="Cerrar" onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {groupedShortcuts().map(({ group, items }) => (
                    <Box key={group} component="section" sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
                        <Typography variant="overline" component="h3" sx={{ color: '#e5a95f' }}>{group}</Typography>
                        <Box component="dl" sx={{ m: 0 }}>
                            {items.map(def => {
                                const note = conflictNote(def);
                                return (
                                    <Box key={def.id} sx={{ display: 'flex', alignItems: 'baseline', gap: 2, py: 0.5 }} data-testid={`shortcut-${def.id}`}>
                                        <Box component="dt" sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2">{def.label}</Typography>
                                            {note && <Typography variant="caption" sx={{ color: '#e5a95f' }}>{note}</Typography>}
                                            {def.scope === 'piano' && <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>Con Teclado PC activo o con el foco en el piano</Typography>}
                                        </Box>
                                        <Box component="dd" sx={{ m: 0, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'flex-end', maxWidth: '55%' }}>
                                            {(def.separateKeys ? def.display.split(' ') : [def.display]).map((k, i) => <Chip key={`${k}-${i}`} size="small" label={k} sx={keycapSx} />)}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                ))}
            </DialogContent>
        </Dialog>
    );
}
