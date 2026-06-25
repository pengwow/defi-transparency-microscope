import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../uiStore';

describe('store/uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      page: 'dashboard',
      mode: 'live',
      alerts: [],
      loading: false,
    });
  });

  it('initial state has the expected defaults', () => {
    const s = useUiStore.getState();
    expect(s.page).toBe('dashboard');
    expect(s.mode).toBe('live');
    expect(s.alerts).toEqual([]);
    expect(s.loading).toBe(false);
  });

  it('setPage updates the active page', () => {
    useUiStore.getState().setPage('mempool');
    expect(useUiStore.getState().page).toBe('mempool');
  });

  it('setMode switches between live and replay', () => {
    useUiStore.getState().setMode('replay');
    expect(useUiStore.getState().mode).toBe('replay');
    useUiStore.getState().setMode('live');
    expect(useUiStore.getState().mode).toBe('live');
  });

  it('pushAlert appends to the alerts list', () => {
    useUiStore.getState().pushAlert({ level: 'info', message: 'hello' });
    useUiStore.getState().pushAlert({ level: 'warn', message: 'oh no' });
    const alerts = useUiStore.getState().alerts;
    expect(alerts).toHaveLength(2);
    expect(alerts[0].message).toBe('hello');
    expect(alerts[1].level).toBe('warn');
    expect(typeof alerts[0].id).toBe('string');
  });

  it('clearAlerts empties the list', () => {
    useUiStore.getState().pushAlert({ level: 'info', message: 'x' });
    useUiStore.getState().clearAlerts();
    expect(useUiStore.getState().alerts).toEqual([]);
  });

  it('setLoading toggles the loading flag', () => {
    useUiStore.getState().setLoading(true);
    expect(useUiStore.getState().loading).toBe(true);
    useUiStore.getState().setLoading(false);
    expect(useUiStore.getState().loading).toBe(false);
  });

  it('startDemo sets demoRunning true and resets demoStep to 0', () => {
    useUiStore.getState().startDemo();
    const s = useUiStore.getState();
    expect(s.demoRunning).toBe(true);
    expect(s.demoStep).toBe(0);
  });

  it('pushFlashAlert stores the payload and dismissFlashAlert clears it', () => {
    useUiStore.getState().pushFlashAlert({
      type: 'sandwich',
      title: '三明治攻击',
      body: '检测到夹子交易',
    });
    const a = useUiStore.getState().flashAlert;
    expect(a).not.toBeNull();
    expect(a?.type).toBe('sandwich');
    expect(a?.title).toBe('三明治攻击');
    useUiStore.getState().dismissFlashAlert();
    expect(useUiStore.getState().flashAlert).toBeNull();
  });

  it('stopDemo clears demoRunning, demoStep, and flashAlert', () => {
    useUiStore.getState().startDemo();
    useUiStore.getState().pushFlashAlert({ type: 'jit', title: 'x', body: 'y' });
    useUiStore.getState().stopDemo();
    const s = useUiStore.getState();
    expect(s.demoRunning).toBe(false);
    expect(s.demoStep).toBe(0);
    expect(s.flashAlert).toBeNull();
  });
});
