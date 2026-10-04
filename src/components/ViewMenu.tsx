import React, { useState } from 'react';
import { Box, Button, Divider, Drawer, ListItemIcon, ListItemText, Menu, MenuItem, MenuList, Typography, useMediaQuery } from '@mui/material';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useLayoutApi } from '../state/LayoutContext';
import { PANEL_IDS, PANEL_LABELS, PANEL_PRESET_ORDER, PRESET_LABELS } from '../state/layout';

const PHONE_QUERY = '(max-width: 599.98px)';

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography variant="overline" component="div" sx={{ px: 2, pt: 1, color: 'text.secondary', lineHeight: 2 }}>{children}</Typography>
);

/** Presets and the per-panel switches. Shared by the desktop menu and the phone bottom sheet. */
const ViewList: React.FC<{ extra?: React.ReactNode; onPick?: () => void }> = ({ extra, onPick }) => {
  const layout = useLayoutApi();
  return (
    <MenuList dense aria-label="Vista" sx={{ py: 0 }}>
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
      {extra}
    </MenuList>
  );
};

/**
 * "Vista" button: presets by activity and a switch per panel. A menu on wide screens,
 * a bottom sheet on phones (within thumb's reach).
 */
export const ViewMenu: React.FC<{ extra?: React.ReactNode; compact?: boolean }> = ({ extra, compact }) => {
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
        sx={{ borderRadius: 2, borderColor: 'rgba(229,169,95,0.4)', color: '#e5a95f', textTransform: 'none', fontWeight: 'bold', flexShrink: 0, whiteSpace: 'nowrap', width: compact ? 'auto' : { xs: '100%', sm: 'auto' }, height: compact ? 44 : undefined }}
      >
        Vista
      </Button>
      {phone ? (
        <Drawer anchor="bottom" open={anchor !== null} onClose={close} slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 'env(safe-area-inset-bottom)', maxHeight: '85dvh' } } }}>
          <Box role="dialog" aria-label="Vista"><ViewList extra={extra} onPick={close} /></Box>
        </Drawer>
      ) : (
        <Menu anchorEl={anchor} open={anchor !== null} onClose={close} slotProps={{ list: { sx: { py: 0 } } }}>
          <ViewList extra={extra} />
        </Menu>
      )}
    </>
  );
};
