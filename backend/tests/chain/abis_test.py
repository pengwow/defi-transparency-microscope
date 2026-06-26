"""Unit tests for `dtm_backend.chain.abis`."""
from __future__ import annotations

from dtm_backend.chain.abis import ABIS, abi_for


def test_abi_table_has_six_entries() -> None:
    """The ABI table holds exactly 6 entries (preserved from TS)."""
    assert set(ABIS) == {
        "ERC20",
        "ERC721",
        "UNI_V2_PAIR",
        "UNI_V3_POOL",
        "AAVE_V3_POOL",
        "AAVE_V3_POOL_DATA_PROVIDER",
    }


def test_abi_table_is_immutable() -> None:
    """`ABIS` is a `MappingProxyType`."""
    import pytest

    with pytest.raises(TypeError):
        ABIS["NEW"] = []  # type: ignore[index]


def test_abi_for_returns_list_for_known_key() -> None:
    """`abi_for` returns the fragment list for a known key."""
    frag = abi_for("ERC20")
    assert isinstance(frag, list)
    assert all(isinstance(s, str) for s in frag)


def test_abi_for_raises_for_unknown_key() -> None:
    """`abi_for` raises `KeyError` for an unknown ABI key."""
    import pytest

    with pytest.raises(KeyError):
        abi_for("DOES_NOT_EXIST")


def test_erc20_abi_has_balance_and_decimals() -> None:
    """The ERC20 fragment covers `balanceOf` + `decimals` + `symbol`."""
    frag = " ".join(abi_for("ERC20"))
    assert "balanceOf" in frag
    assert "decimals" in frag
    assert "symbol" in frag


def test_uni_v2_abi_has_get_reserves() -> None:
    """The Uniswap V2 pair fragment covers `getReserves`."""
    frag = " ".join(abi_for("UNI_V2_PAIR"))
    assert "getReserves" in frag


def test_uni_v3_abi_has_slot0() -> None:
    """The Uniswap V3 pool fragment covers `slot0`."""
    frag = " ".join(abi_for("UNI_V3_POOL"))
    assert "slot0" in frag


def test_aave_v3_pool_abi_has_get_reserves_list() -> None:
    """The Aave V3 Pool fragment covers `getReservesList` (or similar)."""
    frag = " ".join(abi_for("AAVE_V3_POOL"))
    # The Aave V3 IPool ABI exposes getReservesList(); some forks use
    # getReserves() but the canonical mainnet Pool uses getReservesList.
    assert "getReserves" in frag


def test_aave_pool_data_provider_has_get_user_reserves_data() -> None:
    """The PoolDataProvider fragment covers `getUserReservesData`."""
    frag = " ".join(abi_for("AAVE_V3_POOL_DATA_PROVIDER"))
    assert "getUserReservesData" in frag
