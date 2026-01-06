// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Address} from "openzeppelin-contracts/contracts/utils/Address.sol";

import {BondingCurveCreateParams, BondingCurveRouterConfig, BondingCurveInitParams} from "./BondingCurveTypes.sol";
import {ForgeBondingCurvePool} from "./ForgeBondingCurvePool.sol";

contract ForgeBondingCurveFactory is Ownable2Step, ReentrancyGuard {
    using Address for address payable;

    error InsufficientFee(uint256 required, uint256 provided);
    error InvalidParam();
    error NameTooLong();
    error SymbolTooLong();
    error GraduationCapTooLow();

    uint256 public constant MIN_GRADUATION_MARKET_CAP = 1 ether; // Minimum 1 ZIL market cap
    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_SYMBOL_LENGTH = 12;

    event PoolCreated(
        address indexed pool,
        address indexed creator,
        address indexed token,
        string name,
        string symbol,
        string metadataURI
    );
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event GraduationMarketCapUpdated(uint256 oldCap, uint256 newCap);
    event TradingFeePercentUpdated(uint256 oldPercent, uint256 newPercent);
    event DefaultV3FeeUpdated(uint24 oldFee, uint24 newFee);
    event RouterConfigUpdated(address wrappedNative, address positionManager);

    uint256 public creationFee;
    address public treasury;
    uint256 public graduationMarketCap;
    uint256 public tradingFeePercent;
    uint24 public defaultV3Fee;
    BondingCurveRouterConfig public routerConfig;

    address[] public allPools;

    constructor(
        address _treasury,
        uint256 _graduationMarketCap,
        uint256 _tradingFeePercent,
        uint24 _defaultV3Fee,
        BondingCurveRouterConfig memory _routers
    ) Ownable(msg.sender) {
        if (_treasury == address(0)) revert InvalidParam();
        if (_routers.wrappedNative == address(0)) revert InvalidParam();
        if (_routers.positionManager == address(0)) revert InvalidParam();
        if (_tradingFeePercent > 1000) revert InvalidParam(); // Max 10%
        if (_defaultV3Fee == 0) revert InvalidParam();
        if (_graduationMarketCap < MIN_GRADUATION_MARKET_CAP) revert GraduationCapTooLow();

        treasury = _treasury;
        graduationMarketCap = _graduationMarketCap;
        tradingFeePercent = _tradingFeePercent;
        defaultV3Fee = _defaultV3Fee;
        routerConfig = _routers;
    }

    function createPool(BondingCurveCreateParams calldata params)
        external
        payable
        nonReentrant
        returns (address pool)
    {
        if (msg.value < creationFee) {
            revert InsufficientFee(creationFee, msg.value);
        }
        if (bytes(params.name).length == 0) revert InvalidParam();
        if (bytes(params.symbol).length == 0) revert InvalidParam();
        if (bytes(params.name).length > MAX_NAME_LENGTH) revert NameTooLong();
        if (bytes(params.symbol).length > MAX_SYMBOL_LENGTH) revert SymbolTooLong();

        BondingCurveInitParams memory initParams = BondingCurveInitParams({
            creator: msg.sender,
            name: params.name,
            symbol: params.symbol,
            graduationMarketCap: graduationMarketCap,
            v3Fee: defaultV3Fee,
            treasury: treasury,
            tradingFeePercent: tradingFeePercent,
            routers: routerConfig
        });

        ForgeBondingCurvePool poolContract = new ForgeBondingCurvePool(initParams);
        pool = address(poolContract);
        allPools.push(pool);

        if (creationFee > 0) {
            payable(treasury).sendValue(creationFee);
        }

        uint256 refund = msg.value - creationFee;
        if (refund > 0) {
            payable(msg.sender).sendValue(refund);
        }

        emit PoolCreated(
            pool,
            msg.sender,
            address(poolContract.token()),
            params.name,
            params.symbol,
            params.metadataURI
        );
    }

    function setCreationFee(uint256 newFee) external onlyOwner {
        emit CreationFeeUpdated(creationFee, newFee);
        creationFee = newFee;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidParam();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setGraduationMarketCap(uint256 newCap) external onlyOwner {
        if (newCap < MIN_GRADUATION_MARKET_CAP) revert GraduationCapTooLow();
        emit GraduationMarketCapUpdated(graduationMarketCap, newCap);
        graduationMarketCap = newCap;
    }

    function setTradingFeePercent(uint256 newPercent) external onlyOwner {
        if (newPercent > 1000) revert InvalidParam(); // Max 10%
        emit TradingFeePercentUpdated(tradingFeePercent, newPercent);
        tradingFeePercent = newPercent;
    }

    function setDefaultV3Fee(uint24 newFee) external onlyOwner {
        if (newFee == 0) revert InvalidParam();
        emit DefaultV3FeeUpdated(defaultV3Fee, newFee);
        defaultV3Fee = newFee;
    }

    function setRouterConfig(BondingCurveRouterConfig calldata config) external onlyOwner {
        if (config.wrappedNative == address(0)) revert InvalidParam();
        if (config.positionManager == address(0)) revert InvalidParam();
        routerConfig = config;
        emit RouterConfigUpdated(config.wrappedNative, config.positionManager);
    }

    function poolCount() external view returns (uint256) {
        return allPools.length;
    }

    function poolAt(uint256 index) external view returns (address) {
        return allPools[index];
    }
}
