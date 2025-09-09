export const nf = (opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 6, ...opts });

export function formatAddress(addr?: string | null) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function tryFormatUnits(
  value: bigint | string | null | undefined,
  decimals = 18,
) {
  if (value == null) return "—";
  try {
    const { formatUnits } = require("viem");
    const v = typeof value === "string" ? BigInt(value) : value;
    return formatUnits(v, decimals);
  } catch {
    return String(value);
  }
}
