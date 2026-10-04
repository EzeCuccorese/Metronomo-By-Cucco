import { useMemo, useState } from 'react';
import { Dialog } from '@mui/material';
import { Command } from 'cmdk';
import { shortcutCommands } from '../shortcuts/commands';
import { MAX_BPM, MIN_BPM } from '../rhythms/meter';

export interface PaletteCommand {
    id: string;
    label: string;
    group: string;
    /** Extra words the search also matches. */
    keywords?: string[];
    /** Shortcut shown on the right. */
    hint?: string;
    run: () => void;
}

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
    /** Commands that are not shortcuts (rhythms, ...). Every non-piano registry shortcut is added automatically. */
    commands: PaletteCommand[];
    onSetBpm: (bpm: number) => void;
    tempoLocked?: boolean;
}

const paletteSx = {
    '& [cmdk-root]': { display: 'flex', flexDirection: 'column', maxHeight: '70vh' },
    '& [cmdk-input]': {
        font: 'inherit', fontSize: 16, color: 'text.primary', bgcolor: 'transparent', border: 0, borderBottom: '1px solid #333',
        outline: 'none', px: 2, py: 1.5, width: '100%', boxSizing: 'border-box',
    },
    '& [cmdk-list]': { overflowY: 'auto', p: 1, flex: 1 },
    '& [cmdk-group-heading]': { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e5a95f', px: 1, py: 0.75 },
    '& [cmdk-item]': { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 1.5, py: 1, borderRadius: 1, cursor: 'pointer', fontSize: 14, minHeight: 36 },
    '& [cmdk-item][data-selected="true"]': { bgcolor: 'rgba(229,169,95,0.18)' },
    '& [cmdk-item][data-disabled="true"]': { opacity: 0.45, cursor: 'default' },
    '& [cmdk-empty]': { p: 2, color: 'text.secondary', fontSize: 14 },
    '& .palette-hint': { fontFamily: '"Share Tech Mono", monospace', fontSize: 12, color: '#c8bfae', border: '1px solid #4a4034', borderRadius: '4px', px: 0.75, bgcolor: '#26211b', whiteSpace: 'nowrap' },
} as const;

/**
 * Command palette (Cmd/Ctrl+K): search and run any shortcut, jump to a rhythm or type a tempo.
 * cmdk provides the filtering and keyboard navigation; MUI provides the dialog and the look.
 *
 * (ES) Paleta de comandos.
 */
export default function CommandPalette({ open, onClose, commands, onSetBpm, tempoLocked = false }: CommandPaletteProps) {
    const [search, setSearch] = useState('');
    const all = useMemo(() => [...shortcutCommands(), ...commands], [commands]);
    const groups = useMemo(() => {
        const map = new Map<string, PaletteCommand[]>();
        for (const c of all) {
            const list = map.get(c.group);
            if (list) list.push(c); else map.set(c.group, [c]);
        }
        return Array.from(map.entries());
    }, [all]);

    const bpmMatch = /^(\d{2,3})(?:\s*bpm)?$/i.exec(search.trim());
    const typedBpm = bpmMatch ? Number(bpmMatch[1]) : null;
    const bpmValid = typedBpm !== null && typedBpm >= MIN_BPM && typedBpm <= MAX_BPM;

    const close = () => { setSearch(''); onClose(); };
    const run = (fn: () => void) => { close(); fn(); };

    return (
        <Dialog open={open} onClose={close} fullWidth maxWidth="sm" data-testid="command-palette"
            slotProps={{ paper: { 'aria-label': 'Paleta de comandos', sx: { alignSelf: 'flex-start', mt: { xs: 2, sm: '12vh' }, ...paletteSx } } }}>
            <Command label="Paleta de comandos" loop>
                <Command.Input value={search} onValueChange={setSearch} placeholder="Buscá un comando, un ritmo o escribí un tempo…" autoFocus />
                <Command.List>
                    <Command.Empty>No hay comandos que coincidan.</Command.Empty>
                    {typedBpm !== null && (
                        <Command.Group heading="Tempo">
                            <Command.Item
                                value={`tempo ${typedBpm}`}
                                forceMount
                                disabled={!bpmValid || tempoLocked}
                                onSelect={() => run(() => onSetBpm(typedBpm))}
                            >
                                {bpmValid ? `Poner tempo ${typedBpm} BPM` : `Tempo ${typedBpm}: fuera de ${MIN_BPM}–${MAX_BPM} BPM`}
                                {tempoLocked && ' (bloqueado por el entrenador)'}
                            </Command.Item>
                        </Command.Group>
                    )}
                    {groups.map(([group, items]) => (
                        <Command.Group key={group} heading={group}>
                            {items.map(c => (
                                <Command.Item key={c.id} value={`${c.group} ${c.label}`} keywords={[...(c.keywords ?? []), ...(c.hint ? [c.hint] : [])]} onSelect={() => run(c.run)}>
                                    <span>{c.label}</span>
                                    {c.hint && <span className="palette-hint">{c.hint}</span>}
                                </Command.Item>
                            ))}
                        </Command.Group>
                    ))}
                </Command.List>
            </Command>
        </Dialog>
    );
}

