// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeAirdropper} from "src/ForgeAirdropper.sol";

contract AirdropperSetFeeScript is Script {
    // Usage (env):
    // AIRDROPPER_ADDRESS=0x... FEE_WEI=1000000000000000000 forge script script/AirdropperSetFee.s.sol \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run() external {
        address airdropperAddr = vm.envAddress("AIRDROPPER_ADDRESS");
        uint256 feeWei = vm.envUint("FEE_WEI");

        vm.startBroadcast();
        ForgeAirdropper(airdropperAddr).setFee(feeWei);
        vm.stopBroadcast();

        console2.log("Airdropper fee set to:", feeWei);
    }

    // Usage (sig):
    // forge script script/AirdropperSetFee.s.sol --sig "run(address,uint256)" 0xAirdropper <feeWei> \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run(address airdropperAddr, uint256 feeWei) external {
        vm.startBroadcast();
        ForgeAirdropper(airdropperAddr).setFee(feeWei);
        vm.stopBroadcast();
        console2.log("Airdropper fee set to:", feeWei);
    }
}

