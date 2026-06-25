/**
 * Tests for AddressInput — text input + "搜索" button + optional
 * error display.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddressInput } from '../AddressInput';

describe('AddressInput', () => {
  it('renders the input and the search button', () => {
    render(<AddressInput />);
    expect(screen.getByTestId('liquidation-address-input')).toBeInTheDocument();
    expect(screen.getByTestId('liquidation-address-search')).toBeInTheDocument();
  });

  it('invokes onChange when the user types', () => {
    render(<AddressInput />);
    const input = screen.getByTestId('liquidation-address-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0xNew' } });
    expect(input.value).toBe('0xNew');
  });

  it('invokes onSearch when the search button is clicked', () => {
    const spy = vi.fn();
    render(<AddressInput onSearch={spy} />);
    const btn = screen.getByTestId('liquidation-address-search');
    fireEvent.click(btn);
    expect(spy).toHaveBeenCalled();
  });

  it('shows the error message when error is set', () => {
    render(<AddressInput error="地址不合法" />);
    expect(screen.getByTestId('liquidation-address-input-error')).toBeInTheDocument();
    expect(screen.getByText(/地址不合法/)).toBeInTheDocument();
  });
});
