/**
 * PnLChart — ECharts line chart of P&L over time.
 *
 * Each point is rendered as a `(ts, value)` pair on a single line.
 * The chart is initialised once, `setOption` is called on every prop
 * change, and `dispose` is called on unmount.
 */

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import './PnLChart.css';

export interface PnLPoint {
  /** Unix epoch seconds. */
  ts: number;
  value: number;
}

export interface PnLChartProps {
  points: ReadonlyArray<PnLPoint>;
}

export function PnLChart({ points }: PnLChartProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = echarts.init(ref.current);
    const ro = new ResizeObserver(() => chartRef.current?.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const data = points.map((p) => [p.ts * 1000, p.value]);
    chartRef.current.setOption({
      backgroundColor: 'transparent',
      grid: { left: 40, right: 16, top: 24, bottom: 32 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: '#4a5878' } },
        axisLabel: { color: '#9aa4c0' },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#4a5878' } },
        axisLabel: { color: '#9aa4c0' },
        splitLine: { lineStyle: { color: '#1f2a44' } },
      },
      series: [
        {
          type: 'line',
          data,
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#4f8cff', width: 2 },
          areaStyle: { color: 'rgba(79, 140, 255, 0.18)' },
        },
      ],
    });
  }, [points]);

  return <div ref={ref} className="dtm-pnl-chart" data-testid="pnl-chart" />;
}

export default PnLChart;
