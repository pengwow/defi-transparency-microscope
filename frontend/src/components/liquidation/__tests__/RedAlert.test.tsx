/**
 * Tests for RedAlert — a top alert that is rendered only when the
 * store's `redAlert.active` is true.  It can be dismissed via a
 * close button.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RedAlert } from '../RedAlert';
import { useLiquidationStore } from '@/store/liquidationStore';

beforeEach(() => {
  useLiquidationStore.getState().reset();
});

describe('RedAlert', () => {
  it('does not render when no alert is active', () => {
    render(<RedAlert />);
    expect(screen.queryByTestId('liquidation-red-alert-panel')).toBeNull();
  });

  it('renders when redAlert.active is true', () => {
    useLiquidationStore.getState().setRedAlert({
      active: true,
      title: '清算预警',
      desc: 'HF < 1.05',
    });
    render(<RedAlert />);
    expect(screen.getByTestId('liquidation-red-alert-panel')).toBeInTheDocument();
    expect(screen.getByText('清算预警')).toBeInTheDocument();
    expect(screen.getByText('HF < 1.05')).toBeInTheDocument();
  });

  it('dismisses when the close button is clicked', () => {
    useLiquidationStore.getState().setRedAlert({
      active: true,
      title: 'X',
      desc: 'Y',
    });
    render(<RedAlert />);
    fireEvent.click(screen.getByTestId('liquidation-red-alert-close'));
    expect(useLiquidationStore.getState().redAlert).toBeNull();
  });
});
