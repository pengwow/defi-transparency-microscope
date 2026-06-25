/**
 * PoolStatePanel — 5-row pool state table for the LP/IL microscope.
 *
 * Rows:
 *   1. Reserve0       (WETH reserves, in ETH)
 *   2. Reserve1       (USDC reserves, in USDC)
 *   3. LP token supply (mock constant-product formula)
 *   4. 当前价格       (current implied USDC/WETH price)
 *   5. 价格比 r       (the active price ratio from lpStore)
 *
 * All values are derived from the `lpStore` so they react to the
 * price ratio / deposit sliders in real time.  The mock pool uses
 * a constant-product invariant (x·y = k) anchored to the initial
 * $2,500 WETH price and a $10M starting depth.
 */

import { useMemo } from 'react';
import { useLpStore } from '@/store/lpStore';

const INITIAL_PRICE = 2500; // USDC per WETH
const INITIAL_DEPTH_USD = 10_000_000;

export interface PoolStatePanelProps {
  testId?: string;
}

export function PoolStatePanel({ testId = 'pool-state-panel' }: PoolStatePanelProps) {
  const priceRatio = useLpStore((s) => s.priceRatio);
  const depositUsd = useLpStore((s) => s.depositUsd);

  const rows = useMemo(() => {
    const initialEth = INITIAL_DEPTH_USD / INITIAL_PRICE / 2; // half the depth in ETH
    const initialUsdc = INITIAL_DEPTH_USD / 2; // half in USDC
    // k = x * y
    const k = initialEth * initialUsdc;
    // The LP adds a slice proportional to its deposit.
    const slice = depositUsd / INITIAL_DEPTH_USD;
    const userEth = initialEth * slice * Math.sqrt(priceRatio);
    const userUsdc = (initialUsdc * slice) / Math.sqrt(priceRatio);
    const lpSupply = Math.sqrt(userEth * userUsdc);
    const currentPrice = INITIAL_PRICE * priceRatio;
    return [
      { key: 'reserve0', label: 'Reserve0', value: `${userEth.toFixed(2)} WETH`, color: '#00e5ff' },
      { key: 'reserve1', label: 'Reserve1', value: `${Math.round(userUsdc).toLocaleString()} USDC`, color: '#00e5ff' },
      { key: 'lp', label: 'LP token supply', value: lpSupply.toFixed(2), color: '#8b9bb4' },
      { key: 'price', label: '当前价格', value: `$${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: '#ffab40' },
      { key: 'ratio', label: '价格比 r', value: `${priceRatio.toFixed(2)}x`, color: '#b388ff' },
    ];
  }, [priceRatio, depositUsd]);

  return (
    <div className="dtm-pool-state-panel" data-testid={testId}>
      <div className="dtm-pool-state-panel-title">🧪 池子状态</div>
      <table className="dtm-pool-state-table">
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="dtm-pool-state-row"
              data-testid={`pool-state-row-${r.key}`}
            >
              <td className="dtm-pool-state-label">{r.label}</td>
              <td
                className="dtm-pool-state-value"
                style={{ color: r.color }}
              >
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PoolStatePanel;
