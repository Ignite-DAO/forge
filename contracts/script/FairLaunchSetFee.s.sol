// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeFairLaunchFactory} from "src/fairlaunch/ForgeFairLaunchFactory.sol";

/// @notice Helper to update the flat ZIL fee on the fair-launch factory.
contract FairLaunchSetFeeScript is Script {
    // Usage option 1 (env):
    // FAIRLAUNCH_FACTORY_ADDRESS=0x... FAIRLAUNCH_FEE_WEI=1e18 forge script script/FairLaunchSetFee.s.sol \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run() external {
        address factoryAddr = vm.envAddress("FAIRLAUNCH_FACTORY_ADDRESS");
        uint feeWei = vm.envUint("FAIRLAUNCH_FEE_WEI");

        vm.startBroadcast();
        ForgeFairLaunchFactory(factoryAddr).setCreationFee(feeWei);
        vm.stopBroadcast();

        console2.log("Fair launch creation fee set to:", feeWei);
    }

    // Usage option 2 (sig):
    // forge script script/FairLaunchSetFee.s.sol --sig "run(address,uint256)" 0xFactory <feeWei> \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run(address factoryAddr, uint feeWei) external {
        vm.startBroadcast();
        ForgeFairLaunchFactory(factoryAddr).setCreationFee(feeWei);
        vm.stopBroadcast();
        console2.log("Fair launch creation fee set to:", feeWei);
    }
}
