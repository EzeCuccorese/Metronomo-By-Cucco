import { SHORTCUTS } from './registry';
import { invokeShortcut } from './dispatcher';
import type { PaletteCommand } from '../components/CommandPalette';

/** Every global shortcut is also a command: the palette is generated from the same registry. */
export function shortcutCommands(): PaletteCommand[] {
    return SHORTCUTS.filter(s => s.scope === 'global' && s.id !== 'palette.open').map(s => ({
        id: s.id,
        label: s.label,
        group: s.group,
        hint: s.display,
        run: () => invokeShortcut(s.id),
    }));
}
