// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeTokenFactory} from "src/ForgeTokenFactory.sol";

contract SetFeeScript is Script {
    // Usage option 1 (env):
    // FACTORY_ADDRESS=0x... FEE_WEI=1000000000000000000 forge script script/SetFee.s.sol \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run() external {
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        uint256 feeWei = vm.envUint("FEE_WEI");

        vm.startBroadcast();
        ForgeTokenFactory(factoryAddr).setFee(feeWei);
        vm.stopBroadcast();

        console2.log("Fee set to:", feeWei);
    }

    // Usage option 2 (sig):
    // forge script script/SetFee.s.sol --sig "run(address,uint256)" 0xFactory <fee> \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run(address factoryAddr, uint256 feeWei) external {
        vm.startBroadcast();
        ForgeTokenFactory(factoryAddr).setFee(feeWei);
        vm.stopBroadcast();
        console2.log("Fee set to:", feeWei);
    }
}

