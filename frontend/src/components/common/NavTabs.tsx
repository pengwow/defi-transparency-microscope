/**
 * NavTabs — six-tab top-level navigation.
 *
 * Implemented per the WAI-ARIA tabs pattern:
 *   - container: role="tablist"
 *   - each item: role="tab" with aria-selected
 *   - keyboard navigation: ←/→/Home/End
 */

import type { KeyboardEvent } from 'react';
import type { Page } from '@/store/uiStore';

export interface NavTab {
  id: Page;
  label: string;
}

export const NAV_TABS: ReadonlyArray<NavTab> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'mempool', label: 'Mempool' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'lending', label: 'Lending' },
  { id: 'positions', label: 'Positions' },
  { id: 'experiments', label: 'Experiments' },
];

export interface NavTabsProps {
  active: Page;
  onSelect: (p: Page) => void;
}

export function NavTabs({ active, onSelect }: NavTabsProps) {
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = NAV_TABS.findIndex((t) => t.id === active);
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % NAV_TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + NAV_TABS.length) % NAV_TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = NAV_TABS.length - 1;
    else return;
    e.preventDefault();
    const next = NAV_TABS[nextIdx];
    if (next) onSelect(next.id);
  };

  return (
    <div
      className="dtm-nav-tabs"
      role="tablist"
      aria-label="Main navigation"
      onKeyDown={handleKey}
      data-testid="nav-tabs"
    >
      {NAV_TABS.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`dtm-nav-tab${selected ? ' is-active' : ''}`}
            onClick={() => onSelect(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
