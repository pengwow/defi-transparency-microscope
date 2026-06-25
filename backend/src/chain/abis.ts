/**
 * Minimal ABI fragments used by the chain/* layer.
 *
 * We deliberately keep these to the small surface area we actually call:
 * the v1 endpoints only need ERC20 metadata + balances, ERC721 enumeration,
 * Uniswap V2/V3 pair/pool reads, and Aave V3 reads. Storing the full
 * human-readable ABI would bloat the bundle and add attack surface.
 *
 * Each fragment set is independently consumable via `new Interface(ABI)`,
 * and aggregated in `ABIS` for convenient destructuring.
 *
 * Source: derived from the canonical contract ABIs and reduced to the
 * functions/events referenced in the design spec §6.
 */
import type { InterfaceAbi } from 'ethers';

// ERC20 — symbol, name, decimals, totalSupply, balanceOf, allowance, approve, transfer, transferFrom
export const ERC20_ABI: InterfaceAbi = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function transferFrom(address from, address to, uint256 value) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

// ERC721 — name, symbol, balanceOf, ownerOf, tokenOfOwnerByIndex, tokenURI
export const ERC721_ABI: InterfaceAbi = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
];

// Uniswap V2 Pair — getReserves, token0/1, swap event
export const UNISWAP_V2_PAIR_ABI: InterfaceAbi = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'event Swap(address indexed sender, uint amount0In, uint amount0Out, uint amount1In, uint amount1Out, address indexed to)',
  'event Sync(uint112 reserve0, uint112 reserve1)',
  'event Mint(address indexed sender, uint amount0, uint amount1)',
  'event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)',
];

// Uniswap V3 Pool — slot0, liquidity, token0/1, fee, swap event
export const UNISWAP_V3_POOL_ABI: InterfaceAbi = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function tickSpacing() view returns (int24)',
  'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
];

// Aave V3 PoolDataProvider — getReserveData, getUserReserveData, getReserveCaps
export const AAVE_V3_POOL_DATA_PROVIDER_ABI: InterfaceAbi = [
  'function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 idleLiquidity, uint256 totalScaledDebt, uint256 totalDebtToHedge, uint256 totalLiquidity, uint256 totalLiquidityAdded, uint256 availableLiquidity, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)',
  'function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, uint40 usagesAsCollateralEnabledOn, uint256 totalCollateralDiscounted, uint256 totalDiscountedCollateral, uint256 underlyingBalance, uint256 discountedCollateralAmount, uint256 accruedDebt)',
  'function getReserveCaps(address asset) view returns (uint256 borrowCap, uint256 supplyCap)',
];

// Aave V3 Pool — LiquidationCall event
export const AAVE_V3_POOL_ABI: InterfaceAbi = [
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function flashLoan(address receiverAddress, address[] assets, uint256[] amounts, uint256[] modes, address onBehalfOf, bytes params, uint16 referralCode)',
  'event LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken, uint256 accruedDebt, uint256 discountedCollateralAmount, uint256 actualDebtToCover, uint256 actualCollateralToLiquidate, uint256 liquidationProtocolFeeAmount)',
  'event Borrow(address indexed reserve, address indexed user, address indexed onBehalfOf, uint256 amount, uint8 interestRateMode, uint256 borrowRate, uint16 referralCode)',
  'event Supply(address indexed reserve, address indexed user, address indexed onBehalfOf, uint256 amount, uint16 referralCode)',
  'event ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)',
];

/**
 * Convenience object that maps a friendly name to each ABI fragment.
 * Useful for iterating (tests, diagnostics, dynamic lookup).
 */
export const ABIS = {
  ERC20: ERC20_ABI,
  ERC721: ERC721_ABI,
  UNISWAP_V2_PAIR: UNISWAP_V2_PAIR_ABI,
  UNISWAP_V3_POOL: UNISWAP_V3_POOL_ABI,
  AAVE_V3_POOL_DATA_PROVIDER: AAVE_V3_POOL_DATA_PROVIDER_ABI,
  AAVE_V3_POOL: AAVE_V3_POOL_ABI,
} as const;
