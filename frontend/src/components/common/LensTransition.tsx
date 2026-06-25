/**
 * LensTransition — fade transition when switching lenses/modes.
 *
 * Listens to the `mode` from the UI store.  Whenever it changes,
 * the transition layer is briefly visible (fade-out + fade-in).
 * Children remain mounted throughout.
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useUiStore } from '@/store/uiStore';

export interface LensTransitionProps {
  children: ReactNode;
  /** Total transition length in ms (default 240). */
  durationMs?: number;
}

export function LensTransition({ children, durationMs = 240 }: LensTransitionProps) {
  const mode = useUiStore((s) => s.mode);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    // Bump the pulse counter whenever mode changes.
    setPulse((p) => p + 1);
    const t = setTimeout(() => setPulse(0), durationMs);
    return () => clearTimeout(t);
  }, [mode, durationMs]);

  return (
    <div className="dtm-lens-transition" data-mode={mode} data-pulse={pulse} data-testid="lens-transition">
      {children}
    </div>
  );
}
