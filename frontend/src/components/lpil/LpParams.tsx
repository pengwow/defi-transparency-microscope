/**
 * LpParams — V2/V3 tab + 4 ParamSliders (price ratio, concentration,
 * fee, deposit USD) with a live APR / IL% readout.
 *
 * All state is read & written via the `lpStore`.  The IL% readout is
 * derived from the closed-form V2 IL formula on the current price
 * ratio (and amplified by the V3 concentration factor when the
 * V3 tab is active).
 */

import { useMemo } from 'react';
import { ParamSlider } from '@/components/panels';
import { useLpStore } from '@/store/lpStore';
import { calculateV2IL } from '@/algorithms/il';

export interface LpParamsProps {
  testId?: string;
}

export function LpParams({ testId = 'lpil-params-panel' }: LpParamsProps) {
  const version = useLpStore((s) => s.version);
  const priceRatio = useLpStore((s) => s.priceRatio);
  const concentration = useLpStore((s) => s.concentration);
  const fee = useLpStore((s) => s.fee);
  const depositUsd = useLpStore((s) => s.depositUsd);
  const setVersion = useLpStore((s) => s.setVersion);
  const setPriceRatio = useLpStore((s) => s.setPriceRatio);
  const setConcentration = useLpStore((s) => s.setConcentration);
  const setFee = useLpStore((s) => s.setFee);
  const setDepositUsd = useLpStore((s) => s.setDepositUsd);

  // Live readouts.  For V3, amplification = 1 / (1 - concentration) so
  // a wider negative concentration widens the effective range.
  const ilPct = useMemo(() => {
    const base = calculateV2IL(priceRatio);
    if (version === 'v3') {
      const amp = 1 / Math.max(0.1, 1 - Math.abs(concentration));
      return base * amp;
    }
    return base;
  }, [priceRatio, version, concentration]);

  // Toy APR = fee tier scaled by deposit (a deterministic mock so the
  // readout responds immediately to slider drags).
  const aprPct = useMemo(() => {
    return fee * (depositUsd / 1000);
  }, [fee, depositUsd]);

  return (
    <div className="dtm-lp-params" data-testid={testId}>
      <div className="dtm-lp-params-title">🎛️ 仿真参数 · LP Position: WETH/USDC</div>

      <div className="dtm-lp-params-tabs" data-testid="lpil-params-tabs">
        <button
          type="button"
          className="dtm-lp-params-tab"
          data-testid="lpil-params-tab-v2"
          data-active={version === 'v2'}
          onClick={() => setVersion('v2')}
        >
          V2
        </button>
        <button
          type="button"
          className="dtm-lp-params-tab"
          data-testid="lpil-params-tab-v3"
          data-active={version === 'v3'}
          onClick={() => setVersion('v3')}
        >
          V3
        </button>
      </div>

      <ParamSlider
        testId="lpil-param-price-ratio"
        label="价格比 r"
        min={0.1}
        max={5}
        step={0.05}
        precision={2}
        value={Number(priceRatio.toFixed(2))}
        onChange={setPriceRatio}
        suffix="x"
      />
      <ParamSlider
        testId="lpil-param-concentration"
        label="集中度 ±"
        min={-0.5}
        max={0.5}
        step={0.05}
        precision={2}
        value={Number(concentration.toFixed(2))}
        onChange={setConcentration}
        suffix=" 范围"
        disabled={version === 'v2'}
      />
      <ParamSlider
        testId="lpil-param-fee"
        label="手续费率"
        min={0.01}
        max={1}
        step={0.01}
        precision={2}
        value={Number(fee.toFixed(2))}
        onChange={setFee}
        suffix=" %"
      />
      <ParamSlider
        testId="lpil-param-deposit"
        label="存款额"
        min={1000}
        max={100000}
        step={1000}
        value={depositUsd}
        onChange={setDepositUsd}
        suffix=" USD"
      />

      <div className="dtm-lp-params-readouts">
        <div className="dtm-lp-params-readout">
          <span className="dtm-lp-params-readout-label">当前 APR</span>
          <span
            className="dtm-lp-params-readout-value"
            data-testid="lpil-params-apr-readout"
          >
            {aprPct.toFixed(2)}%
          </span>
        </div>
        <div className="dtm-lp-params-readout">
          <span className="dtm-lp-params-readout-label">当前 IL</span>
          <span
            className="dtm-lp-params-readout-value"
            data-testid="lpil-params-il-readout"
          >
            {(ilPct * 100).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default LpParams;
