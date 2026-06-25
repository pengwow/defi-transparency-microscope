/**
 * EducationPage — placeholder.
 *
 * Renders a Panel + ExplainBox announcing the module.  The real
 * implementation (timeline + cheat sheet + glossary) lands in
 * Task 22.
 */

import { ExplainBox, Panel } from '@/components/common';

export function EducationPage() {
  return (
    <Panel title="Education" testId="education-panel">
      <p>Walk through the learning timeline, reference formulas in the cheat sheet, and look up unfamiliar terms in the glossary.</p>
      <ExplainBox title="Why a learning page?">
        DeFi concepts (CPMM, IL, HF, MEV) are easier to grasp when they
        are paired with a worked example and a single place to look
        up the math.  This page is the entry point for new users and
        the reference card for everyone else.
      </ExplainBox>
    </Panel>
  );
}

export default EducationPage;
