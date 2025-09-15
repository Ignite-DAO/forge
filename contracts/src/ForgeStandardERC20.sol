// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// @title ForgeStandardERC20
/// @notice OpenZeppelin-based fixed-supply ERC20 with configurable decimals.
contract ForgeStandardERC20 is ERC20 {
    uint8 private immutable _customDecimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        address initialOwner
    ) ERC20(name_, symbol_) {
        require(initialOwner != address(0), "initialOwner = zero");
        _customDecimals = decimals_;
        _mint(initialOwner, totalSupply_);
    }

    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }
}

