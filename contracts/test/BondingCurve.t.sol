// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeBondingCurveFactory} from "src/bondingcurve/ForgeBondingCurveFactory.sol";
import {ForgeBondingCurvePool} from "src/bondingcurve/ForgeBondingCurvePool.sol";
import {BondingCurveCreateParams, BondingCurveRouterConfig, PoolState} from "src/bondingcurve/BondingCurveTypes.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract MockWETH {
    string public name = "Wrapped ZIL";
    string public symbol = "WZIL";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 wad) external {
        require(balanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] -= wad;
        payable(msg.sender).transfer(wad);
    }

    function approve(address guy, uint256 wad) external returns (bool) {
        allowance[msg.sender][guy] = wad;
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] -= value;
        }
        balanceOf[from] -= value;
        balanceOf[to] += value;
        return true;
    }

    receive() external payable {
        balanceOf[msg.sender] += msg.value;
    }
}

contract MockPositionManager {
    uint256 public nextTokenId = 1;

    struct Position {
        address token0;
        address token1;
        uint24 fee;
        uint256 amount0;
        uint256 amount1;
        address owner;
    }

    mapping(uint256 => Position) public positions;

    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        IERC20(params.token0).transferFrom(msg.sender, address(this), params.amount0Desired);
        IERC20(params.token1).transferFrom(msg.sender, address(this), params.amount1Desired);

        tokenId = nextTokenId++;
        liquidity = uint128(params.amount0Desired + params.amount1Desired);
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;

        positions[tokenId] = Position({
            token0: params.token0,
            token1: params.token1,
            fee: params.fee,
            amount0: amount0,
            amount1: amount1,
            owner: params.recipient
        });
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(positions[tokenId].owner == from, "not owner");
        positions[tokenId].owner = to;
    }
}

contract BondingCurveTest is Test {
    ForgeBondingCurveFactory factory;
    MockWETH weth;
    MockPositionManager positionManager;

    address creator = address(0xA11CE);
    address alice = address(0xBEEF);
    address bob = address(0xC0FFEE);
    address treasury = address(0xDAD);

    uint256 constant GRADUATION_MARKET_CAP = 1_000_000 ether; // Very high to prevent premature graduation in tests
    uint256 constant TRADING_FEE_PERCENT = 100; // 1%
    uint256 constant GRADUATION_FEE_PERCENT = 250; // 2.5%
    uint24 constant DEFAULT_V3_FEE = 10000; // 1%

    function setUp() public {
        weth = new MockWETH();
        positionManager = new MockPositionManager();

        BondingCurveRouterConfig memory config = BondingCurveRouterConfig({
            wrappedNative: address(weth),
            positionManager: address(positionManager)
        });

        factory = new ForgeBondingCurveFactory(
            treasury,
            GRADUATION_MARKET_CAP,
            TRADING_FEE_PERCENT,
            GRADUATION_FEE_PERCENT,
            DEFAULT_V3_FEE,
            config
        );
    }

    // ------------------------------
    // Factory Tests
    // ------------------------------

    function test_CreatePool_Success() public {
        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Test Token",
            symbol: "TEST",
            metadataURI: "ipfs://test"
        });

        vm.prank(creator);
        address poolAddr = factory.createPool(params);

        assertEq(factory.poolCount(), 1);
        assertEq(factory.poolAt(0), poolAddr);

        ForgeBondingCurvePool pool = ForgeBondingCurvePool(payable(poolAddr));
        assertEq(pool.creator(), creator);
        assertEq(pool.graduationMarketCap(), GRADUATION_MARKET_CAP);
        assertEq(pool.tradingFeePercent(), TRADING_FEE_PERCENT);
        assertEq(uint8(pool.state()), uint8(PoolState.Trading));
    }

    function test_CreatePool_WithFee() public {
        factory.setCreationFee(1 ether);

        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Test Token",
            symbol: "TEST",
            metadataURI: ""
        });

        vm.deal(creator, 2 ether);
        uint256 treasuryBefore = treasury.balance;

        vm.prank(creator);
        factory.createPool{value: 1 ether}(params);

        assertEq(treasury.balance, treasuryBefore + 1 ether);
    }

    function test_CreatePool_InsufficientFee_Reverts() public {
        factory.setCreationFee(1 ether);

        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Test Token",
            symbol: "TEST",
            metadataURI: ""
        });

        vm.deal(creator, 0.5 ether);
        vm.prank(creator);
        vm.expectRevert();
        factory.createPool{value: 0.5 ether}(params);
    }

    // ------------------------------
    // Buy Tests
    // ------------------------------

    function test_Buy_Success() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: 1 ether}(0);

        assertGt(tokensOut, 0);
        assertEq(IERC20(address(pool.token())).balanceOf(alice), tokensOut);
        assertGt(pool.tokensSold(), 0);
        assertGt(pool.zilReserve(), 0);
        assertGt(pool.feesCollected(), 0);
    }

    function test_Buy_MultipleBuys_PriceIncreases() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);

        uint256 price1 = pool.currentPrice();

        vm.prank(alice);
        pool.buy{value: 1 ether}(0);

        uint256 price2 = pool.currentPrice();
        assertGt(price2, price1, "price should increase after buy");

        vm.prank(bob);
        pool.buy{value: 1 ether}(0);

        uint256 price3 = pool.currentPrice();
        assertGt(price3, price2, "price should increase after second buy");
    }

    function test_Buy_SlippageProtection() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 1 ether);

        (uint256 expectedTokens,) = pool.quoteBuy(1 ether);

        vm.prank(alice);
        vm.expectRevert(ForgeBondingCurvePool.SlippageExceeded.selector);
        pool.buy{value: 1 ether}(expectedTokens * 2); // Require double the expected
    }

    function test_Buy_ZeroAmount_Reverts() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.prank(alice);
        vm.expectRevert(ForgeBondingCurvePool.ZeroAmount.selector);
        pool.buy{value: 0}(0);
    }

    // ------------------------------
    // Sell Tests
    // ------------------------------

    function test_Sell_Success() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: 1 ether}(0);

        IERC20 token = pool.token();
        uint256 aliceBalBefore = alice.balance;

        vm.startPrank(alice);
        token.approve(address(pool), tokensOut);
        uint256 zilOut = pool.sell(tokensOut, 0);
        vm.stopPrank();

        assertGt(zilOut, 0);
        assertEq(token.balanceOf(alice), 0);
        assertGt(alice.balance, aliceBalBefore);
    }

    function test_Sell_PartialSell() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: 1 ether}(0);

        IERC20 token = pool.token();
        uint256 halfTokens = tokensOut / 2;

        vm.startPrank(alice);
        token.approve(address(pool), halfTokens);
        pool.sell(halfTokens, 0);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), tokensOut - halfTokens);
    }

    function test_Sell_SlippageProtection() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: 1 ether}(0);

        IERC20 token = pool.token();
        (uint256 expectedZil,) = pool.quoteSell(tokensOut);

        vm.startPrank(alice);
        token.approve(address(pool), tokensOut);
        vm.expectRevert(ForgeBondingCurvePool.SlippageExceeded.selector);
        pool.sell(tokensOut, expectedZil * 2); // Require double
        vm.stopPrank();
    }

    function test_Sell_MoreThanSold_Reverts() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: 1 ether}(0);

        IERC20 token = pool.token();

        vm.startPrank(alice);
        token.approve(address(pool), tokensOut * 2);
        vm.expectRevert(ForgeBondingCurvePool.InsufficientTokens.selector);
        pool.sell(tokensOut * 2, 0);
        vm.stopPrank();
    }

    // ------------------------------
    // Graduation Tests
    // ------------------------------

    function test_Graduation_AtMarketCapThreshold() public {
        // Create pool with low (but valid) graduation threshold for testing
        BondingCurveRouterConfig memory config = BondingCurveRouterConfig({
            wrappedNative: address(weth),
            positionManager: address(positionManager)
        });

        ForgeBondingCurveFactory lowCapFactory = new ForgeBondingCurveFactory(
            treasury,
            1 ether, // Minimum valid graduation cap
            TRADING_FEE_PERCENT,
            GRADUATION_FEE_PERCENT,
            DEFAULT_V3_FEE,
            config
        );

        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Graduate Token",
            symbol: "GRAD",
            metadataURI: ""
        });

        vm.prank(creator);
        address poolAddr = lowCapFactory.createPool(params);
        ForgeBondingCurvePool pool = ForgeBondingCurvePool(payable(poolAddr));

        vm.deal(alice, 100 ether);
        vm.prank(alice);
        pool.buy{value: 50 ether}(0);

        assertEq(uint8(pool.state()), uint8(PoolState.Graduated));
        assertGt(pool.lpTokenIdV3(), 0);
    }

    function test_Graduation_TradingStops() public {
        BondingCurveRouterConfig memory config = BondingCurveRouterConfig({
            wrappedNative: address(weth),
            positionManager: address(positionManager)
        });

        ForgeBondingCurveFactory lowCapFactory = new ForgeBondingCurveFactory(
            treasury,
            1 ether, // Minimum valid graduation cap
            TRADING_FEE_PERCENT,
            GRADUATION_FEE_PERCENT,
            DEFAULT_V3_FEE,
            config
        );

        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Graduate Token",
            symbol: "GRAD",
            metadataURI: ""
        });

        vm.prank(creator);
        address poolAddr = lowCapFactory.createPool(params);
        ForgeBondingCurvePool pool = ForgeBondingCurvePool(payable(poolAddr));

        vm.deal(alice, 100 ether);
        vm.prank(alice);
        pool.buy{value: 50 ether}(0);

        // Try to buy after graduation
        vm.deal(bob, 10 ether);
        vm.prank(bob);
        vm.expectRevert(ForgeBondingCurvePool.NotTrading.selector);
        pool.buy{value: 1 ether}(0);

        // Try to sell after graduation
        IERC20 token = pool.token();
        uint256 aliceBalance = token.balanceOf(alice);

        vm.startPrank(alice);
        token.approve(address(pool), aliceBalance);
        vm.expectRevert(ForgeBondingCurvePool.NotTrading.selector);
        pool.sell(aliceBalance, 0);
        vm.stopPrank();
    }

    // ------------------------------
    // Fee Tests
    // ------------------------------

    function test_WithdrawFees_OnlyTreasury() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        pool.buy{value: 1 ether}(0);

        assertGt(pool.feesCollected(), 0);

        vm.prank(alice);
        vm.expectRevert(ForgeBondingCurvePool.OnlyTreasury.selector);
        pool.withdrawFees();

        uint256 treasuryBefore = treasury.balance;
        uint256 fees = pool.feesCollected();

        vm.prank(treasury);
        pool.withdrawFees();

        assertEq(treasury.balance, treasuryBefore + fees);
        assertEq(pool.feesCollected(), 0);
    }

    function test_Graduation_SendsFeeToTreasury() public {
        BondingCurveRouterConfig memory config = BondingCurveRouterConfig({
            wrappedNative: address(weth),
            positionManager: address(positionManager)
        });

        ForgeBondingCurveFactory lowCapFactory = new ForgeBondingCurveFactory(
            treasury,
            1 ether, // Low graduation cap
            TRADING_FEE_PERCENT,
            250, // 2.5% graduation fee
            DEFAULT_V3_FEE,
            config
        );

        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Graduate Token",
            symbol: "GRAD",
            metadataURI: ""
        });

        vm.prank(creator);
        address poolAddr = lowCapFactory.createPool(params);
        ForgeBondingCurvePool pool = ForgeBondingCurvePool(payable(poolAddr));

        assertEq(pool.graduationFeePercent(), 250);

        uint256 treasuryBefore = treasury.balance;

        vm.deal(alice, 100 ether);
        vm.prank(alice);
        pool.buy{value: 50 ether}(0);

        assertEq(uint8(pool.state()), uint8(PoolState.Graduated));

        // Calculate expected fee (2.5% of reserve at graduation)
        // Reserve was zilReserve before graduation
        uint256 treasuryAfter = treasury.balance;
        uint256 treasuryReceived = treasuryAfter - treasuryBefore;

        // Treasury should have received some graduation fee
        assertGt(treasuryReceived, 0, "treasury should receive graduation fee");
    }

    function test_SetGraduationFeePercent_Success() public {
        factory.setGraduationFeePercent(500); // 5%
        assertEq(factory.graduationFeePercent(), 500);
    }

    function test_SetGraduationFeePercent_TooHigh_Reverts() public {
        vm.expectRevert(ForgeBondingCurveFactory.InvalidParam.selector);
        factory.setGraduationFeePercent(1001); // > 10%
    }

    function test_Graduation_ZeroFee_NoTransfer() public {
        BondingCurveRouterConfig memory config = BondingCurveRouterConfig({
            wrappedNative: address(weth),
            positionManager: address(positionManager)
        });

        ForgeBondingCurveFactory zeroFeeFactory = new ForgeBondingCurveFactory(
            treasury,
            1 ether, // Low graduation cap
            TRADING_FEE_PERCENT,
            0, // 0% graduation fee
            DEFAULT_V3_FEE,
            config
        );

        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Graduate Token",
            symbol: "GRAD",
            metadataURI: ""
        });

        vm.prank(creator);
        address poolAddr = zeroFeeFactory.createPool(params);
        ForgeBondingCurvePool pool = ForgeBondingCurvePool(payable(poolAddr));

        assertEq(pool.graduationFeePercent(), 0);

        uint256 treasuryBefore = treasury.balance;

        vm.deal(alice, 100 ether);
        vm.prank(alice);
        pool.buy{value: 50 ether}(0);

        assertEq(uint8(pool.state()), uint8(PoolState.Graduated));

        // Treasury should not have received any graduation fee
        assertEq(treasury.balance, treasuryBefore, "treasury should not receive fee when 0%");
    }

    // ------------------------------
    // View Function Tests
    // ------------------------------

    function test_QuoteBuy_MatchesActual() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);

        (uint256 quotedTokens,) = pool.quoteBuy(1 ether);

        vm.prank(alice);
        uint256 actualTokens = pool.buy{value: 1 ether}(0);

        assertEq(actualTokens, quotedTokens);
    }

    function test_ProgressBps() public {
        ForgeBondingCurvePool pool = _createPool();

        uint256 initialProgress = pool.progressBps();
        // Initial progress is non-zero due to base price creating initial market cap
        assertLt(initialProgress, 10_000, "should not be graduated initially");

        vm.deal(alice, 100 ether);
        vm.prank(alice);
        pool.buy{value: 10 ether}(0);

        uint256 progressAfterBuy = pool.progressBps();
        assertGt(progressAfterBuy, initialProgress, "progress should increase after buy");
        assertLe(progressAfterBuy, 10_000);
    }

    // ------------------------------
    // Validation Tests
    // ------------------------------

    function test_CreatePool_NameTooLong_Reverts() public {
        // 65 characters - exceeds MAX_NAME_LENGTH of 64
        string memory longName = "This is a very long token name that exceeds the maximum allowed!!";

        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: longName,
            symbol: "TEST",
            metadataURI: ""
        });

        vm.prank(creator);
        vm.expectRevert(ForgeBondingCurveFactory.NameTooLong.selector);
        factory.createPool(params);
    }

    function test_CreatePool_SymbolTooLong_Reverts() public {
        // 13 characters - exceeds MAX_SYMBOL_LENGTH of 12
        string memory longSymbol = "VERYLONGSYMBL";

        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Test Token",
            symbol: longSymbol,
            metadataURI: ""
        });

        vm.prank(creator);
        vm.expectRevert(ForgeBondingCurveFactory.SymbolTooLong.selector);
        factory.createPool(params);
    }

    function test_CreatePool_EmptyName_Reverts() public {
        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "",
            symbol: "TEST",
            metadataURI: ""
        });

        vm.prank(creator);
        vm.expectRevert(ForgeBondingCurveFactory.InvalidParam.selector);
        factory.createPool(params);
    }

    function test_CreatePool_EmptySymbol_Reverts() public {
        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Test Token",
            symbol: "",
            metadataURI: ""
        });

        vm.prank(creator);
        vm.expectRevert(ForgeBondingCurveFactory.InvalidParam.selector);
        factory.createPool(params);
    }

    function test_SetGraduationMarketCap_TooLow_Reverts() public {
        vm.expectRevert(ForgeBondingCurveFactory.GraduationCapTooLow.selector);
        factory.setGraduationMarketCap(0.5 ether); // Below MIN_GRADUATION_MARKET_CAP
    }

    function test_SetGraduationMarketCap_Success() public {
        uint256 newCap = 50 ether;
        factory.setGraduationMarketCap(newCap);
        assertEq(factory.graduationMarketCap(), newCap);
    }

    function test_Factory_ZeroGraduationCap_Reverts() public {
        BondingCurveRouterConfig memory config = BondingCurveRouterConfig({
            wrappedNative: address(weth),
            positionManager: address(positionManager)
        });

        vm.expectRevert(ForgeBondingCurveFactory.GraduationCapTooLow.selector);
        new ForgeBondingCurveFactory(
            treasury,
            0, // Zero graduation cap should revert
            TRADING_FEE_PERCENT,
            GRADUATION_FEE_PERCENT,
            DEFAULT_V3_FEE,
            config
        );
    }

    // ------------------------------
    // LP Auto-Burn Tests
    // ------------------------------

    function test_Graduation_AutoBurnsLp() public {
        ForgeBondingCurvePool pool = _createGraduatedPool();

        uint256 lpTokenId = pool.lpTokenIdV3();
        assertGt(lpTokenId, 0, "should have LP token ID");

        // Verify LP was automatically transferred to dead address during graduation
        (,,,,,address owner) = positionManager.positions(lpTokenId);
        assertEq(owner, address(0x000000000000000000000000000000000000dEaD), "LP should be burned");
    }

    // ------------------------------
    // Security Tests
    // ------------------------------

    function test_Buy_BelowMinimum_Reverts() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(ForgeBondingCurvePool.BelowMinimum.selector);
        pool.buy{value: 0.0001 ether}(0); // Below MIN_BUY_AMOUNT of 0.001 ether
    }

    function test_Sell_BelowMinimum_Reverts() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        pool.buy{value: 1 ether}(0);

        IERC20 token = pool.token();
        uint256 tinyAmount = 1e14; // Below MIN_SELL_TOKENS of 1e15

        vm.startPrank(alice);
        token.approve(address(pool), tinyAmount);
        vm.expectRevert(ForgeBondingCurvePool.BelowMinimum.selector);
        pool.sell(tinyAmount, 0);
        vm.stopPrank();
    }

    function test_SecurityConstants_Exist() public {
        ForgeBondingCurvePool pool = _createPool();

        assertEq(pool.MIN_BUY_AMOUNT(), 0.001 ether);
        assertEq(pool.MIN_SELL_TOKENS(), 1e15);
        assertEq(pool.MIN_GRADUATION_LIQUIDITY(), 0.1 ether);
    }

    // ------------------------------
    // Receive Tests
    // ------------------------------

    function test_DirectEthTransfer_Reverts() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(ForgeBondingCurvePool.TransferFailed.selector);
        payable(address(pool)).transfer(1 ether);
    }

    // ------------------------------
    // Edge Case Tests
    // ------------------------------

    function test_BuySell_Symmetry() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 100 ether);

        // Buy some tokens
        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: 10 ether}(0);

        uint256 zilReserveAfterBuy = pool.zilReserve();
        uint256 aliceZilAfterBuy = alice.balance;

        // Sell all tokens back
        IERC20 token = pool.token();
        vm.startPrank(alice);
        token.approve(address(pool), tokensOut);
        uint256 zilBack = pool.sell(tokensOut, 0);
        vm.stopPrank();

        // Due to fees, alice should have less ZIL than she started with
        assertLt(aliceZilAfterBuy + zilBack, 100 ether, "should lose some to fees");

        // Pool reserve should be reduced
        assertLt(pool.zilReserve(), zilReserveAfterBuy, "reserve should decrease after sell");

        // tokensSold should be back to 0
        assertEq(pool.tokensSold(), 0, "tokens sold should be 0 after full sell");
    }

    function test_MultipleBuyersSell() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        // Alice buys first (cheaper price)
        vm.prank(alice);
        uint256 aliceTokens = pool.buy{value: 5 ether}(0);

        // Bob buys second (higher price)
        vm.prank(bob);
        uint256 bobTokens = pool.buy{value: 5 ether}(0);

        // Alice should have gotten more tokens for same ZIL (she bought earlier)
        assertGt(aliceTokens, bobTokens, "earlier buyer should get more tokens");

        // Bob sells first
        IERC20 token = pool.token();
        vm.startPrank(bob);
        token.approve(address(pool), bobTokens);
        uint256 bobZilBack = pool.sell(bobTokens, 0);
        vm.stopPrank();

        // Alice sells second (lower price now)
        vm.startPrank(alice);
        token.approve(address(pool), aliceTokens);
        uint256 aliceZilBack = pool.sell(aliceTokens, 0);
        vm.stopPrank();

        // Bob should get more ZIL back per token (sold at higher price point)
        // But alice has more tokens so total might be higher
        assertGt(aliceZilBack + bobZilBack, 0, "should get some ZIL back");
    }

    function test_SmallBuy() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 1 ether);

        // Very small buy
        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: 0.001 ether}(0);

        assertGt(tokensOut, 0, "should get some tokens for small buy");
    }

    function test_LargeBuy_CapsAtAvailable() public {
        ForgeBondingCurvePool pool = _createPool();

        uint256 tokensForCurve = pool.TOKENS_FOR_CURVE();

        vm.deal(alice, 10000 ether);

        // Buy with huge amount - should cap at available tokens
        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: 10000 ether}(0);

        assertLe(tokensOut, tokensForCurve, "should not exceed tokens for curve");
    }

    function test_QuoteSell_ReturnsZeroForExcessiveAmount() public {
        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: 1 ether}(0);

        // Try to quote selling more than was sold
        (uint256 zilOut, uint256 fee) = pool.quoteSell(tokensOut * 2);
        assertEq(zilOut, 0);
        assertEq(fee, 0);
    }

    // ------------------------------
    // Fuzz Tests
    // ------------------------------

    function testFuzz_BuyQuoteMatchesActual(uint96 buyAmount) public {
        vm.assume(buyAmount >= 0.001 ether && buyAmount <= 100 ether);

        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, uint256(buyAmount) + 1 ether);

        (uint256 quotedTokens,) = pool.quoteBuy(buyAmount);

        vm.prank(alice);
        uint256 actualTokens = pool.buy{value: buyAmount}(0);

        assertEq(actualTokens, quotedTokens, "quote should match actual");
    }

    function testFuzz_SellQuoteMatchesActual(uint96 buyAmount) public {
        vm.assume(buyAmount >= 0.01 ether && buyAmount <= 50 ether);

        ForgeBondingCurvePool pool = _createPool();

        vm.deal(alice, uint256(buyAmount) + 1 ether);

        vm.prank(alice);
        uint256 tokensOut = pool.buy{value: buyAmount}(0);

        (uint256 quotedZil,) = pool.quoteSell(tokensOut);

        IERC20 token = pool.token();
        vm.startPrank(alice);
        token.approve(address(pool), tokensOut);
        uint256 actualZil = pool.sell(tokensOut, 0);
        vm.stopPrank();

        assertEq(actualZil, quotedZil, "quote should match actual");
    }

    // ------------------------------
    // Helpers
    // ------------------------------

    function _createPool() internal returns (ForgeBondingCurvePool) {
        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Test Token",
            symbol: "TEST",
            metadataURI: ""
        });

        vm.prank(creator);
        address poolAddr = factory.createPool(params);
        return ForgeBondingCurvePool(payable(poolAddr));
    }

    function _createGraduatedPool() internal returns (ForgeBondingCurvePool) {
        BondingCurveRouterConfig memory config = BondingCurveRouterConfig({
            wrappedNative: address(weth),
            positionManager: address(positionManager)
        });

        ForgeBondingCurveFactory lowCapFactory = new ForgeBondingCurveFactory(
            treasury,
            1 ether, // Low graduation cap
            TRADING_FEE_PERCENT,
            GRADUATION_FEE_PERCENT,
            DEFAULT_V3_FEE,
            config
        );

        BondingCurveCreateParams memory params = BondingCurveCreateParams({
            name: "Graduate Token",
            symbol: "GRAD",
            metadataURI: ""
        });

        vm.prank(creator);
        address poolAddr = lowCapFactory.createPool(params);
        ForgeBondingCurvePool pool = ForgeBondingCurvePool(payable(poolAddr));

        vm.deal(alice, 100 ether);
        vm.prank(alice);
        pool.buy{value: 50 ether}(0);

        require(pool.state() == PoolState.Graduated, "pool should be graduated");
        return pool;
    }
}
