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

const stateLabels: Record<
  number,
  { label: string; variant: "default" | "secondary" }
> = {
  0: { label: "Trading", variant: "default" },
  1: { label: "Graduated", variant: "secondary" },
};

const REFETCH_INTERVAL = 10000;

const MIN_BUY_AMOUNT = 0.001;
const MIN_SELL_TOKENS = 0.001;

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

              <Card>
                <CardHeader>
                  <CardTitle>How bonding curves work</CardTitle>
                  <CardDescription>
                    Tokens launch with automatic pricing &mdash; no order books
                    needed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-4 rounded-lg border bg-muted/30 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <TrendingUp className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">Buy &rarr; price goes up</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Each purchase moves the price higher along a
                        mathematical curve. Earlier buyers get a lower price.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 rounded-lg border bg-muted/30 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <TrendingDown className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">Sell &rarr; price goes down</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Selling returns tokens to the pool and you receive ZIL.
                        The price adjusts down accordingly.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 rounded-lg border bg-muted/30 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                      <ExternalLink className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">
                        Graduate to PlunderSwap
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        At{" "}
                        {Number(
                          formatUnits(pool.graduationMarketCap, 18),
                        ).toLocaleString()}{" "}
                        ZIL market cap the token graduates with full DEX
                        liquidity.
                      </p>
                    </div>
                  </div>
                  <p className="pt-1 text-xs text-muted-foreground">
                    A {Number(pool.tradingFeePercent) / 100}% fee applies to
                    each trade. No time limit &mdash; the curve stays open
                    until graduation.
                  </p>
                </CardContent>
              </Card>
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

