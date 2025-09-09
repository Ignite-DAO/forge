import { forgeTokenFactoryAbi } from "@/abi/forgeTokenFactory";
import { forgeAirdropperAbi } from "@/abi/forgeAirdropper";

export const FACTORY_ENV_MAINNET = "NEXT_PUBLIC_FACTORY_ADDRESS_32769" as const;
export const FACTORY_ENV_TESTNET = "NEXT_PUBLIC_FACTORY_ADDRESS_33101" as const;
export const AIRDROPPER_ENV_MAINNET =
  "NEXT_PUBLIC_AIRDROPPER_ADDRESS_32769" as const;
export const AIRDROPPER_ENV_TESTNET =
  "NEXT_PUBLIC_AIRDROPPER_ADDRESS_33101" as const;

export function getFactoryAddress(chainId: number): `0x${string}` | null {
  const byChain: Record<number, string | undefined> = {
    32769: process.env[FACTORY_ENV_MAINNET],
    33101: process.env[FACTORY_ENV_TESTNET],
  };
  const addr = byChain[chainId];
  if (!addr) return null;
  return addr as `0x${string}`;
}

export function getAirdropperAddress(chainId: number): `0x${string}` | null {
  const byChain: Record<number, string | undefined> = {
    32769: process.env[AIRDROPPER_ENV_MAINNET],
    33101: process.env[AIRDROPPER_ENV_TESTNET],
  };
  const addr = byChain[chainId];
  if (!addr) return null;
  return addr as `0x${string}`;
}

export const abis = {
  forgeTokenFactory: forgeTokenFactoryAbi,
  forgeAirdropper: forgeAirdropperAbi,
} as const;
