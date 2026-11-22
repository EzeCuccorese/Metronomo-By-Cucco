import React, { useState } from 'react';
import { Chip, Popover } from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import StudyTools, { TomatoIcon } from './StudyTools';
import type { StudySessionState } from '../hooks/useStudySession';
import { formatTime } from '../hooks/usePomodoro';

interface StudyTriggerProps {
  session: StudySessionState;
  pinned: boolean;
  onTogglePin: () => void;
  onFocusPinned: () => void;
}

const POPOVER_PAPER_SX = {
  mt: 1,
  bgcolor: '#171e2c',
  border: '1px solid rgba(148, 163, 184, 0.26)',
  borderRadius: 3,
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)',
} as const;

const triggerSx = (isActive: boolean) => ({
  fontFamily: '"Share Tech Mono", monospace',
  fontWeight: 700,
  fontSize: '0.75rem',
  borderColor: isActive ? 'rgba(245, 184, 81, 0.55)' : 'rgba(148, 163, 184, 0.28)',
  bgcolor: isActive ? 'rgba(245, 184, 81, 0.12)' : 'rgba(15, 23, 42, 0.55)',
  color: isActive ? '#f5b851' : '#cbd5e1',
  '& .MuiChip-icon': { ml: 0.75, mr: -0.25 },
  '& .MuiChip-deleteIcon': { color: 'primary.main', mr: 0.5 },
  '@media (pointer: coarse)': { minHeight: 44 },
});

/**
 * Top-left Studio trigger pill for Study & Pomodoro:
 * opens a floating pop-up when unpinned, or pins/focuses the top-left docked panel.
 */
export const StudyTrigger: React.FC<StudyTriggerProps> = ({ session, pinned, onTogglePin, onFocusPinned }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { timeLeft, isActive } = session.pomodoro;
  const open = !pinned && anchor !== null;

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (pinned) { onFocusPinned(); return; }
    setAnchor(prev => (prev ? null : e.currentTarget));
  };

  return (
    <>
      <Chip
        clickable
        size="small"
        data-testid="study-trigger"
        onClick={handleClick}
        aria-expanded={pinned ? undefined : open}
        aria-haspopup={pinned ? undefined : 'dialog'}
        aria-label={pinned
          ? `Estudio fijado (${formatTime(timeLeft)}). Clic para ir al panel`
          : `Abrir estudio y Pomodoro (${formatTime(timeLeft)})`}
        icon={<TomatoIcon filled={isActive} size={14} />}
        deleteIcon={pinned ? <PushPinIcon sx={{ fontSize: '13px !important' }} /> : undefined}
        onDelete={pinned ? onTogglePin : undefined}
        label={formatTime(timeLeft)}
        variant="outlined"
        sx={triggerSx(isActive)}
      />
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'Estudio y Pomodoro', sx: POPOVER_PAPER_SX } }}
      >
        <StudyTools
          bare
          session={session}
          pinned={pinned}
          onTogglePin={() => { setAnchor(null); onTogglePin(); }}
        />
      </Popover>
    </>
  );
};
