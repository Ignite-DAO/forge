// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeFairLaunchFactory} from "src/fairlaunch/ForgeFairLaunchFactory.sol";

/// @notice Helper to update the treasury/fee recipient for the fair-launch factory.
contract FairLaunchSetTreasuryScript is Script {
    // Usage option 1 (env):
    // FAIRLAUNCH_FACTORY_ADDRESS=0x... FAIRLAUNCH_TREASURY=0x... forge script script/FairLaunchSetTreasury.s.sol \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run() external {
        address factoryAddr = vm.envAddress("FAIRLAUNCH_FACTORY_ADDRESS");
        address treasury = vm.envAddress("FAIRLAUNCH_TREASURY");

        vm.startBroadcast();
        ForgeFairLaunchFactory(factoryAddr).setTreasury(treasury);
        vm.stopBroadcast();

        console2.log("Fair launch treasury set to:", treasury);
    }

    // Usage option 2 (sig):
    // forge script script/FairLaunchSetTreasury.s.sol --sig "run(address,address)" 0xFactory 0xTreasury \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run(address factoryAddr, address treasury) external {
        vm.startBroadcast();
        ForgeFairLaunchFactory(factoryAddr).setTreasury(treasury);
        vm.stopBroadcast();
        console2.log("Fair launch treasury set to:", treasury);
    }
}
