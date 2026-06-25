/**
 * CheatSheet — a grid of formula cards for the Education page.
 *
 * Each card surfaces a title, the formula (rendered in monospace),
 * and a short description.
 */

import './CheatSheet.css';

export interface FormulaCard {
  id: string;
  title: string;
  formula: string;
  description: string;
}

export interface CheatSheetProps {
  cards: ReadonlyArray<FormulaCard>;
}

export function CheatSheet({ cards }: CheatSheetProps) {
  if (cards.length === 0) {
    return <p className="dtm-cheat-empty">No formulas available.</p>;
  }
  return (
    <div className="dtm-cheat-grid" data-testid="cheat-grid">
      {cards.map((c) => (
        <article key={c.id} className="dtm-cheat-card" data-testid="cheat-card">
          <h4 className="dtm-cheat-title">{c.title}</h4>
          <pre className="dtm-cheat-formula mono">{c.formula}</pre>
          <p className="dtm-cheat-desc">{c.description}</p>
        </article>
      ))}
    </div>
  );
}

export default CheatSheet;
