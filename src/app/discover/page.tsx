"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useChainId, usePublicClient, useReadContract } from "wagmi";
import { Wallet, TimerReset, Sparkles, ArrowUpRight } from "lucide-react";

import { abis, getFairLaunchFactoryAddress } from "@/lib/contracts";
import { erc20Abi } from "@/abi/erc20";
import {
  FAIR_LAUNCH_CURRENCIES,
  FairLaunchCurrencyCode,
  formatTokenAmount,
  getCurrencyMeta,
} from "@/lib/fairlaunch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { formatAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addressUrl } from "@/lib/explorer";

type LaunchSummary = {
  pool: `0x${string}`;
  token: `0x${string}`;
  tokenSymbol: string;
  tokenName: string;
  currency: FairLaunchCurrencyCode;
  tokensForSale: bigint;
  totalRaised: bigint;
  softCap: bigint;
  startTime: number;
  endTime: number;
  status: number;
};

const statusLabels: Record<number, { label: string; variant: "default" | "secondary" | "outline" }> =
  {
    0: { label: "Upcoming", variant: "secondary" },
    1: { label: "Live", variant: "default" },
    2: { label: "Ready", variant: "outline" },
    3: { label: "Finalized", variant: "secondary" },
    4: { label: "Cancelled", variant: "outline" },
    5: { label: "Failed", variant: "outline" },
  };

export default function FairLaunchDiscoverPage() {
  const chainId = useChainId();
  const factory = getFairLaunchFactoryAddress(chainId);
  const publicClient = usePublicClient();

  const { data: launchCountData } = useReadContract({
    abi: abis.forgeFairLaunchFactory,
    address: factory ?? undefined,
    functionName: "launchCount",
    query: { enabled: Boolean(factory) },
  });

  const [launches, setLaunches] = useState<LaunchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!factory || !publicClient) return;
    const factoryAddr = factory as `0x${string}`;
    const client = publicClient as NonNullable<typeof publicClient>;
    const total = Number(launchCountData ?? 0n);
    if (!Number.isFinite(total) || total === 0) {
      setLaunches([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const indexes = Array.from({ length: total }, (_, i) => BigInt(i));
        const pools = await Promise.all(
          indexes.map((idx) =>
            client.readContract({
              abi: abis.forgeFairLaunchFactory,
              address: factoryAddr,
              functionName: "launchAt",
              args: [idx],
            }),
          ),
        );
        const summaries = await Promise.all(
          pools.map(async (poolAddr) => {
            const target = poolAddr as `0x${string}`;
            const [
              token,
              currency,
              tokensForSale,
              totalRaised,
              softCap,
              startTime,
              endTime,
              status,
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
            ]);

            let tokenSymbol = "";
            let tokenName = "";
            try {
              [tokenSymbol, tokenName] = await Promise.all([
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
              ]);
            } catch {
              tokenSymbol = "TOKEN";
              tokenName = "Unknown";
            }

            return {
              pool: poolAddr as `0x${string}`,
              token: token as `0x${string}`,
              tokenSymbol,
              tokenName,
              currency: (Number(currency) === 0 ? "ZIL" : "USDC") as FairLaunchCurrencyCode,
              tokensForSale: tokensForSale as bigint,
              totalRaised: totalRaised as bigint,
              softCap: softCap as bigint,
              startTime: Number(startTime),
              endTime: Number(endTime),
              status: Number(status),
            } satisfies LaunchSummary;
          }),
        );

        if (!cancelled) {
          // show newest first
          setLaunches(summaries.reverse());
        }
      } catch (err) {
        if (!cancelled) {
          setError("Unable to load launches");
          setLaunches([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [factory, publicClient, launchCountData]);

  const content = useMemo(() => {
    if (!factory) {
      return (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Fair launch factory missing</CardTitle>
            <CardDescription>
              Set `NEXT_PUBLIC_FAIRLAUNCH_FACTORY_{chainId}` to view active launches.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }
    if (isLoading) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      );
    }
    if (error) {
      return (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      );
    }
    if (launches.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>No launches yet</CardTitle>
            <CardDescription>
              Create your first launchpad and it will show up here automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/fair-launch">Create launch</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2">
        {launches.map((launch) => (
          <LaunchCard key={launch.pool} launch={launch} chainId={chainId} />
        ))}
      </div>
    );
  }, [factory, isLoading, error, launches, chainId]);

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Explore launches"
        description="Track upcoming, live, and completed fair launches. Connect your wallet to participate."
        icon={<Sparkles className="size-6 text-primary" />}
      />
      {content}
    </div>
  );
}

function LaunchCard({ launch, chainId }: { launch: LaunchSummary; chainId: number }) {
  const currencyMeta = getCurrencyMeta(launch.currency);
  const statusConfig = statusLabels[launch.status] ?? statusLabels[0];
  const start = new Date(launch.startTime * 1000);
  const end = new Date(launch.endTime * 1000);
  const now = Date.now();
  const isLive = launch.status === 1;
  const startsIn = start.getTime() > now ? formatRelative(start) : "Started";
  const endsIn = end.getTime() > now ? formatRelative(end) : "Ended";

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{launch.tokenName}</CardTitle>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">{formatAddress(launch.pool)}</div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TimerReset className="size-3.5" /> {isLive ? `Ends ${endsIn}` : `Starts ${startsIn}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <Wallet className="size-3.5" /> {currencyMeta.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-2 text-sm">
          <StatRow
            label="Total raised"
            value={`${formatTokenAmount(launch.totalRaised, currencyMeta.decimals)} ${currencyMeta.symbol}`}
          />
          <StatRow
            label="Tokens for sale"
            value={`${formatTokenAmount(
              launch.tokensForSale,
              currencyMeta.decimals === 6 ? 18 : 18,
            )} ${launch.tokenSymbol}`}
          />
          <StatRow
            label="Soft cap"
            value={`${formatTokenAmount(launch.softCap, currencyMeta.decimals)} ${currencyMeta.symbol}`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="flex-1">
            <Link href={`/fair-launch/${launch.pool}`}>View launch</Link>
          </Button>
          <Button asChild variant="outline">
            <a href={addressUrl(chainId, launch.pool)} target="_blank" rel="noreferrer">
              Explorer
              <ArrowUpRight className="ml-1 size-3.5" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function formatRelative(date: Date) {
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minutes = Math.round(abs / (60 * 1000));
  if (minutes < 60) {
    return `${minutes} min ${diffMs > 0 ? "from now" : "ago"}`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ${diffMs > 0 ? "from now" : "ago"}`;
  }
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ${diffMs > 0 ? "from now" : "ago"}`;
}
