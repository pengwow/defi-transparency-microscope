"""Sandwich-attack simulation on a V2 constant-product pool.

A sandwich is a 3-swap sequence in the same block:

  1. **Front-run**: attacker sells ``attacker_amount_in`` of
     token0 → token1, moving the price up.
  2. **Victim**: victim sells ``victim_amount_in`` of token0 →
     token1, getting a worse rate than they would have without
     the front-run.
  3. **Back-run**: attacker sells the token1 they received in
     step 1 back into token0, ending with more token0 than
     they started with.

Outputs (raw integer amounts in the same units as the inputs):

  * ``attacker_profit = final_token0 - attacker_amount_in``
  * ``victim_loss = baseline_out - victim_out``
    where ``baseline_out`` is what the victim would have
    received in an unattacked single swap.

The wire format returned to the frontend is::

    {
      "durationMs": <int>,
      "result": {
        "attackerProfit": "<decimal string>",
        "victimLoss":     "<decimal string>"
      }
    }

This module is pure math — no IO, no async, no web3.  It builds
on :mod:`dtm_backend.experiments.cpmm` for the per-swap math.
"""
from __future__ import annotations

from dataclasses import dataclass

from dtm_backend.experiments.cpmm import get_amount_out


@dataclass(slots=True)
class SandwichInput:
    """Parameters of a single sandwich simulation.

    All amounts are raw integers in the same units as the
    corresponding pool reserves (e.g. wei for WETH, 1e6 for USDC).
    The fee is in hundredths of a basis point (1/100 bp).
    """

    reserve0: int
    reserve1: int
    victim_amount_in: int
    attacker_amount_in: int
    fee_bip: int


@dataclass(slots=True)
class SandwichResult:
    """The result of a single sandwich simulation.

    All values are raw integers (in the same unit as the
    reserves).  Conversion to a decimal / 1e18 happens at the
    HTTP boundary.
    """

    attacker_profit: int
    victim_loss: int


def run_sandwich(params: SandwichInput) -> SandwichResult:
    """Simulate a 3-swap sandwich attack on a V2 pool.

    See module docstring for the full sequence.
    """
    r0 = params.reserve0
    r1 = params.reserve1
    f = params.fee_bip

    # 1. Victim baseline (no attack) — what the victim would have
    #    received in a single swap on the original pool.
    baseline_victim_out = get_amount_out(
        amount_in=params.victim_amount_in,
        reserve_in=r0,
        reserve_out=r1,
        fee_bip=f,
    )

    # 2. Attacker front-run: token0 → token1.
    if params.attacker_amount_in > 0:
        attacker_front_out = get_amount_out(
            amount_in=params.attacker_amount_in,
            reserve_in=r0,
            reserve_out=r1,
            fee_bip=f,
        )
        # New reserves after front-run.
        new_r0 = r0 + params.attacker_amount_in
        new_r1 = r1 - attacker_front_out
    else:
        attacker_front_out = 0
        new_r0 = r0
        new_r1 = r1

    # 3. Victim trade: token0 → token1 on the depleted pool.
    victim_out = get_amount_out(
        amount_in=params.victim_amount_in,
        reserve_in=new_r0,
        reserve_out=new_r1,
        fee_bip=f,
    )
    post_victim_r0 = new_r0 + params.victim_amount_in
    post_victim_r1 = new_r1 - victim_out

    # 4. Attacker back-run: token1 → token0.
    if attacker_front_out > 0:
        attacker_back_out = get_amount_out(
            amount_in=attacker_front_out,
            reserve_in=post_victim_r1,
            reserve_out=post_victim_r0,
            fee_bip=f,
        )
    else:
        attacker_back_out = 0

    attacker_profit = attacker_back_out - params.attacker_amount_in
    victim_loss = baseline_victim_out - victim_out

    return SandwichResult(
        attacker_profit=attacker_profit,
        victim_loss=victim_loss,
    )


__all__ = ["SandwichInput", "SandwichResult", "run_sandwich"]
