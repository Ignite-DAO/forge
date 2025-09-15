// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ForgeTokenFactory} from "src/ForgeTokenFactory.sol";

contract DeployFactoryScript is Script {
    function run() external returns (ForgeTokenFactory factory) {
        vm.startBroadcast();
        factory = new ForgeTokenFactory();
        vm.stopBroadcast();

        console2.log("ForgeTokenFactory deployed at:", address(factory));
    }
}

