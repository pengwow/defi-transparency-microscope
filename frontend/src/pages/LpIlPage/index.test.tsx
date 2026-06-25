/**
 * Tests for the LpIlPage.
 *
 * The page has been rewritten to a 2-column demo layout (mirrors
 * DTM_Demo.html lines 949-1038).  This test verifies the 6 panels
 * are all rendered, the Lp/IL ExplainBox is present, and the
 * scenario button propagates to the lpStore.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { LpIlPage } from './index';
import { useLpStore } from '@/store/lpStore';

afterEach(() => {
  cleanup();
  useLpStore.getState().reset();
});

describe('LpIlPage', () => {
  it('shows the page test id root', () => {
    render(<LpIlPage />);
    expect(screen.getByTestId('lpil-page')).toBeInTheDocument();
  });

  it('renders the 6 demo panels', () => {
    render(<LpIlPage />);
    expect(screen.getByTestId('lpil-params-panel')).toBeInTheDocument();
    expect(screen.getByTestId('lpil-scenarios-panel')).toBeInTheDocument();
    expect(screen.getByTestId('pool-state-panel')).toBeInTheDocument();
    expect(screen.getByTestId('il-curve-panel')).toBeInTheDocument();
    expect(screen.getByTestId('il-pnl-panel')).toBeInTheDocument();
    expect(screen.getByTestId('il-metrics-panel')).toBeInTheDocument();
  });

  it('renders the LP/IL 模式 explain box', () => {
    render(<LpIlPage />);
    const panel = screen.getByTestId('lpil-explanation-panel');
    expect(panel.textContent).toMatch(/LP\/IL|无常损失/);
  });

  it('clicking the "ETH 涨 2x" scenario card updates priceRatio', () => {
    render(<LpIlPage />);
    act(() => {
      fireEvent.click(screen.getByTestId('lpil-scenario-up-2x'));
    });
    expect(useLpStore.getState().priceRatio).toBe(2);
  });

  it('clicking the V3 tab in the params panel flips the version', () => {
    render(<LpIlPage />);
    act(() => {
      fireEvent.click(screen.getByTestId('lpil-params-tab-v3'));
    });
    expect(useLpStore.getState().version).toBe('v3');
  });
});
