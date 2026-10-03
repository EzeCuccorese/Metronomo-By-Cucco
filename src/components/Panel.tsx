import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface PanelProps {
  /** Small caps heading shown on the top-left of the card. */
  title?: string;
  /** Optional element aligned to the right of the heading. */
  action?: React.ReactNode;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

const asArray = (sx?: SxProps<Theme>) => (Array.isArray(sx) ? sx : [sx]);

/** The single card used by every section of the console, so spacing and chrome stay consistent. */
export const Panel: React.FC<PanelProps> = ({ title, action, children, sx }) => (
  <Paper
    component="section"
    className="brass-trim"
    aria-label={title}
    sx={[
      {
        height: '100%',
        minWidth: 0,
        p: { xs: 1.5, md: 2 },
        borderRadius: 4,
        bgcolor: '#141210',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      },
      ...asArray(sx),
    ]}
  >
    {title && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 24 }}>
        <Typography
          variant="overline"
          component="h2"
          sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 1, m: 0 }}
        >
          <Box component="span" aria-hidden sx={{ width: 4, height: 14, borderRadius: 1, bgcolor: 'primary.main', opacity: 0.8 }} />
          {title}
        </Typography>
        {action}
      </Box>
    )}
    {children}
  </Paper>
);

/**
 * Stretches a self-styled child (one that draws its own card) to the full height of its grid cell.
 * Pass `sx` to normalise the child's own chrome so it matches {@link Panel}.
 */
export const Fill: React.FC<{ children: React.ReactNode; sx?: SxProps<Theme> }> = ({ children, sx }) => (
  <Box
    sx={[
      {
        height: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        '& > *': { flex: 1, minWidth: 0 },
      },
      ...asArray(sx),
    ]}
  >
    {children}
  </Box>
);
