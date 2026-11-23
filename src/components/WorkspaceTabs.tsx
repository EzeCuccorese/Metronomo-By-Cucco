import React, { useRef } from 'react';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import PianoIcon from '@mui/icons-material/Piano';
import TuneIcon from '@mui/icons-material/Tune';
import TimerIcon from '@mui/icons-material/Timer';
import { WORKSPACE_TABS, type WorkspaceTabId } from '../state/workspaceTabs';
import { SkinSwitcher } from './SkinSwitcher';
import type { SkinId } from '../theme/skins';

interface WorkspaceTabsProps {
  activeTab: WorkspaceTabId;
  onSelectTab: (tab: WorkspaceTabId) => void;
  skin: SkinId;
  onSelectSkin: (skin: SkinId) => void;
}

const TAB_ICONS: Record<WorkspaceTabId, React.ReactNode> = {
  ritmos: <GraphicEqIcon fontSize="small" aria-hidden />,
  armonia: <PianoIcon fontSize="small" aria-hidden />,
  mezcla: <TuneIcon fontSize="small" aria-hidden />,
  practica: <TimerIcon fontSize="small" aria-hidden />,
};

/**
 * Functional workspace tablist + skin switcher bar.
 * Follows WAI-ARIA tabs: strictly only tab buttons inside role="tablist",
 * roving tabindex, selection-follows-focus on arrow keys, and non-color underline indicator.
 */
export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  activeTab,
  onSelectTab,
  skin,
  onSelectSkin,
}) => {
  const tabRefs = useRef<Partial<Record<WorkspaceTabId, HTMLButtonElement | null>>>({});

  const focusTab = (id: WorkspaceTabId) => {
    onSelectTab(id);
    const el = tabRefs.current[id];
    if (!el) return;
    el.focus();
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = WORKSPACE_TABS.length;
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % count;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + count) % count;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = count - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    focusTab(WORKSPACE_TABS[nextIndex].id);
  };

  return (
    <nav className="workspace-nav-bar" aria-label="Navegación de consola">
      <div role="tablist" aria-label="Secciones de trabajo" className="workspace-tablist">
        {WORKSPACE_TABS.map((tab, index) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              type="button"
              role="tab"
              id={`workspace-tab-${tab.id}`}
              data-testid={`tab-${tab.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className="workspace-tab"
              onClick={() => focusTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {TAB_ICONS[tab.id]}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <SkinSwitcher skin={skin} onSelectSkin={onSelectSkin} />
    </nav>
  );
};
