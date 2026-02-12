"use client";

import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Send,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useBalance,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { abis } from "@/lib/contracts";
import { addressUrl } from "@/lib/explorer";
import { formatAddress } from "@/lib/format";
import { useNetwork } from "@/providers/network";

type TokenMetadata = {
  pool_address: string;
  image_url: string | null;
  description: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
};

type CurveSnapshot = {
  currentPrice: bigint;
  virtualTokenReserve: bigint;
  virtualZilReserve: bigint;
  realZilReserve: bigint;
  tradingFeePercent: bigint;
  k: bigint;
  feesCollected: bigint;
};

const stateLabels: Record<
  number,
  { label: string; variant: "default" | "secondary" }
> = {
  0: { label: "Trading", variant: "default" },
  1: { label: "Graduated", variant: "secondary" },
};

const REFETCH_INTERVAL = 10000;
const BPS_DENOMINATOR = 10_000n;
const ONE_ETHER = 1_000_000_000_000_000_000n;
const SAMPLE_STEPS_BPS = [10n, 50n, 100n, 250n, 500n] as const;
const PRICE_MOVE_UP_BPS = [1000n, 2500n, 5000n, 10000n] as const;
const PRICE_MOVE_DOWN_BPS = [1000n, 2500n, 5000n] as const;
const BUY_SAMPLE_MIN = 25n * ONE_ETHER;
const BUY_SAMPLE_MAX = 100_000n * ONE_ETHER;
const SELL_SAMPLE_MIN = 10_000n * ONE_ETHER;
const SELL_SAMPLE_MAX = 50_000_000n * ONE_ETHER;
const FIXED_EXECUTION_ZIL_INPUTS = [
  10n * ONE_ETHER,
  100n * ONE_ETHER,
  1_000n * ONE_ETHER,
] as const;
const CURVE_MAP_BUY_STEPS_BPS = [500n, 1000n, 2500n, 5000n, 10_000n] as const;
const CURVE_MAP_SELL_STEPS_BPS = [500n, 1000n, 2500n, 5000n, 10_000n] as const;
const ROUND_TRIP_ZIL_INPUTS = [
  10n * ONE_ETHER,
  100n * ONE_ETHER,
  1_000n * ONE_ETHER,
] as const;
const WALLET_EXIT_BPS = [2500n, 5000n, 10_000n] as const;

// Contract minimum amounts
const MIN_BUY_AMOUNT = 0.001; // 0.001 ZIL
const MIN_SELL_TOKENS = 0.001; // 0.001 tokens (1e15 wei)

export default function BondingCurvePoolPage() {
  const params = useParams<{ address: string }>();
  const poolAddress = params?.address?.toLowerCase() as
    | `0x${string}`
    | undefined;
  const { chainId } = useNetwork();
  const { address, isConnected } = useAccount();

  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [buyTx, setBuyTx] = useState<`0x${string}` | null>(null);
  const [sellTx, setSellTx] = useState<`0x${string}` | null>(null);
  const [approveTx, setApproveTx] = useState<`0x${string}` | null>(null);

  const poolContract = {
    abi: abis.forgeBondingCurvePool,
    address: poolAddress,
    chainId,
  } as const;

  const {
    data: poolData,
    isLoading: isPoolLoading,
    isError: isPoolError,
  } = useReadContracts({
    contracts: [
      { ...poolContract, functionName: "token" },
      { ...poolContract, functionName: "creator" },
      { ...poolContract, functionName: "state" },
      { ...poolContract, functionName: "currentPrice" },
      { ...poolContract, functionName: "marketCap" },
      { ...poolContract, functionName: "progressBps" },
      { ...poolContract, functionName: "tokensSold" },
      { ...poolContract, functionName: "realZilReserve" },
      { ...poolContract, functionName: "tradingFeePercent" },
      { ...poolContract, functionName: "graduationMarketCap" },
      { ...poolContract, functionName: "virtualTokenReserve" },
      { ...poolContract, functionName: "virtualZilReserve" },
      { ...poolContract, functionName: "k" },
      { ...poolContract, functionName: "initialVirtualZilReserve" },
      { ...poolContract, functionName: "feesCollected" },
      { ...poolContract, functionName: "TOTAL_SUPPLY" },
    ],
    query: {
      enabled: !!poolAddress,
      refetchInterval: REFETCH_INTERVAL,
    },
  });

  const tokenAddress = poolData?.[0]?.result as `0x${string}` | undefined;

  const { data: tokenSymbol } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: "symbol",
    chainId,
    query: { enabled: !!tokenAddress },
  });

  const { data: tokenName } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: "name",
    chainId,
    query: { enabled: !!tokenAddress },
  });

  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: !!tokenAddress && !!address,
      refetchInterval: REFETCH_INTERVAL,
    },
  });

  const { data: zilBalance } = useBalance({
    address,
    chainId,
    query: {
      enabled: !!address,
      refetchInterval: REFETCH_INTERVAL,
    },
  });

  const { data: userAllowance, refetch: refetchAllowance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: "allowance",
    args: address && poolAddress ? [address, poolAddress] : undefined,
    chainId,
    query: {
      enabled: !!tokenAddress && !!address && !!poolAddress,
      refetchInterval: REFETCH_INTERVAL,
    },
  });

  const zilAmountParsed = useMemo(() => {
    if (!buyAmount) return 0n;
    try {
      return parseUnits(buyAmount, 18);
    } catch {
      return 0n;
    }
  }, [buyAmount]);

  const { data: buyQuoteData } = useReadContract({
    ...poolContract,
    functionName: "quoteBuy",
    args: [zilAmountParsed],
    query: {
      enabled: !!poolAddress && zilAmountParsed > 0n,
    },
  });

  const tokenAmountParsed = useMemo(() => {
    if (!sellAmount) return 0n;
    try {
      return parseUnits(sellAmount, 18);
    } catch {
      return 0n;
    }
  }, [sellAmount]);

  const { data: sellQuoteData } = useReadContract({
    ...poolContract,
    functionName: "quoteSell",
    args: [tokenAmountParsed],
    query: {
      enabled: !!poolAddress && tokenAmountParsed > 0n,
    },
  });

  const buyQuote = buyQuoteData
    ? { tokensOut: buyQuoteData[0], fee: buyQuoteData[1] }
    : null;
  const sellQuote = sellQuoteData
    ? { zilOut: sellQuoteData[0], fee: sellQuoteData[1] }
    : null;

  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { isLoading: isBuyConfirming, isSuccess: isBuySuccess } =
    useWaitForTransactionReceipt({ hash: buyTx ?? undefined });
  const { isLoading: isSellConfirming, isSuccess: isSellSuccess } =
    useWaitForTransactionReceipt({ hash: sellTx ?? undefined });
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTx ?? undefined });

  useEffect(() => {
    if (!poolAddress) return;
    fetch(`/api/launches/metadata/${poolAddress}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) setMetadata(data);
      })
      .catch(() => {});
  }, [poolAddress]);

  useEffect(() => {
    if (isBuySuccess) {
      setBuyAmount("");
      setBuyTx(null);
      toast.success("Purchase successful!");
    }
  }, [isBuySuccess]);

  useEffect(() => {
    if (isSellSuccess) {
      setSellAmount("");
      setSellTx(null);
      refetchBalance();
      toast.success("Sale successful!");
    }
  }, [isSellSuccess, refetchBalance]);

  useEffect(() => {
    if (isApproveSuccess) {
      setApproveTx(null);
      refetchAllowance();
      toast.success("Approval confirmed");
    }
  }, [isApproveSuccess, refetchAllowance]);

  const handleBuy = async () => {
    if (!poolAddress || !buyAmount || !buyQuote) return;
    if (!isConnected || !address) {
      toast.error("Connect your wallet");
      return;
    }
    const buyAmountNum = parseFloat(buyAmount);
    if (buyAmountNum < MIN_BUY_AMOUNT) {
      toast.error("Amount too small", {
        description: `Minimum buy is ${MIN_BUY_AMOUNT} ZIL`,
      });
      return;
    }
    try {
      const minTokensOut = (buyQuote.tokensOut * 99n) / 100n;
      const tx = await writeContractAsync({
        abi: abis.forgeBondingCurvePool,
        address: poolAddress,
        functionName: "buy",
        args: [minTokensOut],
        value: zilAmountParsed,
        chainId,
      });
      setBuyTx(tx);
      toast.info("Transaction submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Buy failed", { description: err?.message });
    }
  };

  const handleApprove = async () => {
    if (!poolAddress || !tokenAddress || !sellAmount) return;
    if (!isConnected || !address) {
      toast.error("Connect your wallet");
      return;
    }
    try {
      const tx = await writeContractAsync({
        abi: erc20Abi,
        address: tokenAddress,
        functionName: "approve",
        args: [poolAddress, tokenAmountParsed],
        chainId,
      });
      setApproveTx(tx);
      toast.info("Approval submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Approval failed", { description: err?.message });
    }
  };

  const handleSell = async () => {
    if (!poolAddress || !sellAmount || !sellQuote) return;
    if (!isConnected || !address) {
      toast.error("Connect your wallet");
      return;
    }
    const sellAmountNum = parseFloat(sellAmount);
    if (sellAmountNum < MIN_SELL_TOKENS) {
      toast.error("Amount too small", {
        description: `Minimum sell is ${MIN_SELL_TOKENS} tokens`,
      });
      return;
    }
    try {
      const minZilOut = (sellQuote.zilOut * 99n) / 100n;
      const tx = await writeContractAsync({
        abi: abis.forgeBondingCurvePool,
        address: poolAddress,
        functionName: "sell",
        args: [tokenAmountParsed, minZilOut],
        chainId,
      });
      setSellTx(tx);
      toast.info("Transaction submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Sell failed", { description: err?.message });
    }
  };

  const pool = useMemo(() => {
    if (
      !poolAddress ||
      !poolData ||
      poolData.some((r) => r.status === "failure")
    ) {
      return null;
    }
    return {
      pool: poolAddress,
      token: poolData[0].result as `0x${string}`,
      tokenSymbol: (tokenSymbol as string) ?? "TOKEN",
      tokenName: (tokenName as string) ?? "Unknown",
      creator: poolData[1].result as `0x${string}`,
      state: Number(poolData[2].result),
      currentPrice: poolData[3].result as bigint,
      marketCap: poolData[4].result as bigint,
      progressBps: poolData[5].result as bigint,
      tokensSold: poolData[6].result as bigint,
      realZilReserve: poolData[7].result as bigint,
      tradingFeePercent: poolData[8].result as bigint,
      graduationMarketCap: poolData[9].result as bigint,
      virtualTokenReserve: poolData[10].result as bigint,
      virtualZilReserve: poolData[11].result as bigint,
      k: poolData[12].result as bigint,
      initialVirtualZilReserve: poolData[13].result as bigint,
      feesCollected: poolData[14].result as bigint,
      totalSupply: poolData[15].result as bigint,
    };
  }, [poolData, poolAddress, tokenSymbol, tokenName]);

  const needsApproval =
    tokenAmountParsed > 0n && (userAllowance ?? 0n) < tokenAmountParsed;
  const tokenBalanceValue = userBalance ?? 0n;
  const zilBalanceValue = zilBalance?.value ?? 0n;
  const isTrading = pool?.state === 0;
  const stateConfig = pool
    ? (stateLabels[pool.state] ?? stateLabels[0])
    : stateLabels[0];
  const progress = pool ? Number(pool.progressBps) / 100 : 0;
  const curveInsights = useMemo(() => {
    if (!pool) return null;

    const feeNumerator = BPS_DENOMINATOR - pool.tradingFeePercent;
    const targetVzSquared =
      pool.totalSupply > 0n
        ? (pool.graduationMarketCap * pool.k) / pool.totalSupply
        : 0n;
    const targetVz = sqrtCeilBigInt(targetVzSquared);
    const requiredNetZil =
      targetVz > pool.virtualZilReserve
        ? targetVz - pool.virtualZilReserve
        : 0n;
    const estimatedZilToGraduate =
      requiredNetZil > 0n && feeNumerator > 0n
        ? ceilDiv(requiredNetZil * BPS_DENOMINATOR, feeNumerator)
        : 0n;
    const targetVt = targetVz > 0n ? pool.k / targetVz : 0n;
    const tokensToGraduate =
      pool.virtualTokenReserve > targetVt
        ? pool.virtualTokenReserve - targetVt
        : 0n;

    const priceMoveCost = PRICE_MOVE_UP_BPS.map((moveBps) => {
      const targetPrice =
        pool.currentPrice + (pool.currentPrice * moveBps) / BPS_DENOMINATOR;
      const zilRequired =
        targetPrice > pool.currentPrice
          ? estimateGrossZilForTargetPrice(pool, targetPrice)
          : 0n;
      return {
        id: `up-${moveBps.toString()}`,
        moveBps,
        targetPrice,
        zilRequired,
      };
    });

    const availableSellLiquidity = pool.realZilReserve + pool.feesCollected;
    const sellLiquidityCoverageBps =
      pool.virtualZilReserve > 0n
        ? (availableSellLiquidity * BPS_DENOMINATOR) / pool.virtualZilReserve
        : 0n;
    const sellLiquidityCoveragePct = Number(sellLiquidityCoverageBps) / 100;

    const maxSellableNow = findMaxSellableTokens(pool, pool.tokensSold);

    const curveMapBuyAnchor =
      estimatedZilToGraduate > 0n
        ? estimatedZilToGraduate
        : pool.marketCap > 0n
          ? pool.marketCap / 5n
          : 1_000n * ONE_ETHER;
    const curveMapBuyInputs = buildAdaptiveSamples(
      curveMapBuyAnchor,
      10n * ONE_ETHER,
      BUY_SAMPLE_MAX,
      CURVE_MAP_BUY_STEPS_BPS,
    );

    const curveMapSellInputs =
      pool.tokensSold > 0n
        ? CURVE_MAP_SELL_STEPS_BPS.map(
            (stepBps) => (pool.tokensSold * stepBps) / BPS_DENOMINATOR,
          ).filter((value, index, values) => {
            return (
              value > 0n &&
              value <= pool.tokensSold &&
              values.indexOf(value) === index
            );
          })
        : [];

    const currentPriceValue = toUnitNumber(pool.currentPrice);
    const buyCurvePoints = curveMapBuyInputs
      .map((zilIn) => {
        const result = simulateBuy(pool, zilIn);
        if (!result) return null;
        return {
          deltaZil: toUnitNumber(zilIn),
          buyPrice: toUnitNumber(result.postPrice),
          sellPrice: null,
        };
      })
      .filter((point): point is NonNullable<typeof point> => {
        return (
          point !== null &&
          Number.isFinite(point.deltaZil) &&
          Number.isFinite(point.buyPrice)
        );
      });

    const sellCurvePoints = curveMapSellInputs
      .map((tokensIn) => {
        const result = simulateSell(pool, tokensIn);
        if (!result) return null;
        return {
          deltaZil: -toUnitNumber(result.zilOut),
          buyPrice: null,
          sellPrice: toUnitNumber(result.postPrice),
        };
      })
      .filter((point): point is NonNullable<typeof point> => {
        return (
          point !== null &&
          Number.isFinite(point.deltaZil) &&
          Number.isFinite(point.sellPrice)
        );
      });

    const curveMapData = [
      ...sellCurvePoints,
      {
        deltaZil: 0,
        buyPrice: currentPriceValue,
        sellPrice: currentPriceValue,
      },
      ...buyCurvePoints,
    ].sort((a, b) => a.deltaZil - b.deltaZil);
    const graduationDeltaZil =
      estimatedZilToGraduate > 0n ? toUnitNumber(estimatedZilToGraduate) : null;

    const priceTargetMarkers = priceMoveCost.map((row) => ({
      id: row.id,
      label: `+${formatBps(row.moveBps)}%`,
      price: toUnitNumber(row.targetPrice),
    }));

    const maxSellableCoverageBps =
      pool.tokensSold > 0n
        ? (maxSellableNow * BPS_DENOMINATOR) / pool.tokensSold
        : 0n;
    const maxSellableCoveragePct = Number(maxSellableCoverageBps) / 100;

    return {
      estimatedZilToGraduate,
      tokensToGraduate,
      priceTargetMarkers: priceMoveCost.map((row) => ({
        id: row.id,
        label: `+${formatBps(row.moveBps)}%`,
        price: toUnitNumber(row.targetPrice),
      })),
      availableSellLiquidity,
      sellLiquidityCoverageBps,
      maxSellableNow,
      curveMapData,
      graduationDeltaZil,
      sellLiquidityCoveragePct,
      maxSellableCoverageBps,
      maxSellableCoveragePct,
    };
  }, [pool]);

  return (
    <div className="space-y-6 pb-10">
      <Button
        asChild
        variant="ghost"
        className="h-auto p-0 text-sm text-muted-foreground"
      >
        <Link href="/discover" className="inline-flex items-center gap-2">
          <ArrowLeft className="size-4" />
          Back to launches
        </Link>
      </Button>

      {isPoolLoading && !pool && (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      )}

      {isPoolError && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>Unable to load pool</CardTitle>
            <CardDescription>
              Failed to fetch pool data. Please check the address and try again.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {pool && (
        <>
          <div className="flex items-start gap-4">
            {metadata?.image_url ? (
              <img
                src={metadata.image_url}
                alt={pool.tokenName}
                className="size-20 rounded-xl object-cover shrink-0"
              />
            ) : (
              <div className="size-20 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-muted-foreground">
                  {pool.tokenSymbol.slice(0, 2)}
                </span>
              </div>
            )}
            <PageHeader
              title={pool.tokenName}
              description={`${pool.tokenSymbol} · ${formatAddress(pool.pool)}`}
              icon={<TrendingUp className="size-6 text-primary" />}
            />
          </div>

          {metadata?.description && (
            <p className="text-muted-foreground">{metadata.description}</p>
          )}

          <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {pool.tokenSymbol}
                      </CardTitle>
                      <CardDescription>Bonding curve pool</CardDescription>
                    </div>
                    <Badge variant={stateConfig.variant}>
                      {stateConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Progress to graduation
                      </span>
                      <span className="font-medium">
                        {progress.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3.5 w-full overflow-hidden rounded-full bg-muted/70 ring-1 ring-border/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/65 via-primary to-primary/75 shadow-sm shadow-primary/40 transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Target: {formatUnits(pool.graduationMarketCap, 18)} ZIL
                      market cap
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Stat
                      label="Current price"
                      value={`${Number(formatUnits(pool.currentPrice, 18)).toFixed(9)} ZIL`}
                    />
                    <Stat
                      label="Market cap"
                      value={`${Number(formatUnits(pool.marketCap, 18)).toLocaleString()} ZIL`}
                    />
                    <Stat
                      label="ZIL raised"
                      value={`${Number(formatUnits(pool.realZilReserve, 18)).toLocaleString()} ZIL`}
                    />
                    <Stat
                      label="Tokens sold"
                      value={`${Number(formatUnits(pool.tokensSold, 18)).toLocaleString()}`}
                    />
                    <Stat
                      label="Trading fee"
                      value={`${Number(pool.tradingFeePercent) / 100}%`}
                    />
                  </div>
                </CardContent>
              </Card>

              {curveInsights && (
                <Card>
                  <CardHeader>
                    <CardTitle>Curve outlook</CardTitle>
                    <CardDescription>
                      Estimates from current reserves and fee settings to help
                      size trades before you execute
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      State-based model output only. No recent-volume dependency.
                    </p>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-medium">Curve map</h4>
                        <span className="text-[11px] text-muted-foreground">
                          Net ZIL flow vs spot price
                        </span>
                      </div>
                      <div className="h-64 w-full rounded-md border bg-background/70 p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={curveInsights.curveMapData}
                            margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--border)"
                            />
                            <XAxis
                              type="number"
                              dataKey="deltaZil"
                              tickFormatter={(value) => formatCompactNumber(value)}
                              tick={{
                                fontSize: 11,
                                fill: "var(--muted-foreground)",
                              }}
                              stroke="var(--muted-foreground)"
                              label={{
                                value: "Net ZIL flow",
                                position: "insideBottom",
                                offset: -4,
                                style: {
                                  fontSize: 11,
                                  fill: "var(--muted-foreground)",
                                },
                              }}
                            />
                            <YAxis
                              type="number"
                              tickFormatter={(value) => formatPriceTick(value)}
                              tick={{
                                fontSize: 11,
                                fill: "var(--muted-foreground)",
                              }}
                              width={72}
                              stroke="var(--muted-foreground)"
                              label={{
                                value: "Price (ZIL)",
                                angle: -90,
                                position: "insideLeft",
                                style: {
                                  fontSize: 11,
                                  fill: "var(--muted-foreground)",
                                },
                              }}
                            />
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: "var(--popover)",
                                border: "1px solid var(--border)",
                                borderRadius: "8px",
                                color: "var(--popover-foreground)",
                              }}
                              labelStyle={{
                                color: "var(--muted-foreground)",
                                fontSize: "12px",
                              }}
                              itemStyle={{
                                color: "var(--popover-foreground)",
                                fontSize: "12px",
                              }}
                              formatter={(value, name) => {
                                const numericValue =
                                  typeof value === "number"
                                    ? value
                                    : Number(value ?? 0);
                                const label =
                                  name === "buyPrice"
                                    ? "Buy path price"
                                    : "Sell path price";
                                return [`${formatPriceTick(numericValue)} ZIL`, label];
                              }}
                              labelFormatter={(label) => {
                                const numericLabel =
                                  typeof label === "number"
                                    ? label
                                    : Number(label ?? 0);
                                const signedLabel =
                                  numericLabel >= 0
                                    ? `+${formatCompactNumber(numericLabel)}`
                                    : formatCompactNumber(numericLabel);
                                return `Net flow: ${signedLabel} ZIL`;
                              }}
                            />
                            <ReferenceLine
                              x={0}
                              stroke="var(--muted-foreground)"
                              strokeDasharray="4 4"
                            />
                            {curveInsights.graduationDeltaZil != null && (
                              <ReferenceLine
                                x={curveInsights.graduationDeltaZil}
                                stroke="var(--primary)"
                                strokeDasharray="5 5"
                              />
                            )}
                            {curveInsights.priceTargetMarkers.map((marker) => (
                              <ReferenceLine
                                key={marker.id}
                                y={marker.price}
                                stroke="var(--muted-foreground)"
                                strokeDasharray="2 6"
                              />
                            ))}
                            <Line
                              type="monotone"
                              dataKey="sellPrice"
                              name="sellPrice"
                              stroke="#ef4444"
                              strokeWidth={2}
                              dot={{ r: 2.5 }}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="buyPrice"
                              name="buyPrice"
                              stroke="#22c55e"
                              strokeWidth={2}
                              dot={{ r: 2.5 }}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Red line models sells from current state, green models
                        buys. Vertical dashed line marks graduation estimate.
                      </p>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-medium">Liquidity runway</h4>
                        <span className="text-[11px] text-muted-foreground">
                          Execution capacity right now
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Sell liquidity coverage
                            </span>
                            <span className="font-semibold">
                              {formatBps(curveInsights.sellLiquidityCoverageBps)}%
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500/80"
                              style={{
                                width: `${Math.max(
                                  2,
                                  Math.min(
                                    100,
                                    curveInsights.sellLiquidityCoveragePct,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {formatAmount(curveInsights.availableSellLiquidity)}{" "}
                            available vs virtual reserve baseline
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              Max sellable token coverage
                            </span>
                            <span className="font-semibold">
                              {formatBps(curveInsights.maxSellableCoverageBps)}%
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-amber-500/80"
                              style={{
                                width: `${Math.max(
                                  2,
                                  Math.min(
                                    100,
                                    curveInsights.maxSellableCoveragePct,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {formatAmount(curveInsights.maxSellableNow)}{" "}
                            {pool.tokenSymbol} can be sold now
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">
                          Est. ZIL to graduate
                        </p>
                        <p className="text-sm font-semibold">
                          {formatAmount(curveInsights.estimatedZilToGraduate)} ZIL
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">
                          Tokens to graduate
                        </p>
                        <p className="text-sm font-semibold">
                          {formatAmount(curveInsights.tokensToGraduate)}{" "}
                          {pool.tokenSymbol}
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">
                          Available sell liquidity
                        </p>
                        <p className="text-sm font-semibold">
                          {formatAmount(curveInsights.availableSellLiquidity)} ZIL
                        </p>
                      </div>
                      <div className="rounded-md border bg-muted/30 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">
                          Max sellable now
                        </p>
                        <p className="text-sm font-semibold">
                          {formatAmount(curveInsights.maxSellableNow)}{" "}
                          {pool.tokenSymbol}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-medium">
                          Price move checkpoints
                        </h4>
                        <span className="text-[11px] text-muted-foreground">
                          Relative to current spot
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {curveInsights.priceTargetMarkers.map((marker) => (
                          <div
                            key={marker.id}
                            className="rounded-md border bg-background/60 px-2.5 py-1.5 text-xs"
                          >
                            <span className="text-muted-foreground">
                              {marker.label}:
                            </span>{" "}
                            <span className="font-medium">
                              {formatPriceTick(marker.price)} ZIL
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              {isTrading && (
                <Card>
                  <CardHeader>
                    <CardTitle>Trade</CardTitle>
                    <CardDescription>
                      Buy or sell {pool.tokenSymbol} tokens
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="buy">
                      <TabsList className="w-full">
                        <TabsTrigger value="buy" className="flex-1">
                          <TrendingUp className="mr-1.5 size-4" />
                          Buy
                        </TabsTrigger>
                        <TabsTrigger value="sell" className="flex-1">
                          <TrendingDown className="mr-1.5 size-4" />
                          Sell
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="buy" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Amount (ZIL)</Label>
                          <Input
                            type="text"
                            value={buyAmount}
                            onChange={(e) =>
                              setBuyAmount(
                                e.target.value.replace(/[^0-9.]/g, ""),
                              )
                            }
                            placeholder={`Min ${MIN_BUY_AMOUNT} ZIL`}
                          />
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                setBuyAmount(formatUnits(zilBalanceValue, 18))
                              }
                              className="text-primary hover:underline"
                            >
                              Balance:{" "}
                              {Number(
                                formatUnits(zilBalanceValue, 18),
                              ).toLocaleString()}{" "}
                              ZIL
                            </button>
                            <p className="text-muted-foreground">
                              Minimum: {MIN_BUY_AMOUNT} ZIL
                            </p>
                          </div>
                        </div>
                        {buyQuote && (
                          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                You will receive
                              </span>
                              <span className="font-medium">
                                {Number(
                                  formatUnits(buyQuote.tokensOut, 18),
                                ).toLocaleString()}{" "}
                                {pool.tokenSymbol}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Fee</span>
                              <span>{formatUnits(buyQuote.fee, 18)} ZIL</span>
                            </div>
                          </div>
                        )}
                        <Button
                          onClick={handleBuy}
                          disabled={
                            isWriting ||
                            isBuyConfirming ||
                            !buyAmount ||
                            !buyQuote
                          }
                          className="w-full"
                        >
                          {(isWriting || isBuyConfirming) && (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          )}
                          {isBuyConfirming ? "Confirming..." : "Buy"}
                        </Button>
                      </TabsContent>

                      <TabsContent value="sell" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Amount ({pool.tokenSymbol})</Label>
                          <Input
                            type="text"
                            value={sellAmount}
                            onChange={(e) =>
                              setSellAmount(
                                e.target.value.replace(/[^0-9.]/g, ""),
                              )
                            }
                            placeholder={`Min ${MIN_SELL_TOKENS} tokens`}
                          />
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() =>
                                setSellAmount(
                                  formatUnits(tokenBalanceValue, 18),
                                )
                              }
                              className="text-primary hover:underline"
                            >
                              Balance:{" "}
                              {Number(
                                formatUnits(tokenBalanceValue, 18),
                              ).toLocaleString()}{" "}
                              {pool.tokenSymbol}
                            </button>
                            <p className="text-muted-foreground">
                              Minimum: {MIN_SELL_TOKENS} tokens
                            </p>
                          </div>
                        </div>
                        {sellQuote && (
                          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                You will receive
                              </span>
                              <span className="font-medium">
                                {formatUnits(sellQuote.zilOut, 18)} ZIL
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Fee</span>
                              <span>{formatUnits(sellQuote.fee, 18)} ZIL</span>
                            </div>
                          </div>
                        )}
                        {needsApproval ? (
                          <Button
                            onClick={handleApprove}
                            disabled={
                              isWriting || isApproveConfirming || !sellAmount
                            }
                            className="w-full"
                            variant="secondary"
                          >
                            {(isWriting || isApproveConfirming) && (
                              <Loader2 className="mr-2 size-4 animate-spin" />
                            )}
                            {isApproveConfirming ? "Approving..." : "Approve"}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleSell}
                            disabled={
                              isWriting ||
                              isSellConfirming ||
                              !sellAmount ||
                              !sellQuote
                            }
                            className="w-full"
                          >
                            {(isWriting || isSellConfirming) && (
                              <Loader2 className="mr-2 size-4 animate-spin" />
                            )}
                            {isSellConfirming ? "Confirming..." : "Sell"}
                          </Button>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {!isTrading && (
                <Card>
                  <CardHeader>
                    <CardTitle>Graduated</CardTitle>
                    <CardDescription>
                      This token has graduated to PlunderSwap
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Trading is now available on PlunderSwap. The bonding curve
                      has completed.
                    </p>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Token</span>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 font-medium hover:text-primary transition-colors"
                        onClick={() => {
                          navigator.clipboard.writeText(pool.token);
                          toast.success("Address copied", {
                            description: pool.token,
                          });
                        }}
                      >
                        {formatAddress(pool.token)}
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                    <Button asChild className="w-full">
                      <a
                        href={`https://plunderswap.com/swap?outputCurrency=${pool.token}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Trade on PlunderSwap
                        <ExternalLink className="ml-1.5 size-3.5" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Launch details</CardTitle>
                  <CardDescription>
                    Creator and deployment metadata
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Creator</p>
                    <a
                      href={addressUrl(chainId, pool.creator)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary transition-colors"
                    >
                      {formatAddress(pool.creator)}
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                  <div className="space-y-3 text-sm">
                    <DetailRow label="Pool">
                      {formatAddress(pool.pool)}
                    </DetailRow>
                    <DetailRow label="Token">
                      {formatAddress(pool.token)}
                    </DetailRow>
                  </div>
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href={addressUrl(chainId, pool.pool)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on Explorer
                      <ExternalLink className="ml-1.5 size-3.5" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {(metadata?.website ||
                metadata?.twitter ||
                metadata?.telegram) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Links</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {metadata.website && (
                      <a
                        href={
                          metadata.website.startsWith("http")
                            ? metadata.website
                            : `https://${metadata.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/40 transition-colors"
                      >
                        <Globe className="size-4 text-muted-foreground" />
                        <span className="truncate">
                          {metadata.website.replace(/^https?:\/\//, "")}
                        </span>
                        <ExternalLink className="size-3 ml-auto text-muted-foreground" />
                      </a>
                    )}
                    {metadata.twitter && (
                      <a
                        href={`https://x.com/${metadata.twitter.replace("@", "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/40 transition-colors"
                      >
                        <svg
                          className="size-4 text-muted-foreground"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span>@{metadata.twitter.replace("@", "")}</span>
                        <ExternalLink className="size-3 ml-auto text-muted-foreground" />
                      </a>
                    )}
                    {metadata.telegram && (
                      <a
                        href={
                          metadata.telegram.startsWith("http")
                            ? metadata.telegram
                            : `https://t.me/${metadata.telegram.replace("t.me/", "").replace("@", "")}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/40 transition-colors"
                      >
                        <Send className="size-4 text-muted-foreground" />
                        <span className="truncate">
                          {metadata.telegram
                            .replace(/^https?:\/\/t\.me\//, "")
                            .replace("t.me/", "")}
                        </span>
                        <ExternalLink className="size-3 ml-auto text-muted-foreground" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}

function formatAmount(amount: bigint) {
  return Number(formatUnits(amount, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function toUnitNumber(amount: bigint) {
  return Number(formatUnits(amount, 18));
}

function formatWholeAmount(amount: bigint) {
  return Number(formatUnits(amount, 18)).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function formatBps(value: bigint) {
  return (Number(value) / 100).toFixed(2);
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

function formatPriceTick(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  if (value >= 0.01) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 5 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function formatSignedBps(value: bigint) {
  const sign = value >= 0n ? "+" : "-";
  const abs = value >= 0n ? value : -value;
  return `${sign}${formatBps(abs)}`;
}

function formatMultiple(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(2)}x`;
}

function clampBigInt(value: bigint, min: bigint, max: bigint) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function buildAdaptiveSamples(
  anchor: bigint,
  min: bigint,
  max: bigint,
  steps: readonly bigint[],
) {
  const baseAnchor = anchor > 0n ? anchor : min;
  const values: bigint[] = [];

  for (const stepBps of steps) {
    const candidate = clampBigInt(
      (baseAnchor * stepBps) / BPS_DENOMINATOR,
      min,
      max,
    );
    if (!values.includes(candidate)) {
      values.push(candidate);
    }
  }

  const fallback = [
    min,
    clampBigInt(min * 4n, min, max),
    clampBigInt(min * 20n, min, max),
    clampBigInt(min * 100n, min, max),
    max,
  ];

  for (const candidate of fallback) {
    if (!values.includes(candidate)) {
      values.push(candidate);
    }
    if (values.length >= steps.length) break;
  }

  values.sort((a, b) => {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  });

  return values.slice(0, steps.length);
}

function ceilDiv(numerator: bigint, denominator: bigint) {
  if (denominator === 0n) return 0n;
  return (numerator + denominator - 1n) / denominator;
}

function sqrtBigInt(value: bigint) {
  if (value <= 0n) return 0n;
  let x0 = value;
  let x1 = (value + 1n) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x1 + value / x1) / 2n;
  }
  return x0;
}

function sqrtCeilBigInt(value: bigint) {
  if (value <= 0n) return 0n;
  const floor = sqrtBigInt(value);
  return floor * floor === value ? floor : floor + 1n;
}

function estimateGrossZilForTargetPrice(
  pool: CurveSnapshot,
  targetPrice: bigint,
) {
  if (targetPrice <= pool.currentPrice) return 0n;
  const feeNumerator = BPS_DENOMINATOR - pool.tradingFeePercent;
  if (feeNumerator <= 0n) return null;
  const targetVzSquared = (targetPrice * pool.k) / ONE_ETHER;
  const targetVz = sqrtCeilBigInt(targetVzSquared);
  if (targetVz <= pool.virtualZilReserve) return 0n;
  const requiredNetZil = targetVz - pool.virtualZilReserve;
  return ceilDiv(requiredNetZil * BPS_DENOMINATOR, feeNumerator);
}

function estimateTokensForTargetDownPrice(
  pool: CurveSnapshot,
  targetPrice: bigint,
) {
  if (targetPrice <= 0n || targetPrice >= pool.currentPrice) return null;
  const targetVtSquared = ceilDiv(pool.k * ONE_ETHER, targetPrice);
  const targetVt = sqrtCeilBigInt(targetVtSquared);
  if (targetVt <= pool.virtualTokenReserve) return 0n;
  return targetVt - pool.virtualTokenReserve;
}

function findMaxSellableTokens(pool: CurveSnapshot, tokensCap: bigint) {
  if (tokensCap <= 0n) return 0n;
  let low = 0n;
  let high = tokensCap;

  while (low < high) {
    const mid = (low + high + 1n) / 2n;
    if (simulateSell(pool, mid)) {
      low = mid;
    } else {
      high = mid - 1n;
    }
  }

  return low;
}

function simulateRoundTrip(pool: CurveSnapshot, zilIn: bigint) {
  const buyResult = simulateBuy(pool, zilIn);
  if (!buyResult) return null;

  const zilAfterFee = zilIn - buyResult.fee;
  const nextVirtualZilReserve = pool.virtualZilReserve + zilAfterFee;
  if (nextVirtualZilReserve <= 0n) return null;
  const nextVirtualTokenReserve = pool.k / nextVirtualZilReserve;
  if (nextVirtualTokenReserve <= 0n) return null;
  const nextPrice =
    (nextVirtualZilReserve * ONE_ETHER) / nextVirtualTokenReserve;

  const nextPool: CurveSnapshot = {
    ...pool,
    currentPrice: nextPrice,
    virtualTokenReserve: nextVirtualTokenReserve,
    virtualZilReserve: nextVirtualZilReserve,
    realZilReserve: pool.realZilReserve + zilAfterFee,
    feesCollected: pool.feesCollected + buyResult.fee,
  };

  const sellResult = simulateSell(nextPool, buyResult.tokensOut);
  if (!sellResult) return null;

  const loss = zilIn > sellResult.zilOut ? zilIn - sellResult.zilOut : 0n;
  const lossBps = zilIn > 0n ? (loss * BPS_DENOMINATOR) / zilIn : 0n;

  return {
    tokensBought: buyResult.tokensOut,
    zilBack: sellResult.zilOut,
    loss,
    lossBps,
  };
}

function simulateBuy(pool: CurveSnapshot, zilIn: bigint) {
  if (zilIn <= 0n) return null;
  const fee = (zilIn * pool.tradingFeePercent) / BPS_DENOMINATOR;
  const zilAfterFee = zilIn - fee;
  if (zilAfterFee <= 0n) return null;
  const newVirtualZilReserve = pool.virtualZilReserve + zilAfterFee;
  if (newVirtualZilReserve <= 0n) return null;
  const newVirtualTokenReserve = pool.k / newVirtualZilReserve;
  if (newVirtualTokenReserve >= pool.virtualTokenReserve) return null;
  const tokensOut = pool.virtualTokenReserve - newVirtualTokenReserve;
  if (tokensOut <= 0n) return null;
  const postPrice = (newVirtualZilReserve * ONE_ETHER) / newVirtualTokenReserve;
  const averagePrice = (zilIn * ONE_ETHER) / tokensOut;
  const slippageBps =
    pool.currentPrice > 0n
      ? (averagePrice * BPS_DENOMINATOR) / pool.currentPrice - BPS_DENOMINATOR
      : 0n;
  return {
    tokensOut,
    fee,
    slippageBps,
    postPrice,
  };
}

function simulateSell(pool: CurveSnapshot, tokensIn: bigint) {
  if (tokensIn <= 0n) return null;
  const newVirtualTokenReserve = pool.virtualTokenReserve + tokensIn;
  if (newVirtualTokenReserve <= 0n) return null;
  const newVirtualZilReserve = pool.k / newVirtualTokenReserve;
  if (newVirtualZilReserve >= pool.virtualZilReserve) return null;
  const grossProceeds = pool.virtualZilReserve - newVirtualZilReserve;
  const available = pool.realZilReserve + pool.feesCollected;
  if (grossProceeds > available) return null;
  const postPrice = (newVirtualZilReserve * ONE_ETHER) / newVirtualTokenReserve;
  const fee = (grossProceeds * pool.tradingFeePercent) / BPS_DENOMINATOR;
  const zilOut = grossProceeds - fee;
  if (zilOut <= 0n) return null;
  const averagePrice = (zilOut * ONE_ETHER) / tokensIn;
  const slippageBps =
    pool.currentPrice > 0n
      ? BPS_DENOMINATOR - (averagePrice * BPS_DENOMINATOR) / pool.currentPrice
      : 0n;
  return {
    zilOut,
    fee,
    slippageBps,
    postPrice,
  };
}
