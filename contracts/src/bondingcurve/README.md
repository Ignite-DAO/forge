# Bonding Curve Contracts

Linear bonding curve implementation for fair token launches. Tokens are sold along a price curve until graduation, at which point liquidity is permanently locked on Plunder V3.

## Overview

- **ForgeBondingCurveFactory**: Deploys and configures bonding curve pools
- **ForgeBondingCurvePool**: Individual pool handling buys, sells, and graduation
- **BondingCurveTypes**: Shared structs and enums

### Tokenomics

| Parameter            | Value                       |
| -------------------- | --------------------------- |
| Total Supply         | 1,000,000,000 tokens        |
| Tokens for Curve     | 800,000,000 (80%)           |
| Tokens for Liquidity | 200,000,000 (20%)           |
| Base Price           | 0.000000001 ZIL             |
| Slope                | 0.00001 ZIL per 1e18 tokens |

Cost to fill entire curve: ~3,450 ZIL

### Trading Limits

| Parameter              | Value       | Description                    |
| ---------------------- | ----------- | ------------------------------ |
| `MIN_BUY_AMOUNT`       | 0.001 ZIL   | Minimum ZIL per buy            |
| `MIN_SELL_TOKENS`      | 0.001 tokens| Minimum tokens per sell        |
| `MIN_GRADUATION_LIQUIDITY` | 0.1 ZIL | Minimum ZIL for graduation LP  |

## Deployment

Deploy the factory with required environment variables:

```bash
cd contracts

TREASURY_ADDRESS=0x... \
WRAPPED_NATIVE=0x... \
PLUNDER_V3_NFPM=0x... \
GRADUATION_MARKET_CAP=4200000000000000000000000 \
TRADING_FEE_PERCENT=100 \
GRADUATION_FEE_PERCENT=250 \
DEFAULT_V3_FEE=10000 \
forge script script/DeployBondingCurveFactory.s.sol \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### Constructor Parameters

| Parameter                 | Description                               | Default                                      |
| ------------------------- | ----------------------------------------- | -------------------------------------------- |
| `TREASURY_ADDRESS`        | Address receiving fees                    | Required                                     |
| `WRAPPED_NATIVE`          | WZIL address                              | Required                                     |
| `PLUNDER_V3_NFPM`         | Plunder V3 NonfungiblePositionManager     | `0x17678B52997B89b179c0a471bF8d266A4A4c6AC5` |
| `GRADUATION_MARKET_CAP`   | Market cap threshold for graduation (wei) | 4,200,000 ZIL                                |
| `TRADING_FEE_PERCENT`     | Trading fee in basis points (100 = 1%)    | 100 (1%)                                     |
| `GRADUATION_FEE_PERCENT`  | Graduation fee in basis points (250 = 2.5%) | 250 (2.5%)                                 |
| `DEFAULT_V3_FEE`          | Plunder V3 pool fee tier                  | 10000 (1%)                                   |

## Updating Factory Parameters

All parameter updates require owner privileges. Use `cast` to call directly:

### Set Creation Fee

```bash
cast send $FACTORY_ADDRESS "setCreationFee(uint256)" $FEE_WEI \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

### Set Treasury

```bash
cast send $FACTORY_ADDRESS "setTreasury(address)" $NEW_TREASURY \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

### Set Graduation Market Cap

Minimum: 1 ZIL (1e18 wei)

```bash
cast send $FACTORY_ADDRESS "setGraduationMarketCap(uint256)" $NEW_CAP_WEI \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

### Set Trading Fee Percent

Maximum: 1000 (10%)

```bash
cast send $FACTORY_ADDRESS "setTradingFeePercent(uint256)" $NEW_PERCENT \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

### Set Graduation Fee Percent

Maximum: 1000 (10%). This fee is taken from ZIL reserve during graduation and sent to treasury.

```bash
cast send $FACTORY_ADDRESS "setGraduationFeePercent(uint256)" $NEW_PERCENT \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

### Set Default V3 Fee

```bash
cast send $FACTORY_ADDRESS "setDefaultV3Fee(uint24)" $NEW_FEE \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

### Set Router Config

```bash
cast send $FACTORY_ADDRESS "setRouterConfig((address,address))" "($WRAPPED_NATIVE,$POSITION_MANAGER)" \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

## Pool Lifecycle

1. **Trading**: Users buy/sell tokens along the bonding curve
2. **Graduation**: Triggered when market cap reaches threshold OR all curve tokens sold
3. **Post-graduation**: Liquidity locked on Plunder V3, LP NFT burned to dead address

## Withdrawing Fees

Collected trading fees can be withdrawn by the treasury:

```bash
cast send $POOL_ADDRESS "withdrawFees()" \
  --rpc-url $RPC_URL \
  --private-key $TREASURY_PRIVATE_KEY
```

## Read Functions

```bash
# Factory
cast call $FACTORY_ADDRESS "creationFee()(uint256)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "treasury()(address)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "graduationMarketCap()(uint256)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "tradingFeePercent()(uint256)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "graduationFeePercent()(uint256)" --rpc-url $RPC_URL
cast call $FACTORY_ADDRESS "poolCount()(uint256)" --rpc-url $RPC_URL

# Pool
cast call $POOL_ADDRESS "state()(uint8)" --rpc-url $RPC_URL  # 0=Trading, 1=Graduated
cast call $POOL_ADDRESS "currentPrice()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "marketCap()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "tokensSold()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "tokensRemaining()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "progressBps()(uint256)" --rpc-url $RPC_URL  # Progress in basis points (0-10000)
cast call $POOL_ADDRESS "feesCollected()(uint256)" --rpc-url $RPC_URL
cast call $POOL_ADDRESS "graduationFeePercent()(uint256)" --rpc-url $RPC_URL
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
