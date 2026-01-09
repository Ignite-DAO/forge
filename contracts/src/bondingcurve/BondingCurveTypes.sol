// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum PoolState {
    Trading,
    Graduated
}

struct BondingCurveCreateParams {
    string name;
    string symbol;
    string metadataURI;
}

struct BondingCurveRouterConfig {
    address wrappedNative;
    address positionManager;
}

struct BondingCurveInitParams {
    address creator;
    string name;
    string symbol;
    uint256 graduationMarketCap;
    uint24 v3Fee;
    address treasury;
    uint256 tradingFeePercent;
    uint256 graduationFeePercent;
    BondingCurveRouterConfig routers;
}
