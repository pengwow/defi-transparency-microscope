/**
 * DefenseTips — a list of 3-4 mitigation tips for the active
 * scenario.  Each tip is rendered as a row with an icon and a
 * short text description.  The list is derived from
 * `eduStore.activeScenario` so it always matches the user's pick.
 */

import { useEduStore, type EduScenario } from '@/store/eduStore';

export interface DefenseTipsProps {
  testId?: string;
}

interface Tip {
  icon: string;
  text: string;
}

const TIPS: Record<EduScenario, Tip[]> = {
  sandwich: [
    { icon: '🛡️', text: '使用私有内存池（private mempool），避免交易在公开池中被观察。' },
    { icon: '⛽', text: '提高 Gas 费让自己的交易直接被打包，跳过夹子位置。' },
    { icon: '📉', text: '将单笔交易拆成多笔小额，降低可夹价值。' },
    { icon: '🔒', text: '接入 MEV-Protect 之类的中继器。' },
  ],
  jit: [
    { icon: '🛡️', text: '避免使用流动性极浅的池子，深度越深越不容易被插流动性。' },
    { icon: '⏱️', text: '在低活动时段执行大额 swap。' },
    { icon: '📊', text: '关注 pool 的 feeTier 增长，异常高费率说明有 JIT。' },
  ],
  arbitrage: [
    { icon: '🔀', text: '使用 CEX 内部的 off-chain 套利，避开链上 gas 战。' },
    { icon: '🛡️', text: '在 DEX 路由器加入最大可接受偏差（deviation）。' },
    { icon: '📉', text: '对大额交易做分批，降低单笔可套利空间。' },
  ],
  liquidation: [
    { icon: '⚠️', text: '健康因子接近 1.0 时及时补充抵押品。' },
    { icon: '🛡️', text: '在多个借贷协议分散抵押，避免被单一协议清算。' },
    { icon: '📈', text: '开启自动告警，HF < 1.2 时立刻 push 通知。' },
  ],
  'front-running': [
    { icon: '⛽', text: '使用 commit-reveal 模式，分两步提交交易。' },
    { icon: '🛡️', text: '通过隐私中继器发送交易。' },
    { icon: '📉', text: '把交易分散到多区块执行。' },
  ],
};

export function DefenseTips({ testId = 'edu-defense-tips-panel' }: DefenseTipsProps) {
  const activeScenario = useEduStore((s) => s.activeScenario);
  const tips = TIPS[activeScenario];

  return (
    <div className="dtm-defense-tips" data-testid={testId}>
      <div className="dtm-defense-tips-title">🛡️ 防御建议</div>
      <ul className="dtm-defense-tips-list">
        {tips.map((t, i) => (
          <li
            key={i}
            className="dtm-defense-tip"
            data-testid={`edu-defense-tip-${i + 1}`}
          >
            <span className="dtm-defense-tip-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="dtm-defense-tip-text">{t.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DefenseTips;
