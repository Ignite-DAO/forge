"use client";

import { ArrowUpRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import { CreatorTools, LaunchStudio } from "@/components/launch-studio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const {
    data: launchCountData,
    isLoading: isLaunchCountLoading,
    isError: isLaunchCountError,
  } = useReadContract({
    abi: abis.forgeFairLaunchFactory,
    address: fairLaunchFactory ?? undefined,
    functionName: "launchCount",
    chainId,
    query: { enabled: Boolean(fairLaunchFactory), refetchInterval: 10000 },
  });

  const {
    data: poolCountData,
    isLoading: isPoolCountLoading,
    isError: isPoolCountError,
  } = useReadContract({
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

  const [search, setSearch] = useState("");
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
    (Boolean(bondingCurveFactory) &&
      (isBondingCurveLoading || isPoolCountLoading)) ||
    (Boolean(fairLaunchFactory) &&
      (isFairLaunchLoading || isLaunchCountLoading));
  const launchDataErrors = [
    bondingCurveError,
    fairLaunchError,
    isPoolCountError ? "Unable to connect to bonding curves" : null,
    isLaunchCountError ? "Unable to connect to fair launches" : null,
  ].filter(Boolean);

  const filteredLaunches = filterLaunches(
    allLaunches,
    activeTab,
    statusFilter,
  ).filter((item) => {
    const token = item.kind === "bonding_curve" ? item.pool : item.launch;
    return `${token.tokenName} ${token.tokenSymbol} ${token.pool}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  });

  const tabs: { value: TabValue; label: string }[] = [
    { value: "all", label: "All launches" },
    { value: "bonding_curves", label: "Bonding curves" },
    { value: "fair_launches", label: "Fair launches" },
  ];

  const statusChips: { value: StatusFilter; label: string }[] = [
    { value: "live", label: "Live" },
    { value: "upcoming", label: "Upcoming" },
    { value: "ended", label: "Ended" },
  ];

  return (
    <div className="space-y-8 pb-8 sm:space-y-10">
      <LaunchStudio />
      <CreatorTools />
      <section
        id="launches"
        className="scroll-mt-24 space-y-6"
        aria-labelledby="launches-heading"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
              The launchpad
            </p>
            <h2
              id="launches-heading"
              className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Fresh sparks. New possibilities.
            </h2>
            <p className="mt-2 text-pretty text-base text-muted-foreground">
              Explore what people are building. Find a launch that speaks to
              you.
            </p>
          </div>
          <Link
            href="/discover"
            className="flex items-center gap-2 text-sm font-medium hover:underline"
          >
            Explore all <ArrowUpRight className="size-4 shrink-0" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <fieldset
            className="no-scrollbar flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1"
            aria-label="Launch type"
          >
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring",
                  activeTab === tab.value
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </fieldset>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              type="search"
              name="launch-search"
              aria-label="Search launches"
              placeholder="Find your next spark…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 rounded-full bg-card pl-9"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <fieldset
            className="flex min-w-0 flex-wrap gap-2"
            aria-label="Launch status"
          >
            {statusChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                aria-pressed={statusFilter === chip.value}
                onClick={() =>
                  setStatusFilter(
                    statusFilter === chip.value ? null : chip.value,
                  )
                }
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring",
                  statusFilter === chip.value
                    ? "border-primary/40 bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {chip.value === "live" && (
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                )}
                {chip.label}
              </button>
            ))}
            {(search || statusFilter || activeTab !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter(null);
                  setActiveTab("all");
                }}
                className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" /> Reset
              </button>
            )}
          </fieldset>
          <output className="text-sm tabular-nums text-muted-foreground">
            {isLoadingLaunches
              ? "Checking the launchpad…"
              : `${filteredLaunches.length} ${filteredLaunches.length === 1 ? "launch" : "launches"}`}
          </output>
        </div>
        {launchDataErrors.length > 0 && (
          <p
            role="alert"
            className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-base text-destructive sm:text-sm"
          >
            Some launches could not be loaded. {launchDataErrors.join(". ")}.
            We&apos;ll keep trying to reconnect.
          </p>
        )}
        {hasNoLaunchFactories ? (
          <div className="launch-empty rounded-3xl border border-dashed p-8 sm:p-12">
            <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              A little quiet here
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">
              This launchpad isn&apos;t open yet
            </h3>
            <p className="mt-3 max-w-[48ch] text-base/7 text-muted-foreground">
              Launches aren&apos;t available on this network. Try another
              network using the selector above.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/faq">
                Get to know Torchpad <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : isLoadingLaunches && allLaunches.length === 0 ? (
          <section
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            aria-label="Loading launches"
            aria-busy="true"
          >
            {["first", "second", "third"].map((key) => (
              <Skeleton key={key} className="h-72 rounded-3xl" />
            ))}
          </section>
        ) : allLaunches.length === 0 && launchDataErrors.length > 0 ? (
          <p className="py-8 text-base text-muted-foreground">
            We&apos;re having trouble reaching the network. Please try again
            shortly.
          </p>
        ) : allLaunches.length === 0 ? (
          <div className="launch-empty relative overflow-hidden rounded-3xl border border-dashed p-8 sm:p-12">
            <div className="empty-spark" aria-hidden="true" />
            <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              Room for something new
            </p>
            <h3 className="relative mt-3 max-w-[22ch] text-balance text-3xl font-semibold tracking-tight">
              The next spark could be yours
            </h3>
            <p className="relative mt-3 max-w-[40ch] text-pretty text-base/7 text-muted-foreground">
              No launches here just yet. Every community starts with someone who
              goes first.
            </p>
            <Button asChild className="relative mt-6" size="lg">
              <Link href="/bonding-curve">
                Start something <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : filteredLaunches.length === 0 ? (
          <div className="rounded-3xl border border-dashed p-10 text-center">
            <h3 className="text-xl font-semibold">No sparks found this time</h3>
            <p className="mt-2 text-base text-muted-foreground">
              Try another name or clear your filters to see more launches.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredLaunches.map((item) =>
              item.kind === "fair_launch" ? (
                <FairLaunchCard key={item.key} launch={item.launch} />
              ) : (
                <BondingCurveCard key={item.key} pool={item.pool} />
              ),
            )}
          </div>
        )}
      </section>
      <section className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border px-6 py-7 sm:px-8">
        <div>
          <h2 className="text-balance text-xl font-semibold">
            First spark? We&apos;ve got you.
          </h2>
          <p className="mt-1 text-base text-muted-foreground sm:text-sm">
            Get to know tokens, launches, and how it all works.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/faq">
            Find your feet <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}

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
    <Link
      href={detailHref}
      className="launch-card group block rounded-3xl focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="h-full rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {pool.metadata?.image_url ? (
            <img
              src={pool.metadata.image_url}
              alt={pool.tokenName}
              className="size-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center token-avatar rounded-2xl text-lg font-semibold">
              {pool.tokenSymbol.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold">{pool.tokenName}</h3>
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
        <div className="grid grid-cols-2 gap-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Price
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              {Number(priceFormatted).toFixed(6)} ZIL
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Market Cap
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              {Number(mcapFormatted).toLocaleString()} ZIL
            </p>
          </div>
        </div>

        <div className="my-5 border-t" />
        <div>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{progress.toFixed(0)}%</span>
            <span className="uppercase tracking-wider text-muted-foreground">
              {isGraduated ? "Graduated" : "To graduation"}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isGraduated ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        <div className="my-5 border-t" />
        <div
          className={cn(
            "flex items-center justify-center rounded-full py-2.5 text-sm font-medium",
            isGraduated
              ? "border text-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {isGraduated ? "View" : "Trade"}
        </div>
      </div>
    </Link>
  );
}

function FairLaunchCard({ launch }: { launch: FairLaunchSummary }) {
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

  const ctaLabel = isLive
    ? "View launch"
    : launch.status === 0
      ? "View upcoming launch"
      : "View launch";

  return (
    <Link
      href={`/fair-launch/${launch.pool}`}
      className="launch-card group block rounded-3xl focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="h-full rounded-3xl border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center token-avatar rounded-2xl text-lg font-semibold">
            {launch.tokenSymbol.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold">
              {launch.tokenName}
            </h3>
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
        <div className="grid grid-cols-2 gap-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total Raise
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              {softCap} {currencyMeta.symbol}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Currency
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              {currencyMeta.label}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Raised
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
              {raised} {currencyMeta.symbol}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Starts
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">
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
        <div>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{progressPct.toFixed(0)}%</span>
            <span className="uppercase tracking-wider text-muted-foreground">
              {timeLabel}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="my-5 border-t" />
        <div
          className={cn(
            "flex items-center justify-center rounded-full py-2.5 text-sm font-medium",
            isLive
              ? "bg-primary text-primary-foreground"
              : "border text-foreground",
          )}
        >
          {ctaLabel}
        </div>
      </div>
    </Link>
  );
}

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
