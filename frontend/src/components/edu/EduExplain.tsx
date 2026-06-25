/**
 * EduExplain — an ExplainBox that swaps its headline, body, and
 * formula based on `eduStore.activeScenario`, plus a small code
 * block with the canonical MEV formula.
 *
 * The text content is intentionally a deterministic per-scenario
 * string so the test can assert on the keyword for each scenario.
 */

import { ExplainBox } from '@/components/panels';
import { useEduStore, type EduScenario } from '@/store/eduStore';

export interface EduExplainProps {
  testId?: string;
}

interface ScenarioExplain {
  headline: string;
  body: string;
  formula: string;
}

const EXPLAINS: Record<EduScenario, ScenarioExplain> = {
  sandwich: {
    headline: '三明治策略',
    body: '攻击者观测 mempool 中的大额 swap，在前后各插一笔交易，吃掉中间的滑点。受害者的成交价被夹在两次价格之间。',
    formula: 'profit = (p_sandwich - p_pre) · amountIn',
  },
  jit: {
    headline: 'JIT 流动性',
    body: 'Just-In-Time 流动性在同一区块内瞬间注入大笔流动性赚取手续费，几乎无方向性风险。',
    formula: 'fee = swapNotional · feeTier',
  },
  arbitrage: {
    headline: '套利策略',
    body: 'CEX-DEX 价差套利：发现外部价格与链上池子的差，在一笔交易里反向对冲，吃掉无风险收益。',
    formula: 'PnL = (p_cex - p_dex) · notional − gas',
  },
  liquidation: {
    headline: '清算归因',
    body: '当抵押品价值跌破健康因子阈值（HF < 1.0）时，清算机器人会竞拍执行清算，吃 5-10% 清算奖励。',
    formula: 'reward = (collateral · liquidationBonus) − debt',
  },
  'front-running': {
    headline: '前跑策略',
    body: '抢在用户交易之前提交同方向的单，吃后续价格波动。攻击者付更高 Gas 让自己的 tx 优先被打包。',
    formula: 'PnL = (p_post − p_pre) · amount − gas',
  },
};

export function EduExplain({ testId = 'edu-explain-panel' }: EduExplainProps) {
  const activeScenario = useEduStore((s) => s.activeScenario);
  const explain = EXPLAINS[activeScenario];

  return (
    <div className="dtm-edu-explain" data-testid={testId}>
      <ExplainBox
        title={`💡 ${explain.headline}`}
        testId="edu-explain-explain"
      >
        <div
          className="dtm-edu-explain-headline"
          data-testid="edu-explain-headline"
        >
          {explain.headline}
        </div>
        <p className="dtm-edu-explain-body">{explain.body}</p>
      </ExplainBox>
      <div
        className="dtm-edu-explain-formula"
        data-testid="edu-explain-formula"
      >
        <code>{explain.formula}</code>
      </div>
    </div>
  );
}

export default EduExplain;
