/**
 * EducationPage — the learning hub.
 *
 * Three columns:
 *   1. Learning Path — a Timeline of 6 steps the user can click to
 *      navigate the curriculum.
 *   2. Cheat Sheet    — a 2x2 grid of formula cards covering CPMM, IL,
 *      HF, and PnL attribution.
 *   3. Glossary       — a definition list of 6 DeFi terms.
 *
 * Each column ends with an ExplainBox that contextualises the content.
 */

import { useState } from 'react';
import { ExplainBox, Panel } from '@/components/common';
import { Timeline, type TimelineStep } from './Timeline';
import { CheatSheet, type FormulaCard } from './CheatSheet';
import { Glossary, type GlossaryEntry } from './Glossary';
import './EducationPage.css';

const STEPS: ReadonlyArray<TimelineStep> = [
  { id: '1', title: 'CPMM', summary: 'x*y=k — the constant product invariant' },
  { id: '2', title: 'Impermanent Loss', summary: 'LP drift vs. HODL baseline' },
  { id: '3', title: 'Health Factor', summary: 'Lending liquidation risk' },
  { id: '4', title: 'MEV & Sandwiches', summary: 'Attacker profit extraction' },
  { id: '5', title: 'PnL Attribution', summary: 'Decomposing swap P&L' },
  { id: '6', title: 'Reporting', summary: 'Exporting a session as JSON' },
];

const CARDS: ReadonlyArray<FormulaCard> = [
  {
    id: 'cpmm',
    title: 'CPMM',
    formula: 'x * y = k',
    description: 'Constant product invariant. Reserves adjust to keep k constant.',
  },
  {
    id: 'il',
    title: 'Impermanent Loss (V2)',
    formula: 'IL(p) = 2*sqrt(p) / (1 + p) - 1',
    description: 'IL as a function of price ratio p. Always ≤ 0.',
  },
  {
    id: 'hf',
    title: 'Health Factor',
    formula: 'HF = (collateral * threshold) / debt',
    description: 'Position is liquidatable when HF < 1.0.',
  },
  {
    id: 'attribution',
    title: 'PnL Attribution',
    formula: 'net = priceImpact + fees - gas + rebates',
    description: 'Per-leg decomposition of a swap P&L.',
  },
];

const ENTRIES: ReadonlyArray<GlossaryEntry> = [
  { term: 'AMM', definition: 'Automated market maker — on-chain exchange using a pricing function.' },
  { term: 'CPMM', definition: 'Constant-product market maker. The x*y=k family of AMMs.' },
  { term: 'IL', definition: 'Impermanent loss — the cost of being an LP vs. holding.' },
  { term: 'HF', definition: 'Health factor — collateral-to-debt ratio used in lending protocols.' },
  { term: 'MEV', definition: 'Maximal (formerly miner) extractable value — profit from reordering txs.' },
  { term: 'PnL', definition: 'Profit and loss — net P&L after fees, IL, and gas.' },
];

export function EducationPage() {
  const [activeId, setActiveId] = useState<string | null>('1');

  return (
    <div className="dtm-education-grid" data-testid="education-page">
      <Panel title="Learning Path" testId="learning-path-panel">
        <Timeline steps={STEPS} activeId={activeId} onSelect={setActiveId} />
        <ExplainBox title="What is this?">
          A 6-step walk through the protocol: start with the AMM
          curve, then impermanent loss, lending health, MEV
          extraction, P&amp;L attribution, and finally exporting
          your session as JSON.
        </ExplainBox>
      </Panel>

      <Panel title="Cheat Sheet" testId="cheat-sheet-panel">
        <CheatSheet cards={CARDS} />
        <ExplainBox title="How to use the cheat sheet">
          These are the four formulas that drive the dashboard.  The
          CPMM invariant is the foundation; IL and HF fall out of
          it; attribution re-bundles a swap into a P&amp;L
          statement.
        </ExplainBox>
      </Panel>

      <Panel title="Glossary" testId="glossary-panel">
        <Glossary entries={ENTRIES} />
        <ExplainBox title="Reading the glossary">
          Every abbreviation used in the dashboard is defined here.
          If a tooltip or chart label is unclear, look it up in this
          list first.
        </ExplainBox>
      </Panel>
    </div>
  );
}

export default EducationPage;
