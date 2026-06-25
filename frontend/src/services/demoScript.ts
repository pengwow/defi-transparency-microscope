/**
 * demoScript — placeholder for the "一键实验" guided demo.
 *
 * The full 5-step experience (microscope lens overlay → capture → fork →
 * parse → ready) lives in a later batch.  For now we simply toggle the
 * `demoRunning` flag in the UI store so the Header pill turns lime and
 * the LensTransition overlay activates.
 */

import { useUiStore } from '@/store/uiStore';

export type DemoKind = 'auto' | 'microscope';

/**
 * Start the guided demo run.
 *
 * Implementation note: this is a stub.  Phase 9 will replace the body
 * with the real 5-step script (lens stage transitions, page hops,
 * flash alerts, etc.).
 */
export async function runDemo(_kind: DemoKind): Promise<void> {
  useUiStore.getState().startDemo();
  // Stop after a short delay so unit tests don't hang on an always-on
  // demo state.
  setTimeout(() => useUiStore.getState().stopDemo(), 1600);
}
