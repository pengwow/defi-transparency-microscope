/**
 * Tests for the ComplianceAdvice component.
 *
 * ComplianceAdvice renders 4 party-specific recommendations:
 *   1. 监管 (regulator)
 *   2. 协议 (protocol)
 *   3. 用户 (user)
 *   4. 审计 (auditor)
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceAdvice, type AdviceItem } from '../ComplianceAdvice';

const ADVICE: ReadonlyArray<AdviceItem> = [
  {
    party: 'regulator',
    title: 'MiCA 透明度',
    body: 'DEX 应向用户披露 MEV 风险，建议集成 Pre-Trade Risk Score。',
  },
  {
    party: 'protocol',
    title: '集成 MEV-Protect',
    body: '为零售用户默认启用 MEV 保护（Flashbots Protect）。',
  },
  {
    party: 'user',
    title: '拆分大额交易',
    body: '将大额 swap 拆成多笔小额，降低被夹价值。',
  },
  {
    party: 'auditor',
    title: '不可篡改日志',
    body: '所有 MEV 事件记录不可篡改日志，保留 ≥ 2 年。',
  },
];

describe('ComplianceAdvice', () => {
  it('renders the panel root', () => {
    render(<ComplianceAdvice advice={ADVICE} />);
    expect(screen.getByTestId('compliance-advice-panel')).toBeInTheDocument();
  });

  it('renders exactly 4 advice items', () => {
    render(<ComplianceAdvice advice={ADVICE} />);
    const items = screen.getAllByTestId(/^compliance-advice-item-\d+$/);
    expect(items.length).toBe(4);
  });

  it('shows each advice title', () => {
    render(<ComplianceAdvice advice={ADVICE} />);
    for (const a of ADVICE) {
      const matches = screen.getAllByText((_, node) => {
        if (!node || !node.textContent) return false;
        return node.textContent.includes(a.title);
      });
      expect(matches.length).toBeGreaterThan(0);
    }
  });
});
