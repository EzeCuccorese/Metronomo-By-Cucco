import React, { useId, useState } from 'react';
import { Box, ButtonBase, Collapse, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useLayoutApi } from '../state/LayoutContext';
import type { PanelId } from '../state/layout';

interface PanelProps {
  /** Which layout slot this card is. With an id the card can be folded and hidden, and remembers it. */
  id?: PanelId;
  /** Small caps heading shown on the top-left of the card. */
  title?: string;
  /** One line shown next to the title while the card is folded, so it still informs. */
  summary?: React.ReactNode;
  /** Elements aligned to the right of the heading (before the "more" menu). */
  actions?: React.ReactNode;
  /** Defaults to true when the card has an id. */
  collapsible?: boolean;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

const asArray = (sx?: SxProps<Theme>) => (sx ? (Array.isArray(sx) ? sx : [sx]) : []);

const TOUCH_TARGET = { '@media (pointer: coarse)': { minHeight: 44, minWidth: 44 } };

/**
 * The single card used by every section of the console, so spacing and chrome stay consistent.
 *
 * A card with an `id` has three states kept in the persisted layout: open, folded (only the title bar and a
 * summary; the body stays mounted, so anything it does keeps working) and hidden (not rendered at all).
 *
 * (ES) La tarjeta única de la consola: abierta, plegada (queda montada) u oculta (no se dibuja).
 */
export const Panel: React.FC<PanelProps> = ({ id, title, summary, actions, collapsible, children, sx }) => {
  const layout = useLayoutApi();
  const bodyId = useId();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const state = id ? layout.panels[id] : 'open';
  if (state === 'hidden') return null;

  // Folding needs somewhere to remember the state, so it only exists for cards with an id.
  const canFold = Boolean(title) && Boolean(id) && (collapsible ?? true);
  const collapsed = canFold && state === 'collapsed';
  const toggle = () => { if (id) layout.setPanelState(id, collapsed ? 'open' : 'collapsed'); };
  const hide = () => {
    setMenuAnchor(null);
    if (id) layout.setPanelState(id, 'hidden');
  };

  const heading = (
    <Typography
      variant="overline"
      component="h2"
      sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 1, m: 0, minWidth: 0, flex: 1 }}
    >
      {canFold ? (
        <ButtonBase
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          data-testid={id ? `panel-toggle-${id}` : undefined}
          sx={[
            {
              display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, maxWidth: '100%', py: 0.25, pr: 1, borderRadius: 1,
              font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit', textAlign: 'left',
              '&:focus-visible': { outline: '2px solid #e5a95f', outlineOffset: 2 },
            },
            TOUCH_TARGET,
          ]}
        >
          <ExpandMoreIcon
            aria-hidden
            sx={{ fontSize: 20, flexShrink: 0, transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}
          />
          <Box component="span" aria-hidden sx={{ width: 4, height: 14, borderRadius: 1, bgcolor: 'primary.main', opacity: 0.8, flexShrink: 0 }} />
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{title}</Box>
          {collapsed && summary && (
            <Box component="span" data-testid="panel-summary" sx={{ color: 'text.primary', textTransform: 'none', letterSpacing: 0, fontWeight: 400, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
              · {summary}
            </Box>
          )}
        </ButtonBase>
      ) : (
        <>
          <Box component="span" aria-hidden sx={{ width: 4, height: 14, borderRadius: 1, bgcolor: 'primary.main', opacity: 0.8 }} />
          {title}
        </>
      )}
    </Typography>
  );

  return (
    <Paper
      component="section"
      className="brass-trim"
      aria-label={title}
      data-panel={id}
      data-state={id ? state : undefined}
      sx={[
        {
          height: collapsed ? 'auto' : '100%',
          minWidth: 0,
          p: { xs: 1.5, md: 2 },
          borderRadius: 4,
          bgcolor: '#141210',
          display: 'flex',
          flexDirection: 'column',
          gap: collapsed ? 0 : 1.5,
        },
        ...asArray(sx),
      ]}
    >
      {title && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 24, width: '100%' }}>
          {heading}
          {actions}
          {id && (
            <>
              <IconButton
                size="small"
                aria-label={`Opciones de ${title}`}
                aria-haspopup="menu"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={[{ color: 'text.secondary' }, TOUCH_TARGET]}
              >
                <MoreHorizIcon fontSize="small" />
              </IconButton>
              <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
                <MenuItem onClick={hide}>
                  <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Ocultar panel</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>
      )}
      {/* Folded bodies stay mounted (the effects of the card keep running); Collapse only hides them. */}
      {canFold ? (
        <Collapse in={!collapsed} id={bodyId} sx={{ '& > .MuiCollapse-wrapper > .MuiCollapse-wrapperInner': { display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }, flex: collapsed ? 'none' : 1, minHeight: 0 }}>
          {children}
        </Collapse>
      ) : children}
    </Paper>
  );
};
