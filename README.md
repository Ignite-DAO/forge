# Forge

Forge is a simple, secure way to create fixed‑supply ERC‑20 tokens and run airdrops on Zilliqa EVM (Mainnet 32769, Testnet 33101). Frontend is Next.js 15 with Tailwind v4 + shadcn/ui and RainbowKit/wagmi.

## Frontend

- Stack: Next.js (App Router), Tailwind v4, shadcn/ui, RainbowKit + wagmi + viem
- Routes:
  - `/` landing with CTAs
  - `/create-token` token factory flow (reads fee and sends it if set)
  - `/airdrop` airdrop tool (reads fee and sends it if set)
  - `/tokenlist` placeholder for token list
- Commands:
  - Dev: `npm run dev` then open `http://localhost:3000`
  - Build: `npm run build` | Start: `npm run start`
  - Lint/format (Biome): `npm run lint` | `npm run format`
- Wallet: RainbowKit connect with custom button; chain switching for 32769/33101
- Styling: Tailwind v4 via `src/app/globals.css`; shadcn components under `src/components/`

### Environment (frontend)

- Set per‑chain addresses (exposed to the client):
  - `NEXT_PUBLIC_FACTORY_ADDRESS_32769` and `NEXT_PUBLIC_FACTORY_ADDRESS_33101`
  - `NEXT_PUBLIC_AIRDROPPER_ADDRESS_32769` and `NEXT_PUBLIC_AIRDROPPER_ADDRESS_33101`
- Restart the dev server after changing env.

## Cloudflare Workers (Setup)

This repo is prepared to deploy on Cloudflare Workers using OpenNext.

Steps (npm):

- Build Next.js: `npm run build`
- Build Workers bundle: `npm run cf:build` (outputs `.open-next`)
- Local preview: `npm run preview`
- Deploy: `npm run cf:deploy`

Notes:

- `wrangler.toml` points `main` to `.open-next/worker/index.mjs`. If OpenNext outputs a different file, update that path.
- Add secrets via `npx wrangler secret put MY_SECRET`.
- Prefer Edge-friendly code paths where possible for best compatibility on Workers.

## Smart Contracts (Foundry)

Contracts live under `contracts/` and use Foundry/Forge.

- Install deps: `cd contracts && forge install openzeppelin/openzeppelin-contracts`
- Build: `forge build`
- Format: `forge fmt`
- Test: `forge test`
- Deploy (example):
  - Token Factory: `forge create src/ForgeTokenFactory.sol:ForgeTokenFactory --rpc-url <RPC> --private-key <PK>`
  - Airdropper: `forge create src/ForgeAirdropper.sol:ForgeAirdropper --rpc-url <RPC> --private-key <PK>`

Scripts (forge script)

- Deploy airdropper: `forge script script/DeployAirdropper.s.sol --rpc-url <RPC> --private-key <PK> --broadcast`
- Deploy factory: `forge script script/DeployFactory.s.sol --rpc-url <RPC> --private-key <PK> --broadcast`
- Set fee (env): `FACTORY_ADDRESS=<addr> FEE_WEI=<wei> forge script script/SetFee.s.sol --rpc-url <RPC> --private-key <PK> --broadcast`
- Set fee (sig): `forge script script/SetFee.s.sol --sig "run(address,uint256)" <factory> <feeWei> --rpc-url <RPC> --private-key <PK> --broadcast`
- Set treasury (env): `FACTORY_ADDRESS=<addr> TREASURY_ADDRESS=<addr> forge script script/SetTreasury.s.sol --rpc-url <RPC> --private-key <PK> --broadcast`
- Set treasury (sig): `forge script script/SetTreasury.s.sol --sig "run(address,address)" <factory> <treasury> --rpc-url <RPC> --private-key <PK> --broadcast`

Airdropper admin scripts

- Set fee (env): `AIRDROPPER_ADDRESS=<addr> FEE_WEI=<wei> forge script script/AirdropperSetFee.s.sol --rpc-url <RPC> --private-key <PK> --broadcast`
- Set fee (sig): `forge script script/AirdropperSetFee.s.sol --sig "run(address,uint256)" <airdropper> <feeWei> --rpc-url <RPC> --private-key <PK> --broadcast`
- Set treasury (env): `AIRDROPPER_ADDRESS=<addr> TREASURY_ADDRESS=<addr> forge script script/AirdropperSetTreasury.s.sol --rpc-url <RPC> --private-key <PK> --broadcast`
- Set treasury (sig): `forge script script/AirdropperSetTreasury.s.sol --sig "run(address,address)" <airdropper> <treasury> --rpc-url <RPC> --private-key <PK> --broadcast`

Verification (Sourcify)

- Using Foundry integration with Sourcify:
  - Build first: `cd contracts && forge build`
  - One-liners:
    - Factory: `forge verify-contract --verifier sourcify --chain-id <ID> <FACTORY_ADDR> src/ForgeTokenFactory.sol:ForgeTokenFactory`
    - Airdropper: `forge verify-contract --verifier sourcify --chain-id <ID> <AIRDROPPER_ADDR> src/ForgeAirdropper.sol:ForgeAirdropper`
- Helper script:
  - `cd contracts`
  - `CHAIN_ID=<ID> FACTORY_ADDRESS=<0x...> ./scripts/verify-sourcify.sh`
  - `CHAIN_ID=<ID> AIRDROPPER_ADDRESS=<0x...> ./scripts/verify-sourcify.sh`
  - Optional: add `RPC_URL=<https rpc>` if needed for the target network.

Git ignore notes

- Ignored contract artifacts and deps: `contracts/cache/`, `contracts/out/`, `contracts/broadcast/`, `contracts/lib/`.
- After cloning or CI checkout, run `forge install` in `contracts/` to fetch deps before build/test.
- If you prefer vendored deps, pin and commit OZ: `forge install openzeppelin/openzeppelin-contracts@<tag>` and remove `contracts/lib/` from `.gitignore`.

Token creation

- Call `createToken(name, symbol, decimals, supply)` on `ForgeTokenFactory`.
- Full supply mints to the caller. If a fee is set on the factory, send `msg.value >= fee`.

Airdrop

- Approve the `ForgeAirdropper` for the total amount on your ERC‑20.
- If an airdrop fee is configured, send `msg.value >= fee`.
- Call `airdrop(token, recipients[], amounts[])` or `airdropEqual(token, recipients[], amountEach)`.
