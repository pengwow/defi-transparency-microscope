/**
 * Barrel for the cross-page Panel family.
 *
 * Importing from this file keeps page-level modules uncluttered.
 *
 *   import { Panel, ParamSlider, MetricBox, ... } from '@/components/panels';
 */

export { Panel } from './Panel';
export type { PanelProps } from './Panel';

export { ExplainBox } from './ExplainBox';
export type { ExplainBoxProps, ExplainBoxVariant } from './ExplainBox';

export { ParamSlider } from './ParamSlider';
export type { ParamSliderProps } from './ParamSlider';

export { MetricBox } from './MetricBox';
export type { MetricBoxProps, MetricTrend } from './MetricBox';

export { MetricGrid } from './MetricGrid';
export type { MetricGridProps } from './MetricGrid';

export { RiskGauge } from './RiskGauge';
export type { RiskGaugeProps, RiskLevel } from './RiskGauge';

export { ExperimentCard } from './ExperimentCard';
export type { ExperimentCardProps } from './ExperimentCard';

export { StepButton } from './StepButton';
export type { StepButtonProps } from './StepButton';
