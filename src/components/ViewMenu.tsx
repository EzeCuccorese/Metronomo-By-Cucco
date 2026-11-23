import React, { useState } from 'react';
import { Box, Button, Divider, Drawer, ListItemIcon, ListItemText, MenuItem, MenuList, Popover, Typography, useMediaQuery } from '@mui/material';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import { useLayoutApi } from '../state/LayoutContext';
import { PANEL_IDS, PANEL_LABELS, PANEL_PRESET_ORDER, PRESET_LABELS } from '../state/layout';
import { SKIN_IDS, SKINS, type SkinId } from '../theme/skins';

const PHONE_QUERY = '(max-width: 599.98px)';

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="overline" component="div" sx={{ px: 2, pt: 1, color: 'text.secondary', lineHeight: 2 }}>{children}</Typography>
);

interface ViewListProps {
  extra?: React.ReactNode;
  onPick?: () => void;
  onStageMode?: () => void;
  skin?: SkinId;
  onSelectSkin?: (skin: SkinId) => void;
}

/** Presets and the per-panel switches. Shared by the desktop menu and the phone bottom sheet. */
const ViewList: React.FC<ViewListProps> = ({ extra, onPick, onStageMode, skin, onSelectSkin }) => {
  const layout = useLayoutApi();
  return (
    <MenuList dense autoFocusItem aria-label="Vista" sx={{ py: 0 }}>
      <Heading>Vista</Heading>
      {PANEL_PRESET_ORDER.map(preset => (
        <MenuItem
          key={preset}
          role="menuitemradio"
          aria-checked={layout.preset === preset}
          onClick={() => { layout.setPreset(preset); onPick?.(); }}
          sx={{ minHeight: { xs: 44, sm: 36 } }}
        >
          <ListItemIcon>{layout.preset === preset ? <RadioButtonCheckedIcon fontSize="small" color="primary" /> : <RadioButtonUncheckedIcon fontSize="small" />}</ListItemIcon>
          <ListItemText>{PRESET_LABELS[preset]}</ListItemText>
        </MenuItem>
      ))}
      <Divider />
      <Heading>Paneles</Heading>
      {PANEL_IDS.map(id => {
        const visible = layout.panels[id] !== 'hidden';
        return (
          <MenuItem
            key={id}
            role="menuitemcheckbox"
            aria-checked={visible}
            onClick={() => layout.setPanelState(id, visible ? 'hidden' : 'open')}
            sx={{ minHeight: { xs: 44, sm: 36 } }}
          >
            <ListItemIcon>{visible ? <CheckBoxIcon fontSize="small" color="primary" /> : <CheckBoxOutlineBlankIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{PANEL_LABELS[id]}</ListItemText>
          </MenuItem>
        );
      })}
      {onSelectSkin && <Divider />}
      {onSelectSkin && <Heading>Tema / Skin</Heading>}
      {onSelectSkin && SKIN_IDS.map(id => (
        <MenuItem
          key={id}
          role="menuitemradio"
          aria-checked={skin === id}
          onClick={() => { onSelectSkin(id); onPick?.(); }}
          sx={{ minHeight: { xs: 44, sm: 36 } }}
        >
          <ListItemIcon>
            <Box component="span" aria-hidden sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: SKINS[id].accent, border: '1px solid rgba(255,255,255,0.4)' }} />
          </ListItemIcon>
          <ListItemText primary={SKINS[id].name} secondary={SKINS[id].subtitle} />
        </MenuItem>
      ))}
      {onStageMode && <Divider />}
      {onStageMode && (
        <MenuItem onClick={() => { onPick?.(); onStageMode(); }} sx={{ minHeight: { xs: 44, sm: 36 } }} data-testid="stage-menu-item">
          <ListItemIcon><SlideshowIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Modo escenario</ListItemText>
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 2 }} aria-hidden>F</Typography>
        </MenuItem>
      )}
      {extra}
    </MenuList>
  );
};

interface ViewMenuProps {
  extra?: React.ReactNode;
  compact?: boolean;
  onStageMode?: () => void;
  skin?: SkinId;
  onSelectSkin?: (skin: SkinId) => void;
}

/**
 * "Vista" button: presets by activity and a switch per panel. A menu on wide screens,
 * a bottom sheet on phones (within thumb's reach).
 */
export const ViewMenu: React.FC<ViewMenuProps> = ({ extra, compact, onStageMode, skin, onSelectSkin }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const phone = useMediaQuery(PHONE_QUERY);
  const close = () => setAnchor(null);
  return (
    <>
      <Button
        variant="outlined"
        startIcon={<ViewQuiltIcon />}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => setAnchor(e.currentTarget)}
        data-testid={compact ? 'compact-view-menu-button' : 'view-menu-button'}
        sx={{ borderRadius: 2, borderColor: 'rgba(var(--skin-accent-rgb), 0.42)', color: 'var(--skin-accent)', textTransform: 'none', fontWeight: 'bold', flexShrink: 0, whiteSpace: 'nowrap', width: compact ? 'auto' : { xs: '100%', sm: 'auto' }, height: compact ? 44 : undefined }}
      >
        Vista
      </Button>
      {phone ? (
        <Drawer anchor="bottom" open={anchor !== null} onClose={close} slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 'env(safe-area-inset-bottom)', maxHeight: '85dvh' } } }}>
          <Box role="dialog" aria-label="Vista"><ViewList extra={extra} onPick={close} onStageMode={onStageMode} skin={skin} onSelectSkin={onSelectSkin} /></Box>
        </Drawer>
      ) : (
        // A Popover around our own MenuList (a Menu would nest a second menu list inside).
        <Popover anchorEl={anchor} open={anchor !== null} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
          <ViewList extra={extra} onPick={close} onStageMode={onStageMode} skin={skin} onSelectSkin={onSelectSkin} />
        </Popover>
      )}
    </>
  );
};
