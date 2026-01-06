// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeBondingCurveFactory} from "src/bondingcurve/ForgeBondingCurveFactory.sol";
import {BondingCurveRouterConfig} from "src/bondingcurve/BondingCurveTypes.sol";

/// @notice Deploy helper for ForgeBondingCurveFactory.
/// Usage:
/// TREASURY_ADDRESS=0x... WRAPPED_NATIVE=0x... PLUNDER_V3_NFPM=0x...
/// GRADUATION_MARKET_CAP=4200000000000000000000000 TRADING_FEE_PERCENT=100 DEFAULT_V3_FEE=10000
/// forge script script/DeployBondingCurveFactory.s.sol --rpc-url $RPC --private-key $PK --broadcast
contract DeployBondingCurveFactoryScript is Script {
    function run() external {
        address treasury = vm.envOr("TREASURY_ADDRESS", vm.addr(0x1234));
        address wrappedNative = vm.envOr("WRAPPED_NATIVE", address(0));
        address positionManager =
            vm.envOr("PLUNDER_V3_NFPM", address(0x17678B52997B89b179c0a471bF8d266A4A4c6AC5));

        // Default graduation at ~4.2M ZIL (~$84k at $0.02/ZIL)
        uint256 graduationMarketCap =
            vm.envOr("GRADUATION_MARKET_CAP", uint256(4_200_000 ether));

        // Default 1% trading fee
        uint256 tradingFeePercent = vm.envOr("TRADING_FEE_PERCENT", uint256(100));

        // Default 1% V3 pool fee tier
        uint24 defaultV3Fee = uint24(vm.envOr("DEFAULT_V3_FEE", uint256(10000)));

        require(wrappedNative != address(0), "WRAPPED_NATIVE required");

        BondingCurveRouterConfig memory config = BondingCurveRouterConfig({
            wrappedNative: wrappedNative,
            positionManager: positionManager
        });

        vm.startBroadcast();
        ForgeBondingCurveFactory factory = new ForgeBondingCurveFactory(
            treasury,
            graduationMarketCap,
            tradingFeePercent,
            defaultV3Fee,
            config
        );
        vm.stopBroadcast();

        console2.log("BondingCurveFactory deployed at:", address(factory));
        console2.log("Treasury:", treasury);
        console2.log("Graduation Market Cap:", graduationMarketCap);
        console2.log("Trading Fee Percent:", tradingFeePercent);
        console2.log("Default V3 Fee:", defaultV3Fee);
    }
}
