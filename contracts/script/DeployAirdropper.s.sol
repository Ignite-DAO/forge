// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeAirdropper} from "src/ForgeAirdropper.sol";

contract DeployAirdropperScript is Script {
    function run() external returns (ForgeAirdropper airdropper) {
        vm.startBroadcast();
        airdropper = new ForgeAirdropper();
        vm.stopBroadcast();

        console2.log("ForgeAirdropper deployed at:", address(airdropper));
    }
}

