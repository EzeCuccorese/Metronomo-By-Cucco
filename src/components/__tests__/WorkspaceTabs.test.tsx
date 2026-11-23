import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WorkspaceTabs } from '../WorkspaceTabs';

describe('WorkspaceTabs', () => {
  afterEach(cleanup);

  it('renders an accessible tablist with no aria-controls and roving tabindex', () => {
    const onSelectTab = vi.fn();
    render(
      <WorkspaceTabs activeTab="ritmos" onSelectTab={onSelectTab} skin="obsidian" onSelectSkin={vi.fn()} />,
    );
    const tablist = screen.getByRole('tablist', { name: 'Secciones de trabajo' });
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tablist.children).toHaveLength(4);

    tabs.forEach(tab => expect(tab).not.toHaveAttribute('aria-controls'));
    expect(screen.getByTestId('tab-ritmos')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-ritmos')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('tab-armonia')).toHaveAttribute('tabindex', '-1');
  });

  it('supports arrow, Home, and End navigation where selection follows focus', () => {
    const onSelectTab = vi.fn();
    render(
      <WorkspaceTabs activeTab="ritmos" onSelectTab={onSelectTab} skin="obsidian" onSelectSkin={vi.fn()} />,
    );
    const ritmos = screen.getByTestId('tab-ritmos');
    fireEvent.keyDown(ritmos, { key: 'ArrowRight' });
    expect(onSelectTab).toHaveBeenLastCalledWith('armonia');

    fireEvent.keyDown(ritmos, { key: 'ArrowLeft' });
    expect(onSelectTab).toHaveBeenLastCalledWith('practica');

    fireEvent.keyDown(ritmos, { key: 'End' });
    expect(onSelectTab).toHaveBeenLastCalledWith('practica');

    fireEvent.keyDown(screen.getByTestId('tab-practica'), { key: 'Home' });
    expect(onSelectTab).toHaveBeenLastCalledWith('ritmos');
  });

  it('switches skins from the SkinSwitcher menu', async () => {
    const onSelectSkin = vi.fn();
    render(
      <WorkspaceTabs activeTab="ritmos" onSelectTab={vi.fn()} skin="obsidian" onSelectSkin={onSelectSkin} />,
    );
    fireEvent.click(screen.getByTestId('skin-switcher'));
    const cosmos = await screen.findByTestId('skin-option-cosmos');
    fireEvent.click(cosmos);
    expect(onSelectSkin).toHaveBeenCalledWith('cosmos');
  });
});
