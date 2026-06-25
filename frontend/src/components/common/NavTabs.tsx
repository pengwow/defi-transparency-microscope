/**
 * NavTabs — six-tab top-level navigation.
 *
 * Implemented per the WAI-ARIA tabs pattern:
 *   - container: role="tablist"
 *   - each item: role="tab" with aria-selected
 *   - keyboard navigation: ←/→/Home/End
 *
 * The tab IDs are the canonical DTM_Demo names: `live`, `fork`,
 * `liquidation`, `lpil`, `edu`, `report`.  The Page enum in
 * `uiStore` still uses its historical IDs (dashboard / mempool /
 * …) so consumers bridge the two with a small mapping function.
 */

import type { KeyboardEvent } from 'react';
import type { Page } from '@/store/uiStore';

export type NavTabId =
  | 'live'
  | 'fork'
  | 'liquidation'
  | 'lpil'
  | 'edu'
  | 'report'
  | Page;

export interface NavTab {
  id: NavTabId;
  label: string;
}

export const NAV_TABS: ReadonlyArray<NavTab> = [
  { id: 'live', label: '📡 实时采样' },
  { id: 'fork', label: '🔬 实验切片' },
  { id: 'liquidation', label: '⚡ 清算' },
  { id: 'lpil', label: '🌊 LP/IL' },
  { id: 'edu', label: '🎓 教学实验' },
  { id: 'report', label: '📊 报告' },
];

export interface NavTabsProps {
  active: NavTabId;
  onSelect: (id: NavTabId) => void;
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
