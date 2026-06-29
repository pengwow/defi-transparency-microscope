/**
 * ForkParams — left-column param panel for the Fork tab.
 *
 * Mirrors DTM_Demo.html lines 549-593.  Provides 5 sliders (block
 * number / pool depth / slippage tolerance / gas price / attacker
 * capital), a WETH ↔ USDC token pair display, and a "重放仿真" replay
 * button.
 *
 * All slider state and the replay action live in the `forkStore`
 * (Zustand) so the visualisation panels (ForkAmmPanel,
 * ForkSankeyPanel, QuantResults, ForkConclusion) can subscribe and
 * redraw whenever the user moves a slider or clicks "重放仿真".
 *
 * The legacy `onReplay` prop is preserved so that older tests
 * (which mock the handler with `vi.fn()`) keep passing.
 */

import { ParamSlider } from '@/components/panels';
import { useForkStore } from '@/store/forkStore';

export interface ForkParamsValues {
  block: number;
  poolDepth: number;
  slippage: number;
  gasPrice: number;
  attackerCapital: number;
}

export interface ForkParamsProps {
  /** Called when the user clicks the "重放仿真" replay button. */
  onReplay?: (values: ForkParamsValues) => void;
  /** Optional initial values (only applied on first mount). */
  initial?: Partial<ForkParamsValues>;
  /** Optional test id for the root element. */
  testId?: string;
}

export function ForkParams({ onReplay, testId }: ForkParamsProps) {
  const params = useForkStore((s) => s.params);
  const replaying = useForkStore((s) => s.replaying);
  const setParam = useForkStore((s) => s.setParam);
  const replay = useForkStore((s) => s.replay);

  const handleReplay = () => {
    replay();
    onReplay?.(params);
  };

  return (
    <div className="dtm-fork-params" data-testid={testId}>
      <ParamSlider
        label="Fork 区块"
        min={18_000_000}
        max={30_000_000}
        step={1}
        value={params.block}
        onChange={(v) => setParam('block', v)}
        suffix=""
      />
      <ParamSlider
        label="池子深度 (WETH)"
        min={500}
        max={10_000}
        step={50}
        value={params.poolDepth}
        onChange={(v) => setParam('poolDepth', v)}
        suffix=" WETH"
      />
      <ParamSlider
        label="滑点容忍"
        min={1}
        max={50}
        step={1}
        value={params.slippage}
        onChange={(v) => setParam('slippage', v)}
        suffix="%"
        precision={0}
      />
      <ParamSlider
        label="Gas Price"
        min={1}
        max={300}
        step={1}
        value={params.gasPrice}
        onChange={(v) => setParam('gasPrice', v)}
        suffix=" gwei"
      />
      <ParamSlider
        label="攻击者资本"
        min={1}
        max={500}
        step={1}
        value={params.attackerCapital}
        onChange={(v) => setParam('attackerCapital', v)}
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
        className={`dtm-btn dtm-btn-primary${replaying ? ' is-replaying' : ''}`}
        onClick={handleReplay}
        data-testid="fork-replay-btn"
        data-replaying={replaying ? 'true' : 'false'}
        disabled={replaying}
      >
        <span>{replaying ? '⏳' : '▶'}</span> {replaying ? '仿真中…' : '重放仿真'}
      </button>
    </div>
  );
}
