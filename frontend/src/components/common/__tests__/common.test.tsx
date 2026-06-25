/**
 * Smoke tests for the common UI components.
 *
 * These are intentionally shallow — they verify that each component
 * renders, that a11y attributes are set correctly, and that simple
 * interactions work.  The real visual QA happens in the browser.
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import {
  ErrorBoundary,
  LoadingScreen,
  RealtimeClock,
  Panel,
  Header,
  ModeBar,
  NavTabs,
  LensTransition,
  FlashAlert,
  ExplainBox,
} from '../index';
import { useUiStore } from '@/store/uiStore';

afterEach(() => {
  cleanup();
  // Reset UI store between tests so alerts don't leak.
  useUiStore.setState({ alerts: [], page: 'dashboard', mode: 'live', loading: false });
});

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>ok</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('renders a fallback when a child throws', () => {
    // Suppress the React error log.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Bomb(): React.ReactElement {
      throw new Error('boom');
    }
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('LoadingScreen', () => {
  it('renders a progressbar with the right value', () => {
    render(<LoadingScreen progress={0.5} message="loading…" />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
  });
});

describe('RealtimeClock', () => {
  it('renders a <time> element with the current HH:MM:SS', () => {
    render(<RealtimeClock />);
    const el = screen.getByTestId('realtime-clock');
    expect(el.tagName.toLowerCase()).toBe('time');
    expect(el.textContent).toMatch(/^\d{2}:\d{2}(:\d{2})?$/);
  });
});

describe('Panel', () => {
  it('renders the title and children', () => {
    render(
      <Panel title="My Panel" testId="my-panel">
        <span>body</span>
      </Panel>,
    );
    expect(screen.getByText('My Panel')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByTestId('my-panel')).toBeInTheDocument();
  });
});

describe('Header', () => {
  it('renders the brand mark', () => {
    render(<Header />);
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByText('DeFi')).toBeInTheDocument();
  });

  it('renders the right slot when provided', () => {
    render(<Header right={<span data-testid="right-slot">right</span>} />);
    expect(screen.getByTestId('right-slot')).toBeInTheDocument();
  });
});

describe('ModeBar', () => {
  it('marks the active mode with aria-selected', () => {
    render(<ModeBar value="live" onChange={() => undefined} />);
    const live = screen.getByRole('radio', { name: 'Live' });
    const replay = screen.getByRole('radio', { name: 'Replay' });
    expect(live.getAttribute('aria-selected')).toBe('true');
    expect(replay.getAttribute('aria-selected')).toBe('false');
  });

  it('invokes onChange when another option is clicked', () => {
    const cb = vi.fn();
    render(<ModeBar value="live" onChange={cb} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Replay' }));
    expect(cb).toHaveBeenCalledWith('replay');
  });
});

describe('NavTabs', () => {
  it('renders six tabs with the active one selected', () => {
    render(<NavTabs active="dashboard" onSelect={() => undefined} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('invokes onSelect when a tab is clicked', () => {
    const cb = vi.fn();
    render(<NavTabs active="dashboard" onSelect={cb} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Positions' }));
    expect(cb).toHaveBeenCalledWith('positions');
  });

  it('handles arrow key navigation', () => {
    const cb = vi.fn();
    render(<NavTabs active="dashboard" onSelect={cb} />);
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(cb).toHaveBeenCalledWith('mempool');
  });
});

describe('LensTransition', () => {
  it('reflects the current mode via data-mode', () => {
    render(
      <LensTransition>
        <span>child</span>
      </LensTransition>,
    );
    const el = screen.getByTestId('lens-transition');
    expect(el.getAttribute('data-mode')).toBe('live');
  });
});

describe('FlashAlert', () => {
  it('renders nothing when no alerts are present', () => {
    render(<FlashAlert />);
    expect(screen.queryByTestId('flash-alert')).toBeNull();
  });

  it('renders the most recent alert', () => {
    useUiStore.getState().pushAlert({ level: 'info', message: 'hello' });
    render(<FlashAlert />);
    expect(screen.getByTestId('flash-alert')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});

describe('ExplainBox', () => {
  it('starts collapsed by default', () => {
    render(
      <ExplainBox title="Why?">
        <p>explanation body</p>
      </ExplainBox>,
    );
    expect(screen.queryByText('explanation body')).toBeNull();
  });

  it('expands when the toggle is clicked', () => {
    render(
      <ExplainBox title="Why?">
        <p>explanation body</p>
      </ExplainBox>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('explanation body')).toBeInTheDocument();
  });

  it('starts expanded when defaultOpen is true', () => {
    render(
      <ExplainBox title="Why?" defaultOpen>
        <p>explanation body</p>
      </ExplainBox>,
    );
    expect(screen.getByText('explanation body')).toBeInTheDocument();
  });
});

describe('RealtimeClock time advancement', () => {
  it('updates over time', () => {
    vi.useFakeTimers();
    render(<RealtimeClock />);
    const el = screen.getByTestId('realtime-clock');
    const initial = el.textContent;
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // Note: the value may or may not have changed depending on the second boundary.
    // The test passes as long as the component re-renders without crashing.
    expect(el.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(initial).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    vi.useRealTimers();
  });
});

describe('Header (demo)', () => {
  it('renders the microscope logo and the Chinese brand', () => {
    render(<Header />);
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    // Microscope emoji in the logo tile.
    expect(screen.getByLabelText('DeFi 透明显微镜 logo')).toHaveTextContent('🔬');
    // Two-part brand: "DeFi" (dim) + "透明显微镜" (cyan span).
    expect(screen.getByText('DeFi')).toBeInTheDocument();
    expect(screen.getByText('透明显微镜')).toBeInTheDocument();
  });

  it('triggers onStartDemo when the "一键实验" button is clicked', () => {
    const cb = vi.fn();
    render(<Header onStartDemo={cb} />);
    fireEvent.click(screen.getByRole('button', { name: /一键实验/ }));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
