// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForgeTokenFactory} from "src/ForgeTokenFactory.sol";
import {ForgeAirdropper} from "src/ForgeAirdropper.sol";
import {ForgeStandardERC20} from "src/ForgeStandardERC20.sol";

contract ForgeAirdropperTest is Test {
    ForgeTokenFactory factory;
    ForgeAirdropper airdropper;
    address treasury = vm.addr(0x7777);

    address sender = vm.addr(0xAAA1);
    address r1 = vm.addr(0xBB01);
    address r2 = vm.addr(0xBB02);
    address r3 = vm.addr(0xBB03);

    // Allow this test contract to receive ETH from withdraw
    receive() external payable {}

    function setUp() public {
        factory = new ForgeTokenFactory();
        airdropper = new ForgeAirdropper();
    }

    function _deployTokenToSender(uint8 decimals_, uint256 supply_) internal returns (ForgeStandardERC20) {
        vm.prank(sender);
        address tokenAddr = factory.createToken("Drop", "DRP", decimals_, supply_);
        return ForgeStandardERC20(tokenAddr);
    }

    function test_Airdrop_LengthMismatch_Reverts() public {
        address[] memory recipients = new address[](2);
        recipients[0] = r1;
        recipients[1] = r2;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        vm.expectRevert(ForgeAirdropper.LengthMismatch.selector);
        airdropper.airdrop(address(0x1), recipients, amounts);
    }

    function test_Airdrop_Succeeds_With_Allowance() public {
        uint8 decimals = 18;
        uint256 supply = 1_000 ether;
        ForgeStandardERC20 token = _deployTokenToSender(decimals, supply);

        address[] memory recipients = new address[](3);
        recipients[0] = r1;
        recipients[1] = r2;
        recipients[2] = r3;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 10 ether;
        amounts[1] = 20 ether;
        amounts[2] = 30 ether;

        uint256 total = amounts[0] + amounts[1] + amounts[2];

        // approve and airdrop from sender
        vm.startPrank(sender);
        token.approve(address(airdropper), total);
        airdropper.airdrop(address(token), recipients, amounts);
        vm.stopPrank();

        assertEq(token.balanceOf(r1), amounts[0]);
        assertEq(token.balanceOf(r2), amounts[1]);
        assertEq(token.balanceOf(r3), amounts[2]);
        assertEq(token.balanceOf(sender), supply - total);
    }

    function test_AirdropEqual_Succeeds() public {
        ForgeStandardERC20 token = _deployTokenToSender(18, 1_000 ether);
        address[] memory recipients = new address[](2);
        recipients[0] = r1;
        recipients[1] = r2;
        uint256 each = 15 ether;
        uint256 total = each * recipients.length;

        vm.startPrank(sender);
        token.approve(address(airdropper), total);
        airdropper.airdropEqual(address(token), recipients, each);
        vm.stopPrank();

        assertEq(token.balanceOf(r1), each);
        assertEq(token.balanceOf(r2), each);
    }

    function test_Airdrop_InsufficientAllowance_Reverts() public {
        ForgeStandardERC20 token = _deployTokenToSender(18, 100 ether);
        address[] memory recipients = new address[](1);
        recipients[0] = r1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 50 ether;

        vm.startPrank(sender);
        // approve less than needed
        token.approve(address(airdropper), 10 ether);
        vm.expectRevert(); // SafeERC20 will bubble up token's revert
        airdropper.airdrop(address(token), recipients, amounts);
        vm.stopPrank();
    }

    function test_Airdrop_Fee_Insufficient_Reverts() public {
        // set fee to 1 ether
        airdropper.setFee(1 ether);

        ForgeStandardERC20 token = _deployTokenToSender(18, 100 ether);

        address[] memory recipients = new address[](1);
        recipients[0] = r1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;

        vm.startPrank(sender);
        token.approve(address(airdropper), 10 ether);
        vm.deal(sender, 0.5 ether);
        vm.expectRevert(abi.encodeWithSelector(ForgeAirdropper.InsufficientFee.selector, 1 ether, 0.5 ether));
        airdropper.airdrop{value: 0.5 ether}(address(token), recipients, amounts);
        vm.stopPrank();
    }

    function test_Airdrop_Fee_Forwarded_And_Refunded() public {
        // set fee and treasury
        airdropper.setFee(1 ether);
        airdropper.setTreasury(treasury);

        ForgeStandardERC20 token = _deployTokenToSender(18, 100 ether);

        address[] memory recipients = new address[](1);
        recipients[0] = r1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10 ether;

        vm.deal(sender, 2 ether);
        uint256 senderBalBefore = sender.balance;
        uint256 treasuryBalBefore = treasury.balance;

        vm.startPrank(sender);
        token.approve(address(airdropper), 10 ether);
        airdropper.airdrop{value: 2 ether}(address(token), recipients, amounts);
        vm.stopPrank();

        // fee forwarded
        assertEq(treasury.balance, treasuryBalBefore + 1 ether);
        // only fee deducted from sender (excess refunded)
        assertEq(sender.balance, senderBalBefore - 1 ether);
    }

    function test_Airdrop_Withdraw_Sweeps_When_Treasury_Zero() public {
        // set fee > 0 and treasury to zero so fees accumulate in contract
        airdropper.setFee(0.25 ether);
        airdropper.setTreasury(address(0));

        ForgeStandardERC20 token = _deployTokenToSender(18, 100 ether);
        address[] memory recipients = new address[](1);
        recipients[0] = r1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether;

        vm.deal(sender, 1 ether);
        vm.startPrank(sender);
        token.approve(address(airdropper), 1 ether);
        airdropper.airdrop{value: 0.25 ether}(address(token), recipients, amounts);
        vm.stopPrank();

        // contract holds fee
        assertEq(address(airdropper).balance, 0.25 ether);

        // owner is this test contract; withdraw should sweep
        uint256 beforeBal = address(this).balance;
        airdropper.withdraw();
        assertEq(address(airdropper).balance, 0);
        assertEq(address(this).balance, beforeBal + 0.25 ether);
    }
}
