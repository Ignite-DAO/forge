// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";

/// @title ERC20 Airdropper
/// @notice Batch transfers ERC20 tokens from the caller to multiple recipients using allowance.
contract ForgeAirdropper is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address payable;

    error LengthMismatch();
    error InsufficientFee(uint256 required, uint256 provided);

    event Airdropped(
        address indexed token,
        address indexed sender,
        uint256 count,
        uint256 total
    );
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    uint256 public fee; // flat fee in native token (wei)
    address public treasury; // fee recipient

    constructor() Ownable(msg.sender) {
        fee = 0;
        treasury = owner();
    }

    function setFee(uint256 newFee) external onlyOwner {
        emit FeeUpdated(fee, newFee);
        fee = newFee;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Airdrop variable amounts to multiple recipients.
    /// @dev Caller must approve this contract for at least the total sum beforehand.
    function airdrop(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable nonReentrant {
        uint256 n = recipients.length;
        if (n != amounts.length) revert LengthMismatch();

        if (fee > 0 && msg.value < fee) revert InsufficientFee(fee, msg.value);
        IERC20 t = IERC20(token);
        uint256 total;

        for (uint256 i = 0; i < n; i++) {
            total += amounts[i];
            t.safeTransferFrom(msg.sender, recipients[i], amounts[i]);
        }

        // Handle fee forwarding and excess refund after transfers
        if (fee > 0) {
            if (treasury != address(0)) {
                payable(treasury).sendValue(fee);
            }
            uint256 refund = msg.value - fee;
            if (refund > 0) {
                payable(msg.sender).sendValue(refund);
            }
        }

        emit Airdropped(token, msg.sender, n, total);
    }

    /// @notice Airdrop the same amount to each recipient.
    /// @dev Convenience overload to avoid building an amounts array client-side.
    function airdropEqual(
        address token,
        address[] calldata recipients,
        uint256 amountEach
    ) external payable nonReentrant {
        if (fee > 0 && msg.value < fee) revert InsufficientFee(fee, msg.value);
        IERC20 t = IERC20(token);
        uint256 n = recipients.length;
        uint256 total = amountEach * n;

        for (uint256 i = 0; i < n; i++) {
            t.safeTransferFrom(msg.sender, recipients[i], amountEach);
        }

        if (fee > 0) {
            if (treasury != address(0)) {
                payable(treasury).sendValue(fee);
            }
            uint256 refund = msg.value - fee;
            if (refund > 0) {
                payable(msg.sender).sendValue(refund);
            }
        }

        emit Airdropped(token, msg.sender, n, total);
    }

    /// @notice Sweep any stuck native currency to the owner.
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal > 0) {
            payable(owner()).sendValue(bal);
        }
    }
}
