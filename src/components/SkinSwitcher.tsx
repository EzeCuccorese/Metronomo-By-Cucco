import React, { useState } from 'react';
import { Box, Button, ListItemIcon, ListItemText, MenuItem, MenuList, Popover, Typography } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import { SKIN_IDS, SKINS, type SkinId } from '../theme/skins';

interface SkinSwitcherProps {
  skin: SkinId;
  onSelectSkin: (skin: SkinId) => void;
}

const SWITCHER_BUTTON_SX = {
  flexShrink: 0,
  borderRadius: 2,
  borderColor: 'var(--skin-border-strong)',
  color: 'var(--skin-text)',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '0.8rem',
  px: { xs: 1.25, sm: 1.5 },
  minWidth: 44,
  minHeight: { xs: 44, sm: 34 },
  '@media (pointer: coarse)': { minHeight: 44, minWidth: 44 },
  whiteSpace: 'nowrap',
  '&:hover': {
    borderColor: 'var(--skin-accent)',
    bgcolor: 'rgba(var(--skin-accent-rgb), 0.08)',
  },
} as const;

const SkinMenuOption: React.FC<{ id: SkinId; selected: boolean; onPick: () => void }> = ({ id, selected, onPick }) => {
  const def = SKINS[id];
  return (
    <MenuItem role="menuitemradio" aria-checked={selected} data-testid={`skin-option-${id}`} selected={selected} onClick={onPick} sx={{ minHeight: { xs: 44, sm: 40 }, gap: 0.5 }}>
      <ListItemIcon sx={{ minWidth: 28 }}>
        <Box component="span" aria-hidden sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: def.accent, border: `2px solid ${def.secondary}`, boxShadow: selected ? `0 0 8px ${def.accent}` : 'none' }} />
      </ListItemIcon>
      <ListItemText primary={def.name} secondary={def.subtitle} />
    </MenuItem>
  );
};

/** Compact skin picker placed alongside the workspace tabs inside the navigation bar. */
export const SkinSwitcher: React.FC<SkinSwitcherProps> = ({ skin, onSelectSkin }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = SKINS[skin];
  const open = anchor !== null;

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        data-testid="skin-switcher"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Skin: ${current.name}. Cambiar skin`}
        onClick={(e) => setAnchor(e.currentTarget)}
        startIcon={(
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
            <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: current.accent, boxShadow: `0 0 8px ${current.accent}` }} />
            <PaletteIcon fontSize="small" />
          </Box>
        )}
        sx={SWITCHER_BUTTON_SX}
      >
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{current.name}</Box>
      </Button>
      <Popover open={open} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuList dense autoFocusItem aria-label="Skins" sx={{ py: 0.5, minWidth: 210 }}>
          <Typography variant="overline" component="div" sx={{ px: 2, pt: 0.5, color: 'text.secondary', lineHeight: 2 }}>
            Skin visual
          </Typography>
          {SKIN_IDS.map((id) => (
            <SkinMenuOption key={id} id={id} selected={skin === id} onPick={() => { onSelectSkin(id); setAnchor(null); }} />
          ))}
        </MenuList>
      </Popover>
    </>
  );
};
