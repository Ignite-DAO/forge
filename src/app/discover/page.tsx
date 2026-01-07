"use client";

import {
  ArrowUpRight,
  Sparkles,
  TimerReset,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { useNetwork } from "@/providers/network";
import { erc20Abi } from "@/abi/erc20";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  abis,
  getBondingCurveFactoryAddress,
  getFairLaunchFactoryAddress,
} from "@/lib/contracts";
import { addressUrl } from "@/lib/explorer";
import {
  type FairLaunchCurrencyCode,
  formatTokenAmount,
  getCurrencyMeta,
} from "@/lib/fairlaunch";
import { formatAddress } from "@/lib/format";

type FairLaunchSummary = {
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

type TokenMetadata = {
  pool_address: string;
  image_url: string | null;
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
};

type BondingCurveSummary = {
  pool: `0x${string}`;
  token: `0x${string}`;
  tokenSymbol: string;
  tokenName: string;
  currentPrice: bigint;
  marketCap: bigint;
  progressBps: bigint;
  state: number;
  metadata?: TokenMetadata;
};

const fairLaunchStatusLabels: Record<
  number,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  0: { label: "Upcoming", variant: "secondary" },
  1: { label: "Live", variant: "default" },
  2: { label: "Ready", variant: "outline" },
  3: { label: "Finalized", variant: "secondary" },
  4: { label: "Cancelled", variant: "outline" },
  5: { label: "Failed", variant: "outline" },
};

const bondingCurveStateLabels: Record<
  number,
  { label: string; variant: "default" | "secondary" }
> = {
  0: { label: "Trading", variant: "default" },
  1: { label: "Graduated", variant: "secondary" },
};

export default function DiscoverPage() {
  const { chainId } = useNetwork();
  const fairLaunchFactory = getFairLaunchFactoryAddress(chainId);
  const bondingCurveFactory = getBondingCurveFactoryAddress(chainId);
  const publicClient = usePublicClient({ chainId });

  const { data: launchCountData } = useReadContract({
    abi: abis.forgeFairLaunchFactory,
    address: fairLaunchFactory ?? undefined,
    functionName: "launchCount",
    chainId,
    query: { enabled: Boolean(fairLaunchFactory) },
  });

  const { data: poolCountData } = useReadContract({
    abi: abis.forgeBondingCurveFactory,
    address: bondingCurveFactory ?? undefined,
    functionName: "poolCount",
    chainId,
    query: { enabled: Boolean(bondingCurveFactory), refetchInterval: 5000 },
  });

  const [fairLaunches, setFairLaunches] = useState<FairLaunchSummary[]>([]);
  const [isFairLaunchLoading, setIsFairLaunchLoading] = useState(false);
  const [fairLaunchError, setFairLaunchError] = useState<string | null>(null);

  const [bondingCurvePools, setBondingCurvePools] = useState<
    BondingCurveSummary[]
  >([]);
  const [metadataMap, setMetadataMap] = useState<Record<string, TokenMetadata>>(
    {},
  );
  const [isBondingCurveLoading, setIsBondingCurveLoading] = useState(false);
  const [bondingCurveError, setBondingCurveError] = useState<string | null>(
    null,
  );

  // Fetch bonding curve metadata from API
  useEffect(() => {
    if (!chainId) return;
    fetch(`/api/launches/metadata?chainId=${chainId}&launchType=bonding_curve`)
      .then((res) => res.json())
      .then((data) => {
        if (data.metadata) {
          setMetadataMap(data.metadata);
        }
      })
      .catch(() => {});
  }, [chainId]);

  // Load fair launches
  useEffect(() => {
    if (!fairLaunchFactory || !publicClient) return;
    const factoryAddr = fairLaunchFactory as `0x${string}`;
    const client = publicClient as NonNullable<typeof publicClient>;
    const total = Number(launchCountData ?? 0n);
    if (!Number.isFinite(total) || total === 0) {
      setFairLaunches([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsFairLaunchLoading(true);
      setFairLaunchError(null);
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
              currency: (Number(currency) === 0
                ? "ZIL"
                : "USDC") as FairLaunchCurrencyCode,
              tokensForSale: tokensForSale as bigint,
              totalRaised: totalRaised as bigint,
              softCap: softCap as bigint,
              startTime: Number(startTime),
              endTime: Number(endTime),
              status: Number(status),
            } satisfies FairLaunchSummary;
          }),
        );

        if (!cancelled) {
          setFairLaunches(summaries.reverse());
        }
      } catch {
        if (!cancelled) {
          setFairLaunchError("Unable to load fair launches");
          setFairLaunches([]);
        }
      } finally {
        if (!cancelled) setIsFairLaunchLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [fairLaunchFactory, publicClient, launchCountData]);

  // Load bonding curve pools
  useEffect(() => {
    if (!bondingCurveFactory || !publicClient) return;
    const factoryAddr = bondingCurveFactory as `0x${string}`;
    const client = publicClient as NonNullable<typeof publicClient>;
    const total = Number(poolCountData ?? 0n);
    if (!Number.isFinite(total) || total === 0) {
      setBondingCurvePools([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsBondingCurveLoading(true);
      setBondingCurveError(null);
      try {
        const indexes = Array.from({ length: total }, (_, i) => BigInt(i));
        const poolAddresses = await Promise.all(
          indexes.map((idx) =>
            client.readContract({
              abi: abis.forgeBondingCurveFactory,
              address: factoryAddr,
              functionName: "poolAt",
              args: [idx],
            }),
          ),
        );
        const summaries = await Promise.all(
          poolAddresses.map(async (poolAddr) => {
            const target = poolAddr as `0x${string}`;
            const [token, currentPrice, marketCap, progressBps, state] =
              await Promise.all([
                client.readContract({
                  abi: abis.forgeBondingCurvePool,
                  address: target,
                  functionName: "token",
                }),
                client.readContract({
                  abi: abis.forgeBondingCurvePool,
                  address: target,
                  functionName: "currentPrice",
                }),
                client.readContract({
                  abi: abis.forgeBondingCurvePool,
                  address: target,
                  functionName: "marketCap",
                }),
                client.readContract({
                  abi: abis.forgeBondingCurvePool,
                  address: target,
                  functionName: "progressBps",
                }),
                client.readContract({
                  abi: abis.forgeBondingCurvePool,
                  address: target,
                  functionName: "state",
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
              pool: target,
              token: token as `0x${string}`,
              tokenSymbol,
              tokenName,
              currentPrice: currentPrice as bigint,
              marketCap: marketCap as bigint,
              progressBps: progressBps as bigint,
              state: Number(state),
            } satisfies BondingCurveSummary;
          }),
        );

        if (!cancelled) {
          setBondingCurvePools(summaries.reverse());
        }
      } catch {
        if (!cancelled) {
          setBondingCurveError("Unable to load bonding curve pools");
          setBondingCurvePools([]);
        }
      } finally {
        if (!cancelled) setIsBondingCurveLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bondingCurveFactory, publicClient, poolCountData]);

  // Merge metadata with bonding curve pools
  const poolsWithMetadata = bondingCurvePools.map((pool) => ({
    ...pool,
    metadata: metadataMap[pool.pool.toLowerCase()],
  }));

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Explore launches"
        description="Discover bonding curve tokens and fair launches. Connect your wallet to participate."
        icon={<Sparkles className="size-6 text-primary" />}
      />
      <Tabs defaultValue="bonding-curve" className="space-y-6">
        <TabsList>
          <TabsTrigger value="bonding-curve">Bonding Curve</TabsTrigger>
          <TabsTrigger value="fair-launch">Fair Launch</TabsTrigger>
        </TabsList>
        <TabsContent value="bonding-curve">
          {!bondingCurveFactory ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>Bonding curve factory missing</CardTitle>
                <CardDescription>
                  Set `NEXT_PUBLIC_BONDING_CURVE_FACTORY_{chainId}` to view
                  bonding curve pools.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : isBondingCurveLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-xl" />
              ))}
            </div>
          ) : bondingCurveError ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>Something went wrong</CardTitle>
                <CardDescription>{bondingCurveError}</CardDescription>
              </CardHeader>
            </Card>
          ) : bondingCurvePools.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No pools yet</CardTitle>
                <CardDescription>
                  Be the first to launch a token on the bonding curve!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/bonding-curve">Launch token</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {poolsWithMetadata.map((pool) => (
                <BondingCurvePoolCard
                  key={pool.pool}
                  pool={pool}
                  chainId={chainId}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="fair-launch">
          {!fairLaunchFactory ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>Fair launch factory missing</CardTitle>
                <CardDescription>
                  Set `NEXT_PUBLIC_FAIRLAUNCH_FACTORY_{chainId}` to view active
                  launches.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : isFairLaunchLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : fairLaunchError ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>Something went wrong</CardTitle>
                <CardDescription>{fairLaunchError}</CardDescription>
              </CardHeader>
            </Card>
          ) : fairLaunches.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No launches yet</CardTitle>
                <CardDescription>
                  Create your first launchpad and it will show up here
                  automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/fair-launch">Create launch</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {fairLaunches.map((launch) => (
                <FairLaunchCard
                  key={launch.pool}
                  launch={launch}
                  chainId={chainId}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BondingCurvePoolCard({
  pool,
}: {
  pool: BondingCurveSummary & { metadata?: TokenMetadata };
  chainId: number;
}) {
  const stateConfig =
    bondingCurveStateLabels[pool.state] ?? bondingCurveStateLabels[0];
  const progress = Number(pool.progressBps) / 100;
  const priceFormatted = formatUnits(pool.currentPrice, 18);
  const mcapFormatted = formatUnits(pool.marketCap, 18);
  const detailHref = `/discover/${pool.pool}`;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-3">
        <Link href={detailHref} className="flex items-start gap-3 group">
          {pool.metadata?.image_url ? (
            <Image
              src={pool.metadata.image_url}
              alt={pool.tokenName}
              width={48}
              height={48}
              className="rounded-lg object-cover shrink-0 group-hover:ring-2 group-hover:ring-primary/50 transition-all"
            />
          ) : (
            <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:ring-2 group-hover:ring-primary/50 transition-all">
              <span className="text-lg font-bold text-muted-foreground">
                {pool.tokenSymbol.slice(0, 2)}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold truncate group-hover:text-primary transition-colors">
                  {pool.tokenName}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {pool.tokenSymbol}
                </p>
              </div>
              <Badge variant={stateConfig.variant} className="shrink-0">
                {stateConfig.label}
              </Badge>
            </div>
          </div>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress to graduation</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">Price</p>
              <p className="font-medium">
                {Number(priceFormatted).toFixed(9)} ZIL
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">Market cap</p>
              <p className="font-medium">
                {Number(mcapFormatted).toLocaleString()} ZIL
              </p>
            </div>
          </div>
        </div>
        <Button asChild className="w-full">
          <Link href={detailHref}>
            <TrendingUp className="mr-1.5 size-4" />
            Trade
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function FairLaunchCard({
  launch,
  chainId,
}: {
  launch: FairLaunchSummary;
  chainId: number;
}) {
  const currencyMeta = getCurrencyMeta(launch.currency);
  const statusConfig =
    fairLaunchStatusLabels[launch.status] ?? fairLaunchStatusLabels[0];
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
          <CardTitle className="text-base font-semibold">
            {launch.tokenName}
          </CardTitle>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {formatAddress(launch.pool)}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TimerReset className="size-3.5" />{" "}
            {isLive ? `Ends ${endsIn}` : `Starts ${startsIn}`}
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
            <a
              href={addressUrl(chainId, launch.pool)}
              target="_blank"
              rel="noreferrer"
            >
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
