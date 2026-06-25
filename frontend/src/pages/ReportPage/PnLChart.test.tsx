/**
 * Tests for the PnLChart component (Report page, ECharts).
 */

import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PnLChart } from './PnLChart';
import type { PnLPoint } from './PnLChart';

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    dispose: vi.fn(),
    resize: vi.fn(),
  })),
}));

import * as echarts from 'echarts';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  (echarts.init as ReturnType<typeof vi.fn>).mockClear();
});

const POINTS: ReadonlyArray<PnLPoint> = [
  { ts: 1000, value: 10 },
  { ts: 2000, value: -5 },
  { ts: 3000, value: 25 },
];

describe('PnLChart', () => {
  it('calls echarts.init with a DOM element', () => {
    render(<PnLChart points={POINTS} />);
    expect(echarts.init).toHaveBeenCalled();
  });

  it('calls setOption with a line series', () => {
    const setOption = vi.fn();
    (echarts.init as ReturnType<typeof vi.fn>).mockReturnValue({
      setOption,
      dispose: vi.fn(),
      resize: vi.fn(),
    });
    render(<PnLChart points={POINTS} />);
    expect(setOption).toHaveBeenCalled();
    const arg = setOption.mock.calls[0][0] as { series?: Array<{ type?: string }> };
    expect(arg.series?.[0]?.type).toBe('line');
  });

  it('renders a container div for the chart', () => {
    const { container } = render(<PnLChart points={POINTS} />);
    const div = container.querySelector('[data-testid="pnl-chart"]');
    expect(div).not.toBeNull();
  });

  it('disposes the chart on unmount', () => {
    const dispose = vi.fn();
    (echarts.init as ReturnType<typeof vi.fn>).mockReturnValue({
      setOption: vi.fn(),
      dispose,
      resize: vi.fn(),
    });
    const { unmount } = render(<PnLChart points={POINTS} />);
    unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it('handles empty points gracefully', () => {
    const setOption = vi.fn();
    (echarts.init as ReturnType<typeof vi.fn>).mockReturnValue({
      setOption,
      dispose: vi.fn(),
      resize: vi.fn(),
    });
    render(<PnLChart points={[]} />);
    expect(setOption).toHaveBeenCalled();
  });
});
