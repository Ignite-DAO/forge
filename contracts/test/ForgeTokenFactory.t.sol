// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForgeTokenFactory} from "src/ForgeTokenFactory.sol";
import {ForgeStandardERC20} from "src/ForgeStandardERC20.sol";

contract ForgeTokenFactoryTest is Test {
    ForgeTokenFactory factory;

    address creator = vm.addr(0xA11CE);
    address treasury = vm.addr(0xBEEF);

    // Allow this test contract to receive ETH during fee forwarding/withdraw tests
    receive() external payable {}

    function setUp() public {
        factory = new ForgeTokenFactory();
    }

    function test_CreateToken_DefaultDecimals_MintsToCreator() public {
        uint256 supply = 1_000_000 ether;
        vm.prank(creator);
        address tokenAddr = factory.createToken("Forge", "FRG", supply);

        ForgeStandardERC20 token = ForgeStandardERC20(tokenAddr);
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), supply);
        assertEq(token.balanceOf(creator), supply);
    }

    function test_CreateToken_CustomDecimals() public {
        uint256 supply = 1_000_000e6; // with 6 decimals
        vm.prank(creator);
        address tokenAddr = factory.createToken("Forge6", "F6", uint8(6), supply);

        ForgeStandardERC20 token = ForgeStandardERC20(tokenAddr);
        assertEq(token.decimals(), 6);
        assertEq(token.totalSupply(), supply);
        assertEq(token.balanceOf(creator), supply);
    }

    function test_Fee_Insufficient_Reverts() public {
        // set fee
        factory.setFee(1 ether);
        // call with less value
        vm.deal(creator, 0.5 ether);
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(ForgeTokenFactory.InsufficientFee.selector, 1 ether, 0.5 ether));
        factory.createToken{value: 0.5 ether}("Forge", "FRG", 18, 1 ether);
    }

    function test_Fee_Forwarded_And_Refunded() public {
        // set fee and treasury
        factory.setFee(1 ether);
        factory.setTreasury(treasury);

        vm.deal(creator, 2 ether);
        uint256 creatorBalBefore = creator.balance;
        uint256 treasuryBalBefore = treasury.balance;

        vm.prank(creator);
        factory.createToken{value: 2 ether}("Forge", "FRG", 18, 100);

        // fee forwarded
        assertEq(treasury.balance, treasuryBalBefore + 1 ether);
        // excess refunded
        assertEq(creator.balance, creatorBalBefore - 1 ether); // paid only the fee
    }

    function test_Withdraw_Sweeps_Balance_To_Owner() public {
        // Set treasury to zero so fee remains in the contract
        factory.setTreasury(address(0));
        factory.setFee(0.25 ether);

        // Send exact fee; since treasury is zero, it stays inside factory
        vm.deal(creator, 1 ether);
        vm.prank(creator);
        factory.createToken{value: 0.25 ether}("Forge", "FRG", 18, 100);

        // Balance should remain in factory
        assertEq(address(factory).balance, 0.25 ether);

        // Owner is this test contract; withdraw should send funds here
        uint256 beforeBal = address(this).balance;
        factory.withdraw();
        assertEq(address(factory).balance, 0);
        assertEq(address(this).balance, beforeBal + 0.25 ether);
    }

    function test_InputValidation() public {
        vm.prank(creator);
        vm.expectRevert(bytes("decimals > 18"));
        factory.createToken("Forge", "FRG", 19, 100);

        vm.prank(creator);
        vm.expectRevert(bytes("supply = 0"));
        factory.createToken("Forge", "FRG", 18, 0);
    }
}
