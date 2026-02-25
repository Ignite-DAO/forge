"use client";

import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Gift,
  Loader2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { abis } from "@/lib/contracts";
import { addressUrl } from "@/lib/explorer";
import {
  type FairLaunchCurrencyCode,
  formatTokenAmount,
  getCurrencyMeta,
  parseAmount,
} from "@/lib/fairlaunch";
import { formatAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNetwork } from "@/providers/network";

interface PoolDetail {
  pool: `0x${string}`;
  token: `0x${string}`;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  currency: FairLaunchCurrencyCode;
  tokensForSale: bigint;
  totalRaised: bigint;
  softCap: bigint;
  hardCap: bigint;
  maxContribution: bigint;
  startTime: number;
  endTime: number;
  status: number;
  creator: `0x${string}`;
}

const statusLabels: Record<
  number,
  { label: string; intent: "default" | "success" | "warn" }
> = {
  0: { label: "Upcoming", intent: "default" },
  1: { label: "Live", intent: "success" },
  2: { label: "Ready to finalize", intent: "warn" },
  3: { label: "Finalized", intent: "default" },
  4: { label: "Cancelled", intent: "default" },
  5: { label: "Failed", intent: "default" },
};

export default function LaunchDetailPage() {
  const params = useParams<{ address: string }>();
  const poolAddress = params?.address?.toLowerCase() as
    | `0x${string}`
    | undefined;
  const { chainId } = useNetwork();
  const publicClient = usePublicClient({ chainId });
  const { address, isConnected } = useAccount();

  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userContribution, setUserContribution] = useState<bigint | null>(null);
  const [claimTx, setClaimTx] = useState<`0x${string}` | null>(null);
  const [contributionInput, setContributionInput] = useState("");

  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({
    hash: claimTx ?? undefined,
  });

  useEffect(() => {
    if (!poolAddress || !publicClient) return;
    const target = poolAddress as `0x${string}`;
    const client = publicClient as NonNullable<typeof publicClient>;
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [
          token,
          currency,
          tokensForSale,
          totalRaised,
          softCap,
          hardCap,
          maxContribution,
          startTime,
          endTime,
          status,
          creator,
        ] = await Promise.all([
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "token",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "currency",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "tokensForSale",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "totalRaised",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "softCap",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "hardCap",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "maxContribution",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "startTime",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "endTime",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "status",
          }),
          client.readContract({
            abi: abis.forgeFairLaunchPool,
            address: target,
            functionName: "creator",
          }),
        ]);

        let tokenSymbol = "";
        let tokenName = "";
        let tokenDecimals = 18;
        try {
          [tokenSymbol, tokenName, tokenDecimals] = await Promise.all([
            client.readContract({
              abi: erc20Abi,
              address: token as `0x${string}`,
              functionName: "symbol",
            }) as Promise<string>,
            client.readContract({
              abi: erc20Abi,
              address: token as `0x${string}`,
              functionName: "name",
            }) as Promise<string>,
            client.readContract({
              abi: erc20Abi,
              address: token as `0x${string}`,
              functionName: "decimals",
            }) as Promise<number>,
          ]);
        } catch {
          tokenSymbol = "TOKEN";
          tokenName = "Unknown";
          tokenDecimals = 18;
        }

        if (!cancelled) {
          setPool({
            pool: target,
            token: token as `0x${string}`,
            tokenSymbol,
            tokenName,
            tokenDecimals,
            currency: (Number(currency) === 0
              ? "ZIL"
              : "USDC") as FairLaunchCurrencyCode,
            tokensForSale: tokensForSale as bigint,
            totalRaised: totalRaised as bigint,
            softCap: softCap as bigint,
            hardCap: hardCap as bigint,
            maxContribution: maxContribution as bigint,
            startTime: Number(startTime),
            endTime: Number(endTime),
            status: Number(status),
            creator: creator as `0x${string}`,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError("Unable to load this launch");
          setPool(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [poolAddress, publicClient]);

  useEffect(() => {
    if (!poolAddress || !address || !publicClient) {
      setUserContribution(null);
      return;
    }
    const client = publicClient as NonNullable<typeof publicClient>;
    const target = poolAddress as `0x${string}`;
    let cancelled = false;
    async function loadContribution() {
      try {
        const contribution = await client.readContract({
          abi: abis.forgeFairLaunchPool,
          address: target,
          functionName: "contributions",
          args: [address as `0x${string}`],
        });
        if (!cancelled) setUserContribution(contribution as bigint);
      } catch {
        if (!cancelled) setUserContribution(null);
      }
    }
    void loadContribution();
    return () => {
      cancelled = true;
    };
  }, [poolAddress, address, publicClient]);

  const currencyMeta = pool ? getCurrencyMeta(pool.currency) : null;
  const contributionBigint =
    contributionInput && currencyMeta
      ? (() => {
          try {
            return parseAmount(
              contributionInput.replace(",", "."),
              currencyMeta.decimals,
            );
          } catch {
            return null;
          }
        })()
      : null;

  const isCreator =
    pool && address && pool.creator.toLowerCase() === address.toLowerCase();
  const now = Date.now();
  const isLive =
    pool &&
    pool.status === 1 &&
    pool.startTime * 1000 <= now &&
    pool.endTime * 1000 >= now;
  const isFinalized = pool && pool.status === 3;
  const isRefundEnabled = pool && (pool.status === 4 || pool.status === 5);

  const statusConfig = pool
    ? (statusLabels[pool.status] ?? statusLabels[0])
    : statusLabels[0];

  const handleContribute = async () => {
    if (!pool || !currencyMeta || contributionBigint == null || !poolAddress) {
      toast.error("Enter a valid contribution");
      return;
    }
    if (!isConnected || !address) {
      toast.error("Connect your wallet");
      return;
    }
    try {
      if (pool.currency === "ZIL") {
        await writeContractAsync({
          abi: abis.forgeFairLaunchPool,
          address: pool.pool,
          functionName: "contribute",
          args: [0n, []],
          value: contributionBigint,
          chainId,
        });
      } else {
        await writeContractAsync({
          abi: abis.forgeFairLaunchPool,
          address: pool.pool,
          functionName: "contribute",
          args: [contributionBigint, []],
          chainId,
        });
      }
      toast.success("Contribution submitted");
      setContributionInput("");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Contribution failed", { description: err?.message });
    }
  };

  const handleClaim = async () => {
    if (!pool) return;
    try {
      const tx = await writeContractAsync({
        abi: abis.forgeFairLaunchPool,
        address: pool.pool,
        functionName: "claim",
        chainId,
      });
      setClaimTx(tx);
      toast.info("Claim submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Claim failed", { description: err?.message });
    }
  };

  const handleRefund = async () => {
    if (!pool) return;
    try {
      await writeContractAsync({
        abi: abis.forgeFairLaunchPool,
        address: pool.pool,
        functionName: "refund",
        chainId,
      });
      toast.info("Refund transaction sent");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Refund failed", { description: err?.message });
    }
  };

  const handleFinalize = async () => {
    if (!pool) return;
    try {
      await writeContractAsync({
        abi: abis.forgeFairLaunchPool,
        address: pool.pool,
        functionName: "finalize",
        args: [0n, 0n],
        chainId,
      });
      toast.info("Finalize transaction submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Finalize failed", { description: err?.message });
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <Link
        href="/discover"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Back to launches
      </Link>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      )}

      {error && (
        <Card className="border border-destructive">
          <CardHeader>
            <CardTitle>Unable to load launch</CardTitle>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardHeader>
        </Card>
      )}

      {pool && currencyMeta ? (
        <>
          {/* Pool header */}
          <div className="flex items-start gap-5">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted">
              <span className="text-xl font-bold text-muted-foreground">
                {pool.tokenSymbol.slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0 pt-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{pool.tokenName}</h1>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider",
                    statusConfig.intent === "success" &&
                      "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
                    statusConfig.intent === "warn" &&
                      "border-amber-500/30 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {statusConfig.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {pool.tokenSymbol}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            {/* Main column */}
            <div className="space-y-6">
              {/* Progress and stats card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold">
                      {pool.tokenSymbol} fair launch
                    </CardTitle>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Fair launch
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-0">
                  {/* Progress bar */}
                  {(() => {
                    const cap = pool.hardCap > 0n ? pool.hardCap : pool.softCap;
                    const pct =
                      cap > 0n
                        ? Math.min(
                            Number((pool.totalRaised * 10000n) / cap) / 100,
                            100,
                          )
                        : 0;
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {formatTokenAmount(
                              pool.totalRaised,
                              currencyMeta.decimals,
                            )}{" "}
                            / {formatTokenAmount(cap, currencyMeta.decimals)}{" "}
                            {currencyMeta.symbol}
                          </span>
                          <span className="text-sm font-bold">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="my-5 border-t" />

                  {/* Stats grid */}
                  <div className="grid gap-x-8 gap-y-4 md:grid-cols-3">
                    <Stat label="Total raised">
                      {formatTokenAmount(
                        pool.totalRaised,
                        currencyMeta.decimals,
                      )}{" "}
                      {currencyMeta.symbol}
                    </Stat>
                    <Stat label="Tokens for sale">
                      {formatTokenAmount(
                        pool.tokensForSale,
                        pool.tokenDecimals,
                      )}{" "}
                      {pool.tokenSymbol}
                    </Stat>
                    <Stat label="Currency">
                      {currencyMeta.label} ({currencyMeta.symbol})
                    </Stat>
                  </div>

                  {isConnected && (
                    <>
                      <div className="my-5 border-t" />
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Your contribution
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {formatTokenAmount(
                            userContribution ?? 0n,
                            currencyMeta.decimals,
                          )}{" "}
                          {currencyMeta.symbol}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="my-5 border-t" />

                  {/* Schedule */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4 shrink-0" />
                    {new Date(pool.startTime * 1000).toLocaleString()} →{" "}
                    {new Date(pool.endTime * 1000).toLocaleString()}
                  </div>

                  <div className="my-5 border-t" />

                  {/* Contribute section */}
                  <Card className="border shadow-none">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold">Contribute</p>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Max:{" "}
                          {pool.maxContribution === 0n
                            ? "No limit"
                            : `${formatTokenAmount(pool.maxContribution, currencyMeta.decimals)} ${currencyMeta.symbol}`}
                        </span>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Input
                          value={contributionInput}
                          onChange={(event) =>
                            setContributionInput(event.target.value)
                          }
                          placeholder={`0.0 ${currencyMeta.symbol}`}
                          type="text"
                          disabled={!isLive}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleContribute}
                          disabled={
                            !isLive || isWriting || contributionBigint == null
                          }
                          variant="outline"
                          className="w-full rounded-full sm:w-auto"
                        >
                          {isWriting ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" />
                              Pending...
                            </>
                          ) : (
                            "Contribute"
                          )}
                        </Button>
                      </div>
                      {!isLive && (
                        <p className="text-xs text-muted-foreground">
                          Contributions are available while the sale is live.
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="my-5 border-t" />

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={handleClaim}
                      disabled={!isFinalized || isClaimConfirming}
                      className="rounded-full disabled:opacity-40"
                    >
                      Claim tokens
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRefund}
                      disabled={!isRefundEnabled}
                      className="rounded-full disabled:opacity-40"
                    >
                      Claim refund
                    </Button>
                    {isCreator && pool.status === 2 && (
                      <Button
                        variant="outline"
                        onClick={handleFinalize}
                        className="rounded-full"
                      >
                        Finalize launch
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 text-sm">
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Pool address
                    </span>
                    <Link
                      href={addressUrl(chainId, pool.pool)}
                      target="_blank"
                      className="text-sm font-bold transition-colors hover:text-primary"
                    >
                      {formatAddress(pool.pool)}
                    </Link>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Creator
                    </span>
                    <span className="text-sm font-bold">
                      {formatAddress(pool.creator)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Soft cap
                    </span>
                    <span className="text-sm font-bold">
                      {formatTokenAmount(pool.softCap, currencyMeta.decimals)}{" "}
                      {currencyMeta.symbol}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t py-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Hard cap
                    </span>
                    <span className="text-sm font-bold">
                      {pool.hardCap === 0n
                        ? "No limit"
                        : `${formatTokenAmount(pool.hardCap, currencyMeta.decimals)} ${currencyMeta.symbol}`}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* How fair launches work */}
              <Card>
                <CardHeader>
                  <CardTitle>How fair launches work</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Everyone gets the same price &mdash; no first-mover
                    advantage
                  </p>
                </CardHeader>
                <CardContent className="space-y-0">
                  <div className="flex gap-4 border-t py-4">
                    <Wallet className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Contribute</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Connect your wallet and contribute {currencyMeta.symbol}{" "}
                        during the sale window.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 border-t py-4">
                    <CheckCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Fair allocation</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Tokens are distributed proportionally &mdash; everyone
                        pays the same price per token.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 border-t py-4">
                    <Gift className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Claim tokens</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Once finalized, return here to claim your share. If the
                        soft cap isn&apos;t met, you get a full refund.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold">{children}</p>
    </div>
  );
}
