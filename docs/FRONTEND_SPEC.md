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
- `/tokenlist` — Link to hosted tokenlist or local static for dev.

## Forms & Validation
- Prefer lightweight validation using Zod or custom utils; avoid heavy form libs unless needed.
- Constraints:
  - Symbol uppercase A–Z length 3–10.
  - Decimals 0–18.
  - Supply positive; convert UI supply to base units using `decimals`.
- Address validation via viem’s `isAddress`.

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

## State & UX
- Global: connected account, selected chain, tx status toasts.
- Loading states for reads/writes; disable buttons during pending txs.
- Errors surfaced with actionable messages (insufficient funds, rejection, invalid input).
- Accessibility: keyboard navigation, semantic labels, focus management in dialogs.

## Components (initial set)
- `ConnectWalletButton` (RainbowKit’s `ConnectButton` wrapper)
- `FormField` (label + input + error text)
- `FeeBanner` (reads fee/treasury and displays ZIL values)
- `TxStatus` (pending/success/error with hashes)
- `RecipientsTable` (upload CSV, edit rows, compute totals)
- `Sidebar` (shadcn/ui-based) and `Topbar` (ConnectButton host)

## Styling
- Tailwind v4 utilities only; keep `@theme inline` tokens for colors/fonts in `globals.css`.
- shadcn/ui components adapted to v4 classes; do not introduce legacy Tailwind config unless needed.

## Tokenlist & Icons
- After token creation, display instructions to submit an icon PR to the public repo (documented later in `docs/TOKENLIST.md`).
- Fallback to identicon if icon missing.

## Telemetry & Quality
- Optional Sentry for error reporting (env‑gated).
- Lighthouse target ≥90 on frontpage (desktop) later in plan.

## Deliverables (for this stage)
- Spec only. No dependencies added yet.
- Next stage: scaffold providers (`chains.ts`, wagmi config), basic routes, and placeholder components.
