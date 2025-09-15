// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeTokenFactory} from "src/ForgeTokenFactory.sol";

contract SetTreasuryScript is Script {
    // Usage option 1 (env):
    // FACTORY_ADDRESS=0x... TREASURY_ADDRESS=0x... forge script script/SetTreasury.s.sol \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run() external {
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        address treasuryAddr = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();
        ForgeTokenFactory(factoryAddr).setTreasury(treasuryAddr);
        vm.stopBroadcast();

        console2.log("Treasury set to:", treasuryAddr);
    }

    // Usage option 2 (sig):
    // forge script script/SetTreasury.s.sol --sig "run(address,address)" 0xFactory 0xTreasury \
    //   --rpc-url $RPC --private-key $PK --broadcast
    function run(address factoryAddr, address treasuryAddr) external {
        vm.startBroadcast();
        ForgeTokenFactory(factoryAddr).setTreasury(treasuryAddr);
        vm.stopBroadcast();
        console2.log("Treasury set to:", treasuryAddr);
    }
}

