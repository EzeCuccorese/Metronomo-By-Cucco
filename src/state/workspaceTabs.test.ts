import { describe, it, expect } from 'vitest';
import { PANEL_IDS } from './layout';
import {
  DEFAULT_WORKSPACE_TAB,
  TAB_FOR_PANEL,
  TAB_FOR_PRESET,
  WORKSPACE_TABS,
  WORKSPACE_TAB_IDS,
  WORKSPACE_TAB_PANELS,
  isWorkspaceTab,
} from './workspaceTabs';

describe('workspaceTabs', () => {
  it('assigns every panel to a valid workspace tab', () => {
    const covered = WORKSPACE_TABS.flatMap(t => [...t.panels]).sort();
    expect(covered).toEqual([...PANEL_IDS].sort());
    for (const panel of PANEL_IDS) {
      expect(WORKSPACE_TAB_PANELS[TAB_FOR_PANEL[panel]]).toContain(panel);
    }
  });

  it('validates tab identifiers strictly', () => {
    for (const id of WORKSPACE_TAB_IDS) expect(isWorkspaceTab(id)).toBe(true);
    expect(isWorkspaceTab('unknown')).toBe(false);
    expect(isWorkspaceTab(null)).toBe(false);
    expect(DEFAULT_WORKSPACE_TAB).toBe('ritmos');
  });

  it('maps view presets to their matching workspace tab', () => {
    expect(TAB_FOR_PRESET.ritmos).toBe('ritmos');
    expect(TAB_FOR_PRESET.solo).toBe('ritmos');
    expect(TAB_FOR_PRESET.armonia).toBe('armonia');
    expect(TAB_FOR_PRESET.estudio).toBe('practica');
    expect(TAB_FOR_PRESET.todo).toBeNull();
    expect(TAB_FOR_PRESET.personalizado).toBeNull();
  });
});
