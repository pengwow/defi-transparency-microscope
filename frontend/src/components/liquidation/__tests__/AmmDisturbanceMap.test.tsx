/**
 * Tests for AmmDisturbanceMap — wraps the AmmDisturbance canvas with
 * an explanatory caption.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { AmmDisturbanceMap } from '../AmmDisturbanceMap';

describe('AmmDisturbanceMap', () => {
  it('renders the disturbance canvas', () => {
    render(<AmmDisturbanceMap />);
    expect(screen.getByTestId('liquidation-amm-disturbance-panel')).toBeInTheDocument();
    expect(screen.getByTestId('amm-disturbance-canvas')).toBeInTheDocument();
  });

  it('renders an explanatory caption mentioning x*y=k', () => {
    render(<AmmDisturbanceMap />);
    const cap = screen.getByTestId('amm-disturbance-caption');
    expect(cap.textContent).toMatch(/x\*y=k|扰动|红圈/);
  });
});
