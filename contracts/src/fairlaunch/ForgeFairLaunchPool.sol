// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";
import {MerkleProof} from "openzeppelin-contracts/contracts/utils/cryptography/MerkleProof.sol";

import {FairLaunchCurrency, FairLaunchRouterKind, FairLaunchInitParams} from "./FairLaunchTypes.sol";
import {IPlunderRouterV2, IPlunderFactoryV2, IWETH9, INonfungiblePositionManager} from "./PlunderInterfaces.sol";

/// @notice Per-sale fair launch contract deployed via ForgeFairLaunchFactory.
contract ForgeFairLaunchPool is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    uint256 private constant PERCENT_BASE = 100;
    int24 private constant FULL_RANGE_MIN = -887220;
    int24 private constant FULL_RANGE_MAX = 887220;

    error NotCreator();
    error InvalidParam();
    error InvalidTimeline();
    error SaleNotLive();
    error HardCapReached();
    error MaxContributionExceeded();
    error NotWhitelisted();
    error NothingToClaim();
    error NothingToRefund();
    error AlreadyFinalized();
    error SoftCapNotMet();
    error SaleOngoing();
    error AutoListingDisabled();
    error ManualListingOnly();
    error LiquidityLocked();
    error AlreadyReleased();
    error InvalidRouter();
    error InvalidCurrency();
    error SaleCancelled();
    error NotFinalized();

    event Contribution(address indexed account, uint256 amount, uint256 newTotalRaised);
    event Refunded(address indexed account, uint256 amount);
    event Claimed(address indexed account, uint256 amount);
    event Finalized(
        uint256 totalRaised, uint256 liquidityCurrency, uint256 liquidityTokens, uint256 lockEndsAt, bool autoListing
    );
    event CreatorWithdrawal(uint256 amount);
    event ManualLiquidityWithdrawn(uint256 amount);
    event LiquidityReleased(address indexed to, address lpToken, uint256 lpAmount, uint256 tokenId);
    event WhitelistUpdated(bytes32 root, bool enabled);
    event Paused(bool paused);
    event Cancelled();

    modifier onlyCreator() {
        if (msg.sender != creator) revert NotCreator();
        _;
    }

    address public immutable factory;
    address public immutable creator;
    IERC20 public immutable token;
    FairLaunchCurrency public immutable currency;
    IERC20 public immutable raiseToken; // zero address when currency == ZIL
    uint256 public immutable tokensForSale;
    uint16 public immutable liquidityPercent; // 51-100 inclusive
    uint256 public immutable softCap;
    uint256 public immutable hardCap;
    uint256 public immutable maxContribution;
    uint64 public immutable startTime;
    uint64 public immutable endTime;
    bool public immutable autoListing;
    FairLaunchRouterKind public immutable routerKind;
    uint24 public immutable v3Fee;
    uint256 public immutable lockDuration;
    uint256 public immutable tokensForLiquidity;
    uint256 public immutable totalTokensRequired;

    address public immutable routerV2;
    address public immutable factoryV2;
    address public immutable wrappedNative;
    address public immutable positionManager;

    bytes32 public whitelistRoot;
    bool public whitelistEnabled;

    bool public paused;
    bool public cancelled;
    bool public finalized;
    uint256 public finalizedAt;
    uint256 public lockEndsAt;
    bool public liquidityReleasedToCreator;
    bool public manualLiquidityWithdrawn;
    bool public tokensReturnedAfterCancel;

    uint256 public totalRaised;
    uint256 public contributorCount;
    uint256 public creatorProceeds;
    uint256 public creatorProceedsClaimed;
    uint256 public liquidityCurrencyUsed;
    uint256 public tokensClaimedTotal;

    address public lpTokenV2;
    uint256 public lpTokenBalance;
    uint256 public lpTokenIdV3;

    mapping(address => uint256) public contributions;
    mapping(address => uint256) public claimed;

    constructor(FairLaunchInitParams memory params) {
        if (params.creator == address(0) || params.token == address(0)) revert InvalidParam();
        if (params.tokensForSale == 0) revert InvalidParam();
        if (params.liquidityPercent < 51 || params.liquidityPercent > 100) revert InvalidParam();
        if (params.softCap == 0) revert InvalidParam();
        if (params.endTime <= params.startTime) revert InvalidTimeline();
        if (params.currency == FairLaunchCurrency.USDC && params.raiseToken == address(0)) {
            revert InvalidParam();
        }
        if (params.autoListing && params.routerKind == FairLaunchRouterKind.V2 && params.routers.routerV2 == address(0))
        {
            revert InvalidRouter();
        }
        if (
            params.autoListing && params.routerKind == FairLaunchRouterKind.V3
                && params.routers.positionManager == address(0)
        ) {
            revert InvalidRouter();
        }
        if (params.routerKind == FairLaunchRouterKind.V3 && params.v3Fee == 0) {
            revert InvalidRouter();
        }

        factory = msg.sender;
        creator = params.creator;
        token = IERC20(params.token);
        currency = params.currency;
        raiseToken = IERC20(params.raiseToken);
        tokensForSale = params.tokensForSale;
        liquidityPercent = params.liquidityPercent;
        softCap = params.softCap;
        hardCap = params.hardCap;
        maxContribution = params.maxContribution;
        startTime = params.startTime;
        endTime = params.endTime;
        autoListing = params.autoListing;
        routerKind = params.routerKind;
        v3Fee = params.v3Fee;
        lockDuration = params.lockDuration;

        tokensForLiquidity = (params.tokensForSale * params.liquidityPercent) / PERCENT_BASE;
        totalTokensRequired = params.tokensForSale + tokensForLiquidity;

        whitelistRoot = params.whitelistRoot;
        whitelistEnabled = params.whitelistEnabled;

        routerV2 = params.routers.routerV2;
        factoryV2 = params.routers.factoryV2;
        wrappedNative = params.routers.wrappedNative;
        positionManager = params.routers.positionManager;
    }

    receive() external payable {
        if (currency != FairLaunchCurrency.ZIL) {
            revert InvalidCurrency();
        }
    }

    // ------------------------
    // Contributor interactions
    // ------------------------

    function contribute(uint256 amount, bytes32[] calldata proof) external payable nonReentrant {
        if (cancelled) revert SaleCancelled();
        if (finalized) revert AlreadyFinalized();
        if (paused) revert SaleNotLive();
        if (block.timestamp < startTime || block.timestamp > endTime) revert SaleNotLive();
        if (whitelistEnabled && !_isWhitelisted(msg.sender, proof)) revert NotWhitelisted();

        uint256 contribution;
        if (currency == FairLaunchCurrency.ZIL) {
            contribution = msg.value;
            if (contribution == 0 || amount != 0) revert InvalidCurrency();
        } else {
            if (msg.value != 0) revert InvalidCurrency();
            contribution = amount;
            if (contribution == 0) revert InvalidCurrency();
            raiseToken.safeTransferFrom(msg.sender, address(this), contribution);
        }

        if (hardCap != 0 && totalRaised + contribution > hardCap) revert HardCapReached();

        uint256 prev = contributions[msg.sender];
        uint256 updated = prev + contribution;
        if (maxContribution != 0 && updated > maxContribution) revert MaxContributionExceeded();

        contributions[msg.sender] = updated;
        totalRaised += contribution;
        if (prev == 0) {
            contributorCount += 1;
        }

        emit Contribution(msg.sender, contribution, totalRaised);
    }

    function claim() external nonReentrant {
        if (!finalized) revert NotFinalized();
        uint256 contribution = contributions[msg.sender];
        if (contribution == 0) revert NothingToClaim();

        uint256 totalClaimable = (tokensForSale * contribution) / totalRaised;
        uint256 alreadyClaimed = claimed[msg.sender];
        if (totalClaimable <= alreadyClaimed) revert NothingToClaim();

        uint256 payout = totalClaimable - alreadyClaimed;
        claimed[msg.sender] = totalClaimable;
        tokensClaimedTotal += payout;

        token.safeTransfer(msg.sender, payout);
        emit Claimed(msg.sender, payout);
    }

    function refund() external nonReentrant {
        if (finalized) revert AlreadyFinalized();
        if (!(cancelled || block.timestamp > endTime || totalRaised < softCap)) revert SaleOngoing();

        uint256 contribution = contributions[msg.sender];
        if (contribution == 0) revert NothingToRefund();
        contributions[msg.sender] = 0;
        totalRaised -= contribution;

        if (currency == FairLaunchCurrency.ZIL) {
            payable(msg.sender).sendValue(contribution);
        } else {
            raiseToken.safeTransfer(msg.sender, contribution);
        }
        emit Refunded(msg.sender, contribution);
    }

    // ------------------------
    // Creator actions
    // ------------------------

    function finalize(uint256 minTokenLiquidity, uint256 minCurrencyLiquidity) external onlyCreator nonReentrant {
        if (cancelled) revert SaleCancelled();
        if (finalized) revert AlreadyFinalized();
        if (block.timestamp < endTime) revert SaleOngoing();
        if (totalRaised < softCap) revert SoftCapNotMet();
        _ensureTokenCoverage();

        finalized = true;
        finalizedAt = block.timestamp;

        uint256 liquidityTokens = tokensForLiquidity;
        uint256 liquidityCurrency = (totalRaised * liquidityPercent) / PERCENT_BASE;
        uint256 proceeds = totalRaised;

        if (autoListing) {
            liquidityCurrencyUsed = liquidityCurrency;
            proceeds = totalRaised - liquidityCurrency;
            _autoList(liquidityCurrency, liquidityTokens, minTokenLiquidity, minCurrencyLiquidity);
            lockEndsAt = lockDuration == type(uint256).max ? type(uint256).max : block.timestamp + lockDuration;
        }

        creatorProceeds = proceeds;
        emit Finalized(totalRaised, liquidityCurrencyUsed, liquidityTokens, lockEndsAt, autoListing);
    }

    function withdrawCreatorProceeds(address payable to) external onlyCreator nonReentrant {
        if (!finalized) revert NotFinalized();
        if (to == address(0)) revert InvalidParam();
        uint256 remaining = creatorProceeds - creatorProceedsClaimed;
        if (remaining == 0) revert NothingToClaim();
        creatorProceedsClaimed += remaining;

        if (currency == FairLaunchCurrency.ZIL) {
            to.sendValue(remaining);
        } else {
            raiseToken.safeTransfer(to, remaining);
        }
        emit CreatorWithdrawal(remaining);
    }

    function withdrawManualLiquidityTokens(address to) external onlyCreator nonReentrant {
        if (autoListing) revert AutoListingDisabled();
        if (!finalized) revert NotFinalized();
        if (manualLiquidityWithdrawn) revert AlreadyReleased();
        if (to == address(0)) revert InvalidParam();
        manualLiquidityWithdrawn = true;
        uint256 amount = tokensForLiquidity;
        token.safeTransfer(to, amount);
        emit ManualLiquidityWithdrawn(amount);
    }

    function releaseLiquidity(address to) external onlyCreator nonReentrant {
        if (!autoListing) revert ManualListingOnly();
        if (!finalized) revert NotFinalized();
        if (lockDuration == type(uint256).max) revert LiquidityLocked();
        if (lockEndsAt == 0 || block.timestamp < lockEndsAt) revert LiquidityLocked();
        if (liquidityReleasedToCreator) revert AlreadyReleased();
        if (to == address(0)) revert InvalidParam();
        liquidityReleasedToCreator = true;

        if (routerKind == FairLaunchRouterKind.V2) {
            uint256 amount = lpTokenBalance;
            IERC20(lpTokenV2).safeTransfer(to, amount);
            emit LiquidityReleased(to, lpTokenV2, amount, 0);
        } else {
            INonfungiblePositionManager(positionManager).transferFrom(address(this), to, lpTokenIdV3);
            emit LiquidityReleased(to, address(0), 0, lpTokenIdV3);
        }
    }

    function setWhitelist(bytes32 root, bool enabled) external onlyCreator {
        whitelistRoot = root;
        whitelistEnabled = enabled;
        emit WhitelistUpdated(root, enabled);
    }

    function setPaused(bool value) external onlyCreator {
        if (paused == value) return;
        paused = value;
        emit Paused(value);
    }

    function cancelSale() external onlyCreator {
        if (cancelled) revert SaleCancelled();
        if (block.timestamp >= startTime) revert SaleOngoing();
        cancelled = true;
        emit Cancelled();
    }

    function withdrawTokensAfterCancel() external onlyCreator nonReentrant {
        if (!cancelled) revert SaleCancelled();
        if (tokensReturnedAfterCancel) revert AlreadyReleased();
        tokensReturnedAfterCancel = true;
        if (totalRaised != 0) revert SaleOngoing();
        token.safeTransfer(creator, token.balanceOf(address(this)));
    }

    function sweepDust(address to) external onlyCreator nonReentrant {
        if (!finalized) revert NotFinalized();
        if (tokensClaimedTotal != tokensForSale) revert LiquidityLocked();
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NothingToClaim();
        token.safeTransfer(to, balance);
    }

    // ------------------------
    // Views
    // ------------------------

    function getClaimable(address account) external view returns (uint256) {
        if (!finalized) return 0;
        uint256 contribution = contributions[account];
        if (contribution == 0) return 0;
        uint256 totalClaimable = (tokensForSale * contribution) / totalRaised;
        uint256 alreadyClaimed = claimed[account];
        if (totalClaimable <= alreadyClaimed) return 0;
        return totalClaimable - alreadyClaimed;
    }

    function status() external view returns (uint8) {
        if (cancelled) return 4; // Cancelled
        if (finalized) return 3; // Finalized
        if (block.timestamp < startTime) return 0; // Upcoming
        if (block.timestamp <= endTime) return 1; // Live
        if (totalRaised >= softCap) return 2; // Successful waiting finalize
        return 5; // Failed (refund)
    }

    // ------------------------
    // Internal helpers
    // ------------------------

    function _isWhitelisted(address account, bytes32[] calldata proof) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(account));
        return MerkleProof.verify(proof, whitelistRoot, leaf);
    }

    function _ensureTokenCoverage() internal view {
        uint256 balance = token.balanceOf(address(this));
        uint256 reservedForSale = tokensForSale - tokensClaimedTotal;
        uint256 liquidityReserve = manualLiquidityWithdrawn ? 0 : tokensForLiquidity;
        if (balance < reservedForSale + liquidityReserve) {
            revert InvalidCurrency();
        }
    }

    function _autoList(
        uint256 liquidityCurrency,
        uint256 liquidityTokens,
        uint256 minTokenLiquidity,
        uint256 minCurrencyLiquidity
    ) internal {
        if (!autoListing) revert AutoListingDisabled();

        if (routerKind == FairLaunchRouterKind.V2) {
            _addLiquidityV2(liquidityCurrency, liquidityTokens, minTokenLiquidity, minCurrencyLiquidity);
        } else {
            _addLiquidityV3(liquidityCurrency, liquidityTokens, minTokenLiquidity, minCurrencyLiquidity);
        }
    }

    function _addLiquidityV2(
        uint256 liquidityCurrency,
        uint256 liquidityTokens,
        uint256 minTokenLiquidity,
        uint256 minCurrencyLiquidity
    ) internal {
        if (routerV2 == address(0) || factoryV2 == address(0)) revert InvalidRouter();
        if (currency == FairLaunchCurrency.ZIL && wrappedNative == address(0)) revert InvalidRouter();
        token.forceApprove(routerV2, liquidityTokens);
        if (currency == FairLaunchCurrency.ZIL) {
            IPlunderRouterV2(routerV2).addLiquidityETH{value: liquidityCurrency}(
                address(token),
                liquidityTokens,
                minTokenLiquidity,
                minCurrencyLiquidity,
                address(this),
                block.timestamp + 900
            );
        } else {
            raiseToken.forceApprove(routerV2, liquidityCurrency);
            IPlunderRouterV2(routerV2).addLiquidity(
                address(token),
                address(raiseToken),
                liquidityTokens,
                liquidityCurrency,
                minTokenLiquidity,
                minCurrencyLiquidity,
                address(this),
                block.timestamp + 900
            );
            raiseToken.forceApprove(routerV2, 0);
        }
        token.forceApprove(routerV2, 0);

        address pair = IPlunderFactoryV2(factoryV2).getPair(
            address(token), currency == FairLaunchCurrency.ZIL ? wrappedNative : address(raiseToken)
        );
        if (pair == address(0)) revert InvalidRouter();
        lpTokenV2 = pair;
        lpTokenBalance = IERC20(pair).balanceOf(address(this));
        if (lpTokenBalance == 0) revert InvalidRouter();
    }

    function _addLiquidityV3(
        uint256 liquidityCurrency,
        uint256 liquidityTokens,
        uint256 minTokenLiquidity,
        uint256 minCurrencyLiquidity
    ) internal {
        if (positionManager == address(0)) revert InvalidRouter();
        if (currency == FairLaunchCurrency.ZIL && wrappedNative == address(0)) revert InvalidRouter();
        address currencyToken = currency == FairLaunchCurrency.ZIL ? wrappedNative : address(raiseToken);

        if (currency == FairLaunchCurrency.ZIL) {
            IWETH9(wrappedNative).deposit{value: liquidityCurrency}();
            IERC20(wrappedNative).forceApprove(positionManager, liquidityCurrency);
        } else {
            raiseToken.forceApprove(positionManager, liquidityCurrency);
        }
        token.forceApprove(positionManager, liquidityTokens);

        bool saleIsToken0 = address(token) < currencyToken;
        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: saleIsToken0 ? address(token) : currencyToken,
            token1: saleIsToken0 ? currencyToken : address(token),
            fee: v3Fee,
            tickLower: FULL_RANGE_MIN,
            tickUpper: FULL_RANGE_MAX,
            amount0Desired: saleIsToken0 ? liquidityTokens : liquidityCurrency,
            amount1Desired: saleIsToken0 ? liquidityCurrency : liquidityTokens,
            amount0Min: saleIsToken0 ? minTokenLiquidity : minCurrencyLiquidity,
            amount1Min: saleIsToken0 ? minCurrencyLiquidity : minTokenLiquidity,
            recipient: address(this),
            deadline: block.timestamp + 900
        });

        (uint256 tokenId,,,) = INonfungiblePositionManager(positionManager).mint{value: 0}(params);
        lpTokenIdV3 = tokenId;

        token.forceApprove(positionManager, 0);
        if (currency == FairLaunchCurrency.USDC) {
            raiseToken.forceApprove(positionManager, 0);
        } else {
            IERC20(wrappedNative).forceApprove(positionManager, 0);
        }
    }
}
