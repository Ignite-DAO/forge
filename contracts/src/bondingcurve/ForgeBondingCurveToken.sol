// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ForgeStandardERC20} from "../ForgeStandardERC20.sol";

/// @title ForgeBondingCurveToken
/// @notice ERC20 that locks transfers until the bonding curve graduates.
contract ForgeBondingCurveToken is ForgeStandardERC20 {
    error TradingNotEnabled();
    error OnlyPool();

    address public immutable pool;
    bool public tradingEnabled;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        address pool_
    ) ForgeStandardERC20(name_, symbol_, decimals_, totalSupply_, pool_) {
        if (pool_ == address(0)) revert OnlyPool();
        pool = pool_;
    }

    function enableTrading() external {
        if (msg.sender != pool) revert OnlyPool();
        tradingEnabled = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (!tradingEnabled) {
            if (from != address(0) && to != address(0) && from != pool && to != pool) {
                revert TradingNotEnabled();
            }
        }

        super._update(from, to, value);
    }
}
