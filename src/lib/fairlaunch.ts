import { formatUnits, parseUnits } from "viem";

export const FairLaunchCurrencyId = {
  ZIL: 0,
  USDC: 1,
} as const;

export type FairLaunchCurrencyCode = keyof typeof FairLaunchCurrencyId;

export const FairLaunchRouterKindId = {
  V2: 0,
  V3: 1,
} as const;

export type FairLaunchRouterKindCode = keyof typeof FairLaunchRouterKindId;

export interface CurrencyMeta {
  code: FairLaunchCurrencyCode;
  label: string;
  symbol: string;
  decimals: number;
}

export const FAIR_LAUNCH_CURRENCIES: CurrencyMeta[] = [
  { code: "ZIL", label: "Zilliqa (ZIL)", symbol: "ZIL", decimals: 18 },
  { code: "USDC", label: "USD Coin (USDC)", symbol: "USDC", decimals: 6 },
];

export const LIQUIDITY_MIN = 51;
export const LIQUIDITY_MAX = 100;

export const LOCK_OPTIONS = [
  { value: "0", label: "No lock (manual listing)" },
  { value: String(30 * 24 * 60 * 60), label: "30 days" },
  { value: String(90 * 24 * 60 * 60), label: "3 months" },
  { value: String(180 * 24 * 60 * 60), label: "6 months" },
  { value: String(365 * 24 * 60 * 60), label: "1 year" },
  { value: "max", label: "Indefinite lock" },
];

export const UINT256_MAX = (1n << 256n) - 1n;

export function parseLockDuration(value: string): bigint {
  if (value === "max") return UINT256_MAX;
  return BigInt(value);
}

export function getCurrencyMeta(code: FairLaunchCurrencyCode): CurrencyMeta {
  const meta = FAIR_LAUNCH_CURRENCIES.find((c) => c.code === code);
  if (!meta) throw new Error(`Unknown currency ${code}`);
  return meta;
}

export function tokensForLiquidity(tokensForSale: bigint, liquidityPercent: number) {
  return (tokensForSale * BigInt(liquidityPercent)) / 100n;
}

export function totalTokensRequired(tokensForSale: bigint, liquidityPercent: number) {
  return tokensForSale + tokensForLiquidity(tokensForSale, liquidityPercent);
}

export function formatTokenAmount(amount: bigint, decimals: number, fractionDigits = 6) {
  const formatted = formatUnits(amount, decimals);
  const [whole, frac = ""] = formatted.split(".");
  if (fractionDigits === 0) return whole;
  const trimmed = frac.slice(0, fractionDigits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function parseAmount(value: string, decimals: number) {
  return parseUnits(value.replace(/,/g, ""), decimals);
}
