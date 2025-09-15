# Contracts Specification — Forge (useforge.xyz)

Scope: Zilliqa EVM Mainnet (32769) and Testnet (33101). Solidity contracts enabling fixed‑supply ERC‑20 token creation via a fee‑enabled factory and a simple airdrop dispatcher.

## Overview

- Compiler: Solidity ^0.8.24 (exact version to lock during implementation)
- Libraries: OpenZeppelin (ERC20, Ownable2Step, IERC20, SafeERC20, ReentrancyGuard, Address)
- Ownership/Admin: Single owner (EOA or multisig) controls factory parameters
- Verification: Sourcify (metadata + sources)

## Contracts

### ForgeStandardERC20 (OpenZeppelin-based)

- Purpose: Simple fixed‑supply ERC‑20 minted at deployment to `initialOwner`.
- Inheritance: `ERC20`
- Constructor:
  - `constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 totalSupply_, address initialOwner)`
  - Mints `totalSupply_` to `initialOwner`.
  - Stores custom `decimals_` returned by `decimals()` override.
- State:
  - `uint8 private _customDecimals;`
- Functions:
  - `function decimals() public view override returns (uint8)`
- Events: standard ERC‑20 `Transfer`/`Approval` only.
- Notes: No mint/burn after deployment.

### ForgeTokenFactory (Ownable2Step + ReentrancyGuard)

- Purpose: Deploys new `ForgeStandardERC20` tokens. Optional flat fee in native ZIL sent to a treasury.
- Inheritance: `Ownable2Step`, `ReentrancyGuard`
- State:
  - `uint256 public fee;` — flat fee in wei (native ZIL)
  - `address public treasury;` — recipient of fees (defaults to `owner`)
- Constructor:
  - `constructor()`
  - Owner defaults to deployer (`msg.sender` via Ownable). Sets `fee = 0` and `treasury = owner`.
- Functions:
  - `function createToken(string calldata name, string calldata symbol, uint8 decimals, uint256 supply) external payable returns (address token)`
    - Requirements: if `fee > 0`, `msg.value >= fee`; reverts `InsufficientFee()` otherwise.
    - Deploys `ForgeStandardERC20(name, symbol, decimals, supply, msg.sender)`.
    - If `fee > 0` and `treasury != address(0)`, forwards `fee` to `treasury` (via `Address.sendValue`) and refunds any excess to `msg.sender`.
    - Emits `TokenCreated(token, msg.sender, name, symbol, decimals, supply)`.
  - `function setFee(uint256 newFee) external onlyOwner` — emits `FeeUpdated(oldFee, newFee)`.
  - `function setTreasury(address newTreasury) external onlyOwner` — emits `TreasuryUpdated(oldTreasury, newTreasury)`.
  - `function withdraw() external onlyOwner` — sweep any stuck ETH/ZIL to owner (defensive; should be unused).
- Events:
  - `event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint8 decimals, uint256 supply);`
  - `event FeeUpdated(uint256 oldFee, uint256 newFee);`
  - `event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);`
- Errors:
  - `error InsufficientFee(uint256 required, uint256 provided);`
  - `error TransferFailed();` (if forwarding ETH/ZIL fails)
- Security:
  - Uses `Ownable2Step` for safer ownership transfers and `ReentrancyGuard` on payable functions.
  - Forwards ETH via `Address.sendValue` (reverts on failure), then refunds any excess.
  - Validates `decimals <= 18` and `supply > 0` on-chain.

### ForgeAirdropper (SafeERC20 + Fee)

- Purpose: Batch transfer ERC‑20 tokens from sender to multiple recipients using allowance; supports optional flat fee in native token forwarded to a treasury.
- State:
  - `uint256 public fee;` — flat fee in wei (native ZIL)
  - `address public treasury;` — fee recipient (defaults to `owner`)
- Admin (Ownable2Step):
  - `setFee(uint256)` — emits `FeeUpdated(oldFee,newFee)`
  - `setTreasury(address)` — emits `TreasuryUpdated(old,new)`
  - `withdraw()` — sweeps any stuck ETH to owner (defensive)
- Functions:
  - `function airdrop(address token, address[] calldata recipients, uint256[] calldata amounts) external payable`
    - Requirements: `recipients.length == amounts.length`; if `fee>0`, `msg.value >= fee` else reverts `InsufficientFee(required,provided)`.
    - Computes total and loops using `SafeERC20.safeTransferFrom` in a non-reentrant context.
    - Forwards `fee` to `treasury` (if non-zero) and refunds any excess to `msg.sender`.
    - Emits `Airdropped(token, msg.sender, recipients.length, total)`.
  - `function airdropEqual(address token, address[] calldata recipients, uint256 amountEach) external payable`
    - Same fee behavior; transfers equal amounts to all recipients.
- Events:
  - `event Airdropped(address indexed token, address indexed sender, uint256 count, uint256 total);`
  - `event FeeUpdated(uint256 oldFee, uint256 newFee);`
  - `event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);`
- Errors:
  - `error LengthMismatch();`
  - `error InsufficientFee(uint256 required, uint256 provided);`
- Notes:
  - Gas limits: frontend should cap N per call to avoid out‑of‑gas based on estimated costs.
  - Approvals: UI performs `approve` for the total prior to invoking `airdrop`.

## ABI Summary (signatures)

ForgeStandardERC20

- constructor(string,string,uint8,uint256,address)
- function name() view returns (string)
- function symbol() view returns (string)
- function decimals() view returns (uint8)
- function totalSupply() view returns (uint256)
- function balanceOf(address) view returns (uint256)
- function transfer(address,uint256) returns (bool)
- function allowance(address,address) view returns (uint256)
- function approve(address,uint256) returns (bool)
- function transferFrom(address,address,uint256) returns (bool)
- event Transfer(address indexed,address indexed,uint256)
- event Approval(address indexed,address indexed,uint256)

ForgeTokenFactory

- constructor()
- function fee() view returns (uint256)
- function treasury() view returns (address)
- function owner() view returns (address)
- function createToken(string,string,uint8,uint256) payable returns (address)
- function createToken(string,string,uint256) payable returns (address) // defaults decimals to 18
- function setFee(uint256)
- function setTreasury(address)
- function withdraw()
- function transferOwnership(address)
- event TokenCreated(address indexed,address indexed,string,string,uint8,uint256)
- event FeeUpdated(uint256,uint256)
- event TreasuryUpdated(address indexed,address indexed)

ForgeAirdropper

- function fee() view returns (uint256)
- function treasury() view returns (address)
- function owner() view returns (address)
- function setFee(uint256)
- function setTreasury(address)
- function withdraw()
- function airdrop(address,address[],uint256[]) payable
- function airdropEqual(address,address[],uint256) payable
- event Airdropped(address indexed,address indexed,uint256,uint256)
- event FeeUpdated(uint256,uint256)
- event TreasuryUpdated(address indexed,address indexed)

## Deployment & Parameters

- Factory has no constructor params; defaults to `fee = 0`.
- Defaults:
  - `owner` = deployer address
  - `treasury` = `owner` (can be updated later)
- Testnet chain id: 33101, RPC: `https://api.testnet.zilliqa.com`
- Mainnet chain id: 32769, RPC: `https://api.zilliqa.com`

## Verification (Sourcify)

- Produce standard metadata JSON and source tree for all three artifacts.
- Match compiler settings exactly (optimizer enabled; runs=200 recommended).
- Verification script uploads artifacts on deployment; links captured in `docs/DEPLOYS.md` later.

## Security Notes

- Access control limited to factory admin functions; token contracts are non‑upgradeable and mint‑fixed.
- Avoid unbounded loops in factory; only airdropper loops with UI‑enforced caps.
- Fee forwarding must not be blocked; handle failures with revert.

## Testing Targets (unit)

- Factory: fee logic (`fee=0`, `fee>0`, excess refund), events emission, admin updates.
- Token: decimals override correctness; total supply minted to creator.
- Airdropper: length mismatch revert; success path; insufficient allowance; fee logic (insufficient fee, forward + refund, withdraw when treasury zero).
