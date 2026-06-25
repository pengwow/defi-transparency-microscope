/**
 * Barrel export for the `report` components.
 *
 * Usage:
 *   import { StrategyPie, ReportOverview } from '@/components/report';
 */

export { StrategyPie } from './StrategyPie';
export type { StrategyPieProps } from './StrategyPie';

export { RiskRadar } from './RiskRadar';
export type { RiskRadarProps } from './RiskRadar';

export { ProfitWaterfall } from './ProfitWaterfall';
export type { ProfitWaterfallProps } from './ProfitWaterfall';

export { ReportOverview } from './ReportOverview';
export type { ReportOverviewProps, ReportOverviewData } from './ReportOverview';

export { AttackerAttribution } from './AttackerAttribution';
export type { AttackerAttributionProps, AttackerRow } from './AttackerAttribution';

export { EvmTrace } from './EvmTrace';
export type { EvmTraceProps, TraceOp } from './EvmTrace';

export { RiskAssessment } from './RiskAssessment';
export type { RiskAssessmentProps, RiskLevel } from './RiskAssessment';

export { VulnerabilityPanel } from './VulnerabilityPanel';
export type {
  VulnerabilityPanelProps,
  Vulnerability,
  VulnerabilitySeverity,
} from './VulnerabilityPanel';

export { ComplianceAdvice } from './ComplianceAdvice';
export type {
  ComplianceAdviceProps,
  AdviceItem,
  AdviceParty,
} from './ComplianceAdvice';

export { ExportPdfButton } from './ExportPdfButton';
export type { ExportPdfButtonProps } from './ExportPdfButton';
