import { forgeAirdropperAbi } from "@/abi/forgeAirdropper";
import { forgeBondingCurveFactoryAbi } from "@/abi/forgeBondingCurveFactory";
import { forgeBondingCurvePoolAbi } from "@/abi/forgeBondingCurvePool";
import { forgeFairLaunchFactoryAbi } from "@/abi/forgeFairLaunchFactory";
import { forgeFairLaunchPoolAbi } from "@/abi/forgeFairLaunchPool";
import { forgeTokenFactoryAbi } from "@/abi/forgeTokenFactory";

// Note: Use direct env references so Next.js replaces them at build time for the client bundle.
const FACTORY_32769 = process.env.NEXT_PUBLIC_FACTORY_ADDRESS_32769 as
  | `0x${string}`
  | undefined;
const FACTORY_33101 = process.env.NEXT_PUBLIC_FACTORY_ADDRESS_33101 as
  | `0x${string}`
  | undefined;
const AIRDROPPER_32769 = process.env.NEXT_PUBLIC_AIRDROPPER_ADDRESS_32769 as
  | `0x${string}`
  | undefined;
const AIRDROPPER_33101 = process.env.NEXT_PUBLIC_AIRDROPPER_ADDRESS_33101 as
  | `0x${string}`
  | undefined;
const FAIRLAUNCH_FACTORY_32769 = process.env
  .NEXT_PUBLIC_FAIRLAUNCH_FACTORY_32769 as `0x${string}` | undefined;
const FAIRLAUNCH_FACTORY_33101 = process.env
  .NEXT_PUBLIC_FAIRLAUNCH_FACTORY_33101 as `0x${string}` | undefined;
const USDC_32769 = process.env.NEXT_PUBLIC_USDC_32769 as
  | `0x${string}`
  | undefined;
const USDC_33101 = process.env.NEXT_PUBLIC_USDC_33101 as
  | `0x${string}`
  | undefined;
const BONDING_CURVE_FACTORY_32769 = process.env
  .NEXT_PUBLIC_BONDING_CURVE_FACTORY_32769 as `0x${string}` | undefined;
const BONDING_CURVE_FACTORY_33101 = process.env
  .NEXT_PUBLIC_BONDING_CURVE_FACTORY_33101 as `0x${string}` | undefined;

export function getFactoryAddress(chainId: number): `0x${string}` | null {
  const addr =
    chainId === 32769
      ? FACTORY_32769
      : chainId === 33101
        ? FACTORY_33101
        : undefined;
  return (addr as `0x${string}` | undefined) ?? null;
}

export function getAirdropperAddress(chainId: number): `0x${string}` | null {
  const addr =
    chainId === 32769
      ? AIRDROPPER_32769
      : chainId === 33101
        ? AIRDROPPER_33101
        : undefined;
  return (addr as `0x${string}` | undefined) ?? null;
}

export function getFairLaunchFactoryAddress(
  chainId: number,
): `0x${string}` | null {
  const addr =
    chainId === 32769
      ? FAIRLAUNCH_FACTORY_32769
      : chainId === 33101
        ? FAIRLAUNCH_FACTORY_33101
        : undefined;
  return (addr as `0x${string}` | undefined) ?? null;
}

export function getUsdcAddress(chainId: number): `0x${string}` | null {
  const addr =
    chainId === 32769 ? USDC_32769 : chainId === 33101 ? USDC_33101 : undefined;
  return (addr as `0x${string}` | undefined) ?? null;
}

export function getBondingCurveFactoryAddress(
  chainId: number,
): `0x${string}` | null {
  const addr =
    chainId === 32769
      ? BONDING_CURVE_FACTORY_32769
      : chainId === 33101
        ? BONDING_CURVE_FACTORY_33101
        : undefined;
  return (addr as `0x${string}` | undefined) ?? null;
}

export const abis = {
  forgeTokenFactory: forgeTokenFactoryAbi,
  forgeAirdropper: forgeAirdropperAbi,
  forgeFairLaunchFactory: forgeFairLaunchFactoryAbi,
  forgeFairLaunchPool: forgeFairLaunchPoolAbi,
  forgeBondingCurveFactory: forgeBondingCurveFactoryAbi,
  forgeBondingCurvePool: forgeBondingCurvePoolAbi,
} as const;
