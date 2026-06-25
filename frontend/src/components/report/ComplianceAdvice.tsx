/**
 * ComplianceAdvice — 4 party-specific recommendations for the
 * Report tab (监管 / 协议 / 用户 / 审计).
 *
 * Each item is rendered as a row with a party tag, a title, and a
 * short body.  Layout is intentionally simple so it slots into the
 * 3-column right rail of the Report page.
 */

export type AdviceParty = 'regulator' | 'protocol' | 'user' | 'auditor';

export interface AdviceItem {
  party: AdviceParty;
  title: string;
  body: string;
}

export interface ComplianceAdviceProps {
  advice: ReadonlyArray<AdviceItem>;
  testId?: string;
}

const PARTY_LABEL: Record<AdviceParty, string> = {
  regulator: '监管',
  protocol: '协议',
  user: '用户',
  auditor: '审计',
};

const PARTY_COLOR: Record<AdviceParty, string> = {
  regulator: '#00e5ff',
  protocol: '#ffab40',
  user: '#69f0ae',
  auditor: '#b388ff',
};

export function ComplianceAdvice({
  advice,
  testId = 'compliance-advice-panel',
}: ComplianceAdviceProps) {
  return (
    <div className="dtm-report-compliance-advice" data-testid={testId}>
      <div className="dtm-report-compliance-advice-title">📜 合规建议 (MiCA/ESMA)</div>
      <ol
        className="dtm-report-compliance-advice-list"
        data-testid="compliance-advice-list"
      >
        {advice.map((a, i) => (
          <li
            key={a.title}
            className="dtm-report-compliance-advice-item"
            data-testid={`compliance-advice-item-${i + 1}`}
            data-party={a.party}
          >
            <span
              className="dtm-report-compliance-advice-party"
              style={{ color: PARTY_COLOR[a.party] }}
            >
              {PARTY_LABEL[a.party]}
            </span>
            <span className="dtm-report-compliance-advice-title">{a.title}</span>
            <p className="dtm-report-compliance-advice-body">{a.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default ComplianceAdvice;
