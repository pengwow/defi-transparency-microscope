/**
 * ForkTimeline — 4-step sandwich event timeline.
 *
 * Mirrors the "执行轨迹" timeline on DTM_Demo.html (lines 629-640).
 * Each entry has a timestamp, a tag, and a description.
 */

export interface ForkTimelineEntry {
  /** Block / unix timestamp. */
  time: string;
  /** Short tag (e.g. "[前跑]"). */
  tag: string;
  /** Tag variant: 'event' | 'danger' | 'success'. */
  variant: 'event' | 'danger' | 'success';
  /** Description shown under the tag. */
  description: string;
}

const DEFAULT_ENTRIES: ForkTimelineEntry[] = [
  {
    time: '14:32:15',
    tag: '[前跑]',
    variant: 'danger',
    description: '策略方买入 50 WETH，把价格推高 1.2%',
  },
  {
    time: '14:32:18',
    tag: '[Swap]',
    variant: 'event',
    description: '交易发起方用 10 WETH → 19,800 USDC（实际仅得 19,600）',
  },
  {
    time: '14:32:21',
    tag: '[后跑]',
    variant: 'success',
    description: '策略方卖出 50 WETH，落袋 $1,240',
  },
  {
    time: '14:32:24',
    tag: '[清算]',
    variant: 'success',
    description: '策略方归还借款，净获利 $1,053',
  },
];

export interface ForkTimelineProps {
  entries?: ForkTimelineEntry[];
  testId?: string;
}

const VARIANT_CLASS: Record<ForkTimelineEntry['variant'], string> = {
  event: 'dtm-tag-event',
  danger: 'dtm-tag-danger',
  success: 'dtm-tag-success',
};

export function ForkTimeline({ entries = DEFAULT_ENTRIES, testId = 'fork-timeline' }: ForkTimelineProps) {
  return (
    <ul className="dtm-timeline" data-testid={testId}>
      {entries.map((e, i) => (
        <li
          key={i}
          className={`dtm-timeline-item${i === entries.length - 1 ? ' is-active' : ''}`}
          data-testid={`fork-timeline-item-${i}`}
        >
          <div className="dtm-timeline-time">{e.time}</div>
          <div className="dtm-timeline-content">
            <span className={`dtm-timeline-tag ${VARIANT_CLASS[e.variant]}`}>{e.tag}</span>
            <div className="dtm-timeline-desc">{e.description}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
