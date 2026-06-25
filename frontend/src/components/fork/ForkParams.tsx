/**
 * ForkParams — left-column param panel for the Fork tab.
 *
 * Mirrors DTM_Demo.html lines 549-593.  Provides 5 sliders (block
 * number / pool depth / slippage tolerance / gas price / attacker
 * capital), a WETH ↔ USDC token pair display, and a "重放仿真" replay
 * button.  All state is held locally (useState) so the parent page
 * can lift it if needed.
 */

import { useState } from 'react';
import { ParamSlider } from '@/components/panels';

export interface ForkParamsValues {
  block: number;
  poolDepth: number;
  slippage: number;
  gasPrice: number;
  attackerCapital: number;
}

export interface ForkParamsProps {
  /** Called when the user clicks the "重放仿真" replay button. */
  onReplay: (values: ForkParamsValues) => void;
  /** Optional initial values. */
  initial?: Partial<ForkParamsValues>;
  /** Optional test id for the root element. */
  testId?: string;
}

const DEFAULTS: ForkParamsValues = {
  block: 22_180_542,
  poolDepth: 1000,
  slippage: 5,
  gasPrice: 30,
  attackerCapital: 50,
};

export function ForkParams({ onReplay, initial, testId }: ForkParamsProps) {
  const [block, setBlock] = useState<number>(initial?.block ?? DEFAULTS.block);
  const [poolDepth, setPoolDepth] = useState<number>(initial?.poolDepth ?? DEFAULTS.poolDepth);
  const [slippage, setSlippage] = useState<number>(initial?.slippage ?? DEFAULTS.slippage);
  const [gasPrice, setGasPrice] = useState<number>(initial?.gasPrice ?? DEFAULTS.gasPrice);
  const [attackerCapital, setAttackerCapital] = useState<number>(
    initial?.attackerCapital ?? DEFAULTS.attackerCapital,
  );

  return (
    <div className="dtm-fork-params" data-testid={testId}>
      <ParamSlider
        label="Fork 区块"
        min={18_000_000}
        max={30_000_000}
        step={1}
        value={block}
        onChange={setBlock}
        suffix=""
      />
      <ParamSlider
        label="池子深度 (WETH)"
        min={500}
        max={10_000}
        step={50}
        value={poolDepth}
        onChange={setPoolDepth}
        suffix=" WETH"
      />
      <ParamSlider
        label="滑点容忍"
        min={1}
        max={50}
        step={1}
        value={slippage}
        onChange={setSlippage}
        suffix="%"
        precision={0}
      />
      <ParamSlider
        label="Gas Price"
        min={1}
        max={300}
        step={1}
        value={gasPrice}
        onChange={setGasPrice}
        suffix=" gwei"
      />
      <ParamSlider
        label="攻击者资本"
        min={1}
        max={500}
        step={1}
        value={attackerCapital}
        onChange={setAttackerCapital}
        suffix=" WETH"
      />

      <div className="dtm-form-group">
        <label className="dtm-form-label">交易对</label>
        <div className="dtm-token-row">
          <div className="dtm-token-icon" style={{ background: 'linear-gradient(135deg,#627eea,#8c9eff)' }}>
            Ξ
          </div>
          <div className="dtm-token-info">
            <div className="dtm-token-symbol">WETH</div>
          </div>
        </div>
        <div className="dtm-swap-arrow">→</div>
        <div className="dtm-token-row">
          <div className="dtm-token-icon" style={{ background: 'linear-gradient(135deg,#2775ca,#6ab7ff)' }}>
            $
          </div>
          <div className="dtm-token-info">
            <div className="dtm-token-symbol">USDC</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="dtm-btn dtm-btn-primary"
        onClick={() =>
          onReplay({ block, poolDepth, slippage, gasPrice, attackerCapital })
        }
      >
        <span>▶</span> 重放仿真
      </button>
    </div>
  );
}
