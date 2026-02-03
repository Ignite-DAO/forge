"use client";

import {
  Coins,
  Gift,
  Rocket,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient, useReadContract } from "wagmi";
import { useNetwork } from "@/providers/network";
import { erc20Abi } from "@/abi/erc20";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  abis,
  getBondingCurveFactoryAddress,
} from "@/lib/contracts";

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

const bondingCurveStateLabels: Record<
  number,
  { label: string; variant: "default" | "secondary" }
> = {
  0: { label: "Trading", variant: "default" },
  1: { label: "Graduated", variant: "secondary" },
};

export default function Home() {
  const { chainId } = useNetwork();
  const bondingCurveFactory = getBondingCurveFactoryAddress(chainId);
  const publicClient = usePublicClient({ chainId });

  const { data: poolCountData } = useReadContract({
    abi: abis.forgeBondingCurveFactory,
    address: bondingCurveFactory ?? undefined,
    functionName: "poolCount",
    chainId,
    query: { enabled: Boolean(bondingCurveFactory), refetchInterval: 10000 },
  });

  const [bondingCurvePools, setBondingCurvePools] = useState<
    BondingCurveSummary[]
  >([]);
  const [metadataMap, setMetadataMap] = useState<Record<string, TokenMetadata>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);

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
      setIsLoading(true);
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
          setBondingCurvePools([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
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

  const tradingPools = poolsWithMetadata.filter((p) => p.state === 0);
  const displayPools = tradingPools.slice(0, 6);

  return (
    <div className="space-y-12 pb-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-12">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Launch tokens. Trade instantly.
          </h1>
          <p className="text-base text-muted-foreground mt-3">
            Create bonding curve tokens, run fair launches, and distribute airdrops. All on-chain.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/bonding-curve" className="inline-flex items-center gap-1.5">
                Launch Token
                <Rocket className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/discover" className="inline-flex items-center gap-1.5">
                Explore All
                <Sparkles className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
      </section>

      {/* Live Launches */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Live Launches</h2>
            {tradingPools.length > 0 && (
              <Badge variant="default">{tradingPools.length} trading</Badge>
            )}
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/discover">View all</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : displayPools.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No live launches yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Be the first to launch a token on the bonding curve!
              </p>
              <Button asChild size="sm">
                <Link href="/bonding-curve">Launch now</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayPools.map((pool) => (
              <PoolCard key={pool.pool} pool={pool} />
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/bonding-curve"
          className="group rounded-xl border border-border p-5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
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
          className="group rounded-xl border border-border p-5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Sparkles className="size-5" />
            </span>
            <div>
              <div className="font-medium">Fair Launch</div>
              <div className="text-sm text-muted-foreground">
                Equal opportunity for all
              </div>
            </div>
          </div>
        </Link>
        <Link
          href="/airdrop"
          className="group rounded-xl border border-border p-5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Gift className="size-5" />
            </span>
            <div>
              <div className="font-medium">Airdrop</div>
              <div className="text-sm text-muted-foreground">
                Distribute tokens easily
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* How It Works */}
      <section>
        <h2 className="text-xl font-semibold mb-4">How It Works</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="size-4" />
              </span>
              <h3 className="font-medium">Bonding Curve</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Launch tokens with automatic liquidity. Price increases with each purchase. Auto-migrates to PlunderSwap at graduation.
            </p>
          </div>
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-4" />
              </span>
              <h3 className="font-medium">Fair Launch</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Community-first raises with soft/hard caps, liquidity %, and optional whitelists. Auto-lists on PlunderSwap.
            </p>
          </div>
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Coins className="size-4" />
              </span>
              <h3 className="font-medium">Token Creation</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Simple ERC-20 factory. Set name, symbol, decimals, and supply. Full supply minted to your wallet.
            </p>
          </div>
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Gift className="size-4" />
              </span>
              <h3 className="font-medium">Airdrops</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Batch distribute to up to 500 recipients via CSV. Approve once, send to all addresses at once.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function PoolCard({
  pool,
}: {
  pool: BondingCurveSummary & { metadata?: TokenMetadata };
}) {
  const stateConfig =
    bondingCurveStateLabels[pool.state] ?? bondingCurveStateLabels[0];
  const progress = Number(pool.progressBps) / 100;
  const mcapFormatted = formatUnits(pool.marketCap, 18);
  const detailHref = `/discover/${pool.pool}`;

  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-colors">
      <Link href={detailHref}>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {pool.metadata?.image_url ? (
              <img
                src={pool.metadata.image_url}
                alt={pool.tokenName}
                className="size-10 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-muted-foreground">
                  {pool.tokenSymbol.slice(0, 2)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold truncate">
                    {pool.tokenName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {pool.tokenSymbol}
                  </p>
                </div>
                <Badge variant={stateConfig.variant} className="text-[10px] shrink-0">
                  {stateConfig.label}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground">Market cap</span>
              <span className="font-medium">
                {Number(mcapFormatted).toLocaleString()} ZIL
              </span>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
