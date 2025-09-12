# Forge (useforge.xyz) — Build Plan with Verifiable Deliverables

This plan captures the agreed scope for the initial Forge release: a clean frontpage with marketing + functionality, ERC‑20 fixed‑supply token creation through a fee‑enabled factory, simple airdrops, RainbowKit wallet integration, Next.js + Tailwind v4 + shadcn UI, and GitHub-based token icons/list publishing. Primary chains: Zilliqa EVM Mainnet (32769) and Zilliqa EVM Testnet (33101).

## 0) Scope Lock & Architecture

- Summary
  - Chains: Zilliqa EVM Mainnet (id 32769, rpc https://api.zilliqa.com) and Testnet (id 33101, rpc https://api.testnet.zilliqa.com)
  - Fees: Flat fee in native ZIL; configurable by contract admin; default 0 at deploy; fee sent to configurable treasury
  - Token: Basic ERC‑20, fixed supply, minted to creator (connected wallet), standard decimals selectable (default 18)
  - Airdrop: Simple batch dispatcher that immediately transfers to a provided list (creator pays gas); uses `transferFrom` with prior approval
  - Verification: Sourcify
  - Assets: Token icons + tokenlist managed in a public GitHub repo and served on `useforge.xyz`

- Deliverables (verifiable)
  - docs/PLAN.md (this file) committed
  - docs/CONTRACTS_SPEC.md summarizing ABIs, functions, events, and security notes
  - docs/FRONTEND_SPEC.md summarizing flows, routes, and state

## 1) Smart Contracts (Factories + Implementations)

- Contracts
  - ForgeTokenFactory
    - `createToken(name, symbol, decimals, supply)` payable; reverts if `msg.value < fee` when `fee > 0`
    - Admin: `setFee(uint256)`, `setTreasury(address)`, `transferOwnership(address)`
    - Events: `TokenCreated(token,address creator,string name,string symbol,uint8 decimals,uint256 supply)`; `FeeUpdated`; `TreasuryUpdated`
    - Defaults: `owner = deployer`; `treasury = owner`
  - ForgeStandardERC20 (OZ-based ERC20)
    - Constructor mints full fixed supply to `msg.sender`
  - ForgeAirdropper
    - `airdrop(address token, address[] recipients, uint256[] amounts)`
    - Performs `IERC20(token).transferFrom(msg.sender, recipients[i], amounts[i])` in a loop
    - Emits `Airdropped(token,address sender,uint256 count,uint256 total)`

- Security/Constraints
  - Use OpenZeppelin (latest matching compiler) for ERC‑20, Ownable, and interfaces
  - Reasonable caps checked client-side (e.g., max recipients per call) to avoid out-of-gas
  - Non‑reentrant modifier not strictly required (no external callbacks after state changes), but acceptable to include

- Deliverables (verifiable)
  - `contracts/ForgeTokenFactory.sol`, `contracts/ForgeStandardERC20.sol`, `contracts/ForgeAirdropper.sol`
  - Unit tests: creation fee logic, token minting to creator, admin updates, airdrop behavior and failure cases (length mismatch, no allowance)
  - Hardhat/Foundry project with `forge test` or `npx hardhat test` passing locally
  - Gas usage report for airdrop with N recipients (document limits in README)

## 2) Contract Tooling & Verification

- Tooling
  - Hardhat or Foundry (choose one; default to Hardhat for RainbowKit/viem familiarity)
  - Ethers + TypeChain or viem typegen for typed ABIs
  - Sourcify verification script (upload metadata + sources on deploy)

- Deliverables (verifiable)
  - `package.json` tasks: `contracts:build`, `contracts:test`, `contracts:deploy:testnet`, `contracts:verify:sourcify`
  - Sourcify verification succeeds on Zilliqa Testnet for all deployed artifacts (links captured in docs/DEPLOYS.md)

## 3) Frontend Scaffold (Next.js + Tailwind v4 + shadcn + RainbowKit)

- Stack
  - Next.js (App Router), Tailwind v4, shadcn/ui, RainbowKit + wagmi + viem
  - Custom chain configs for Zilliqa EVM Mainnet/Testnet

- Skeleton Pages/Routes
  - `/` frontpage (marketing + CTAs + quick create token widget)
  - `/create-token` full form flow
  - `/airdrop` airdrop tool
  - `/tokenlist` read-only JSON endpoint or link to hosted tokenlist

- Deliverables (verifiable)
  - App boots locally: `pnpm dev` or `npm run dev` showing frontpage
  - RainbowKit connect modal works on both testnet/mainnet chains (switching allowed)
  - Custom wallet button implemented via `ConnectButton.Custom` and styled with shadcn `Button`
  - shadcn components render with Tailwind v4 (button, input, card demo)

## 4) Wallet & Chain Integration

- Details
  - Add custom `wagmi`/`viem` chain objects for ids 32769/33101 with RPCs and block explorers
  - Network switch prompts on action if wrong chain
  - Gas/currency display in ZIL

- Deliverables (verifiable)
  - `src/lib/chains.ts` with Zilliqa chain configs
  - Test: connect wallet, select Testnet, read on-chain fee from factory via UI

## 5) Token Creation Flow

- UX
  - Form: name, symbol, decimals (default 18), total supply, optional icon upload now or later
  - Fee banner displays current fee in ZIL and destination treasury
  - On submit: call `createToken` with `value = fee` (if fee>0)
  - On success: show new token address and prompt to add to wallet; persist metadata for tokenlist

- Client Validation
  - Symbol uppercase A–Z, 3–10 chars; decimals 0–18; supply uses 18-decimal UI helper

- Deliverables (verifiable)
  - Transaction completes on Testnet creating token minted to creator
  - UI shows deployed address; copy and block explorer link works
  - Event `TokenCreated` decoded and displayed in a receipt panel

## 6) Airdrop Flow (Simple Dispatcher)

- UX
  - Token selector (address input or recent created)
  - CSV upload: `address,amount` or manual table editor
  - Pre-flight checks: sum of amounts, allowance required, estimated gas
  - One-click: approve token for total amount, then `airdrop` with arrays

- Deliverables (verifiable)
  - CSV parser validates addresses and amounts; shows total
  - `Approve` then `Airdrop` transactions succeed on Testnet and recipients balances reflect transfers
  - UI displays counts and total distributed; links to transaction hashes

## 7) Token Icons & Tokenlist (GitHub‑backed)

- Approach
  - Public GitHub repo (e.g., `useforge-assets`) holding:
    - `/tokenlist.json` (Pancake/Uniswap tokenlist standard)
    - `/icons/<chainId>/<address>.png` (lowercase address), recommended 256×256 PNG or SVG
  - Frontend: on successful token creation, create a local pending entry and provide instructions to submit a PR with icon
  - Hosting: `useforge.xyz/tokenlist.json` served via web (and periodically synced from GitHub). Optionally pin to IPFS later

- Deliverables (verifiable)
  - Template repo scaffold with CONTRIBUTING.md and icon guidelines (documented in docs/TOKENLIST.md)
  - Local dev endpoint or static file serving `tokenlist.json` with at least one Testnet token entry
  - Frontend renders token icon from `/icons/...` if present; falls back to identicon

## 8) Testnet Deploys & Docs

- Steps
  - Deploy `ForgeTokenFactory` and `ForgeAirdropper` to Zilliqa Testnet
  - Set default `fee = 0` (owner and treasury default to deployer)
  - Verify on Sourcify

- Deliverables (verifiable)
  - docs/DEPLOYS.md with: block numbers, contract addresses, Sourcify links, ABI checksums
  - Frontend env points to Testnet contracts; all flows complete on Testnet

## 9) Frontpage (Marketing + Functionality)

- Content
  - Brand: Forge (useforge.xyz); clean, minimal hero; primary CTA “Create Token”; secondary CTA “Run Airdrop”
- Sections: How it works, Fees (flat, configurable, default 0), Supported Chains (Zilliqa EVM), Security (OZ, Sourcify), FAQ
  - Added ad‑marketing explainer under hero (performance, attribution, audience→ownership)
  - Added features/roadmap list (liquidity locks; launch formats: full, fair, presale; ElizaOS agents)
  - Added Torch Wallet section with external link (torchwallet.io)
  - Inline widget to create a token (compact version of the full form)

- Deliverables (verifiable)
  - Lighthouse pass: Performance/Accessibility/Best Practices/SEO ≥ 90 on frontpage (desktop)
  - Responsive layout verified at 320px, 768px, 1024px, 1440px

## 10) Mainnet Readiness

- Steps
  - Re-deploy to Zilliqa Mainnet; set initial `fee=0`, set production treasury
  - Sourcify verification
  - Env switch and final smoke tests

- Deliverables (verifiable)
  - Mainnet addresses + Sourcify links in docs/DEPLOYS.md
  - Successful end‑to‑end token creation on Mainnet (screenshot + tx hash)

## 11) Compliance, Ops, and Quality

- Steps
  - Add Terms/Privacy links; basic disclaimers around token creation risk
  - Basic rate limiting on upload endpoints (if any serverless used)
  - Analytics (privacy‑friendly) and Sentry optional

- Deliverables (verifiable)
  - `/legal/terms` and `/legal/privacy` pages exist
  - Error boundaries in UI; Sentry DSN wired (optional)

## 12) Acceptance Criteria (Summary)

- Contracts
  - Factory enforces fee in ZIL when `fee>0`; emits `TokenCreated`
  - ERC‑20 fixed supply minted to creator; decimals configurable
  - Airdropper successfully transfers to N recipients using allowance

- Frontend
  - Wallet connect via RainbowKit; chain switch handling for 32769/33101
  - Create Token flow works end‑to‑end on Testnet and displays deployed address
  - Airdrop flow works with CSV import and shows tx hashes

- Tokenlist & Icons
  - Public GitHub repo structure documented; tokenlist served at `useforge.xyz/tokenlist.json`
  - New token addition process documented and test entry visible in UI

- Verification & Docs
  - Sourcify verification for all deployed contracts (Testnet/Mainnet)
  - docs/DEPLOYS.md contains addresses, links, and checksums

## 13) Open Questions (for later iterations)

- Presales/launchpads, liquidity locks, vesting modules, anti‑bot tools
- IPFS pinning automation for icons/tokenlist
- Indexing of created tokens and airdrops for on‑site discovery

## 14) Deployment: Cloudflare Workers (prep)

- Add Wrangler config (`wrangler.toml`) targeting OpenNext output.
- Package scripts:
  - `cf:build` → `npx open-next@latest build --platform cloudflare`
  - `cf:dev` → `npx wrangler dev`
  - `cf:deploy` → `npx wrangler deploy`
- Dev notes:
  - Install dev deps: `npm i -D open-next @opennextjs/cloudflare wrangler`
  - Build sequence: `npm run build` (Next) then `npm run cf:build` (OpenNext)
  - Update `wrangler.toml` `main` path if OpenNext output differs.

## File Map to Create During Implementation

- contracts/
  - ForgeTokenFactory.sol
  - ForgeStandardERC20.sol
  - ForgeAirdropper.sol
- docs/
  - PLAN.md (this)
  - CONTRACTS_SPEC.md (functions, events, permissions)
  - FRONTEND_SPEC.md (flows, routes, state)
  - DEPLOYS.md (addresses + verification links)
  - TOKENLIST.md (format, contribution guide, icon rules)
- apps/web/ (Next.js app)
  - src/app/(routes): `/`, `/create-token`, `/airdrop`
  - src/lib/chains.ts (Zilliqa chains)
  - RainbowKit/shadcn/Tailwind v4 setup

## Notes on Performance & Limits

- Airdropper is a simple loop and will be gas‑bound by recipient count; start with soft limit (e.g., 200–500 recipients per tx depending on chain gas limits). UI will split into multiple txs if needed.
- Tokenlist updates via GitHub PR enable transparency and community contributions; initial seed list contains only verified Testnet assets from Forge.
