/**
 * LiquidationExplanation — narrative description of the Liquidation
 * tab (清算模式) plus a formula block (HF and close-factor formulas).
 */

import { ExplainBox } from '@/components/panels';

export interface LiquidationExplanationProps {
  testId?: string;
}

export function LiquidationExplanation({
  testId = 'liquidation-explanation-panel',
}: LiquidationExplanationProps) {
  return (
    <div className="dtm-liquidation-explanation" data-testid={testId}>
      <ExplainBox
        title="💡 清算模式"
        body="清算模式用于展示对 DeFi 借贷市场参与者的健康度 (Health Factor) 进行归因分析。
              全景模式广播全链 + 多协议的清算事件，焦点模式对单一地址进行 HF 滑块实验。"
        testId="liquidation-explanation-explain"
      />
      <div
        className="dtm-liquidation-explanation-formula"
        data-testid="liquidation-explanation-formula"
      >
        <code>{'HF = (collateral × price × liquidationThreshold) / debt'}</code>
        <code>{'closeFactor = min(1, (1 - HF) / (liquidationThreshold - 1))'}</code>
      </div>
    </div>
  );
}

export default LiquidationExplanation;
