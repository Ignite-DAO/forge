// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";

import {PoolState, BondingCurveInitParams} from "./BondingCurveTypes.sol";
import {IWETH9, INonfungiblePositionManager} from "../fairlaunch/PlunderInterfaces.sol";
import {ForgeStandardERC20} from "../ForgeStandardERC20.sol";

contract ForgeBondingCurvePool is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;
    uint256 public constant TOKENS_FOR_CURVE = 800_000_000e18;
    uint256 public constant TOKENS_FOR_LIQUIDITY = 200_000_000e18;
    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant MIN_BUY_AMOUNT = 0.001 ether;
    uint256 public constant MIN_SELL_TOKENS = 1e15;
    uint256 public constant MIN_GRADUATION_LIQUIDITY = 0.1 ether;
    int24 private constant MAX_TICK = 887272;
    int24 private constant MIN_TICK = -887272;

    // Curve parameters - tuned for ~3450 ZIL to fill entire curve (~$69k at $0.02/ZIL)
    // Linear curve: price = BASE_PRICE + SLOPE * tokensSold / 1e18
    // Cost to buy all 800M tokens ≈ 3450 ZIL
    uint256 public constant BASE_PRICE = 1e9; // 0.000000001 ZIL initial price per token
    uint256 public constant SLOPE = 1e4; // Price increases by 0.00001 ZIL per 1e18 tokens sold

    error NotTrading();
    error SlippageExceeded();
    error InsufficientPayment();
    error InsufficientTokens();
    error InsufficientReserve();
    error InsufficientLiquidity();
    error ZeroAmount();
    error BelowMinimum();
    error TransferFailed();
    error LiquidityCreationFailed();
    error OnlyTreasury();

    event Buy(
        address indexed buyer,
        uint256 zilIn,
        uint256 tokensOut,
        uint256 fee,
        uint256 newTokensSold,
        uint256 newPrice
    );
    event Sell(
        address indexed seller,
        uint256 tokensIn,
        uint256 zilOut,
        uint256 fee,
        uint256 newTokensSold,
        uint256 newPrice
    );
    event Graduated(
        uint256 totalZilRaised,
        uint256 liquidityZil,
        uint256 liquidityTokens,
        uint256 lpTokenId,
        uint256 graduationFee
    );
    event FeesWithdrawn(address indexed to, uint256 amount);

    address public immutable factory;
    address public immutable creator;
    IERC20 public immutable token;
    uint256 public immutable graduationMarketCap;
    uint24 public immutable v3Fee;
    address public immutable treasury;
    uint256 public immutable tradingFeePercent;
    uint256 public immutable graduationFeePercent;
    address public immutable wrappedNative;
    address public immutable positionManager;

    PoolState public state;
    uint256 public tokensSold;
    uint256 public zilReserve;
    uint256 public feesCollected;
    uint256 public lpTokenIdV3;

    constructor(BondingCurveInitParams memory params) {
        factory = msg.sender;
        creator = params.creator;
        graduationMarketCap = params.graduationMarketCap;
        v3Fee = params.v3Fee;
        treasury = params.treasury;
        tradingFeePercent = params.tradingFeePercent;
        graduationFeePercent = params.graduationFeePercent;
        wrappedNative = params.routers.wrappedNative;
        positionManager = params.routers.positionManager;

        token = IERC20(
            address(
                new ForgeStandardERC20(params.name, params.symbol, 18, TOTAL_SUPPLY, address(this))
            )
        );

        state = PoolState.Trading;
    }

    function buy(uint256 minTokensOut) external payable nonReentrant returns (uint256 tokensOut) {
        if (state != PoolState.Trading) revert NotTrading();
        if (msg.value == 0) revert ZeroAmount();
        if (msg.value < MIN_BUY_AMOUNT) revert BelowMinimum();

        uint256 fee = (msg.value * tradingFeePercent) / FEE_DENOMINATOR;
        uint256 zilAfterFee = msg.value - fee;

        tokensOut = _calculateBuy(zilAfterFee);
        if (tokensOut == 0) revert ZeroAmount();
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        uint256 available = TOKENS_FOR_CURVE - tokensSold;
        if (tokensOut > available) {
            tokensOut = available;
            // Recalculate actual cost for capped tokens
            uint256 actualCost = _calculateCost(tokensOut);
            uint256 actualFee = (actualCost * tradingFeePercent) / (FEE_DENOMINATOR - tradingFeePercent);
            uint256 refund = msg.value - actualCost - actualFee;
            fee = actualFee;
            zilAfterFee = actualCost;
            if (refund > 0) {
                payable(msg.sender).sendValue(refund);
            }
        }

        tokensSold += tokensOut;
        zilReserve += zilAfterFee;
        feesCollected += fee;

        token.safeTransfer(msg.sender, tokensOut);

        emit Buy(msg.sender, msg.value, tokensOut, fee, tokensSold, currentPrice());

        _checkGraduation();
    }

    function sell(uint256 tokensIn, uint256 minZilOut) external nonReentrant returns (uint256 zilOut) {
        if (state != PoolState.Trading) revert NotTrading();
        if (tokensIn == 0) revert ZeroAmount();
        if (tokensIn < MIN_SELL_TOKENS) revert BelowMinimum();
        if (tokensIn > tokensSold) revert InsufficientTokens();

        uint256 grossProceeds = _calculateSell(tokensIn);
        uint256 fee = (grossProceeds * tradingFeePercent) / FEE_DENOMINATOR;
        zilOut = grossProceeds - fee;

        if (zilOut < minZilOut) revert SlippageExceeded();
        if (grossProceeds > zilReserve) revert InsufficientReserve();

        // Update state before external calls (CEI pattern)
        tokensSold -= tokensIn;
        zilReserve -= grossProceeds;
        feesCollected += fee;

        // External calls after state updates
        token.safeTransferFrom(msg.sender, address(this), tokensIn);
        payable(msg.sender).sendValue(zilOut);

        emit Sell(msg.sender, tokensIn, zilOut, fee, tokensSold, currentPrice());
    }

    function withdrawFees() external nonReentrant {
        if (msg.sender != treasury) revert OnlyTreasury();
        uint256 amount = feesCollected;
        if (amount == 0) revert ZeroAmount();
        feesCollected = 0;
        payable(treasury).sendValue(amount);
        emit FeesWithdrawn(treasury, amount);
    }

    // ------------------------
    // View Functions
    // ------------------------

    function currentPrice() public view returns (uint256) {
        return BASE_PRICE + (SLOPE * tokensSold) / 1e18;
    }

    function marketCap() public view returns (uint256) {
        return (currentPrice() * TOTAL_SUPPLY) / 1e18;
    }

    function tokensRemaining() external view returns (uint256) {
        return TOKENS_FOR_CURVE - tokensSold;
    }

    function progressBps() external view returns (uint256) {
        if (graduationMarketCap == 0) return 0;
        uint256 mcap = marketCap();
        if (mcap >= graduationMarketCap) return 10_000;
        return (mcap * 10_000) / graduationMarketCap;
    }

    function quoteBuy(uint256 zilAmount) external view returns (uint256 tokensOut, uint256 fee) {
        fee = (zilAmount * tradingFeePercent) / FEE_DENOMINATOR;
        uint256 zilAfterFee = zilAmount - fee;
        tokensOut = _calculateBuy(zilAfterFee);
        uint256 available = TOKENS_FOR_CURVE - tokensSold;
        if (tokensOut > available) {
            tokensOut = available;
        }
    }

    function quoteSell(uint256 tokensIn) external view returns (uint256 zilOut, uint256 fee) {
        if (tokensIn > tokensSold) {
            return (0, 0);
        }
        uint256 grossProceeds = _calculateSell(tokensIn);
        fee = (grossProceeds * tradingFeePercent) / FEE_DENOMINATOR;
        zilOut = grossProceeds - fee;
        if (zilOut > zilReserve) {
            zilOut = 0;
            fee = 0;
        }
    }

    // ------------------------
    // Internal Functions
    // ------------------------

    function _calculateBuy(uint256 zilIn) internal view returns (uint256 tokensOut) {
        // Solve for n tokens given cost zilIn
        // cost = n * BASE_PRICE + SLOPE * n * (s + n/2) / 1e18
        // Rearranging: (SLOPE/2) * n^2 + (BASE_PRICE + SLOPE*s/1e18) * n - cost = 0
        // Using quadratic formula: n = (-b + sqrt(b^2 + 4ac)) / 2a
        // where a = SLOPE/2, b = BASE_PRICE + SLOPE*s/1e18, c = cost (zilIn)

        uint256 s = tokensSold;
        uint256 b = BASE_PRICE + (SLOPE * s) / 1e18;

        // Discriminant = b^2 + 2 * SLOPE * zilIn (since 4ac/2a = 2c when a = SLOPE/2)
        uint256 discriminant = b * b + 2 * SLOPE * zilIn;
        uint256 sqrtDisc = _sqrt(discriminant);

        // n = (sqrt(discriminant) - b) * 1e18 / SLOPE
        if (sqrtDisc <= b) return 0;
        tokensOut = ((sqrtDisc - b) * 1e18) / SLOPE;
    }

    function _calculateCost(uint256 n) internal view returns (uint256 cost) {
        // cost = n * BASE_PRICE + SLOPE * n * (s + n/2) / 1e18
        uint256 s = tokensSold;
        cost = (n * BASE_PRICE) / 1e18 + (SLOPE * n * (s + n / 2)) / 1e36;
    }

    function _calculateSell(uint256 n) internal view returns (uint256 proceeds) {
        // proceeds = n * BASE_PRICE + SLOPE * n * (s - n/2) / 1e18
        uint256 s = tokensSold;
        proceeds = (n * BASE_PRICE) / 1e18 + (SLOPE * n * (s - n / 2)) / 1e36;
    }

    function _checkGraduation() internal {
        if (state != PoolState.Trading) return;

        bool thresholdReached = marketCap() >= graduationMarketCap;
        bool allSold = tokensSold >= TOKENS_FOR_CURVE;

        if (thresholdReached || allSold) {
            _graduate();
        }
    }

    function _graduate() internal {
        state = PoolState.Graduated;

        uint256 totalZil = zilReserve;
        uint256 graduationFee = (totalZil * graduationFeePercent) / FEE_DENOMINATOR;
        uint256 liquidityZil = totalZil - graduationFee;

        // Ensure minimum liquidity for meaningful V3 pool
        if (liquidityZil < MIN_GRADUATION_LIQUIDITY) revert InsufficientLiquidity();

        // Wrap ZIL to WZIL
        IWETH9(wrappedNative).deposit{value: liquidityZil}();

        IERC20(wrappedNative).forceApprove(positionManager, liquidityZil);
        token.forceApprove(positionManager, TOKENS_FOR_LIQUIDITY);

        // Determine token ordering for V3
        bool tokenIsToken0 = address(token) < wrappedNative;

        // Create and initialize the V3 pool with the appropriate price
        INonfungiblePositionManager(positionManager).createAndInitializePoolIfNecessary(
            tokenIsToken0 ? address(token) : wrappedNative,
            tokenIsToken0 ? wrappedNative : address(token),
            v3Fee,
            _calculateSqrtPriceX96(
                tokenIsToken0 ? TOKENS_FOR_LIQUIDITY : liquidityZil,
                tokenIsToken0 ? liquidityZil : TOKENS_FOR_LIQUIDITY
            )
        );

        // Calculate valid tick bounds for the fee tier
        (int24 tickLower, int24 tickUpper) = _getFullRangeTicks(v3Fee);

        (uint256 tokenId, uint128 liquidity,,) = INonfungiblePositionManager(positionManager).mint(
            INonfungiblePositionManager.MintParams({
                token0: tokenIsToken0 ? address(token) : wrappedNative,
                token1: tokenIsToken0 ? wrappedNative : address(token),
                fee: v3Fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: tokenIsToken0 ? TOKENS_FOR_LIQUIDITY : liquidityZil,
                amount1Desired: tokenIsToken0 ? liquidityZil : TOKENS_FOR_LIQUIDITY,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp + 900
            })
        );

        // Verify LP creation succeeded
        if (tokenId == 0 || liquidity == 0) revert LiquidityCreationFailed();
        lpTokenIdV3 = tokenId;

        // Clear approvals
        IERC20(wrappedNative).forceApprove(positionManager, 0);
        token.forceApprove(positionManager, 0);

        // Burn LP by transferring to dead address - liquidity is permanently locked
        INonfungiblePositionManager(positionManager).transferFrom(
            address(this),
            address(0x000000000000000000000000000000000000dEaD),
            tokenId
        );

        // Reset reserve since it's now in LP
        zilReserve = 0;

        // Send graduation fee at the end (after all state changes and LP creation)
        if (graduationFee > 0) {
            payable(treasury).sendValue(graduationFee);
        }

        emit Graduated(totalZil, liquidityZil, TOKENS_FOR_LIQUIDITY, tokenId, graduationFee);
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _calculateSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        // sqrtPriceX96 = sqrt(amount1/amount0) * 2^96
        // = sqrt(amount1) * 2^96 / sqrt(amount0)
        uint256 sqrtAmount1 = _sqrt(amount1);
        uint256 sqrtAmount0 = _sqrt(amount0);
        if (sqrtAmount0 == 0) return type(uint160).max;
        return uint160((sqrtAmount1 << 96) / sqrtAmount0);
    }

    function _getFullRangeTicks(uint24 fee) internal pure returns (int24 tickLower, int24 tickUpper) {
        int24 tickSpacing = _getTickSpacing(fee);
        // Round MIN_TICK up (toward zero) to nearest valid tick
        tickLower = (MIN_TICK / tickSpacing) * tickSpacing;
        // Round MAX_TICK down (toward zero) to nearest valid tick
        tickUpper = (MAX_TICK / tickSpacing) * tickSpacing;
    }

    function _getTickSpacing(uint24 fee) internal pure returns (int24) {
        // PlunderSwap fee tiers: 0.01%, 0.05%, 0.25%, 1%
        if (fee == 100) return 1;
        if (fee == 500) return 10;
        if (fee == 2500) return 50;
        if (fee == 10000) return 200;
        revert("Invalid fee");
    }

    receive() external payable {
        // Only accept ETH from wrappedNative (during unwrap) or during buy transactions
        // Rejecting arbitrary deposits prevents accounting issues
        if (msg.sender != wrappedNative) revert TransferFailed();
    }
}
