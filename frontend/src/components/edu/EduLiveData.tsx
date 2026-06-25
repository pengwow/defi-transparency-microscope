/**
 * EduLiveData — a 5-row mock live-data table for the active
 * scenario.  Each row shows:
 *   - a deterministic transaction hash
 *   - a type / scenario label
 *   - a price change (positive or negative)
 *   - an estimated profit
 *
 * The numbers are derived from the active scenario + the slider
 * state, so dragging a slider in EduParams immediately rewrites
 * the table.
 */

import { useMemo } from 'react';
import { useEduStore, type EduScenario } from '@/store/eduStore';

export interface EduLiveDataProps {
  testId?: string;
}

interface EduLiveRow {
  hash: string;
  type: string;
  priceChangePct: number;
  profitUsd: number;
}

const SCENARIO_TYPE_LABEL: Record<EduScenario, string> = {
  sandwich: '三明治',
  jit: 'JIT',
  arbitrage: '套利',
  liquidation: '清算',
  'front-running': '前跑',
};

const HASH_PREFIX = '0x';

function fakeHash(seed: number): string {
  // Deterministic mock hash (no Math.random → stable tests).
  const hex = ((seed * 0x9e3779b1) >>> 0).toString(16).padStart(8, '0');
  return `${HASH_PREFIX}${hex}${hex}${hex}${hex}`;
}

export function EduLiveData({ testId = 'edu-live-data-panel' }: EduLiveDataProps) {
  const activeScenario = useEduStore((s) => s.activeScenario);
  const swapSize = useEduStore((s) => s.sliders.swapSize);
  const liquidity = useEduStore((s) => s.sliders.liquidity);
  const gasPrice = useEduStore((s) => s.sliders.gasPrice);

  const rows: EduLiveRow[] = useMemo(() => {
    const baseChange = (swapSize / Math.max(1, liquidity)) * 100;
    const baseProfit = swapSize * 100 * (gasPrice / 50);
    return [1, 2, 3, 4, 5].map((i) => {
      const wobble = ((i % 3) - 1) * 0.4; // -0.4, 0, 0.4
      const profitWobble = ((i % 2) - 0.5) * 0.6; // -0.3, 0.3
      return {
        hash: fakeHash(i + activeScenario.length),
        type: SCENARIO_TYPE_LABEL[activeScenario],
        priceChangePct: baseChange * (1 + wobble),
        profitUsd: Math.max(0, Math.round(baseProfit * (1 + profitWobble))),
      };
    });
  }, [activeScenario, swapSize, liquidity, gasPrice]);

  return (
    <div className="dtm-edu-live-data" data-testid={testId}>
      <div className="dtm-edu-live-data-title">📡 实时数据（mock）</div>
      <table className="dtm-edu-live-data-table">
        <thead>
          <tr>
            <th>Hash</th>
            <th>类型</th>
            <th>价格变化</th>
            <th>Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.hash}
              className="dtm-edu-live-data-row"
              data-testid={`edu-live-row-${i + 1}`}
            >
              <td className="dtm-edu-live-data-hash">{r.hash}</td>
              <td className="dtm-edu-live-data-type">{r.type}</td>
              <td
                className="dtm-edu-live-data-change"
                style={{ color: r.priceChangePct >= 0 ? '#69f0ae' : '#ff5e5e' }}
              >
                {r.priceChangePct >= 0 ? '+' : ''}
                {r.priceChangePct.toFixed(2)}%
              </td>
              <td
                className="dtm-edu-live-data-profit"
                style={{ color: '#00e5ff' }}
              >
                ${r.profitUsd.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default EduLiveData;
