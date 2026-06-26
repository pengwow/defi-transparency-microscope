"""Pure-math CPMM (Constant-Product Market Maker) helpers.

These functions implement the Uniswap V2 / V3 output formula
`x · y = k` for a single trade, with the fee charged on the
input side.  The fee is denominated in **hundredths of a basis
point** (units of 1/100 bp):

  * 0.3%  V2 pool → ``fee_bip = 3_000``
  * 5 bps V3 pool → ``fee_bip = 500``

Formula
-------
``amount_in_with_fee = amount_in * (1_000_000 - fee_bip)``
``numerator          = amount_in_with_fee * reserve_out``
``denominator        = reserve_in * 1_000_000 + amount_in_with_fee``
``amount_out         = floor(numerator / denominator)``

This module has no IO, no async, no web3 — it is the lowest
layer of the experiments stack.  All callers (`sandwich.py`,
`il.py`, `attribution.py`, the HTTP routes) build on top of
these two primitives.
"""
from __future__ import annotations

# Maximum fee we accept.  Anything ≥ 100% would make the trade
# a no-op.  Tests assert that we reject out-of-range values.
_FEE_SCALE: int = 1_000_000  # 100% in 1/100 bp


def get_amount_out(
    *,
    amount_in: int,
    reserve_in: int,
    reserve_out: int,
    fee_bip: int,
) -> int:
    """Return the output amount for a constant-product swap.

    Parameters
    ----------
    amount_in:
        Amount of the input token the trader supplies.
    reserve_in:
        Pool reserve of the input token.
    reserve_out:
        Pool reserve of the output token.
    fee_bip:
        Pool fee in hundredths of a basis point (1/100 bp).
        Must be in ``[0, 1_000_000)``.

    Raises
    ------
    ValueError
        If any reserve is ``0`` or the fee is out of range.
    """
    if reserve_in <= 0:
        raise ValueError(f"reserve_in must be > 0, got {reserve_in}")
    if reserve_out <= 0:
        raise ValueError(f"reserve_out must be > 0, got {reserve_out}")
    if fee_bip < 0 or fee_bip >= _FEE_SCALE:
        raise ValueError(
            f"fee_bip must be in [0, {_FEE_SCALE}), got {fee_bip}"
        )
    if amount_in == 0:
        return 0
    amount_in_with_fee = amount_in * (_FEE_SCALE - fee_bip)
    numerator = amount_in_with_fee * reserve_out
    denominator = reserve_in * _FEE_SCALE + amount_in_with_fee
    return numerator // denominator


def get_amount_in(
    *,
    amount_out: int,
    reserve_in: int,
    reserve_out: int,
    fee_bip: int,
) -> int:
    """Return the input amount required to receive ``amount_out``.

    This is the exact inverse of :func:`get_amount_out` (rounded
    up — calling ``get_amount_out`` with the result is guaranteed
    to give back at least ``amount_out``, plus at most one wei
    of slippage).

    Raises
    ------
    ValueError
        If ``amount_out >= reserve_out`` (impossible) or any
        reserve is non-positive or the fee is out of range.
    """
    if reserve_in <= 0:
        raise ValueError(f"reserve_in must be > 0, got {reserve_in}")
    if reserve_out <= 0:
        raise ValueError(f"reserve_out must be > 0, got {reserve_out}")
    if fee_bip < 0 or fee_bip >= _FEE_SCALE:
        raise ValueError(
            f"fee_bip must be in [0, {_FEE_SCALE}), got {fee_bip}"
        )
    if amount_out >= reserve_out:
        raise ValueError(
            f"amount_out ({amount_out}) must be < reserve_out "
            f"({reserve_out}) — pool cannot pay that much out"
        )
    if amount_out == 0:
        return 0
    # Derivation: solve  get_amount_out(amount_in) = amount_out
    #   numerator   = amount_in · (S - f) · reserve_out
    #   denominator = reserve_in · S + amount_in · (S - f)
    #   amount_out · denominator = numerator
    #   amount_out · reserve_in · S + amount_out · amount_in · (S - f)
    #     = amount_in · (S - f) · reserve_out
    #   amount_out · reserve_in · S
    #     = amount_in · (S - f) · (reserve_out - amount_out)
    #   amount_in = ceil( amount_out · reserve_in · S
    #                     / ( (reserve_out - amount_out) · (S - f) ) )
    numerator = amount_out * reserve_in * _FEE_SCALE
    denominator = (reserve_out - amount_out) * (_FEE_SCALE - fee_bip)
    # Round up: add denominator-1 before the integer divide.
    return (numerator + denominator - 1) // denominator


__all__ = ["get_amount_in", "get_amount_out"]
