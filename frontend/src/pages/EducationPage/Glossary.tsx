/**
 * Glossary — a definition list of DeFi terms for the Education page.
 *
 * Each entry is rendered as a definition list row: term (bold) and
 * its description.
 */

import './Glossary.css';

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface GlossaryProps {
  entries: ReadonlyArray<GlossaryEntry>;
}

export function Glossary({ entries }: GlossaryProps) {
  if (entries.length === 0) {
    return <p className="dtm-glossary-empty">No glossary entries.</p>;
  }
  return (
    <dl className="dtm-glossary" data-testid="glossary-list">
      {entries.map((e) => (
        <div key={e.term} className="dtm-glossary-entry" data-testid="glossary-entry">
          <dt className="dtm-glossary-term">{e.term}</dt>
          <dd className="dtm-glossary-def">{e.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

export default Glossary;
