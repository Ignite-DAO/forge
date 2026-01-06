"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { toast } from "sonner";
import { Rocket, ArrowUpRight, TrendingUp, Loader2 } from "lucide-react";

import { abis, getBondingCurveFactoryAddress } from "@/lib/contracts";
import { erc20Abi } from "@/abi/erc20";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { formatAddress } from "@/lib/format";
import { addressUrl } from "@/lib/explorer";

type PoolSummary = {
  pool: `0x${string}`;
  token: `0x${string}`;
  tokenSymbol: string;
  tokenName: string;
  currentPrice: bigint;
  marketCap: bigint;
  progressBps: bigint;
  state: number;
};

const stateLabels: Record<number, { label: string; variant: "default" | "secondary" }> = {
  0: { label: "Trading", variant: "default" },
  1: { label: "Graduated", variant: "secondary" },
};

export default function BondingCurveDiscoverPage() {
  const chainId = useChainId();
  const factory = getBondingCurveFactoryAddress(chainId);
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();

  const { data: poolCountData, refetch: refetchPoolCount } = useReadContract({
    abi: abis.forgeBondingCurveFactory,
    address: factory ?? undefined,
    functionName: "poolCount",
    query: { enabled: Boolean(factory), refetchInterval: 5000 },
  });

  const { data: creationFeeData } = useReadContract({
    abi: abis.forgeBondingCurveFactory,
    address: factory ?? undefined,
    functionName: "creationFee",
    query: { enabled: Boolean(factory) },
  });

  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [createTx, setCreateTx] = useState<`0x${string}` | null>(null);
  const [createdPool, setCreatedPool] = useState<`0x${string}` | null>(null);

  const { writeContractAsync, isPending: isCreating } = useWriteContract();
  const { isLoading: isCreateConfirming, isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({
    hash: createTx ?? undefined,
  });

  // Load pools
  useEffect(() => {
    if (!factory || !publicClient) return;
    const factoryAddr = factory as `0x${string}`;
    const client = publicClient as NonNullable<typeof publicClient>;
    const total = Number(poolCountData ?? 0n);
    if (!Number.isFinite(total) || total === 0) {
      setPools([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
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
            const [token, currentPrice, marketCap, progressBps, state] = await Promise.all([
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
            } satisfies PoolSummary;
          }),
        );

        if (!cancelled) {
          setPools(summaries.reverse());
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load pools");
          setPools([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [factory, publicClient, poolCountData]);

  const handleCreate = async () => {
    if (!factory || !name.trim() || !symbol.trim()) {
      toast.error("Enter a name and symbol");
      return;
    }
    if (!isConnected || !address) {
      toast.error("Connect your wallet");
      return;
    }
    try {
      const tx = await writeContractAsync({
        abi: abis.forgeBondingCurveFactory,
        address: factory,
        functionName: "createPool",
        args: [{ name: name.trim(), symbol: symbol.trim().toUpperCase(), metadataURI: metadataURI.trim() }],
        value: creationFeeData ?? 0n,
      });
      setCreateTx(tx);
      toast.info("Transaction submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Failed to create", { description: err?.message });
    }
  };

  // Handle successful creation
  useEffect(() => {
    if (isCreateSuccess && createTx && publicClient) {
      const client = publicClient as NonNullable<typeof publicClient>;
      client.getTransactionReceipt({ hash: createTx }).then((receipt) => {
        const poolCreatedLog = receipt.logs.find((log) => {
          try {
            return log.topics[0] === "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0" ||
              log.topics.length === 4;
          } catch {
            return false;
          }
        });
        if (poolCreatedLog && poolCreatedLog.topics[1]) {
          const poolAddress = `0x${poolCreatedLog.topics[1].slice(26)}` as `0x${string}`;
          setCreatedPool(poolAddress);
        }
        void refetchPoolCount();
        setName("");
        setSymbol("");
        setMetadataURI("");
        setCreateTx(null);
      });
    }
  }, [isCreateSuccess, createTx, publicClient, refetchPoolCount]);

  const creationFee = creationFeeData ? formatUnits(creationFeeData, 18) : "0";

  if (!factory) {
    return (
      <div className="space-y-8 pb-12">
        <PageHeader
          title="Bonding Curve"
          description="Launch tokens with automatic liquidity via bonding curves"
          icon={<Rocket className="size-6 text-primary" />}
        />
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Factory not configured</CardTitle>
            <CardDescription>
              Set `NEXT_PUBLIC_BONDING_CURVE_FACTORY_{chainId}` to enable bonding curve pools.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Bonding Curve"
        description="Launch tokens with automatic liquidity via bonding curves"
        icon={<Rocket className="size-6 text-primary" />}
      />

      {/* Create Token Card */}
      <Card>
        <CardHeader>
          <CardTitle>Launch a token</CardTitle>
          <CardDescription>
            Create a new token with an instant bonding curve. Graduates to Uniswap V3 at target market cap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {createdPool ? (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Token created successfully!</p>
              <Button asChild>
                <Link href={`/bonding-curve/${createdPool}`}>View your token</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCreatedPool(null)}>
                Create another
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Token"
                    maxLength={64}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="MTK"
                    maxLength={12}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metadata">Metadata URI (optional)</Label>
                <Input
                  id="metadata"
                  value={metadataURI}
                  onChange={(e) => setMetadataURI(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              {Number(creationFee) > 0 && (
                <p className="text-sm text-muted-foreground">Creation fee: {creationFee} ZIL</p>
              )}
              <Button
                onClick={handleCreate}
                disabled={isCreating || isCreateConfirming || !name.trim() || !symbol.trim()}
              >
                {(isCreating || isCreateConfirming) && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isCreating ? "Confirm in wallet..." : isCreateConfirming ? "Creating..." : "Launch token"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pools Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Active pools</h2>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : pools.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No pools yet</CardTitle>
              <CardDescription>Be the first to launch a token on the bonding curve!</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pools.map((pool) => (
              <PoolCard key={pool.pool} pool={pool} chainId={chainId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PoolCard({ pool, chainId }: { pool: PoolSummary; chainId: number }) {
  const stateConfig = stateLabels[pool.state] ?? stateLabels[0];
  const progress = Number(pool.progressBps) / 100;
  const priceFormatted = formatUnits(pool.currentPrice, 18);
  const mcapFormatted = formatUnits(pool.marketCap, 18);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">{pool.tokenName}</CardTitle>
            <p className="text-sm text-muted-foreground">{pool.tokenSymbol}</p>
          </div>
          <Badge variant={stateConfig.variant}>{stateConfig.label}</Badge>
        </div>
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
              <p className="font-medium">{Number(priceFormatted).toFixed(9)} ZIL</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">Market cap</p>
              <p className="font-medium">{Number(mcapFormatted).toLocaleString()} ZIL</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link href={`/bonding-curve/${pool.pool}`}>
              <TrendingUp className="mr-1.5 size-4" />
              Trade
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <a href={addressUrl(chainId, pool.pool)} target="_blank" rel="noreferrer">
              <ArrowUpRight className="size-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
