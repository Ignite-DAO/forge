// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeAirdropper} from "src/ForgeAirdropper.sol";

contract AirdropperSetTreasuryScript is Script {
    // Usage (env):
    // AIRDROPPER_ADDRESS=0x... TREASURY_ADDRESS=0x... forge script script/AirdropperSetTreasury.s.sol \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run() external {
        address airdropperAddr = vm.envAddress("AIRDROPPER_ADDRESS");
        address treasuryAddr = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();
        ForgeAirdropper(airdropperAddr).setTreasury(treasuryAddr);
        vm.stopBroadcast();

        console2.log("Airdropper treasury set to:", treasuryAddr);
    }

    // Usage (sig):
    // forge script script/AirdropperSetTreasury.s.sol --sig "run(address,address)" 0xAirdropper 0xTreasury \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run(address airdropperAddr, address treasuryAddr) external {
        vm.startBroadcast();
        ForgeAirdropper(airdropperAddr).setTreasury(treasuryAddr);
        vm.stopBroadcast();
        console2.log("Airdropper treasury set to:", treasuryAddr);
    }
}

