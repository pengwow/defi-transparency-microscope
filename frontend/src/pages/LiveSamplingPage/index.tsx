/**
 * LiveSamplingPage — the "Live 实时采样" tab.
 *
 * Three-column layout (per DTM_Demo.html page-live):
 *   - Left:  Mempool 泳道 (MempoolLanes + MevLegend) + MEV 策略归因
 *   - Center: 实时 AMM 曲线 + 实时损益归因
 *   - Right: 网络状态 + 最近采样
 *
 * Each cell is wrapped in a `Panel`; MempoolLanes exposes an
 * "🔬 放入显微镜" button that drops the user into the demo's
 * microscope-loading animation by setting the UI store's lens
 * stage to `capture`.
 */

import { Panel, ExplainBox } from '@/components/panels';
import { useUiStore } from '@/store/uiStore';
import {
  MempoolLanes,
  MevLegend,
  MevAttribution,
  LiveAmmPanel,
  LivePnlPanel,
  NetworkStatus,
  RecentSamples,
} from '@/components/live';
import './LiveSamplingPage.css';

const LIVE_BADGE = (
  <span className="dtm-live-badge">
    <span className="dtm-pulse" />
    LIVE
  </span>
);

export function LiveSamplingPage() {
  const setLensStage = useUiStore((s) => s.setLensStage);

  return (
    <div className="dtm-page dtm-page-live is-active" data-testid="live-page">
      <div className="dtm-container">
        <ExplainBox testId="live-sampling-explain">
          <strong>实时采样模式</strong>：DTM 通过 WebSocket 直连以太坊节点，实时订阅 Mempool 中的待处理交易。
          你看到的就是
          <span style={{ color: 'var(--dtm-coral)' }}>此刻</span>
          区块链上正在发生的事。当采样到 MEV 策略活动时，右上角会弹出标注，你可以一键"放入显微镜"进行深度分析。
        </ExplainBox>
        <div className="dtm-grid-3">
          {/* LEFT column */}
          <div>
            <div style={{ marginBottom: '0.7rem' }}>
              <Panel
                title="Mempool 泳道"
                right={LIVE_BADGE}
                testId="mempool-panel"
              >
                <MevLegend />
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  <MempoolLanes
                    onEnterMicroscope={() => {
                      setLensStage('capture');
                    }}
                  />
                </div>
              </Panel>
            </div>
            <Panel
              title="MEV 策略归因"
              dotColor="var(--dtm-amber)"
              testId="mev-attribution-panel"
            >
              <MevAttribution />
            </Panel>
          </div>

          {/* CENTER column */}
          <div>
            <div style={{ marginBottom: '0.7rem' }}>
              <Panel
                title="实时 AMM 曲线 — WETH/USDC"
                right={LIVE_BADGE}
                testId="live-amm-panel"
              >
                <LiveAmmPanel />
              </Panel>
            </div>
            <Panel
              title="实时损益归因"
              dotColor="var(--dtm-purple)"
              testId="live-pnl-panel"
            >
              <LivePnlPanel />
            </Panel>
          </div>

          {/* RIGHT column */}
          <div>
            <Panel
              title="网络状态"
              dotColor="var(--dtm-lime)"
              testId="network-status-panel"
            >
              <NetworkStatus />
            </Panel>
            <div style={{ height: '0.7rem' }} />
            <Panel
              title="最近采样"
              dotColor="var(--dtm-coral)"
              testId="recent-samples-panel"
            >
              <RecentSamples />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveSamplingPage;
