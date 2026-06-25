/**
 * Tests for `runDemo` — the orchestrated "一键实验" demo script.
 *
 * Two scripts are covered:
 *   - 'auto' (16s): Live → push sandwich flash alert → dismiss + capture →
 *     fork → parse → ready → zooming → idle + Fork page → stopDemo
 *   - 'microscope' (3.5s): dismiss → capture → fork → parse → ready →
 *     zooming → idle + Fork page
 *
 * Behaviour asserted:
 *   - startDemo sets demoRunning=true and demoStep=0
 *   - advanceDemo increments demoStep
 *   - Steps fire in time-order when fake timers advance
 *   - Manual stopDemo cancels side effects (timers either no-op or
 *     are cleared, so demoRunning stays false after a long advance)
 *   - Calling runDemo twice clears the previous timers (no double-fire)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runDemo } from '../demoScript';
import { useUiStore } from '@/store/uiStore';

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({
    page: 'live',
    mode: 'live',
    alerts: [],
    loading: false,
    flashAlert: null,
    lensStage: 'idle',
    demoRunning: false,
    demoStep: 0,
    blockNumber: 22_180_542,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runDemo (auto)', () => {
  it('startDemo sets demoRunning=true and demoStep=0', () => {
    runDemo('auto');
    expect(useUiStore.getState().demoRunning).toBe(true);
    expect(useUiStore.getState().demoStep).toBe(0);
  });

  it('advanceDemo increments demoStep on the 2000ms (first real progress) step', () => {
    runDemo('auto');
    expect(useUiStore.getState().demoStep).toBe(0);
    vi.advanceTimersByTime(2000);
    expect(useUiStore.getState().demoStep).toBe(1);
  });

  it('0ms sets page to live', () => {
    useUiStore.getState().setPage('report');
    runDemo('auto');
    expect(useUiStore.getState().page).toBe('live');
  });

  it('2000ms pushes a sandwich flashAlert', () => {
    runDemo('auto');
    vi.advanceTimersByTime(2000);
    const alert = useUiStore.getState().flashAlert;
    expect(alert).not.toBeNull();
    expect(alert?.type).toBe('sandwich');
  });

  it('4000ms dismisses flashAlert and sets lensStage=capture', () => {
    runDemo('auto');
    vi.advanceTimersByTime(2000);
    expect(useUiStore.getState().flashAlert).not.toBeNull();
    vi.advanceTimersByTime(2000);
    expect(useUiStore.getState().flashAlert).toBeNull();
    expect(useUiStore.getState().lensStage).toBe('capture');
  });

  it('5000ms sets lensStage=fork', () => {
    runDemo('auto');
    vi.advanceTimersByTime(5000);
    expect(useUiStore.getState().lensStage).toBe('fork');
  });

  it('6000ms sets lensStage=parse', () => {
    runDemo('auto');
    vi.advanceTimersByTime(6000);
    expect(useUiStore.getState().lensStage).toBe('parse');
  });

  it('7000ms sets lensStage=ready', () => {
    runDemo('auto');
    vi.advanceTimersByTime(7000);
    expect(useUiStore.getState().lensStage).toBe('ready');
  });

  it('8500ms sets lensStage=zooming', () => {
    runDemo('auto');
    vi.advanceTimersByTime(8500);
    expect(useUiStore.getState().lensStage).toBe('zooming');
  });

  it('10500ms sets lensStage=idle and page=fork', () => {
    runDemo('auto');
    vi.advanceTimersByTime(10500);
    expect(useUiStore.getState().lensStage).toBe('idle');
    expect(useUiStore.getState().page).toBe('fork');
  });

  it('16000ms calls stopDemo (demoRunning=false)', () => {
    runDemo('auto');
    vi.advanceTimersByTime(16000);
    expect(useUiStore.getState().demoRunning).toBe(false);
  });
});

describe('runDemo (microscope)', () => {
  it('0ms dismisses any pending flashAlert', () => {
    useUiStore.getState().pushFlashAlert({
      type: 'sandwich',
      title: 'prior',
      body: 'should be cleared',
    });
    runDemo('microscope');
    expect(useUiStore.getState().flashAlert).toBeNull();
  });

  it('100ms sets lensStage=capture', () => {
    runDemo('microscope');
    vi.advanceTimersByTime(100);
    expect(useUiStore.getState().lensStage).toBe('capture');
  });

  it('800ms sets lensStage=fork', () => {
    runDemo('microscope');
    vi.advanceTimersByTime(800);
    expect(useUiStore.getState().lensStage).toBe('fork');
  });

  it('1500ms sets lensStage=parse', () => {
    runDemo('microscope');
    vi.advanceTimersByTime(1500);
    expect(useUiStore.getState().lensStage).toBe('parse');
  });

  it('2200ms sets lensStage=ready', () => {
    runDemo('microscope');
    vi.advanceTimersByTime(2200);
    expect(useUiStore.getState().lensStage).toBe('ready');
  });

  it('2900ms sets lensStage=zooming', () => {
    runDemo('microscope');
    vi.advanceTimersByTime(2900);
    expect(useUiStore.getState().lensStage).toBe('zooming');
  });

  it('3500ms sets lensStage=idle and page=fork', () => {
    runDemo('microscope');
    vi.advanceTimersByTime(3500);
    expect(useUiStore.getState().lensStage).toBe('idle');
    expect(useUiStore.getState().page).toBe('fork');
  });
});

describe('runDemo cleanup', () => {
  it('stopDemo prevents scheduled step actions from firing', () => {
    runDemo('auto');
    useUiStore.getState().stopDemo();
    // Advance well past the 4000ms 'capture' step.
    vi.advanceTimersByTime(10000);
    // The 4000ms action should have been skipped because demoRunning
    // was false by the time the timer fired.
    expect(useUiStore.getState().lensStage).toBe('idle');
    expect(useUiStore.getState().demoRunning).toBe(false);
  });

  it('advancing past 16s keeps demoRunning=false after stopDemo', () => {
    runDemo('auto');
    useUiStore.getState().stopDemo();
    vi.advanceTimersByTime(20000);
    expect(useUiStore.getState().demoRunning).toBe(false);
  });

  it('calling runDemo a second time clears the first run\'s timers', () => {
    runDemo('auto');
    // Immediately re-run with a different script.
    runDemo('microscope');
    // Advance past the auto 4000ms 'capture' step.  If the auto
    // timer wasn't cleared, lensStage would be 'capture' here.
    // The microscope script's 3500ms 'idle' step should be the last
    // one to touch lensStage.
    vi.advanceTimersByTime(4000);
    expect(useUiStore.getState().lensStage).toBe('idle');
  });
});
