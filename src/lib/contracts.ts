import { forgeTokenFactoryAbi } from "@/abi/forgeTokenFactory";
import { forgeAirdropperAbi } from "@/abi/forgeAirdropper";

// Note: Use direct env references so Next.js replaces them at build time for the client bundle.
const FACTORY_32769 = process.env
  .NEXT_PUBLIC_FACTORY_ADDRESS_32769 as `0x${string}` | undefined;
const FACTORY_33101 = process.env
  .NEXT_PUBLIC_FACTORY_ADDRESS_33101 as `0x${string}` | undefined;
const AIRDROPPER_32769 = process.env
  .NEXT_PUBLIC_AIRDROPPER_ADDRESS_32769 as `0x${string}` | undefined;
const AIRDROPPER_33101 = process.env
  .NEXT_PUBLIC_AIRDROPPER_ADDRESS_33101 as `0x${string}` | undefined;

export function getFactoryAddress(chainId: number): `0x${string}` | null {
  const addr = chainId === 32769 ? FACTORY_32769 : chainId === 33101 ? FACTORY_33101 : undefined;
  return (addr as `0x${string}` | undefined) ?? null;
}

export function getAirdropperAddress(chainId: number): `0x${string}` | null {
  const addr =
    chainId === 32769 ? AIRDROPPER_32769 : chainId === 33101 ? AIRDROPPER_33101 : undefined;
  return (addr as `0x${string}` | undefined) ?? null;
}

export const abis = {
  forgeTokenFactory: forgeTokenFactoryAbi,
  forgeAirdropper: forgeAirdropperAbi,
} as const;
