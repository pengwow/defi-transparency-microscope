/**
 * Tests for EduParams — three ParamSliders (Swap 数量 / 池子深度 /
 * Gas 价格) + 当前场景说明.
 *
 * The sliders are bound to `eduStore.sliders` and the description
 * reflects the active scenario from `eduStore.activeScenario`.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EduParams } from '../EduParams';
import { useEduStore } from '@/store/eduStore';

describe('EduParams', () => {
  beforeEach(() => {
    useEduStore.getState().reset();
  });

  it('renders the panel root', () => {
    render(<EduParams />);
    expect(screen.getByTestId('edu-params-panel')).toBeInTheDocument();
  });

  it('renders 3 ParamSliders (range inputs)', () => {
    render(<EduParams />);
    const ranges = document.querySelectorAll('input[type="range"]');
    expect(ranges.length).toBe(3);
  });

  it('shows the active scenario description for sandwich by default', () => {
    render(<EduParams />);
    expect(screen.getByTestId('edu-params-description').textContent).toMatch(
      /三明治/,
    );
  });

  it('updates the description when the scenario changes', () => {
    render(<EduParams />);
    act(() => {
      useEduStore.getState().setActiveScenario('jit');
    });
    expect(screen.getByTestId('edu-params-description').textContent).toMatch(
      /JIT/,
    );
  });

  it('moving the swapSize slider writes to the store', () => {
    render(<EduParams />);
    const slider = screen.getByTestId('edu-param-swap-size');
    const range = slider.querySelector('input[type="range"]') as HTMLInputElement;
    act(() => {
      fireEvent.change(range, { target: { value: '55' } });
    });
    expect(useEduStore.getState().sliders.swapSize).toBe(55);
  });

  it('moving the liquidity slider writes to the store', () => {
    render(<EduParams />);
    const slider = screen.getByTestId('edu-param-liquidity');
    const range = slider.querySelector('input[type="range"]') as HTMLInputElement;
    act(() => {
      fireEvent.change(range, { target: { value: '4321' } });
    });
    expect(useEduStore.getState().sliders.liquidity).toBe(4321);
  });

  it('moving the gasPrice slider writes to the store', () => {
    render(<EduParams />);
    const slider = screen.getByTestId('edu-param-gas-price');
    const range = slider.querySelector('input[type="range"]') as HTMLInputElement;
    act(() => {
      fireEvent.change(range, { target: { value: '123' } });
    });
    expect(useEduStore.getState().sliders.gasPrice).toBe(123);
  });
});
