/**
 * LensTransition — full-screen "placing under the microscope" overlay.
 *
 * Listens to `uiStore.lensStage` and, when it's anything other than
 * 'idle', shows a fixed overlay with a circular lens, a 4-step
 * indicator (CAPTURE / FORK / PARSE / READY), and a status line.
 *
 * The `zooming` stage additionally scales the lens to fill the screen,
 * simulating the moment the sample is brought into focus.
 *
 * Children always remain mounted.
 */

import type { ReactNode } from 'react';
import { useUiStore } from '@/store/uiStore';
import type { LensStage } from '@/store/uiStore';

export interface LensTransitionProps {
  children: ReactNode;
}

interface Stage {
  id: LensStage;
  icon: string;
  label: string;
}

const STAGES: ReadonlyArray<Stage> = [
  { id: 'capture', icon: '📡', label: 'CAPTURE' },
  { id: 'fork', icon: '🍴', label: 'FORK' },
  { id: 'parse', icon: '🔍', label: 'PARSE' },
  { id: 'ready', icon: '✨', label: 'READY' },
];

function statusFor(stage: LensStage): string {
  switch (stage) {
    case 'capture':
      return '捕获链上交易信号…';
    case 'fork':
      return '分叉出独立仿真环境…';
    case 'parse':
      return '解析交易与流动性轨迹…';
    case 'ready':
      return '就绪，进入显微镜视图';
    case 'zooming':
      return '正在对焦…';
    default:
      return '';
  }
}

export function LensTransition({ children }: LensTransitionProps) {
  const stage = useUiStore((s) => s.lensStage);

  const isActive = stage !== 'idle';
  const isZooming = stage === 'zooming';

  const cls = [
    'dtm-lens-transition',
    isActive ? 'is-active' : '',
    isZooming ? 'is-zooming' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} data-stage={stage} data-testid="lens-transition">
      {children}
      {isActive && (
        <div className="dtm-lens-overlay" aria-hidden="true">
          <div className="dtm-lens-scanline" />
          <div className="dtm-lens-circle" data-testid="lens-circle">
            <div className="dtm-lens-title">🔬 正在放入显微镜</div>
            <div className="dtm-lens-subtitle">DeFi Transparency Microscope</div>
            <div className="dtm-lens-steps" data-testid="lens-steps">
              {STAGES.map((s) => {
                const active = s.id === stage;
                return (
                  <div
                    key={s.id}
                    className={`dtm-lens-step${active ? ' is-active' : ''}`}
                    data-stage={s.id}
                    data-testid="lens-step"
                  >
                    <span className="dtm-lens-step-icon" aria-hidden="true">{s.icon}</span>
                    <span className="dtm-lens-step-label">{s.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="dtm-lens-status">{statusFor(stage)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
