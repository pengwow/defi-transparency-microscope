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
  Panel,
  Header,
  ModeBar,
  NavTabs,
  LensTransition,
  FlashAlert,
  ExplainBox,
  DemoOverlay,
} from '../index';
import { useUiStore } from '@/store/uiStore';

afterEach(() => {
  cleanup();
  // Reset UI store between tests so alerts don't leak.
  useUiStore.setState({
    alerts: [],
    page: 'live',
    mode: 'live',
    loading: false,
    flashAlert: null,
    lensStage: 'idle',
    demoRunning: false,
    demoStep: 0,
    blockNumber: 22_180_542,
  });
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
  it('invokes onReady after minDurationMs', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    render(<LoadingScreen onReady={cb} minDurationMs={2500} />);
    expect(cb).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(cb).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('renders the microscope logo and Chinese title', () => {
    const { rerender } = render(<LoadingScreen />);
    // Microscope emoji in the logo tile.
    expect(screen.getByLabelText('DeFi 透明显微镜 loading logo')).toHaveTextContent('🔬');
    // Playfair title.
    expect(screen.getByText('DeFi 透明显微镜')).toBeInTheDocument();
    // Default subtitle.
    expect(screen.getByText(/正在初始化链上机理仿真实验室/)).toBeInTheDocument();

    // Custom subtitle override.
    rerender(<LoadingScreen subtitle="正在初始化…" />);
    expect(screen.getByText('正在初始化…')).toBeInTheDocument();
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
    const live = screen.getByRole('radio', { name: /实时采样/ });
    const replay = screen.getByRole('radio', { name: /实验切片/ });
    expect(live.getAttribute('aria-selected')).toBe('true');
    expect(replay.getAttribute('aria-selected')).toBe('false');
  });

  it('invokes onChange when another option is clicked', () => {
    const cb = vi.fn();
    render(<ModeBar value="live" onChange={cb} />);
    fireEvent.click(screen.getByRole('radio', { name: /实验切片/ }));
    expect(cb).toHaveBeenCalledWith('replay');
  });
});

describe('NavTabs', () => {
  it('renders six tabs with the active one selected', () => {
    render(<NavTabs active="live" onSelect={() => undefined} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].textContent).toBe('📡 实时采样');
  });

  it('invokes onSelect when a tab is clicked', () => {
    const cb = vi.fn();
    render(<NavTabs active="report" onSelect={cb} />);
    fireEvent.click(screen.getByRole('tab', { name: /LP\/IL/ }));
    expect(cb).toHaveBeenCalledWith('lpil');
  });

  it('handles arrow key navigation', () => {
    const cb = vi.fn();
    render(<NavTabs active="live" onSelect={cb} />);
    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(cb).toHaveBeenCalledWith('fork');
  });
});

describe('LensTransition', () => {
  it('renders the 4 stage labels CAPTURE / FORK / PARSE / READY when active', () => {
    useUiStore.getState().setLensStage('capture');
    render(
      <LensTransition>
        <span>child</span>
      </LensTransition>,
    );
    expect(screen.getByText('CAPTURE')).toBeInTheDocument();
    expect(screen.getByText('FORK')).toBeInTheDocument();
    expect(screen.getByText('PARSE')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('renders the overlay with is-active only when lensStage is not idle', () => {
    const { rerender } = render(
      <LensTransition>
        <span>child</span>
      </LensTransition>,
    );
    let el = screen.getByTestId('lens-transition');
    expect(el.className).not.toContain('is-active');

    useUiStore.getState().setLensStage('capture');
    rerender(
      <LensTransition>
        <span>child</span>
      </LensTransition>,
    );
    el = screen.getByTestId('lens-transition');
    expect(el.className).toContain('is-active');
  });

  it('switches the active step when lensStage changes', () => {
    useUiStore.getState().setLensStage('parse');
    render(
      <LensTransition>
        <span>child</span>
      </LensTransition>,
    );
    // The PARSE step should be marked active.
    const steps = screen.getAllByTestId('lens-step');
    const parseStep = steps.find((s) => s.getAttribute('data-stage') === 'parse');
    expect(parseStep).toBeDefined();
    expect(parseStep?.className).toContain('is-active');
    const captureStep = steps.find((s) => s.getAttribute('data-stage') === 'capture');
    expect(captureStep?.className).not.toContain('is-active');
  });

  it('adds is-zooming class when lensStage is "zooming"', () => {
    useUiStore.getState().setLensStage('zooming');
    render(
      <LensTransition>
        <span>child</span>
      </LensTransition>,
    );
    const el = screen.getByTestId('lens-transition');
    expect(el.className).toContain('is-zooming');
    expect(el.className).toContain('is-active');
  });
});

describe('FlashAlert', () => {
  it('renders nothing when no flashAlert is set', () => {
    render(<FlashAlert onEnterMicroscope={() => undefined} />);
    expect(screen.queryByTestId('flash-alert')).toBeNull();
  });

  it('renders the demo title and body when a flashAlert is in the store', () => {
    useUiStore.getState().pushFlashAlert({
      type: 'sandwich',
      title: '三明治攻击检测',
      body: '套利者 front-run + back-run 一笔 50 WETH 交易',
    });
    render(<FlashAlert onEnterMicroscope={() => undefined} />);
    expect(screen.getByTestId('flash-alert')).toBeInTheDocument();
    expect(screen.getByText('三明治攻击检测')).toBeInTheDocument();
    expect(screen.getByText(/套利者 front-run/)).toBeInTheDocument();
  });

  it('invokes onEnterMicroscope when the "放入显微镜" button is clicked', () => {
    useUiStore.getState().pushFlashAlert({
      type: 'jit',
      title: 'JIT 流动性',
      body: '检测到即时流动性提供',
    });
    const cb = vi.fn();
    render(<FlashAlert onEnterMicroscope={cb} />);
    fireEvent.click(screen.getByRole('button', { name: /放入显微镜/ }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('clears the flashAlert when "忽略" is clicked', () => {
    useUiStore.getState().pushFlashAlert({
      type: 'liquidation',
      title: '清算',
      body: '某头寸即将被清算',
    });
    render(<FlashAlert onEnterMicroscope={() => undefined} />);
    expect(screen.getByTestId('flash-alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /忽略/ }));
    expect(useUiStore.getState().flashAlert).toBeNull();
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

describe('DemoOverlay', () => {
  it('is not rendered when demoRunning is false', () => {
    render(<DemoOverlay />);
    expect(screen.queryByTestId('demo-overlay')).toBeNull();
  });

  it('renders the progress bar and step text when demoRunning is true', () => {
    useUiStore.getState().startDemo();
    useUiStore.getState().advanceDemo(); // demoStep = 1
    render(<DemoOverlay />);
    expect(screen.getByTestId('demo-overlay')).toBeInTheDocument();
    // The progress bar fill is present and has a non-zero width.
    const bar = screen.getByTestId('demo-progress-bar');
    expect(bar).toBeInTheDocument();
    expect(bar.style.width).not.toBe('0%');
    // The step text matches the demoStep mapping (1 → "捕获交易…").
    expect(screen.getByTestId('demo-step-text')).toHaveTextContent('捕获交易');
  });

  it('shows the "准备中…" text when demoStep is 0', () => {
    useUiStore.getState().startDemo(); // demoStep = 0
    render(<DemoOverlay />);
    expect(screen.getByTestId('demo-step-text')).toHaveTextContent('准备中');
    // The progress bar should be empty.
    expect(screen.getByTestId('demo-progress-bar').style.width).toBe('0%');
  });

  it('shows the "完成 ✅" text when demoStep is 4', () => {
    useUiStore.getState().startDemo();
    for (let i = 0; i < 4; i++) useUiStore.getState().advanceDemo();
    render(<DemoOverlay />);
    expect(screen.getByTestId('demo-step-text')).toHaveTextContent('完成');
  });

  it('shows the "已就绪" text when demoStep is >= 5', () => {
    useUiStore.getState().startDemo();
    for (let i = 0; i < 6; i++) useUiStore.getState().advanceDemo();
    render(<DemoOverlay />);
    expect(screen.getByTestId('demo-step-text')).toHaveTextContent('已就绪');
  });

  it('clicking "跳过" calls stopDemo', () => {
    useUiStore.getState().startDemo();
    const stopSpy = vi.spyOn(useUiStore.getState(), 'stopDemo');
    render(<DemoOverlay />);
    fireEvent.click(screen.getByRole('button', { name: /跳过/ }));
    expect(stopSpy).toHaveBeenCalledTimes(1);
    stopSpy.mockRestore();
  });
});
