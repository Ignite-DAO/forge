"use client";

import {
  ArrowUpRight,
  Gift,
  Rocket,
  Sparkles,
  TimerReset,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
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
import { useNetwork } from "@/providers/network";

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

type HomeLaunchItem =
  | {
      kind: "bonding_curve";
      key: string;
      pool: BondingCurveSummary & { metadata?: TokenMetadata };
    }
  | {
      kind: "fair_launch";
      key: string;
      launch: FairLaunchSummary;
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

const HOME_LAUNCH_LIMIT = 45;

function buildMixedLaunches(
  bondingCurvePools: (BondingCurveSummary & { metadata?: TokenMetadata })[],
  fairLaunches: FairLaunchSummary[],
): HomeLaunchItem[] {
  const mixed: HomeLaunchItem[] = [];
  const maxLength = Math.max(bondingCurvePools.length, fairLaunches.length);

  for (let i = 0; i < maxLength; i += 1) {
    const bondingPool = bondingCurvePools[i];
    if (bondingPool) {
      mixed.push({
        kind: "bonding_curve",
        key: `bonding-${bondingPool.pool}`,
        pool: bondingPool,
      });
    }

    const fairLaunch = fairLaunches[i];
    if (fairLaunch) {
      mixed.push({
        kind: "fair_launch",
        key: `fair-${fairLaunch.pool}`,
        launch: fairLaunch,
      });
    }
  }

  return mixed;
}

export default function Home() {
  const { chainId } = useNetwork();
  const fairLaunchFactory = getFairLaunchFactoryAddress(chainId);
  const bondingCurveFactory = getBondingCurveFactoryAddress(chainId);
  const publicClient = usePublicClient({ chainId });

  const { data: launchCountData } = useReadContract({
    abi: abis.forgeFairLaunchFactory,
    address: fairLaunchFactory ?? undefined,
    functionName: "launchCount",
    chainId,
    query: { enabled: Boolean(fairLaunchFactory), refetchInterval: 10000 },
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

  const poolsWithMetadata = bondingCurvePools.map((pool) => ({
    ...pool,
    metadata: metadataMap[pool.pool.toLowerCase()],
  }));
  const allLaunches = buildMixedLaunches(poolsWithMetadata, fairLaunches).slice(
    0,
    HOME_LAUNCH_LIMIT,
  );
  const hasNoLaunchFactories = !bondingCurveFactory && !fairLaunchFactory;
  const isLoadingLaunches =
    (Boolean(bondingCurveFactory) && isBondingCurveLoading) ||
    (Boolean(fairLaunchFactory) && isFairLaunchLoading);
  const launchDataErrors = [bondingCurveError, fairLaunchError].filter(Boolean);

  return (
    <div className="space-y-10 pb-12">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Launch and discover tokens in one place.
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Create bonding curve launches, run fair launches, and distribute
            airdrops on Zilliqa EVM. Browse live opportunities directly below.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link
                href="/bonding-curve"
                className="inline-flex items-center gap-1.5"
              >
                Launch Token
                <Rocket className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link
                href="/discover"
                className="inline-flex items-center gap-1.5"
              >
                All Launches
                <Sparkles className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">All launches</h2>
            <p className="text-sm text-muted-foreground">
              Bonding curves and fair launches in one feed.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/discover">View all launches</Link>
          </Button>
        </div>

        {hasNoLaunchFactories ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle>Launch factories missing</CardTitle>
              <CardDescription>
                Set <code>NEXT_PUBLIC_BONDING_CURVE_FACTORY_{"{chainId}"}</code>{" "}
                and <code>NEXT_PUBLIC_FAIRLAUNCH_FACTORY_{"{chainId}"}</code> to
                load launch data.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : isLoadingLaunches && allLaunches.length === 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => `launch-skeleton-${i}`).map(
              (skeletonKey) => (
                <Skeleton key={skeletonKey} className="h-52 rounded-xl" />
              ),
            )}
          </div>
        ) : allLaunches.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No launches yet</CardTitle>
              <CardDescription>
                Be the first to launch a token on Torchpad.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/bonding-curve">Launch token</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {launchDataErrors.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Some data is unavailable right now:{" "}
                {launchDataErrors.join(" • ")}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allLaunches.map((item) =>
                item.kind === "fair_launch" ? (
                  <FairLaunchCard
                    key={item.key}
                    launch={item.launch}
                    chainId={chainId}
                    showFairLaunchBadge
                  />
                ) : (
                  <BondingCurvePoolCard key={item.key} pool={item.pool} />
                ),
              )}
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/bonding-curve"
          className="group rounded-xl border border-border p-5 transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <TrendingUp className="size-5" />
            </span>
            <div>
              <div className="font-medium">Bonding Curve</div>
              <div className="text-sm text-muted-foreground">
                Launch with instant liquidity
              </div>
            </div>
          </div>
        </Link>

        <Link
          href="/fair-launch"
          className="group rounded-xl border border-border p-5 transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            <div>
              <div className="font-medium">Fair Launch</div>
              <div className="text-sm text-muted-foreground">
                Community-first raises
              </div>
            </div>
          </div>
        </Link>

        <Link
          href="/airdrop"
          className="group rounded-xl border border-border p-5 transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Gift className="size-5" />
            </span>
            <div>
              <div className="font-medium">Airdrop</div>
              <div className="text-sm text-muted-foreground">
                Batch distribute tokens
              </div>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}

function BondingCurvePoolCard({
  pool,
}: {
  pool: BondingCurveSummary & { metadata?: TokenMetadata };
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
        <Link href={detailHref} className="group flex items-start gap-3">
          {pool.metadata?.image_url ? (
            <img
              src={pool.metadata.image_url}
              alt={pool.tokenName}
              className="size-12 shrink-0 rounded-lg object-cover transition-all group-hover:ring-2 group-hover:ring-primary/50"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted transition-all group-hover:ring-2 group-hover:ring-primary/50">
              <span className="text-lg font-bold text-muted-foreground">
                {pool.tokenSymbol.slice(0, 2)}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="truncate text-base font-semibold transition-colors group-hover:text-primary">
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
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/65 via-primary to-primary/75 shadow-sm shadow-primary/40 transition-all duration-500 ease-out"
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
  showFairLaunchBadge = false,
}: {
  launch: FairLaunchSummary;
  chainId: number;
  showFairLaunchBadge?: boolean;
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
          <div className="flex items-center gap-2">
            {showFairLaunchBadge && (
              <Badge variant="outline">Fair launch</Badge>
            )}
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {formatAddress(launch.pool)}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TimerReset className="size-3.5" />
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
            value={`${formatTokenAmount(launch.tokensForSale, 18)} ${launch.tokenSymbol}`}
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
