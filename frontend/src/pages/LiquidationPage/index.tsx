/**
 * LiquidationPage — the Liquidation tab.
 *
 * Two modes:
 *   - panorama ("全景模式"): HeatmapPanel + ProtocolStats + PendingMempool + AmmDisturbanceMap
 *   - focus ("焦点模式"): AddressInput + SimParams + ExperimentControls + RedAlert + HfGaugePanel + PriceHfCurve + LiquidationTimeline + AttributionPanel + PositionDetails
 *
 * The mode is stored in `liquidationStore.liqMode`.  The
 * `LiquidationExplanation` panel is shown below both modes.
 */

import { useLiquidationStore } from '@/store/liquidationStore';
import {
  PanoramaView,
  FocusView,
  HeatmapPanel,
  ProtocolStats,
  PendingMempool,
  AmmDisturbanceMap,
  LiquidationExplanation,
} from '@/components/liquidation';
import './LiquidationPage.css';

export function LiquidationPage() {
  const liqMode = useLiquidationStore((s) => s.liqMode);
  const setLiqMode = useLiquidationStore((s) => s.setLiqMode);

  return (
    <div className="dtm-page dtm-liquidation-page" data-testid="liquidation-page">
      <div className="dtm-liquidation-mode-bar" data-testid="liquidation-mode-bar">
        <button
          type="button"
          className="dtm-liquidation-mode-btn"
          data-testid="liquidation-mode-panorama"
          data-active={liqMode === 'panorama'}
          onClick={() => setLiqMode('panorama')}
        >
          全景模式
        </button>
        <button
          type="button"
          className="dtm-liquidation-mode-btn"
          data-testid="liquidation-mode-focus"
          data-active={liqMode === 'focus'}
          onClick={() => setLiqMode('focus')}
        >
          焦点模式
        </button>
      </div>

      {liqMode === 'panorama' ? (
        <div className="dtm-liquidation-panorama" data-testid="liquidation-panorama-container">
          <PanoramaView />
          <div className="dtm-liquidation-panorama-side">
            <HeatmapPanel />
            <ProtocolStats />
            <PendingMempool />
          </div>
          <AmmDisturbanceMap />
        </div>
      ) : (
        <FocusView />
      )}

      <LiquidationExplanation />
    </div>
  );
}

export default LiquidationPage;
