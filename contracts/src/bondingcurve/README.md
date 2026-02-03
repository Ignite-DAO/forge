# Bonding Curve Contracts

Virtual AMM bonding curve implementation (pump.fun style) for fair token launches. Tokens are sold along a constant product curve until graduation, at which point liquidity is permanently locked on Plunder V3.

## Overview

- **ForgeBondingCurveFactory**: Deploys and configures bonding curve pools
- **ForgeBondingCurvePool**: Individual pool handling buys, sells, and graduation
- **BondingCurveTypes**: Shared structs and enums

## How It Works

### Virtual AMM (Constant Product Formula)

Unlike a linear bonding curve, this implementation uses the constant product formula (`x * y = k`) similar to Uniswap/pump.fun:

```
virtualTokenReserve * virtualZilReserve = k (constant)

price = virtualZilReserve / virtualTokenReserve
```

**Buy calculation:**
```solidity
tokensOut = virtualTokenReserve - (k / (virtualZilReserve + zilIn))
```

**Sell calculation:**
```solidity
zilOut = virtualZilReserve - (k / (virtualTokenReserve + tokensIn))
```

### Virtual vs Real Reserves

The pool tracks two types of reserves:

| Reserve | Description |
|---------|-------------|
| `virtualTokenReserve` | Virtual token reserve for price calculation (starts at TOTAL_SUPPLY) |
| `virtualZilReserve` | Virtual ZIL reserve for price calculation (starts at initialVirtualZilReserve) |
| `realZilReserve` | Actual ZIL held by the contract (available for sells and graduation) |

The virtual reserves determine price via the AMM formula, while the real reserve tracks actual ZIL deposited.

### Token Mechanics

1. **Pool creation**: All 1B tokens are minted to the pool
2. **Buy**: Tokens transfer from pool to buyer; ZIL added to real reserve
3. **Sell**: Tokens transfer from buyer to pool; ZIL sent from real reserve
4. **Graduation**: Remaining tokens + real ZIL go to DEX liquidity

### Graduation

Graduation triggers **only** when market cap reaches the target threshold:

```solidity
if (marketCap() >= graduationMarketCap) {
    _graduate();
}
```

There is no "tokens exhausted" graduation condition—graduation is purely market-cap based.

## Constants

| Parameter | Value | Description |
|-----------|-------|-------------|
| `TOTAL_SUPPLY` | 1,000,000,000 tokens | Fixed token supply |
| `MIN_BUY_AMOUNT` | 0.001 ZIL | Minimum ZIL per buy |
| `MIN_SELL_TOKENS` | 0.001 tokens | Minimum tokens per sell |
| `MIN_GRADUATION_LIQUIDITY` | 0.1 ZIL | Minimum ZIL for graduation LP |
| `FEE_DENOMINATOR` | 10,000 | Basis points denominator |

## Configurable Parameters

All parameters are set per-factory and apply to newly created pools.

### `graduationMarketCap`

**What it does:** Sets the market cap threshold that triggers graduation to DEX.

**Default:** 8,000,000 ZIL (~$50k at $0.0062/ZIL)

**How to change:**
```bash
cast send $FACTORY_ADDRESS "setGraduationMarketCap(uint256)" $NEW_CAP_WEI \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

**Effect:** Higher values mean more trading before graduation (more ZIL raised). Lower values mean faster graduation (less ZIL raised).

### `initialVirtualZilReserve`

**What it does:** Sets the starting virtual ZIL reserve, which determines:
- Starting price: `initialVirtualZilReserve / TOTAL_SUPPLY`
- Curve steepness: Lower = steeper curve (price rises faster)
- Real ZIL raised at graduation (approximately)

**Default:** 22,500 ZIL

**How to change:**
```bash
cast send $FACTORY_ADDRESS "setInitialVirtualZilReserve(uint256)" $NEW_RESERVE_WEI \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

**Effect on curve shape:**

| Initial Virtual ZIL | Starting Price | Curve Behavior |
|---------------------|----------------|----------------|
| Lower (e.g., 9,000) | ~0.000009 ZIL | Steeper—price rises faster, earlier buyers get better prices |
| Higher (e.g., 45,000) | ~0.000045 ZIL | Gentler—price rises slower, more even distribution |

**Approximate real ZIL raised at graduation:**
```
Real ZIL ≈ sqrt(initialVirtualZil × graduationMarketCap) - initialVirtualZil
```

### Tuning Guide

| Goal | Real ZIL Target | Graduation MC | Initial Virtual ZIL |
|------|-----------------|---------------|---------------------|
| Small launch (~$1k) | ~161k ZIL | 3.2M ZIL | 9,000 ZIL |
| Medium launch (~$2.5k) | ~403k ZIL | 8M ZIL | 22,500 ZIL |
| Large launch (~$5k) | ~806k ZIL | 16M ZIL | 45,000 ZIL |

### `tradingFeePercent`

**What it does:** Fee taken on each buy/sell transaction.

**Default:** 100 (1%)

**Max:** 1000 (10%)

**How to change:**
```bash
cast send $FACTORY_ADDRESS "setTradingFeePercent(uint256)" $NEW_PERCENT \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### `graduationFeePercent`

**What it does:** Fee taken from real ZIL reserve during graduation, sent to treasury.

**Default:** 250 (2.5%)

**Max:** 1000 (10%)

**How to change:**
```bash
cast send $FACTORY_ADDRESS "setGraduationFeePercent(uint256)" $NEW_PERCENT \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### `creationFee`

**What it does:** Fee charged to create a new pool.

**Default:** 0

**How to change:**
```bash
cast send $FACTORY_ADDRESS "setCreationFee(uint256)" $FEE_WEI \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### `defaultV3Fee`

**What it does:** Plunder V3 pool fee tier for graduated liquidity.

**Default:** 10000 (1%)

**Valid values:** 100 (0.01%), 500 (0.05%), 2500 (0.25%), 10000 (1%)

**How to change:**
```bash
cast send $FACTORY_ADDRESS "setDefaultV3Fee(uint24)" $NEW_FEE \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## Deployment

Deploy the factory with required environment variables:

```bash
cd contracts

TREASURY_ADDRESS=0x... \
WRAPPED_NATIVE=0x... \
PLUNDER_V3_NFPM=0x... \
GRADUATION_MARKET_CAP=8000000000000000000000000 \
INITIAL_VIRTUAL_ZIL_RESERVE=22500000000000000000000 \
TRADING_FEE_PERCENT=100 \
GRADUATION_FEE_PERCENT=250 \
DEFAULT_V3_FEE=10000 \
forge script script/DeployBondingCurveFactory.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Constructor Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `TREASURY_ADDRESS` | Address receiving fees | Required |
| `WRAPPED_NATIVE` | WZIL address | Required |
| `PLUNDER_V3_NFPM` | Plunder V3 NonfungiblePositionManager | `0x17678B52997B89b179c0a471bF8d266A4A4c6AC5` |
| `GRADUATION_MARKET_CAP` | Market cap threshold for graduation (wei) | 8,000,000 ZIL |
| `INITIAL_VIRTUAL_ZIL_RESERVE` | Starting virtual ZIL reserve (wei) | 22,500 ZIL |
| `TRADING_FEE_PERCENT` | Trading fee in basis points | 100 (1%) |
| `GRADUATION_FEE_PERCENT` | Graduation fee in basis points | 250 (2.5%) |
| `DEFAULT_V3_FEE` | Plunder V3 pool fee tier | 10000 (1%) |

## Pool Lifecycle

1. **Trading**: Users buy/sell tokens along the constant product curve
2. **Graduation**: Triggered when market cap reaches threshold
3. **Post-graduation**: All remaining tokens + real ZIL locked on Plunder V3, LP NFT burned

## Read Functions

```bash
# Factory
cast call $FACTORY_ADDRESS "creationFee()(uint256)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "treasury()(address)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "graduationMarketCap()(uint256)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "initialVirtualZilReserve()(uint256)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "tradingFeePercent()(uint256)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "graduationFeePercent()(uint256)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "poolCount()(uint256)" --rpc-url $RPC_URL

# Pool
cast call $POOL_ADDRESS "state()(uint8)" --rpc-url $RPC_URL  # 0=Trading, 1=Graduated
cast call $POOL_ADDRESS "currentPrice()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "marketCap()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "tokensSold()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "virtualTokenReserve()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "virtualZilReserve()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "realZilReserve()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "k()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "progressBps()(uint256)" --rpc-url $RPC_URL  # 0-10000
cast call $POOL_ADDRESS "feesCollected()(uint256)" --rpc-url $RPC_URL
```

## Withdrawing Fees

Collected trading fees can be withdrawn by the treasury:

```bash
cast send $POOL_ADDRESS "withdrawFees()" \
  --rpc-url $RPC_URL \
  --private-key $TREASURY_PRIVATE_KEY
```

## Ownership Transfer

The factory uses OpenZeppelin's `Ownable2Step` for secure ownership transfers:

```bash
# Step 1: Current owner initiates transfer
cast send $FACTORY_ADDRESS "transferOwnership(address)" $NEW_OWNER \
  --rpc-url $RPC_URL \
  --private-key $CURRENT_OWNER_KEY

# Step 2: New owner accepts
cast send $FACTORY_ADDRESS "acceptOwnership()" \
  --rpc-url $RPC_URL \
  --private-key $NEW_OWNER_KEY
```

## Price Examples

With default configuration (8M ZIL graduation, 22,500 ZIL initial virtual reserve):

| State | Virtual Token Reserve | Virtual ZIL Reserve | Price (ZIL) | Market Cap (ZIL) |
|-------|----------------------|---------------------|-------------|------------------|
| Initial | 1,000,000,000 | 22,500 | 0.0000225 | 22,500 |
| After 100k ZIL bought | ~995,619,275 | 122,500 | 0.0001230 | 123,047 |
| Near graduation | ~118,585,412 | 189,736 | 0.0016 | 1,600,000 |
| At graduation | ~2,812,500 | 8,000,000 | 2.844 | 8,000,000 |

Note: Actual values vary based on fee deductions and exact trading patterns.
