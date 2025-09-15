// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";

import {ForgeStandardERC20} from "./ForgeStandardERC20.sol";

/// @title Token Factory (optional flat fee)
/// @notice Deploys fixed-supply ERC20 tokens and forwards optional fee to treasury.
contract ForgeTokenFactory is Ownable2Step, ReentrancyGuard {
    using Address for address payable;

    error InsufficientFee(uint256 required, uint256 provided);

    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint8 decimals,
        uint256 supply
    );
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    uint256 public fee; // flat fee in native token (wei)
    address public treasury; // recipient of fees

    constructor() Ownable(msg.sender) {
        fee = 0;
        treasury = owner(); // default to owner
    }

    function setFee(uint256 newFee) external onlyOwner {
        emit FeeUpdated(fee, newFee);
        fee = newFee;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Deploy a fixed‑supply ERC20 and mint full supply to the creator.
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param decimals Token decimals (0–18 typical)
    /// @param supply Total supply (raw units, not adjusted by decimals)
    function createToken(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 supply
    ) external payable nonReentrant returns (address token) {
        token = _createToken(name, symbol, decimals, supply);
    }

    /// @notice Convenience overload: defaults to 18 decimals.
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 supply
    ) external payable nonReentrant returns (address token) {
        token = _createToken(name, symbol, 18, supply);
    }

    function _createToken(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 supply
    ) internal returns (address token) {
        if (fee > 0 && msg.value < fee) revert InsufficientFee(fee, msg.value);
        require(decimals <= 18, "decimals > 18");
        require(supply > 0, "supply = 0");

        token = address(new ForgeStandardERC20(name, symbol, decimals, supply, msg.sender));
        emit TokenCreated(token, msg.sender, name, symbol, decimals, supply);

        if (fee > 0) {
            if (treasury != address(0)) {
                payable(treasury).sendValue(fee); // reverts on failure
            }
            uint256 refund = msg.value - fee;
            if (refund > 0) {
                payable(msg.sender).sendValue(refund);
            }
        }
    }

    /// @notice Sweep any stuck native currency to the owner.
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal > 0) {
            payable(owner()).sendValue(bal);
        }
    }
}
