"use client";

import {
  ArrowUpRight,
  Gift,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
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
import {
  type FairLaunchCurrencyCode,
  formatTokenAmount,
  getCurrencyMeta,
} from "@/lib/fairlaunch";
import { cn } from "@/lib/utils";
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

const fairLaunchStatusLabels: Record<number, string> = {
  0: "UPCOMING",
  1: "LIVE",
  2: "READY",
  3: "FINALIZED",
  4: "CANCELLED",
  5: "FAILED",
};

const bondingCurveStateLabels: Record<number, string> = {
  0: "TRADING",
  1: "GRADUATED",
};

const HOME_LAUNCH_LIMIT = 45;

type TabValue = "all" | "bonding_curves" | "fair_launches";
type StatusFilter = "live" | "upcoming" | "ended" | null;

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

function isItemLive(item: HomeLaunchItem): boolean {
  if (item.kind === "bonding_curve") return item.pool.state === 0;
  return item.launch.status === 1;
}

function isItemUpcoming(item: HomeLaunchItem): boolean {
  if (item.kind === "bonding_curve") return false;
  return item.launch.status === 0;
}

function isItemEnded(item: HomeLaunchItem): boolean {
  if (item.kind === "bonding_curve") return item.pool.state === 1;
  return item.launch.status >= 2;
}

function filterLaunches(
  items: HomeLaunchItem[],
  tab: TabValue,
  status: StatusFilter,
): HomeLaunchItem[] {
  let filtered = items;

  if (tab === "bonding_curves") {
    filtered = filtered.filter((i) => i.kind === "bonding_curve");
  } else if (tab === "fair_launches") {
    filtered = filtered.filter((i) => i.kind === "fair_launch");
  }

  if (status === "live") {
    filtered = filtered.filter(isItemLive);
  } else if (status === "upcoming") {
    filtered = filtered.filter(isItemUpcoming);
  } else if (status === "ended") {
    filtered = filtered.filter(isItemEnded);
  }

  return filtered;
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

  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);

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

  const filteredLaunches = filterLaunches(allLaunches, activeTab, statusFilter);

  const tabs: { value: TabValue; label: string }[] = [
    { value: "all", label: "All" },
    { value: "bonding_curves", label: "Bonding Curves" },
    { value: "fair_launches", label: "Fair Launches" },
  ];

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: "live", label: "Live" },
    { value: "upcoming", label: "Upcoming" },
    { value: "ended", label: "Ended" },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Hero */}
      <section className="relative isolate overflow-hidden rounded-3xl py-20 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10 hero-mesh" />
        <div className="pointer-events-none absolute inset-0 -z-10 hero-grid opacity-[0.06] dark:opacity-[0.07]" />
        <div className="pointer-events-none absolute inset-0 -z-10 hero-grain opacity-[0.30] dark:opacity-[0.18]" />
        <div className="pointer-events-none absolute -z-10 hero-blob hero-blob-1" />
        <div className="pointer-events-none absolute -z-10 hero-blob hero-blob-2" />
        <div className="pointer-events-none absolute -z-10 hero-blob hero-blob-3" />
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          The launchpad for Zilliqa
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
          Create tokens, launch bonding curves, run fair raises, and airdrop — all in one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild size="lg" className="rounded-full text-base font-semibold">
            <Link href="/bonding-curve">Launch a Token</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-full text-base font-semibold">
            <Link href="/discover">Discover</Link>
          </Button>
        </div>
      </section>

      <div>
        <h2 className="text-3xl font-bold tracking-tight">All Launches</h2>
        <p className="mt-1 text-muted-foreground">
          Bonding curves and fair launches in one feed.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-full border p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {statusChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() =>
                setStatusFilter(statusFilter === chip.value ? null : chip.value)
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors",
                statusFilter === chip.value
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:border-foreground/40",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      <section>
        {hasNoLaunchFactories ? (
          <Card className="border border-destructive">
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
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => `launch-skeleton-${i}`).map(
              (skeletonKey) => (
                <Skeleton key={skeletonKey} className="h-72 rounded-2xl" />
              ),
            )}
          </div>
        ) : allLaunches.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border py-20 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
              <Sparkles className="size-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold">No launches yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Be the first to launch a token on Torchpad.
            </p>
            <Button asChild variant="outline" className="mt-5 rounded-full">
              <Link href="/bonding-curve">Launch a Token</Link>
            </Button>
          </div>
        ) : (
          <>
            {launchDataErrors.length > 0 && (
              <p className="mb-4 text-xs text-muted-foreground">
                Some data is unavailable: {launchDataErrors.join(" · ")}
              </p>
            )}

            {filteredLaunches.length === 0 ? (
              <p className="py-16 text-center text-muted-foreground">
                No launches match the current filters.
              </p>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {filteredLaunches.map((item) =>
                  item.kind === "fair_launch" ? (
                    <FairLaunchCard
                      key={item.key}
                      launch={item.launch}
                    />
                  ) : (
                    <BondingCurveCard key={item.key} pool={item.pool} />
                  ),
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/bonding-curve"
          className="group flex items-center gap-3 rounded-2xl border p-5 transition-colors hover:bg-muted/50"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <TrendingUp className="size-5 text-muted-foreground" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold">Bonding Curve</div>
            <div className="text-xs text-muted-foreground">
              Launch with instant liquidity
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>

        <Link
          href="/fair-launch"
          className="group flex items-center gap-3 rounded-2xl border p-5 transition-colors hover:bg-muted/50"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-5 text-muted-foreground" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold">Fair Launch</div>
            <div className="text-xs text-muted-foreground">
              Community-first raises
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>

        <Link
          href="/airdrop"
          className="group flex items-center gap-3 rounded-2xl border p-5 transition-colors hover:bg-muted/50"
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Gift className="size-5 text-muted-foreground" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold">Airdrop</div>
            <div className="text-xs text-muted-foreground">
              Batch distribute tokens
            </div>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card Components                                                     */
/* ------------------------------------------------------------------ */

function BondingCurveCard({
  pool,
}: {
  pool: BondingCurveSummary & { metadata?: TokenMetadata };
}) {
  const isGraduated = pool.state === 1;
  const statusLabel = bondingCurveStateLabels[pool.state] ?? "TRADING";
  const progress = Number(pool.progressBps) / 100;
  const priceFormatted = formatUnits(pool.currentPrice, 18);
  const mcapFormatted = formatUnits(pool.marketCap, 18);
  const detailHref = `/discover/${pool.pool}`;

  return (
    <Link href={detailHref} className="block">
      <div className="rounded-2xl bg-card p-6 transition-colors hover:brightness-[0.98] dark:hover:brightness-110">
        {/* Header */}
        <div className="flex items-start gap-4">
          {pool.metadata?.image_url ? (
            <img
              src={pool.metadata.image_url}
              alt={pool.tokenName}
              className="size-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
              {pool.tokenSymbol.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold">{pool.tokenName}</h3>
            <p className="text-sm text-muted-foreground">{pool.tokenSymbol}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider",
              isGraduated
                ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
            )}
          >
            {statusLabel}
          </span>
        </div>

        <div className="my-5 border-t" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Price
            </p>
            <p className="mt-0.5 text-sm font-bold">
              {Number(priceFormatted).toFixed(6)} ZIL
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Market Cap
            </p>
            <p className="mt-0.5 text-sm font-bold">
              {Number(mcapFormatted).toLocaleString()} ZIL
            </p>
          </div>
        </div>

        <div className="my-5 border-t" />

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{progress.toFixed(0)}%</span>
            <span className="uppercase tracking-wider text-muted-foreground">
              {isGraduated ? "Graduated" : "To graduation"}
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isGraduated ? "bg-emerald-500" : "bg-foreground",
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="my-5 border-t" />

        {/* CTA */}
        <div
          className={cn(
            "flex items-center justify-center rounded-full py-2.5 text-sm font-medium",
            isGraduated
              ? "border text-foreground"
              : "bg-foreground text-background",
          )}
        >
          {isGraduated ? "View" : "Trade"}
        </div>
      </div>
    </Link>
  );
}

function FairLaunchCard({
  launch,
}: {
  launch: FairLaunchSummary;
}) {
  const currencyMeta = getCurrencyMeta(launch.currency);
  const statusLabel = fairLaunchStatusLabels[launch.status] ?? "UPCOMING";
  const isLive = launch.status === 1;
  const start = new Date(launch.startTime * 1000);
  const end = new Date(launch.endTime * 1000);
  const now = Date.now();
  const raised = formatTokenAmount(launch.totalRaised, currencyMeta.decimals);
  const softCap = formatTokenAmount(launch.softCap, currencyMeta.decimals);
  const progressPct =
    Number(launch.softCap) > 0
      ? Math.min(
          (Number(launch.totalRaised) / Number(launch.softCap)) * 100,
          100,
        )
      : 0;

  const timeLabel = isLive
    ? formatCountdown(end)
    : start.getTime() > now
      ? `Starts ${formatCountdown(start)}`
      : "Ended";

  const ctaLabel = isLive ? "Invest" : launch.status === 0 ? "Notify Me" : "View";

  return (
    <Link href={`/fair-launch/${launch.pool}`} className="block">
      <div className="rounded-2xl bg-card p-6 transition-colors hover:brightness-[0.98] dark:hover:brightness-110">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
            {launch.tokenSymbol.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold">{launch.tokenName}</h3>
            <p className="text-sm text-muted-foreground">
              {launch.tokenSymbol}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider",
              isLive
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "text-foreground",
            )}
          >
            {statusLabel}
          </span>
        </div>

        <div className="my-5 border-t" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Raise
            </p>
            <p className="mt-0.5 text-sm font-bold">
              {softCap} {currencyMeta.symbol}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Currency
            </p>
            <p className="mt-0.5 text-sm font-bold">{currencyMeta.label}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Raised
            </p>
            <p className="mt-0.5 text-sm font-bold">
              {raised} {currencyMeta.symbol}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Starts
            </p>
            <p className="mt-0.5 text-sm font-bold">
              {start.getTime() > now
                ? start.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Now"}
            </p>
          </div>
        </div>

        <div className="my-5 border-t" />

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{progressPct.toFixed(0)}%</span>
            <span className="uppercase tracking-wider text-muted-foreground">
              {timeLabel}
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="my-5 border-t" />

        {/* CTA */}
        <div
          className={cn(
            "flex items-center justify-center rounded-full py-2.5 text-sm font-medium",
            isLive
              ? "bg-foreground text-background"
              : "border text-foreground",
          )}
        >
          {ctaLabel}
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCountdown(date: Date) {
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "Now";
  const abs = Math.abs(diffMs);
  const minutes = Math.floor(abs / (60 * 1000));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) {
    const remainHours = hours % 24;
    return `${String(days).padStart(2, "0")}D ${String(remainHours).padStart(2, "0")}H LEFT`;
  }
  const remainMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}H ${String(remainMinutes).padStart(2, "0")}M LEFT`;
}
