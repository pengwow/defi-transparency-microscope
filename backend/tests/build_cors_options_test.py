"""Unit tests for `server._build_cors_options`.

These exercise the CORS resolution rules that are preserved from
the previous TypeScript backend:

  - `cors_allow_all=True`                  → `allow_origins=["*"]`
  - `cors_origins` contains `*`            → `allow_origins=["*"]`
  - otherwise                              → exact-match allow-list
  - credentials are always disabled (CORS spec)
"""
from __future__ import annotations

from dtm_backend.config import Config
from dtm_backend.server import _build_cors_options


def test_cors_defaults_to_exact_allowlist() -> None:
    """Default `cors_origins` produces an exact-match list, not `*`."""
    cfg = Config()
    opts = _build_cors_options(cfg)
    assert opts["allow_origins"] == list(cfg.cors_origins)
    assert "*" not in opts["allow_origins"]
    assert opts["allow_credentials"] is False


def test_cors_allow_all_flag_unlocks_star() -> None:
    """`cors_allow_all=True` short-circuits to `*`."""
    cfg = Config(cors_allow_all=True)
    opts = _build_cors_options(cfg)
    assert opts["allow_origins"] == ["*"]
    assert opts["allow_credentials"] is False


def test_cors_star_in_origins_unlocks_star() -> None:
    """`*` anywhere in `cors_origins` unlocks the wildcard."""
    cfg = Config(cors_origins=("http://localhost:5173", "*"))
    opts = _build_cors_options(cfg)
    assert opts["allow_origins"] == ["*"]
    assert opts["allow_credentials"] is False


def test_cors_comma_list_is_preserved() -> None:
    """An explicit list of origins is kept verbatim (order-stable)."""
    cfg = Config(
        cors_origins=("http://a.example", "http://b.example", "http://c.example"),
    )
    opts = _build_cors_options(cfg)
    assert opts["allow_origins"] == [
        "http://a.example",
        "http://b.example",
        "http://c.example",
    ]


def test_cors_always_disables_credentials() -> None:
    """Credentials stay off — even when `cors_allow_all` is True.

    The CORS spec forbids `allow_credentials=True` with `*`, so
    we hard-disable credentials across all branches.  This is a
    regression guard, not a behaviour test.
    """
    for cfg in (
        Config(),
        Config(cors_allow_all=True),
        Config(cors_origins=("http://x",)),
    ):
        opts = _build_cors_options(cfg)
        assert opts["allow_credentials"] is False


def test_cors_methods_include_options() -> None:
    """`OPTIONS` is required for preflight — sanity check."""
    cfg = Config()
    opts = _build_cors_options(cfg)
    assert "OPTIONS" in opts["allow_methods"]
