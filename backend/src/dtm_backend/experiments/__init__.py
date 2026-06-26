"""`dtm_backend.experiments` — pure-math LP / MEV analysis.

This package contains the four experiment primitives the
backend exposes via `POST /api/v1/experiments/{variant}` plus
the curated in-memory presets:

* :mod:`.cpmm`         — Constant-product market-maker math
* :mod:`.sandwich`     — 3-swap sandwich attack simulation
* :mod:`.il`           — Impermanent-loss formulas (V2 + V3)
* :mod:`.attribution`  — 4-component PnL decomposition
* :mod:`.presets`      — 4 in-memory experiment presets
* :mod:`.types`        — Pydantic v2 wire models

Everything in this package is pure math — no IO, no async,
no web3.  The HTTP layer in `dtm_backend.routes.experiments`
adapts these functions to the wire format.
"""
from __future__ import annotations

__all__ = [
    "attribution",
    "cpmm",
    "il",
    "presets",
    "sandwich",
    "types",
]
