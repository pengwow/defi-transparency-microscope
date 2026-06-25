/**
 * Tests for the MempoolLanes panel.
 *
 * The component:
 *   1. Reads the live mempool from `useLiveStore` and renders one row
 *      per entry (with type, display hash, gas, address, timestamp).
 *   2. Polls every 2500ms to push a freshly built `makeTransaction`
 *      into the store.
 *   3. For attack types (sandwich / jit / liquidation) it has a 30%
 *      chance per push of calling `useUiStore.pushFlashAlert`.
 *   4. Hovers expose a "🔬 放入显微镜" button which calls the
 *      `onEnterMicroscope` prop.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MempoolLanes } from '../MempoolLanes';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';

beforeEach(() => {
  useLiveStore.getState().reset();
  useLiveStore.getState().init({
    mempool: [
      {
        hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        from: '0xfrom-a',
        timestamp: 1_710_000_000,
        mevType: 'sandwich',
      },
      {
        hash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        from: '0xfrom-b',
        timestamp: 1_710_000_010,
        mevType: 'normal',
      },
      {
        hash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        from: '0xfrom-c',
        timestamp: 1_710_000_020,
        mevType: 'jit',
      },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('MempoolLanes', () => {
  it('renders one lane per mempool entry', () => {
    render(<MempoolLanes onEnterMicroscope={() => undefined} />);
    expect(screen.getAllByTestId(/^mempool-lane-/).length).toBe(3);
  });

  it('shows the truncated display hash for the first entry', () => {
    render(<MempoolLanes onEnterMicroscope={() => undefined} />);
    // The hash is rendered as text inside a span — query the first lane.
    const firstLane = screen.getByTestId('mempool-lane-0');
    expect(firstLane.textContent).toMatch(/0x1111.*\.\.\..*1111/);
  });

  it('invokes onEnterMicroscope when the user clicks the hover button', () => {
    const spy = vi.fn();
    render(<MempoolLanes onEnterMicroscope={spy} />);
    const buttons = screen.getAllByTestId('mempool-enter-microscope');
    fireEvent.click(buttons[0]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('polls every 2500ms and pushes a new transaction into the store', () => {
    vi.useFakeTimers();
    const before = useLiveStore.getState().mempool.length;
    render(<MempoolLanes onEnterMicroscope={() => undefined} />);
    vi.advanceTimersByTime(2500);
    const after = useLiveStore.getState().mempool.length;
    expect(after).toBe(before + 1);
  });

  it('triggers a flash alert for an attack-type push (30% probability)', () => {
    // Force pushFlashAlert to be observable.
    const spy = vi.spyOn(useUiStore.getState(), 'pushFlashAlert');
    vi.useFakeTimers();
    // Run 40 ticks — by the law of large numbers we should see at
    // least one attack flash.
    render(<MempoolLanes onEnterMicroscope={() => undefined} />);
    for (let i = 0; i < 40; i++) vi.advanceTimersByTime(2500);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('uses the sandwich flash template for sandwich txs', () => {
    const spy = vi.spyOn(useUiStore.getState(), 'pushFlashAlert');
    vi.useFakeTimers();
    render(<MempoolLanes onEnterMicroscope={() => undefined} />);
    for (let i = 0; i < 50; i++) vi.advanceTimersByTime(2500);
    const sandwichCalls = spy.mock.calls.filter(
      ([p]) => (p as { type: string }).type === 'sandwich',
    );
    expect(sandwichCalls.length).toBeGreaterThan(0);
    // Every sandwich flash must use the new specific template.
    for (const [payload] of sandwichCalls) {
      expect((payload as { title: string }).title).toBe('🚨 采样到三明治！');
    }
    spy.mockRestore();
  });

  it('uses the JIT flash template for JIT txs', () => {
    const spy = vi.spyOn(useUiStore.getState(), 'pushFlashAlert');
    vi.useFakeTimers();
    render(<MempoolLanes onEnterMicroscope={() => undefined} />);
    for (let i = 0; i < 50; i++) vi.advanceTimersByTime(2500);
    const jitCalls = spy.mock.calls.filter(
      ([p]) => (p as { type: string }).type === 'jit',
    );
    expect(jitCalls.length).toBeGreaterThan(0);
    for (const [payload] of jitCalls) {
      expect((payload as { title: string }).title).toBe('🎯 检测到 JIT 注入');
    }
    spy.mockRestore();
  });

  it('does not trigger flash alerts while the demo is running', () => {
    useUiStore.getState().startDemo();
    const spy = vi.spyOn(useUiStore.getState(), 'pushFlashAlert');
    vi.useFakeTimers();
    render(<MempoolLanes onEnterMicroscope={() => undefined} />);
    for (let i = 0; i < 50; i++) vi.advanceTimersByTime(2500);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    useUiStore.getState().stopDemo();
  });
});
