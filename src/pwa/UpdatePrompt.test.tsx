import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';
import { BREAKPOINT_VALUES } from '../theme/breakpoints';
import { darkTheme } from '../theme/darkTheme';

describe('UpdatePrompt', () => {
  const setup = (props: Partial<Parameters<typeof UpdatePrompt>[0]> = {}) => {
    const onUpdate = vi.fn();
    const onDismiss = vi.fn();
    render(<UpdatePrompt needRefresh isPlaying={false} onUpdate={onUpdate} onDismiss={onDismiss} {...props} />);
    return { onUpdate, onDismiss };
  };

  it('offers the update when a new version is waiting and the metronome is stopped', () => {
    const { onUpdate } = setup();
    expect(screen.getByText('Hay una versión nueva')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it('never shows while playing (a reload would cut the practice)', () => {
    setup({ isPlaying: true });
    expect(screen.queryByTestId('update-prompt')).not.toBeInTheDocument();
  });

  it('stays hidden without a new version', () => {
    setup({ needRefresh: false });
    expect(screen.queryByTestId('update-prompt')).not.toBeInTheDocument();
  });

  it('can be dismissed', () => {
    const { onDismiss } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Luego' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('breakpoint tokens', () => {
  it('feed the MUI theme with the 600 / 900 / 1200 table', () => {
    expect(darkTheme.breakpoints.values).toMatchObject({ xs: 0, sm: 600, md: 900, lg: 1200 });
    expect(BREAKPOINT_VALUES.md).toBe(900);
  });
});
