# Frontend Specification — Forge (useforge.xyz)

Tech stack: Next.js (App Router) + Tailwind v4 + shadcn/ui + RainbowKit + wagmi + viem. Primary chains: Zilliqa EVM Mainnet (32769) and Testnet (33101).

## Architecture
- App Router under `src/app` with global providers in `RootLayout`.
- Styling via Tailwind v4 (`@import "tailwindcss";` and `@theme inline` in `globals.css`).
- UI kit: shadcn/ui components (Button, Input, Card, Dialog, Alert) adapted for Tailwind v4 classes.
- Wallet onboarding: RainbowKit on top of wagmi/viem. Custom chain objects for Zilliqa EVM Testnet/Mainnet.
- State/query: TanStack Query (via wagmi) for caching, retries, and mutations.
- Data fetching: direct on‑chain reads via viem; minimal server actions.

## Environment
- `NEXT_PUBLIC_CHAIN_ID_DEFAULT=33101`
- `NEXT_PUBLIC_FACTORY_ADDRESS_33101=<address>`
- `NEXT_PUBLIC_FACTORY_ADDRESS_32769=<address>`
- `NEXT_PUBLIC_AIRDROPPER_ADDRESS_33101=<address>`
- `NEXT_PUBLIC_AIRDROPPER_ADDRESS_32769=<address>`
- Optional: `NEXT_PUBLIC_BLOCK_EXPLORER_TESTNET` (default `https://otterscan.testnet.zilliqa.com`), `NEXT_PUBLIC_BLOCK_EXPLORER_MAINNET` (default `https://otterscan.zilliqa.com`)
- Fair launch env:
  - `NEXT_PUBLIC_FAIRLAUNCH_FACTORY_33101=<address>`
  - `NEXT_PUBLIC_FAIRLAUNCH_FACTORY_32769=<address>`
  - `NEXT_PUBLIC_USDC_33101=0x1fD09F6701a1852132A649fe9D07F2A3b991eCfA`
  - `NEXT_PUBLIC_USDC_32769=0xD8b73cEd1B16C047048f2c5EA42233DA33168198`
  - PlunderSwap v2 (mainnet) — `NEXT_PUBLIC_PLUNDER_FACTORY_V2_32769=0xf42d1058f233329185A36B04B7f96105afa1adD2`, `NEXT_PUBLIC_PLUNDER_ROUTER_V2_32769=0x33C6a20D2a605da9Fd1F506ddEd449355f0564fe`
  - PlunderSwap v3 mainnet — `NEXT_PUBLIC_PLUNDER_V3_FACTORY_32769=0x000A3ED861B2cC98Cc5f1C0Eb4d1B53904c0c93a`, `NEXT_PUBLIC_PLUNDER_V3_POOL_DEPLOYER_32769=0x667f17594AA1fBd4d70e5914EDF9e8ad818e4Ef3`, `NEXT_PUBLIC_PLUNDER_V3_MIGRATOR_32769=0xb72048adc590b926fA79fB3e54AAf33a39317A23`, `NEXT_PUBLIC_PLUNDER_V3_NFPM_32769=0x17678B52997B89b179c0a471bF8d266A4A4c6AC5`
  - PlunderSwap v3 testnet — `NEXT_PUBLIC_PLUNDER_V3_FACTORY_33101=0x026d35f6e8D2a9Bb4BbC9380cDb7df20038aAaFa`, `NEXT_PUBLIC_PLUNDER_V3_POOL_DEPLOYER_33101=0x601350273D21BEF3790146c24A1364f56c6E5084`, `NEXT_PUBLIC_PLUNDER_V3_MIGRATOR_33101=0x38a30F5D0f44f8812D7FafF82655290aac6FB04B`, `NEXT_PUBLIC_PLUNDER_V3_NFPM_33101=0x3a7ef9Ad056D21E62a067619562bCdAEc8988b10`
  - Reserve env keys for PlunderSwap v2 testnet once confirmed; keep routing logic abstracted via a config map keyed by chainId.

## Chains (wagmi/viem)
- 33101 — Zilliqa EVM Testnet
  - name: `Zilliqa Testnet`
  - nativeCurrency: `{ name: 'Zilliqa', symbol: 'ZIL', decimals: 18 }`
  - rpcUrls: `https://api.testnet.zilliqa.com`
  - blockExplorers: `https://otterscan.testnet.zilliqa.com`
- 32769 — Zilliqa EVM Mainnet
  - name: `Zilliqa`
  - nativeCurrency: `{ name: 'Zilliqa', symbol: 'ZIL', decimals: 18 }`
  - rpcUrls: `https://api.zilliqa.com`
  - blockExplorers: `https://otterscan.zilliqa.com`

Provide a `src/lib/chains.ts` exporting these for wagmi config.

## Providers Setup
- `src/app/providers.tsx` (or inside `layout.tsx`):
  - Create a TanStack `QueryClient` and provide it.
  - Create wagmi config with chains above.
  - Wrap `children` with `QueryClientProvider`, `WagmiProvider`, and `RainbowKitProvider` (theme, `modalSize='compact'`).
- Add a global top‑right `ConnectButton` in the layout header.

## Navigation
- Pattern: shadcn/ui Sidebar + Topbar layout.
- Sidebar (left):
  - Collapsible/expandable; persists state in localStorage.
  - Items (initial): Home (`/`), Create Token (`/create-token`), Airdrop (`/airdrop`), Tokenlist (`/tokenlist`).
  - Active route highlighting; keyboard accessible; aria labels on nav groups.
  - Mobile: hidden by default; opened via hamburger button as an overlay/sheet.
- Topbar (header):
  - Left: hamburger (mobile), current page title/breadcrumbs.
  - Right: RainbowKit `ConnectButton`, optional theme toggle.
  - Sticks to top; safe-area aware.
- Components & structure:
  - `src/components/layout/app-shell.tsx` (Server component) renders sidebar + header shell and slots `children`.
  - `src/components/nav/sidebar.tsx` (Client) implements shadcn Sidebar with Tailwind v4 classes.
  - `src/components/nav/topbar.tsx` (Client) hosts `ConnectButton` and actions.
  - Root layout uses AppShell around route children.
- Styling: Tailwind v4 utilities only; follow shadcn/ui Sidebar recipe adapted for v4 (no legacy tailwind.config).
- Accessibility: focus trap when mobile sidebar is open; ESC to close; tab order consistent.

## Routes
- `/` — Frontpage
  - Hero, marketing sections, CTAs.
  - Inline “Quick Create Token” widget (name, symbol, supply) linking to `/create-token` with prefilled values.
- `/create-token` — Full token creation flow
  - Form: name, symbol (A–Z, 3–10), decimals (0–18, default 18), total supply.
  - Fee banner shows `fee` and `treasury` read from factory.
  - Submit triggers on‑chain `createToken` with `value=fee`.
  - Result view shows token address, explorer link, copy, and “Add to Wallet”.
- `/airdrop` — Airdrop tool
  - Token input (address) and recipients editor (CSV upload or table).
  - Pre‑flight: address validation, amounts sum, estimated gas, allowance check.
  - Buttons: `Approve` (spender = airdropper), then `Airdrop`.
- `/fair-launch` — Fair launch builder (multi-step wizard)
  - Wizard: Step 1 verify token + choose currency; Step 2 configure sale (tokens for sale, caps, whitelist toggle, optional per-wallet max, start/end, liquidity %, router type, lock duration, auto/manual listing); Step 3 project metadata (logo/banner URLs, socials, description); Step 4 review, approvals, and `createLaunch` tx tracking with inline allowance checklist.
- `/fair-launch/discover` — Public launch list
  - Cards show token metadata, currency, soft cap, progress/status badges, explorer links, and CTA to the detail page.
- `/fair-launch/[address]` — Launch detail & participation view
  - Displays countdowns, contribution progress, per-wallet contribution form (ZIL/USDC), claim/refund buttons, and creator-only finalize controls.
- `/tokenlist` — Link to hosted tokenlist or local static for dev.

## Forms & Validation
- Prefer lightweight validation using Zod or custom utils; avoid heavy form libs unless needed.
- Constraints:
  - Symbol uppercase A–Z length 3–10.
  - Decimals 0–18.
  - Supply positive; convert UI supply to base units using `decimals`.
- Address validation via viem’s `isAddress`.
- Fair launch form validation:
  - Positive integers for “tokens for sale”, soft cap (required) / hard cap (optional, must be >= soft cap), per-wallet max (if enabled).
  - Liquidity percent slider clamped [51, 100], default 80; enforce increments of 1%.
  - Start/end datetimes enforce `start < end` and `start >= now`.
  - Lock duration select limited to {30d, 90d, 180d, 365d, `Infinity`}; show derived unlock date.
  - Whitelist upload accepts newline-separated addresses or CSV; display errors inline if parsing fails.

## On‑Chain Interactions
- ABIs derived from docs/CONTRACTS_SPEC.md; keep in `src/abis/`.
- Reads (viem):
  - Factory: `fee()`, `treasury()` for current chain.
- Writes (wagmi):
  - `createToken(...)` with `value=fee`.
  - `approve(spender=Airdropper, amount=total)` then `airdrop(token, recipients[], amounts[])`.
- Event decoding:
  - Parse `TokenCreated` from receipt logs to confirm token address; also read function return if available.
- Chain switching:
  - If wrong chain, prompt via RainbowKit; block writes until correct.
- Fair launch interactions:
  - Reads: `FairLaunchFactory.launchCount()`, `launchAt(index)` to enumerate launches; pool reads for `token`, `currency`, `tokensForSale`, `totalRaised`, `softCap`, `startTime`, `endTime`, `status`, `creator`, `contributions(address)`.
  - Writes: `createLaunch(cfg)` (requires fee in ZIL + token approval), `contribute(amount, proof)` (handles ZIL/USDC paths), `claim()`, `refund()`, `finalize(minToken, minCurrency)`, creator-only withdrawals and whitelist updates.
  - Event decoding: `LaunchCreated`, `Contribution`, `Finalized`, `Refunded`, `LiquidityLocked`, etc., to update UI state without refetching full lists.

## State & UX
- Global: connected account, selected chain, tx status toasts.
- Loading states for reads/writes; disable buttons during pending txs.
- Errors surfaced with actionable messages (insufficient funds, rejection, invalid input).
- Accessibility: keyboard navigation, semantic labels, focus management in dialogs.
- Fair launch extras:
  - Keep wizard progress/resume state in URL query or localStorage so users can return mid-setup.
  - Detail page derives status badges (Upcoming, Live, Successful, Failed, Finalized, Locked, Released) from pool state + timestamps.
  - Show contextual helper banners (e.g., “Soft cap not reached, claim refund after end block”).

## Components (initial set)
- `ConnectWalletButton` (RainbowKit’s `ConnectButton` wrapper)
- `FormField` (label + input + error text)
- `FeeBanner` (reads fee/treasury and displays ZIL values)
- `TxStatus` (pending/success/error with hashes)
- `RecipientsTable` (upload CSV, edit rows, compute totals)
- `Sidebar` (shadcn/ui-based) and `Topbar` (ConnectButton host)
- Fair launch specific:
  - `FairLaunchWizard` (stepper with progress), `FairLaunchSummaryCard`, `FairLaunchContributionCard`, `LaunchAdminActions`, `LaunchStatusBadge`, `LockupBadge`, `LaunchListFilters`.

## Styling
- Tailwind v4 utilities only; keep `@theme inline` tokens for colors/fonts in `globals.css`.
- shadcn/ui components adapted to v4 classes; do not introduce legacy Tailwind config unless needed.

## Tokenlist & Icons
- After token creation, display instructions to submit an icon PR to the public repo (documented later in `docs/TOKENLIST.md`).
- Fallback to identicon if icon missing.

## Fair Launch Launchpad
- Overview
  - `/fair-launch` is a client-heavy route (wizard + dashboard); wrap with AppShell but gate interactive pieces with `"use client"`.
  - Fetch launch metadata from on-chain events plus a lightweight indexer/JSON file until a subgraph exists.
- Sections
  1. **Discovery grid/table** — filters by status (upcoming/live/completed/cancelled), currency, router type, lock duration; cards show CTA (View/Contribute) and highlight liquidity percent + lock.
  2. **Wizard** — 4 steps modeled after PinkSale, with persistent summary sidebar:
     - Step 1: Verify token (address input, auto fetch name/symbol/decimals, show USDC/ZIL currency selector, display factory fee).
     - Step 2: Configure sale (tokens for sale, soft cap, optional hard cap, whitelist toggle/upload, optional per-wallet max, start/end pickers, liquidity % slider w/ default 80%, router select [v2/v3], listing mode, lock duration select).
     - Step 3: Project info (logo/banner URLs validated to image extensions, website + socials, description textarea/markdown, docs/roadmap links).
     - Step 4: Review (all values, derived token requirements, fee summary) + approvals (token allowance) + `createLaunch`.
  3. **Launch detail** — hero with status pill + countdown, stats cards (total raised, participants, price, liquidity percent, lock release), CTA area:
     - Contributors: amount input (handles currency decimals), max button, info about per-wallet max, `Contribute` button (ZIL vs USDC), claim/refund/pending states.
     - Admin: finalize button (auto listing vs manual), pause/resume, extend (if within policy), cancel (if no contributions), withdraw leftover funds post-lock.
     - Activity list of recent contributions, plus share links.
- UX Notes
  - Always show price formula `price = totalRaised / tokensForSale`.
  - Use `sonner` toasts for tx lifecycle; disable buttons during pending writes.
  - After finalize, show listing summary with PlunderSwap pair/position links and lock expiry countdown; include `Add Liquidity` instructions for manual mode.
  - Provide warnings if token has transfer tax (ask creator to exempt factory/router addresses).
- Data & caching
  - Cache launches per chain; poll during live sales (e.g., every 15s) or subscribe via events if feasible.
  - Derive statuses on client (Pending, Live, Successful, Failed, Finalized, Locked, Released).
- Access control
  - Creator-only actions determined by comparing connected address to `launch.creator`.
  - Whitelist flows: if enabled, input field accepts proof (Merkle) or we provide wallet-level whitelisting API; fallback to simple address list for v1.

## Telemetry & Quality
- Optional Sentry for error reporting (env‑gated).
- Lighthouse target ≥90 on frontpage (desktop) later in plan.

## Deliverables (for this stage)
- Spec only. No dependencies added yet.
- Next stage: scaffold providers (`chains.ts`, wagmi config), basic routes, and placeholder components.
