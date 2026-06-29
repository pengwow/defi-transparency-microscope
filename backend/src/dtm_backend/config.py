"""Application configuration.

Built on top of `pydantic-settings` for type-safe env loading.
The defaults are tuned for Ethereum mainnet; tests can override
the relevant fields by instantiating `Config` directly.
"""
from __future__ import annotations

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Default CORS allow-list when `CORS_ORIGINS` is unset.
#
# Covers the common Vite dev ports (5173 / 4173 / 5174 / 5175) and
# 127.0.0.1 mirrors so a developer running on any of them won't get
# a `No 'Access-Control-Allow-Origin' header is present` error.  Add
# more here if your team standardises on a different port; the env
# var `CORS_ORIGINS` overrides this list entirely.
DEFAULT_CORS_ORIGINS: tuple[str, ...] = (
    # Vite dev server (default).
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Vite dev server with --strictPort / multi-instance fallbacks.
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    # Vite `vite preview` (port 4173).
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    # Common alt dev servers (CRA / Next.js / generic dev).
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
)

# Built-in RPC fallback URLs (used when `RPC_URL` is unset).
DEFAULT_RPC_FALLBACKS: tuple[str, ...] = (
    "https://eth.llamarpc.com",
    "https://cloudflare-eth.com",
    "https://rpc.ankr.com/eth",
)


class Config(BaseSettings):
    """Strongly-typed application config.

    Loaded from the process environment (and a `.env` file in
    the working directory if present).  The defaults match the
    values documented in the design spec.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # HTTP server
    port: int = 8000
    host: str = "0.0.0.0"
    log_level: str = "info"

    # Chain
    rpc_url: str = Field(default=DEFAULT_RPC_FALLBACKS[0])
    rpc_ws_url: str | None = None
    chain_id: int = 1

    # Caching / polling
    cache_ttl_ms: int = 5_000
    liquidation_poll_ms: int = 12_000
    liquidation_lookback: int = 100
    amm_sync_poll_ms: int = 12_000
    amm_sync_lookback: int = 100
    amm_sync_debounce_ms: int = 250

    # CORS
    cors_origins: tuple[str, ...] = DEFAULT_CORS_ORIGINS
    cors_allow_all: bool = False

    # Test helpers
    env: Literal["dev", "test", "prod"] = "dev"

    def cors_origin_list(self) -> list[str]:
        """Return the effective CORS origin list (post-resolve)."""
        return list(self.cors_origins)


def load_config() -> Config:
    """Build a Config from the process environment."""
    return Config()
