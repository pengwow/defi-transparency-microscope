"""Unit tests for `dtm_backend.chain.addresses`."""
from __future__ import annotations

import pytest

from dtm_backend.chain.addresses import (
    ADDRESSES,
    assert_addresses_valid,
    is_checksum_address,
)


def test_addresses_dict_has_eleven_entries() -> None:
    """The address table must hold exactly 11 mainnet entries.

    The number is preserved from the previous TypeScript backend:
    5 ERC20 tokens + 1 V2 pair + 3 V3 pools + Aave V3 Pool +
    Aave V3 PoolDataProvider = 11.
    """
    assert len(ADDRESSES) == 11


def test_addresses_dict_is_immutable() -> None:
    """`ADDRESSES` is a `MappingProxyType` and cannot be mutated."""
    with pytest.raises(TypeError):
        ADDRESSES["NEW"] = "0x0000000000000000000000000000000000000000"  # type: ignore[index]


def test_every_address_is_checksummed() -> None:
    """Every address in the table is EIP-55 checksummed."""
    for key, addr in ADDRESSES.items():
        assert is_checksum_address(addr), f"{key} = {addr} is not EIP-55 checksummed"


def test_every_address_is_40_hex() -> None:
    """Every address is exactly `0x` + 40 hex chars."""
    for key, addr in ADDRESSES.items():
        assert addr.startswith("0x"), f"{key} missing 0x prefix"
        assert len(addr) == 42, f"{key} wrong length: {addr}"
        int(addr, 16)  # raises if non-hex


def test_assert_addresses_valid_passes() -> None:
    """`assert_addresses_valid` is a no-op when the table is sane."""
    assert_addresses_valid()  # does not raise


def test_assert_addresses_valid_rejects_bad_entry(monkeypatch: pytest.MonkeyPatch) -> None:
    """`assert_addresses_valid` raises if a value is not EIP-55."""
    from dtm_backend.chain import addresses as mod

    # Patch one address to an all-lowercase (non-checksummed) value.
    bad = {**mod.ADDRESSES, "WETH": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"}
    monkeypatch.setattr(mod, "ADDRESSES", bad)
    with pytest.raises(ValueError, match="EIP-55"):
        mod.assert_addresses_valid()


def test_is_checksum_address_lowercase_is_false() -> None:
    """An all-lowercase address is not EIP-55 checksummed (it's valid hex but not checksummed)."""
    assert is_checksum_address("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") is False


def test_is_checksum_address_uppercase_is_false() -> None:
    """An all-uppercase address is not EIP-55 checksummed."""
    assert is_checksum_address("0xC02AAA39B223FE8D0A0E5C4F27EAD9083C756CC2") is False
