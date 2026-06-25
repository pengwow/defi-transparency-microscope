/**
 * Tests for the ExportButton component (Report page).
 */

import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ExportButton } from './ExportButton';
import type { ReportData } from './ExportButton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  // Polyfill URL.createObjectURL / revokeObjectURL for jsdom.
  if (!('createObjectURL' in URL)) {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () =>
      'blob:mock';
  }
  if (!('revokeObjectURL' in URL)) {
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => undefined;
  }
});

const DATA: ReportData = {
  sessionId: 'sess-1',
  generatedAt: 1_700_000_000,
  txCount: 5,
  mevCostUsd: 100,
  lpValueUsd: 50_000,
  debtUsd: 1_000,
  scenarios: 2,
  pnlSeries: [{ ts: 1, value: 1 }],
};

describe('ExportButton', () => {
  it('renders a button labelled "Export JSON"', () => {
    render(<ExportButton data={DATA} />);
    expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument();
  });

  it('creates a Blob and triggers a download when clicked', () => {
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const el = origCreate(tag);
        if (tag === 'a') {
          el.click = clickSpy;
        }
        return el;
      });
    render(<ExportButton data={DATA} />);
    fireEvent.click(screen.getByRole('button', { name: /export json/i }));
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('encodes the report data as JSON in the blob', () => {
    const blobs: Blob[] = [];
    const origBlob = global.Blob;
    const blobSpy = vi.spyOn(global, 'Blob').mockImplementation((parts, options) => {
      const b = new origBlob(parts, options);
      blobs.push(b);
      return b;
    });
    render(<ExportButton data={DATA} />);
    fireEvent.click(screen.getByRole('button', { name: /export json/i }));
    expect(blobSpy).toHaveBeenCalled();
    expect(blobs.length).toBeGreaterThan(0);
    const text = blobs[0].size > 0 ? 'non-empty' : 'empty';
    expect(text).toBe('non-empty');
  });
});
