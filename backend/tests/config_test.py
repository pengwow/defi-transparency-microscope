"""Unit tests for `Config` and `load_config`."""
from __future__ import annotations

import pytest

from dtm_backend.config import (
    DEFAULT_CORS_ORIGINS,
    DEFAULT_RPC_FALLBACKS,
    Config,
    load_config,
)


def test_config_defaults() -> None:
    """Sensible defaults for an empty environment."""
    cfg = Config()
    assert cfg.port == 8000
    assert cfg.host == "0.0.0.0"
    assert cfg.log_level == "info"
    assert cfg.rpc_url == DEFAULT_RPC_FALLBACKS[0]
    assert cfg.rpc_ws_url is None
    assert cfg.chain_id == 1
    assert cfg.cache_ttl_ms == 5_000
    assert cfg.liquidation_poll_ms == 12_000
    assert cfg.liquidation_lookback == 100
    assert cfg.amm_sync_poll_ms == 12_000
    assert cfg.amm_sync_lookback == 100
    assert cfg.amm_sync_debounce_ms == 250
    assert cfg.cors_origins == DEFAULT_CORS_ORIGINS
    assert cfg.cors_allow_all is False
    assert cfg.env == "dev"


def test_config_cors_origin_list_returns_list() -> None:
    """`cors_origin_list()` is always a fresh list (not a tuple)."""
    cfg = Config()
    assert isinstance(cfg.cors_origin_list(), list)
    assert cfg.cors_origin_list() == list(DEFAULT_CORS_ORIGINS)


def test_config_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    """`PORT=9000` in the env propagates to `Config.port`."""
    monkeypatch.setenv("PORT", "9000")
    monkeypatch.setenv("CHAIN_ID", "11155111")
    monkeypatch.setenv("CORS_ALLOW_ALL", "true")
    cfg = load_config()
    assert cfg.port == 9000
    assert cfg.chain_id == 11155111
    assert cfg.cors_allow_all is True


def test_config_extra_env_keys_are_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unknown env keys must not raise (extra='ignore')."""
    monkeypatch.setenv("SOMETHING_COMPLETELY_UNKNOWN", "ok")
    cfg = load_config()
    assert cfg.port == 8000  # default preserved
