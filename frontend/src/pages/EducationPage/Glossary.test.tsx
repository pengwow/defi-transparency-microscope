/**
 * Tests for the Glossary component (Education).
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Glossary } from './Glossary';
import type { GlossaryEntry } from './Glossary';

afterEach(() => {
  cleanup();
});

const ENTRIES: ReadonlyArray<GlossaryEntry> = [
  { term: 'AMM', definition: 'Automated market maker.' },
  { term: 'CPMM', definition: 'Constant product market maker.' },
  { term: 'IL', definition: 'Impermanent loss.' },
  { term: 'HF', definition: 'Health factor.' },
  { term: 'MEV', definition: 'Maximal / miner extractable value.' },
  { term: 'PnL', definition: 'Profit and loss.' },
];

describe('Glossary', () => {
  it('renders 6 entries', () => {
    render(<Glossary entries={ENTRIES} />);
    expect(screen.getAllByTestId('glossary-entry')).toHaveLength(6);
  });

  it('shows the term and its definition', () => {
    render(<Glossary entries={ENTRIES} />);
    expect(screen.getByText('AMM')).toBeInTheDocument();
    expect(screen.getByText('Automated market maker.')).toBeInTheDocument();
  });

  it('renders an empty state when no entries are provided', () => {
    render(<Glossary entries={[]} />);
    expect(screen.getByText(/glossary entries/i)).toBeInTheDocument();
  });
});
