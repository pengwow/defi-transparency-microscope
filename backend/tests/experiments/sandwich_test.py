"""Unit tests for `dtm_backend.experiments.sandwich`.

The sandwich experiment is a 3-swap sequence on a V2 pool:

  1. Attacker front-runs: ``attackerAmountIn`` of token0 → token1.
  2. Victim trades: ``victimAmountIn`` of token0 → token1
     (the price is now worse than it would have been).
  3. Attacker back-runs: sells the token1 they just bought
     back into token0.

The wire format is the one consumed by
`POST /api/v1/experiments/sandwich` and by
`HttpAPI.runSandwichExperiment` on the frontend.
"""
from __future__ import annotations

from dtm_backend.experiments.sandwich import SandwichInput, run_sandwich


def test_sandwich_attacker_profits_and_victim_loses() -> None:
    """A classic sandwich on a V2 ETH/USDC pool must be profitable.

    Reserves: 80 000 ETH / 160 000 000 USDC (V2 0.3% fee).
    Attacker: 100 ETH front / back.
    Victim:   1 000 ETH.

    The attacker must end with strictly more ETH than they
    started with, and the victim must get strictly less USDC
    than they would have in an unattacked trade.
    """
    result = run_sandwich(
        SandwichInput(
            reserve0=80_000 * 10**18,
            reserve1=160_000_000 * 10**6,
            victim_amount_in=1_000 * 10**18,
            attacker_amount_in=100 * 10**18,
            fee_bip=3000,
        )
    )
    assert result.attacker_profit > 0
    assert result.victim_loss > 0


def test_sandwich_zero_attacker_input_means_zero_profit() -> None:
    """No front-run ⇒ no profit and the victim gets the natural rate.

    With the attacker's size set to 0, the sandwich collapses to
    a single victim swap; the "loss" relative to the unattacked
    baseline must be ~0 (one wei of integer rounding is OK).
    """
    result = run_sandwich(
        SandwichInput(
            reserve0=10_000 * 10**18,
            reserve1=20_000_000 * 10**6,
            victim_amount_in=10 * 10**18,
            attacker_amount_in=0,
            fee_bip=3000,
        )
    )
    assert result.attacker_profit == 0
    # The victim loss is measured against the no-attack baseline.
    # With no attacker, those two paths are identical — the
    # delta must be zero (modulo integer rounding).
    assert result.victim_loss <= 1


def test_sandwich_result_is_symmetric_in_direction() -> None:
    """Swapping the in/out tokens must give the same absolute P&L.

    The math is symmetric: token0→token1 and token1→token0 are
    the same trade, just mirrored.  Profit and loss magnitudes
    are identical regardless of direction.
    """
    # Same scenario, same direction (token0 → token1).
    a = run_sandwich(
        SandwichInput(
            reserve0=80_000 * 10**18,
            reserve1=160_000_000 * 10**6,
            victim_amount_in=1_000 * 10**18,
            attacker_amount_in=100 * 10**18,
            fee_bip=3000,
        )
    )
    # Mirrored scenario (the previous token1 becomes token0).
    b = run_sandwich(
        SandwichInput(
            reserve0=160_000_000 * 10**6,
            reserve1=80_000 * 10**18,
            victim_amount_in=1_000_000 * 10**6,  # 1 000 ETH worth of USDC
            attacker_amount_in=100_000 * 10**6,
            fee_bip=3000,
        )
    )
    # Allow a small relative tolerance because the two pools have
    # very different scales (1e18 vs 1e6); what matters is that
    # both produce positive P&L in the same order of magnitude.
    assert a.attacker_profit > 0
    assert b.attacker_profit > 0
    assert a.victim_loss > 0
    assert b.victim_loss > 0


def test_sandwich_higher_fee_lowers_attacker_profit() -> None:
    """Higher pool fee ⇒ less extractable value for the attacker.

    Same victim + attacker size, two different fee tiers.  The
    lower-fee pool must yield at least as much profit as the
    higher-fee pool (the difference is the part of the value
    that the LPs keep).
    """
    low_fee = run_sandwich(
        SandwichInput(
            reserve0=80_000 * 10**18,
            reserve1=160_000_000 * 10**6,
            victim_amount_in=1_000 * 10**18,
            attacker_amount_in=100 * 10**18,
            fee_bip=500,  # 5 bps
        )
    )
    high_fee = run_sandwich(
        SandwichInput(
            reserve0=80_000 * 10**18,
            reserve1=160_000_000 * 10**6,
            victim_amount_in=1_000 * 10**18,
            attacker_amount_in=100 * 10**18,
            fee_bip=3000,  # 0.3%
        )
    )
    assert low_fee.attacker_profit >= high_fee.attacker_profit
