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
});
