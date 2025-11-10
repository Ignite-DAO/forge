"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { toast } from "sonner";
import { ArrowLeft, Coins, TimerReset, Info } from "lucide-react";

import { erc20Abi } from "@/abi/erc20";
import { abis } from "@/lib/contracts";
import { FairLaunchCurrencyCode, formatTokenAmount, getCurrencyMeta, parseAmount } from "@/lib/fairlaunch";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatAddress } from "@/lib/format";
import { addressUrl, txUrl } from "@/lib/explorer";

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

const statusLabels: Record<number, { label: string; intent: "default" | "success" | "warn" }> = {
  0: { label: "Upcoming", intent: "default" },
  1: { label: "Live", intent: "success" },
  2: { label: "Ready to finalize", intent: "warn" },
  3: { label: "Finalized", intent: "default" },
  4: { label: "Cancelled", intent: "default" },
  5: { label: "Failed", intent: "default" },
};

export default function LaunchDetailPage() {
  const params = useParams<{ address: string }>();
  const poolAddress = params?.address?.toLowerCase() as `0x${string}` | undefined;
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();

  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userContribution, setUserContribution] = useState<bigint | null>(null);
  const [claimTx, setClaimTx] = useState<`0x${string}` | null>(null);
  const [contributionInput, setContributionInput] = useState("");

  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({ hash: claimTx ?? undefined });

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
            currency: (Number(currency) === 0 ? "ZIL" : "USDC") as FairLaunchCurrencyCode,
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
            return parseAmount(contributionInput.replace(",", "."), currencyMeta.decimals);
          } catch {
            return null;
          }
        })()
      : null;

  const isCreator = pool && address && pool.creator.toLowerCase() === address.toLowerCase();
  const now = Date.now();
  const isLive = pool && pool.status === 1 && pool.startTime * 1000 <= now && pool.endTime * 1000 >= now;
  const isFinalized = pool && pool.status === 3;
  const isRefundEnabled = pool && (pool.status === 4 || pool.status === 5);

  const statusConfig = pool ? statusLabels[pool.status] ?? statusLabels[0] : statusLabels[0];

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
        });
      } else {
        await writeContractAsync({
          abi: abis.forgeFairLaunchPool,
          address: pool.pool,
          functionName: "contribute",
          args: [contributionBigint, []],
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
      });
      toast.info("Finalize transaction submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Finalize failed", { description: err?.message });
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <Button asChild variant="ghost" className="h-auto p-0 text-sm text-muted-foreground">
        <Link href="/discover" className="inline-flex items-center gap-2">
          <ArrowLeft className="size-4" />
          Back to launches
        </Link>
      </Button>
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      )}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Unable to load launch</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}
      {pool && currencyMeta ? (
        <>
          <PageHeader
            title={pool.tokenName}
            description={`${pool.tokenSymbol} · ${formatAddress(pool.pool)}`}
            icon={<Coins className="size-6 text-primary" />}
          />
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{pool.tokenSymbol} fair launch</CardTitle>
                    <CardDescription>
                      {statusConfig.label} · Soft cap{" "}
                      {formatTokenAmount(pool.softCap, currencyMeta.decimals)} {currencyMeta.symbol}
                    </CardDescription>
                  </div>
                  <Badge variant={statusConfig.intent === "success" ? "default" : "secondary"}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Stat label="Total raised">
                    {formatTokenAmount(pool.totalRaised, currencyMeta.decimals)} {currencyMeta.symbol}
                  </Stat>
                  <Stat label="Tokens for sale">
                    {formatTokenAmount(pool.tokensForSale, pool.tokenDecimals)} {pool.tokenSymbol}
                  </Stat>
                  <Stat label="Currency">
                    {currencyMeta.label} ({currencyMeta.symbol})
                  </Stat>
                </div>
                {isConnected && (
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Your contribution</p>
                    <p className="text-base font-semibold">
                      {formatTokenAmount(userContribution ?? 0n, currencyMeta.decimals)} {currencyMeta.symbol}
                    </p>
                  </div>
                )}
                <div className="rounded-lg border p-4 text-sm">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <TimerReset className="size-4" />
                    Window: {new Date(pool.startTime * 1000).toLocaleString()} →{" "}
                    {new Date(pool.endTime * 1000).toLocaleString()}
                  </p>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Contribute</p>
                    <small className="text-muted-foreground">
                      Max per wallet:{" "}
                      {pool.maxContribution === 0n
                        ? "∞"
                        : `${formatTokenAmount(pool.maxContribution, currencyMeta.decimals)} ${
                            currencyMeta.symbol
                          }`}
                    </small>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      value={contributionInput}
                      onChange={(event) => setContributionInput(event.target.value)}
                      placeholder={`0.0 ${currencyMeta.symbol}`}
                      type="text"
                      disabled={!isLive}
                    />
                    <Button
                      onClick={handleContribute}
                      disabled={!isLive || isWriting || contributionBigint == null}
                    >
                      {isWriting ? "Pending…" : "Contribute"}
                    </Button>
                  </div>
                  {!isLive && (
                    <p className="text-xs text-muted-foreground">
                      Contributions are available while the sale is live.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleClaim} disabled={!isFinalized || isClaimConfirming}>
                    Claim tokens
                  </Button>
                  <Button variant="outline" onClick={handleRefund} disabled={!isRefundEnabled}>
                    Claim refund
                  </Button>
                  {isCreator && pool.status === 2 && (
                    <Button variant="secondary" onClick={handleFinalize}>
                      Finalize launch
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <DetailRow label="Pool address">
                    <Link
                      href={addressUrl(chainId, pool.pool)}
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      {formatAddress(pool.pool)}
                    </Link>
                  </DetailRow>
                  <DetailRow label="Creator">{formatAddress(pool.creator)}</DetailRow>
                  <DetailRow label="Soft cap">
                    {formatTokenAmount(pool.softCap, currencyMeta.decimals)} {currencyMeta.symbol}
                  </DetailRow>
                  <DetailRow label="Hard cap">
                    {pool.hardCap === 0n
                      ? "∞"
                      : `${formatTokenAmount(pool.hardCap, currencyMeta.decimals)} ${currencyMeta.symbol}`}
                  </DetailRow>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Info className="size-4 text-muted-foreground" />
                    How to participate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>1. Connect your wallet on the correct chain.</p>
                  <p>2. Enter the amount you wish to contribute and submit the transaction.</p>
                  <p>3. After the sale finalizes, return here to claim your tokens.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{children}</p>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}
