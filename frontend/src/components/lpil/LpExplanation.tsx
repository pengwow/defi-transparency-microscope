/**
 * LpExplanation — narrative description of the LP/IL microscope
 * (LP/IL 模式) plus the closed-form IL formula.
 *
 *   IL = 2·√r / (1 + r) - 1
 *   r = newPrice / oldPrice
 *
 * Renders an ExplainBox on top of a code block with the formula.
 */

import { ExplainBox } from '@/components/panels';

export interface LpExplanationProps {
  testId?: string;
}

export function LpExplanation({
  testId = 'lpil-explanation-panel',
}: LpExplanationProps) {
  return (
    <div className="dtm-lpil-explanation" data-testid={testId}>
      <ExplainBox
        title="💡 LP/IL 模式"
        testId="lpil-explanation-explain"
      >
        LP/IL 模式用于展示 Uniswap V2/V3 流动性提供者面临的无常损失
        (Impermanent Loss)：把两种资产按 50/50 存入 AMM 后，若价格
        偏离，LP 账户价值会低于"简单持有"基准。V3 通过集中流动性
        放大了区间内的 IL，区间外则锁定为单边资产。
      </ExplainBox>
      <div
        className="dtm-lpil-explanation-formula"
        data-testid="lpil-explanation-formula"
      >
        <code>{'IL = 2·√r / (1 + r) − 1'}</code>
        <code>{'r = newPrice / oldPrice'}</code>
      </div>
    </div>
  );
}

export default LpExplanation;
