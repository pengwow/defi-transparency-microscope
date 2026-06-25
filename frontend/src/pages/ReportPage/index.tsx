/**
 * ReportPage — the 📊 报告 (合规报告) tab.
 *
 * Layout (mirrors DTM_Demo.html lines 1041-1140):
 *   - Top:    ReportOverview (4 metrics + report id + block + export)
 *   - 3-col:
 *       Left:   StrategyPie + AttackerAttribution
 *       Center: RiskRadar + VulnerabilityPanel
 *       Right:  ProfitWaterfall + ComplianceAdvice
 *   - Bottom (full width): EvmTrace + RiskAssessment
 *
 * The legacy PnL / Export JSON / ReportSummary sub-modules remain
 * importable (iron rule 5) so downstream consumers don't break.
 */

import { ExplainBox, Panel } from '@/components/common';
import {
  ReportOverview,
  StrategyPie,
  RiskRadar,
  ProfitWaterfall,
  AttackerAttribution,
  VulnerabilityPanel,
  ComplianceAdvice,
  RiskAssessment,
  EvmTrace,
  ExportPdfButton,
} from '@/components/report';
import { ReportSummary, type ReportSummary as ReportSummaryData } from './ReportSummary';
import { PnLChart, type PnLPoint } from './PnLChart';
import { ExportButton, type ReportData } from './ExportButton';
import './ReportPage.css';

const SUMMARY: ReportSummaryData = {
  txCount: 128,
  mevCostUsd: 4_215.5,
  lpValueUsd: 312_500,
  debtUsd: 75_000,
  scenarios: 6,
};

const PNL: ReadonlyArray<PnLPoint> = [
  { ts: 1_700_000_000, value: 0 },
  { ts: 1_700_086_400, value: 250 },
  { ts: 1_700_172_800, value: 180 },
  { ts: 1_700_259_200, value: 420 },
  { ts: 1_700_345_600, value: 360 },
  { ts: 1_700_432_000, value: 510 },
  { ts: 1_700_518_400, value: 680 },
];

const REPORT_DATA: ReportData = {
  sessionId: 'sess-2026-06-25',
  generatedAt: 1_700_518_400,
  txCount: SUMMARY.txCount,
  mevCostUsd: SUMMARY.mevCostUsd,
  lpValueUsd: SUMMARY.lpValueUsd,
  debtUsd: SUMMARY.debtUsd,
  scenarios: SUMMARY.scenarios,
  pnlSeries: PNL,
};

const STRATEGY_SLICES = [
  { label: '三明治', value: 42, color: '#ff5e5e' },
  { label: '套利', value: 28, color: '#ffab40' },
  { label: 'JIT', value: 18, color: '#b388ff' },
  { label: '清算', value: 12, color: '#448aff' },
  { label: '前跑', value: 5, color: '#69f0ae' },
];

const RISK_AXES = [
  { label: '频率', value: 80, max: 100 },
  { label: '复杂度', value: 60, max: 100 },
  { label: '单笔利润', value: 90, max: 100 },
  { label: '防御难度', value: 75, max: 100 },
  { label: '检测难度', value: 50, max: 100 },
];

const WATERFALL_STEPS = [
  { label: '攻击者利润', delta: 1240, type: 'gain' as const },
  { label: '受害者损失', delta: -456, type: 'loss' as const },
  { label: 'LP 损失', delta: -89, type: 'loss' as const },
  { label: '协议费', delta: -12, type: 'loss' as const },
  { label: '验证者小费', delta: -45, type: 'loss' as const },
  { label: '净效果', delta: 638, type: 'total' as const },
];

const ATTACKER_ROWS = [
  { address: '0x7a25a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7', share: 42, profit: 1240.5, protocol: 'Uniswap V3', timestamp: 1_716_000_000 },
  { address: '0x1234567890abcdef1234567890abcdef12345678', share: 28, profit: 824.2, protocol: 'SushiSwap', timestamp: 1_716_005_000 },
  { address: '0xabcdef1234567890abcdef1234567890abcdef12', share: 18, profit: 530.0, protocol: 'Curve', timestamp: 1_716_010_000 },
  { address: '0x9876543210fedcba9876543210fedcba98765432', share: 7, profit: 207.8, protocol: 'Balancer', timestamp: 1_716_015_000 },
  { address: '0xdeadbeefcafebabe0123456789abcdef01234567', share: 5, profit: 148.4, protocol: 'PancakeSwap', timestamp: 1_716_020_000 },
];

const VULNS = [
  { name: '滑点容忍度过宽', severity: 'high' as const, description: '0.5% 滑点设置过于宽松，给三明治攻击留出套利空间。', reference: 'EIP-1559 / MEV-Boost' },
  { name: '交易金额/池子深度比例过高', severity: 'high' as const, description: '0.24% 的比例容易被检测和插队。', reference: 'Aave V3 docs § Risk Parameters' },
  { name: '未使用私有通道', severity: 'medium' as const, description: '完全公开 mempool，攻击者无需付费即可抢跑。', reference: 'Flashbots Protect' },
];

const ADVICE = [
  { party: 'regulator' as const, title: 'MiCA 透明度', body: 'DEX 应向用户披露 MEV 风险，建议集成 Pre-Trade Risk Score。' },
  { party: 'protocol' as const, title: '集成 MEV-Protect', body: '为零售用户默认启用 MEV 保护（Flashbots Protect）。' },
  { party: 'user' as const, title: '拆分大额交易', body: '将大额 swap 拆成多笔小额，降低被夹价值。' },
  { party: 'auditor' as const, title: '不可篡改日志', body: '所有 MEV 事件记录不可篡改日志，保留 ≥ 2 年。' },
];

const EVM_TRACE = [
  { pc: 0, opcode: 'CALL', gas: 21_000, stack: '0x', desc: '外层调用' },
  { pc: 1, opcode: 'STATICCALL', gas: 5_000, stack: '0x01', desc: '读池子' },
  { pc: 2, opcode: 'DELEGATECALL', gas: 8_000, stack: '0x02', desc: '库调用' },
  { pc: 3, opcode: 'SSTORE', gas: 20_000, stack: '0x03', desc: '写储备' },
  { pc: 4, opcode: 'MSTORE', gas: 100, stack: '0x04', desc: '写内存' },
  { pc: 5, opcode: 'LOG3', gas: 1_500, stack: '0x05', desc: '事件' },
];

const REPORT_OVERVIEW = {
  reportId: 'DTM-RPT-20260625-001',
  blockNumber: 22_180_543,
  totalProfitUsd: 1_240_500_000_000_000_000n,
  totalLossUsd: 456_200_000_000_000_000n,
  victimCount: 12,
  txCount: 38,
};

export function ReportPage() {
  return (
    <div className="dtm-page dtm-report-page" data-testid="report-page">
      <div className="dtm-report-page-title">📊 合规报告 (MiCA / ESMA)</div>

      <ExplainBox title="关于本报告">
        DTM 为采样到的 MEV 事件生成正式分析报告。报告包含 5 类策略归因、
        5 维风险评估、6 步利润瀑布、3 个协议脆弱点和 4 方合规建议。
        下方所有数据均为 demo 模式的硬编码样本，用于演示布局与交互。
      </ExplainBox>

      <Panel title="报告概览" testId="report-overview-panel">
        <ReportOverview data={REPORT_OVERVIEW} testId="report-overview-body" />
      </Panel>

      <div className="dtm-report-grid" data-testid="report-grid">
        <div className="dtm-report-col dtm-report-col-left">
          <Panel title="策略类型归因" testId="strategy-pie-panel">
            <StrategyPie slices={STRATEGY_SLICES} testId="strategy-pie-body" />
          </Panel>
          <Panel title="攻击者归因" testId="attacker-attribution-panel">
            <AttackerAttribution rows={ATTACKER_ROWS} testId="attacker-attribution-body" />
          </Panel>
        </div>
        <div className="dtm-report-col dtm-report-col-center">
          <Panel title="风险评估雷达" testId="risk-radar-panel">
            <RiskRadar axes={RISK_AXES} testId="risk-radar-body" />
          </Panel>
          <Panel title="协议脆弱点" testId="vulnerability-panel">
            <VulnerabilityPanel vulnerabilities={VULNS} testId="vulnerability-body" />
          </Panel>
        </div>
        <div className="dtm-report-col dtm-report-col-right">
          <Panel title="利润瀑布图" testId="profit-waterfall-panel">
            <ProfitWaterfall steps={WATERFALL_STEPS} testId="profit-waterfall-body" />
          </Panel>
          <Panel title="合规建议 (MiCA/ESMA)" testId="compliance-advice-panel">
            <ComplianceAdvice advice={ADVICE} testId="compliance-advice-body" />
          </Panel>
        </div>
      </div>

      <div className="dtm-report-bottom" data-testid="report-bottom">
        <Panel title="EVM 执行轨迹" testId="evm-trace-panel">
          <EvmTrace trace={EVM_TRACE} testId="evm-trace-body" />
        </Panel>
        <Panel title="风险评估" testId="risk-assessment-panel">
          <RiskAssessment
            level="high"
            score={82}
            frequency={23}
            poolTvl="中等 (TVL $4.2M)"
            mempool="高 (142 笔待处理)"
            testId="risk-assessment-body"
          />
        </Panel>
        <Panel title="导出 PDF" testId="export-pdf-panel">
          <ExportPdfButton />
          <p className="muted dtm-report-export-hint">
            演示模式：点击按钮会在浏览器中弹出 "PDF 已生成（demo 模式）"。
            生产环境会触发真实 PDF 下载。
          </p>
        </Panel>
      </div>

      {/* Legacy panels retained so older testIds keep resolving. */}
      <Panel title="Report Summary (legacy)" testId="report-summary-panel">
        <ReportSummary summary={SUMMARY} />
      </Panel>
      <Panel title="PnL Over Time (legacy)" testId="pnl-over-time-panel">
        <PnLChart points={PNL} />
      </Panel>
      <Panel title="Export (legacy)" testId="export-panel">
        <ExportButton data={REPORT_DATA} />
      </Panel>
    </div>
  );
}

export default ReportPage;
