/**
 * AddressInput — the address search input used in the focus view.
 *
 * Hosts a text input + a "搜索" button + an optional error message.
 * Reads/writes the focus address through the `liquidationStore` by
 * default; the parent may also pass `onSearch` for side-effects.
 */

import { useState } from 'react';
import { useLiquidationStore } from '@/store/liquidationStore';

export interface AddressInputProps {
  /** Called when the user clicks the "搜索" button. */
  onSearch?: (address: string) => void;
  /** Optional error message to render under the input. */
  error?: string;
  /** Optional test id for the root element. */
  testId?: string;
}

export function AddressInput({
  onSearch,
  error,
  testId = 'liquidation-address-input-panel',
}: AddressInputProps) {
  const focusAddress = useLiquidationStore((s) => s.focusAddress);
  const setFocusAddress = useLiquidationStore((s) => s.setFocusAddress);
  const [localError, setLocalError] = useState<string | null>(null);

  const visibleError = error ?? localError;

  function handleSearch() {
    if (!focusAddress.startsWith('0x')) {
      setLocalError('地址必须以 0x 开头');
      return;
    }
    setLocalError(null);
    onSearch?.(focusAddress);
  }

  return (
    <div className="dtm-address-input-panel" data-testid={testId}>
      <div className="dtm-address-input-title">🔍 地址输入</div>
      <div className="dtm-address-input-row">
        <input
          type="text"
          className="dtm-address-input"
          data-testid="liquidation-address-input"
          value={focusAddress}
          onChange={(e) => setFocusAddress(e.target.value)}
          placeholder="0x..."
        />
        <button
          type="button"
          className="dtm-address-search-btn"
          data-testid="liquidation-address-search"
          onClick={handleSearch}
        >
          搜索
        </button>
      </div>
      {visibleError && (
        <div
          className="dtm-address-input-error"
          data-testid="liquidation-address-input-error"
          role="alert"
        >
          {visibleError}
        </div>
      )}
    </div>
  );
}

export default AddressInput;
