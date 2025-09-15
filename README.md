# Forge
Welcome to Forge, by Torch Wallet.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Wallet Integration

- RainbowKit + wagmi powered wallet connect.
- Custom wallet button built with RainbowKit’s `ConnectButton.Custom` and styled using the project’s shadcn `Button` for a consistent topbar look.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Cloudflare Workers (Setup)

This repo is prepared to deploy on Cloudflare Workers using OpenNext.

Steps (npm):

- Install tooling (dev deps): `npm i -D open-next @opennextjs/cloudflare wrangler`
- Build Next.js: `npm run build`
- Build Workers bundle: `npm run cf:build` (outputs `.open-next`)
- Local dev: `npm run cf:dev`
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
