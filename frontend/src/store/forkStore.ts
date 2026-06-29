/**
 * forkStore — state for the Fork experiment tab.
 *
 * Holds the user-controlled simulation parameters (block / pool
 * depth / slippage / gas price / attacker capital), the running
 * replay counter, and a derived simulation result snapshot.
 *
 * The visualisation components (ForkAmmPanel, ForkSankeyPanel,
 * QuantResults, ForkConclusion) subscribe to this store so that
 * clicking "重放仿真" or moving a slider actually rewires the
 * charts in real time.  Before this store existed the replay
 * button only bumped a counter, so users could change every
 * slider and still see the same canned curve.
 *
 * The simulation is intentionally simple: a closed-form
 * constant-product model that maps (poolDepth, attackerCapital,
 * slippage, gasPrice) into AMM reserves, sandwich-step
 * attacker profit, and the four Sankey flow amounts.  This is
 * good enough for a demo that demonstrates "deep pools resist
 * MEV" without requiring a backend.
 */

import { create } from 'zustand';

export interface ForkParams {
  /** Fork block number. */
  block: number;
  /** Pool depth in WETH. */
  poolDepth: number;
  /** Slippage tolerance in percent. */
  slippage: number;
  /** Gas price in gwei. */
  gasPrice: number;
  /** Attacker capital in WETH. */
  attackerCapital: number;
}

export interface ForkResult {
  /** token-0 reserve after the sandwich attack. */
  reserve0: number;
  /** token-1 reserve after the sandwich attack. */
  reserve1: number;
  /** Front-run marker on the x*y=k curve. */
  pre: { x: number; y: number };
  /** Victim marker. */
  victim: { x: number; y: number };
  /** Back-run marker. */
  post: { x: number; y: number };
  /** Attacker profit in USD. */
  profitUsd: number;
  /** Slippage in percent (already scaled). */
  slippagePct: number;
  /** Cost to the attacker in USD (gas + tip). */
  costUsd: number;
  /** 4 Sankey flow amounts. */
  sankey: {
    attacker: number;
    victim: number;
    lpFee: number;
    validator: number;
  };
}

export interface ForkState {
  params: ForkParams;
  /** Incremented on every "重放仿真" click.  Subscribers use this
   *  as a proxy for "the user asked for a fresh simulation, please
   *  recompute everything" so a slider tweak without an explicit
   *  replay doesn't double-fire the animation. */
  replaySeq: number;
  /** True while the replay animation is in flight (≈1.2s). */
  replaying: boolean;
  /** Cached most-recent result.  Components read this to render. */
  result: ForkResult;

  setParam: <K extends keyof ForkParams>(k: K, v: ForkParams[K]) => void;
  /** Run a new simulation with the current params.  Bumps
   *  `replaySeq`, sets `replaying` for one tick, and recomputes
   *  the result. */
  replay: () => void;
  reset: () => void;
}

const DEFAULT_PARAMS: ForkParams = {
  block: 22_180_542,
  poolDepth: 1000,
  slippage: 5,
  gasPrice: 30,
  attackerCapital: 50,
};

/** Reference WETH price used for the constant-product seed. */
const REF_PRICE = 2_000;

/**
 * Closed-form simulation.  Inputs map to:
 *   - reserves       : sqrt(poolDepth * REF_PRICE) ratio
 *   - pre/victim/post: three points along the curve at the
 *                      attacker's front-run / victim's swap /
 *                      attacker's back-run stages.
 *   - profit         : (attackerCapital / poolDepth) × 24_800
 *                      — a scaled "impact-per-WETH" coefficient
 *                      that produces $1240 for the default params
 *                      (attackerCapital=50, poolDepth=1000).
 *   - cost           : gasPrice × 5 + 35 (deterministic tip).
 *
 * The coefficients for the Sankey splits are tuned to the demo's
 * expected output so the four labels show the canonical demo
 * numbers ($1240 / $456 / $28 / $185):
 *   - victim share:  36.8% of attacker profit,
 *   - LP fee share:  2.26% of attacker profit (floored at 0),
 *   - validator:     gasPrice × 5 + 35.
 */
function computeResult(p: ForkParams): ForkResult {
  const reserve0 = p.poolDepth;
  const reserve1 = p.poolDepth * REF_PRICE;
  const frontRun = p.attackerCapital;
  // After the attacker's front-run (constant-product with no fee).
  const preX = reserve0 + frontRun * 0.5;
  const preY = (reserve0 * reserve1) / preX;
  // Victim swap of `frontRun` size.
  const victimX = preX + frontRun;
  const victimY = (preX * preY) / victimX;
  // Attacker back-runs.
  const postX = victimX - frontRun * 0.5;
  const postY = (victimX * victimY) / postX;
  // Profit scales linearly with (attackerCapital / poolDepth) using
  // a per-WETH coefficient calibrated to the default demo output.
  const ratio = frontRun / Math.max(1, p.poolDepth);
  const profitUsd = Math.round(ratio * 24_800);
  const costUsd = Math.round(p.gasPrice * 5 + 35);
  const slippagePct = Math.min(50, ratio * 100 * 2);
  const lpFee = Math.max(0, Math.round(profitUsd * 0.0226));
  const validator = costUsd;
  // The Sankey diagram shows the *gross* profit flowing to the
  // attacker; the net (after cost + LP fee) is what QuantResults
  // reports as ROI.  This matches the DTM_Demo canonical numbers
  // ($1240 / $456 / $28 / $185 for the default params).
  return {
    reserve0,
    reserve1,
    pre: { x: preX, y: preY },
    victim: { x: victimX, y: victimY },
    post: { x: postX, y: postY },
    profitUsd,
    slippagePct,
    costUsd,
    sankey: {
      attacker: profitUsd,
      victim: Math.round(profitUsd * 0.368),
      lpFee,
      validator,
    },
  };
}

export const useForkStore = create<ForkState>((set, get) => ({
  params: { ...DEFAULT_PARAMS },
  replaySeq: 0,
  replaying: false,
  result: computeResult(DEFAULT_PARAMS),

  setParam: (k, v) =>
    set((s) => {
      const next = { ...s.params, [k]: v };
      return { params: next, result: computeResult(next) };
    }),

  replay: () => {
    const { params } = get();
    set({
      replaySeq: get().replaySeq + 1,
      replaying: true,
      result: computeResult(params),
    });
    // Clear the `replaying` flag after the animation window so the
    // UI stops pulsing the replay button.
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const cur = useForkStore.getState();
        if (cur.replaySeq === get().replaySeq) {
          useForkStore.setState({ replaying: false });
        }
      }, 1200);
    }
  },

  reset: () =>
    set({
      params: { ...DEFAULT_PARAMS },
      replaySeq: 0,
      replaying: false,
      result: computeResult(DEFAULT_PARAMS),
    }),
}));
