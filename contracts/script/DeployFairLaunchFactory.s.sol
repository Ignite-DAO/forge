// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeFairLaunchFactory} from "src/fairlaunch/ForgeFairLaunchFactory.sol";
import {FairLaunchRouterConfig} from "src/fairlaunch/FairLaunchTypes.sol";

/// @notice Deploy helper for ForgeFairLaunchFactory.
/// Usage:
/// TREASURY_ADDRESS=0x... USDC_ADDRESS=0x...
/// PLUNDER_ROUTER_V2=0x... PLUNDER_FACTORY_V2=0x... WRAPPED_NATIVE=0x...
/// PLUNDER_V3_FACTORY=0x... PLUNDER_V3_POOL_DEPLOYER=0x...
/// PLUNDER_V3_MIGRATOR=0x... PLUNDER_V3_NFPM=0x...
/// forge script script/DeployFairLaunchFactory.s.sol --rpc-url $RPC --private-key $PK --broadcast
contract DeployFairLaunchFactoryScript is Script {
    function run() external {
        address treasury = vm.envOr("TREASURY_ADDRESS", vm.addr(0x1234)); // override via env for production
        address usdc = vm.envOr("USDC_ADDRESS", address(0xD8b73cEd1B16C047048f2c5EA42233DA33168198));

        address routerV2 =
            vm.envOr("PLUNDER_ROUTER_V2", address(0x33C6a20D2a605da9Fd1F506ddEd449355f0564fe));
        address factoryV2 =
            vm.envOr("PLUNDER_FACTORY_V2", address(0xf42d1058f233329185A36B04B7f96105afa1adD2));
        address wrappedNative =
            vm.envOr("WRAPPED_NATIVE", address(0x0000000000000000000000000000000000000000)); // replace with WZIL
        address v3Factory =
            vm.envOr("PLUNDER_V3_FACTORY", address(0x000A3ED861B2cC98Cc5f1C0Eb4d1B53904c0c93a));
        address v3PoolDeployer =
            vm.envOr("PLUNDER_V3_POOL_DEPLOYER", address(0x667f17594AA1fBd4d70e5914EDF9e8ad818e4Ef3));
        address v3Migrator =
            vm.envOr("PLUNDER_V3_MIGRATOR", address(0xb72048adc590b926fA79fB3e54AAf33a39317A23));
        address v3NFT =
            vm.envOr("PLUNDER_V3_NFPM", address(0x17678B52997B89b179c0a471bF8d266A4A4c6AC5));

        FairLaunchRouterConfig memory config = FairLaunchRouterConfig({
            routerV2: routerV2,
            factoryV2: factoryV2,
            wrappedNative: wrappedNative,
            v3Factory: v3Factory,
            v3PoolDeployer: v3PoolDeployer,
            v3Migrator: v3Migrator,
            positionManager: v3NFT
        });

        vm.startBroadcast();
        ForgeFairLaunchFactory factory = new ForgeFairLaunchFactory(treasury, usdc, config);
        vm.stopBroadcast();

        console2.log("FairLaunchFactory deployed at:", address(factory));
    }
}
