"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, decodeEventLog, parseAbiItem } from "viem";
import { toast } from "sonner";
import { ArrowLeft, TrendingUp, TrendingDown, Loader2, ArrowUpRight, ExternalLink } from "lucide-react";

import { abis } from "@/lib/contracts";
import { erc20Abi } from "@/abi/erc20";
import { forgeBondingCurvePoolAbi } from "@/abi/forgeBondingCurvePool";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { formatAddress } from "@/lib/format";
import { addressUrl, txUrl } from "@/lib/explorer";

type PoolDetail = {
  pool: `0x${string}`;
  token: `0x${string}`;
  tokenSymbol: string;
  tokenName: string;
  creator: `0x${string}`;
  state: number;
  currentPrice: bigint;
  marketCap: bigint;
  progressBps: bigint;
  tokensSold: bigint;
  tokensRemaining: bigint;
  zilReserve: bigint;
  tradingFeePercent: bigint;
  graduationMarketCap: bigint;
};

type Trade = {
  type: "buy" | "sell";
  trader: `0x${string}`;
  zilAmount: bigint;
  tokenAmount: bigint;
  fee: bigint;
  newPrice: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
};

const stateLabels: Record<number, { label: string; variant: "default" | "secondary" }> = {
  0: { label: "Trading", variant: "default" },
  1: { label: "Graduated", variant: "secondary" },
};

export default function BondingCurvePoolPage() {
  const params = useParams<{ address: string }>();
  const poolAddress = params?.address?.toLowerCase() as `0x${string}` | undefined;
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();

  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [userBalance, setUserBalance] = useState<bigint>(0n);
  const [userAllowance, setUserAllowance] = useState<bigint>(0n);

  // Trading state
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [buyQuote, setBuyQuote] = useState<{ tokensOut: bigint; fee: bigint } | null>(null);
  const [sellQuote, setSellQuote] = useState<{ zilOut: bigint; fee: bigint } | null>(null);
  const [buyTx, setBuyTx] = useState<`0x${string}` | null>(null);
  const [sellTx, setSellTx] = useState<`0x${string}` | null>(null);
  const [approveTx, setApproveTx] = useState<`0x${string}` | null>(null);

  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const { isLoading: isBuyConfirming, isSuccess: isBuySuccess } = useWaitForTransactionReceipt({
    hash: buyTx ?? undefined,
  });
  const { isLoading: isSellConfirming, isSuccess: isSellSuccess } = useWaitForTransactionReceipt({
    hash: sellTx ?? undefined,
  });
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveTx ?? undefined,
  });

  // Load pool data
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
          creator,
          state,
          currentPrice,
          marketCap,
          progressBps,
          tokensSold,
          tokensRemaining,
          zilReserve,
          tradingFeePercent,
          graduationMarketCap,
        ] = await Promise.all([
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "token" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "creator" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "state" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "currentPrice" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "marketCap" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "progressBps" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "tokensSold" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "tokensRemaining" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "zilReserve" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "tradingFeePercent" }),
          client.readContract({ abi: abis.forgeBondingCurvePool, address: target, functionName: "graduationMarketCap" }),
        ]);

        let tokenSymbol = "TOKEN";
        let tokenName = "Unknown";
        try {
          [tokenSymbol, tokenName] = await Promise.all([
            client.readContract({ abi: erc20Abi, address: token as `0x${string}`, functionName: "symbol" }) as Promise<string>,
            client.readContract({ abi: erc20Abi, address: token as `0x${string}`, functionName: "name" }) as Promise<string>,
          ]);
        } catch {}

        if (!cancelled) {
          setPool({
            pool: target,
            token: token as `0x${string}`,
            tokenSymbol,
            tokenName,
            creator: creator as `0x${string}`,
            state: Number(state),
            currentPrice: currentPrice as bigint,
            marketCap: marketCap as bigint,
            progressBps: progressBps as bigint,
            tokensSold: tokensSold as bigint,
            tokensRemaining: tokensRemaining as bigint,
            zilReserve: zilReserve as bigint,
            tradingFeePercent: tradingFeePercent as bigint,
            graduationMarketCap: graduationMarketCap as bigint,
          });
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load pool");
          setPool(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [poolAddress, publicClient]);

  // Load trades
  useEffect(() => {
    if (!poolAddress || !publicClient) return;
    const target = poolAddress as `0x${string}`;
    const client = publicClient as NonNullable<typeof publicClient>;
    let cancelled = false;

    async function loadTrades() {
      setTradesLoading(true);
      try {
        const blockNumber = await client.getBlockNumber();
        const fromBlock = blockNumber > 10000n ? blockNumber - 10000n : 0n;

        const logs = await client.getLogs({
          address: target,
          fromBlock,
          toBlock: "latest",
        });

        const buyEvent = parseAbiItem("event Buy(address indexed buyer, uint256 zilIn, uint256 tokensOut, uint256 fee, uint256 newTokensSold, uint256 newPrice)");
        const sellEvent = parseAbiItem("event Sell(address indexed seller, uint256 tokensIn, uint256 zilOut, uint256 fee, uint256 newTokensSold, uint256 newPrice)");

        const parsedTrades: Trade[] = [];
        for (const log of logs) {
          try {
            if (log.topics[0] === "0x377aadfa4a80f9da64f29d71a893e96dc4d87db368118e909ed1c45a9a671235") {
              const decoded = decodeEventLog({ abi: [buyEvent], data: log.data, topics: log.topics });
              parsedTrades.push({
                type: "buy",
                trader: decoded.args.buyer as `0x${string}`,
                zilAmount: decoded.args.zilIn as bigint,
                tokenAmount: decoded.args.tokensOut as bigint,
                fee: decoded.args.fee as bigint,
                newPrice: decoded.args.newPrice as bigint,
                txHash: log.transactionHash as `0x${string}`,
                blockNumber: log.blockNumber,
              });
            } else if (log.topics[0] === "0x96e0c1a8e3c2506aa7e4af89d9ec1e7b6eb7e3e8f0b2edb7e8dc80dd0c08b0c4") {
              const decoded = decodeEventLog({ abi: [sellEvent], data: log.data, topics: log.topics });
              parsedTrades.push({
                type: "sell",
                trader: decoded.args.seller as `0x${string}`,
                zilAmount: decoded.args.zilOut as bigint,
                tokenAmount: decoded.args.tokensIn as bigint,
                fee: decoded.args.fee as bigint,
                newPrice: decoded.args.newPrice as bigint,
                txHash: log.transactionHash as `0x${string}`,
                blockNumber: log.blockNumber,
              });
            }
          } catch {}
        }

        if (!cancelled) {
          setTrades(parsedTrades.reverse().slice(0, 20));
        }
      } catch {
        if (!cancelled) setTrades([]);
      } finally {
        if (!cancelled) setTradesLoading(false);
      }
    }
    void loadTrades();
    const interval = setInterval(loadTrades, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [poolAddress, publicClient]);

  // Load user balance and allowance
  useEffect(() => {
    if (!pool || !address || !publicClient) {
      setUserBalance(0n);
      setUserAllowance(0n);
      return;
    }
    const client = publicClient as NonNullable<typeof publicClient>;
    let cancelled = false;

    async function loadUserData() {
      try {
        const [balance, allowance] = await Promise.all([
          client.readContract({
            abi: erc20Abi,
            address: pool!.token,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          }),
          client.readContract({
            abi: erc20Abi,
            address: pool!.token,
            functionName: "allowance",
            args: [address as `0x${string}`, pool!.pool],
          }),
        ]);
        if (!cancelled) {
          setUserBalance(balance as bigint);
          setUserAllowance(allowance as bigint);
        }
      } catch {
        if (!cancelled) {
          setUserBalance(0n);
          setUserAllowance(0n);
        }
      }
    }
    void loadUserData();
    const interval = setInterval(loadUserData, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pool, address, publicClient, isApproveSuccess, isSellSuccess]);

  // Get buy quote
  useEffect(() => {
    if (!pool || !publicClient || !buyAmount) {
      setBuyQuote(null);
      return;
    }
    const client = publicClient as NonNullable<typeof publicClient>;
    let cancelled = false;
    async function getQuote() {
      try {
        const zilAmountParsed = parseUnits(buyAmount, 18);
        const result = await client.readContract({
          abi: abis.forgeBondingCurvePool,
          address: pool!.pool,
          functionName: "quoteBuy",
          args: [zilAmountParsed],
        });
        if (!cancelled) {
          setBuyQuote({ tokensOut: result[0] as bigint, fee: result[1] as bigint });
        }
      } catch {
        if (!cancelled) setBuyQuote(null);
      }
    }
    const timeout = setTimeout(getQuote, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [pool, publicClient, buyAmount]);

  // Get sell quote
  useEffect(() => {
    if (!pool || !publicClient || !sellAmount) {
      setSellQuote(null);
      return;
    }
    const client = publicClient as NonNullable<typeof publicClient>;
    let cancelled = false;
    async function getQuote() {
      try {
        const tokenAmountParsed = parseUnits(sellAmount, 18);
        const result = await client.readContract({
          abi: abis.forgeBondingCurvePool,
          address: pool!.pool,
          functionName: "quoteSell",
          args: [tokenAmountParsed],
        });
        if (!cancelled) {
          setSellQuote({ zilOut: result[0] as bigint, fee: result[1] as bigint });
        }
      } catch {
        if (!cancelled) setSellQuote(null);
      }
    }
    const timeout = setTimeout(getQuote, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [pool, publicClient, sellAmount]);

  // Reset after successful trades
  useEffect(() => {
    if (isBuySuccess) {
      setBuyAmount("");
      setBuyQuote(null);
      setBuyTx(null);
      toast.success("Purchase successful!");
    }
  }, [isBuySuccess]);

  useEffect(() => {
    if (isSellSuccess) {
      setSellAmount("");
      setSellQuote(null);
      setSellTx(null);
      toast.success("Sale successful!");
    }
  }, [isSellSuccess]);

  useEffect(() => {
    if (isApproveSuccess) {
      setApproveTx(null);
      toast.success("Approval confirmed");
    }
  }, [isApproveSuccess]);

  const handleBuy = async () => {
    if (!pool || !buyAmount || !buyQuote) return;
    if (!isConnected || !address) {
      toast.error("Connect your wallet");
      return;
    }
    try {
      const zilAmountParsed = parseUnits(buyAmount, 18);
      const minTokensOut = (buyQuote.tokensOut * 99n) / 100n; // 1% slippage
      const tx = await writeContractAsync({
        abi: abis.forgeBondingCurvePool,
        address: pool.pool,
        functionName: "buy",
        args: [minTokensOut],
        value: zilAmountParsed,
      });
      setBuyTx(tx);
      toast.info("Transaction submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Buy failed", { description: err?.message });
    }
  };

  const handleApprove = async () => {
    if (!pool || !sellAmount) return;
    if (!isConnected || !address) {
      toast.error("Connect your wallet");
      return;
    }
    try {
      const tokenAmountParsed = parseUnits(sellAmount, 18);
      const tx = await writeContractAsync({
        abi: erc20Abi,
        address: pool.token,
        functionName: "approve",
        args: [pool.pool, tokenAmountParsed],
      });
      setApproveTx(tx);
      toast.info("Approval submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Approval failed", { description: err?.message });
    }
  };

  const handleSell = async () => {
    if (!pool || !sellAmount || !sellQuote) return;
    if (!isConnected || !address) {
      toast.error("Connect your wallet");
      return;
    }
    try {
      const tokenAmountParsed = parseUnits(sellAmount, 18);
      const minZilOut = (sellQuote.zilOut * 99n) / 100n; // 1% slippage
      const tx = await writeContractAsync({
        abi: abis.forgeBondingCurvePool,
        address: pool.pool,
        functionName: "sell",
        args: [tokenAmountParsed, minZilOut],
      });
      setSellTx(tx);
      toast.info("Transaction submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Sell failed", { description: err?.message });
    }
  };

  const sellAmountParsed = sellAmount ? parseUnits(sellAmount, 18) : 0n;
  const needsApproval = sellAmountParsed > 0n && userAllowance < sellAmountParsed;

  const isTrading = pool?.state === 0;
  const stateConfig = pool ? stateLabels[pool.state] ?? stateLabels[0] : stateLabels[0];
  const progress = pool ? Number(pool.progressBps) / 100 : 0;

  return (
    <div className="space-y-6 pb-10">
      <Button asChild variant="ghost" className="h-auto p-0 text-sm text-muted-foreground">
        <Link href="/bonding-curve" className="inline-flex items-center gap-2">
          <ArrowLeft className="size-4" />
          Back to pools
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
            <CardTitle>Unable to load pool</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {pool && (
        <>
          <PageHeader
            title={pool.tokenName}
            description={`${pool.tokenSymbol} · ${formatAddress(pool.pool)}`}
            icon={<TrendingUp className="size-6 text-primary" />}
          />

          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            {/* Main column */}
            <div className="space-y-6">
              {/* Stats */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{pool.tokenSymbol}</CardTitle>
                      <CardDescription>Bonding curve pool</CardDescription>
                    </div>
                    <Badge variant={stateConfig.variant}>{stateConfig.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress to graduation</span>
                      <span className="font-medium">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Target: {formatUnits(pool.graduationMarketCap, 18)} ZIL market cap
                    </p>
                  </div>

                  {/* Stats grid */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Stat label="Current price" value={`${Number(formatUnits(pool.currentPrice, 18)).toFixed(9)} ZIL`} />
                    <Stat label="Market cap" value={`${Number(formatUnits(pool.marketCap, 18)).toLocaleString()} ZIL`} />
                    <Stat label="ZIL reserve" value={`${Number(formatUnits(pool.zilReserve, 18)).toLocaleString()} ZIL`} />
                    <Stat label="Tokens sold" value={`${Number(formatUnits(pool.tokensSold, 18)).toLocaleString()}`} />
                    <Stat label="Tokens remaining" value={`${Number(formatUnits(pool.tokensRemaining, 18)).toLocaleString()}`} />
                    <Stat label="Trading fee" value={`${Number(pool.tradingFeePercent) / 100}%`} />
                  </div>
                </CardContent>
              </Card>

              {/* Trading */}
              {isTrading && (
                <Card>
                  <CardHeader>
                    <CardTitle>Trade</CardTitle>
                    <CardDescription>Buy or sell {pool.tokenSymbol} tokens</CardDescription>
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
                            onChange={(e) => setBuyAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                            placeholder="0.0"
                          />
                        </div>
                        {buyQuote && (
                          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">You will receive</span>
                              <span className="font-medium">
                                {Number(formatUnits(buyQuote.tokensOut, 18)).toLocaleString()} {pool.tokenSymbol}
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
                          disabled={isWriting || isBuyConfirming || !buyAmount || !buyQuote}
                          className="w-full"
                        >
                          {(isWriting || isBuyConfirming) && <Loader2 className="mr-2 size-4 animate-spin" />}
                          {isBuyConfirming ? "Confirming..." : "Buy"}
                        </Button>
                      </TabsContent>

                      <TabsContent value="sell" className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Amount ({pool.tokenSymbol})</Label>
                            <button
                              type="button"
                              onClick={() => setSellAmount(formatUnits(userBalance, 18))}
                              className="text-xs text-primary hover:underline"
                            >
                              Max: {Number(formatUnits(userBalance, 18)).toLocaleString()}
                            </button>
                          </div>
                          <Input
                            type="text"
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                            placeholder="0.0"
                          />
                        </div>
                        {sellQuote && (
                          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">You will receive</span>
                              <span className="font-medium">{formatUnits(sellQuote.zilOut, 18)} ZIL</span>
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
                            disabled={isWriting || isApproveConfirming || !sellAmount}
                            className="w-full"
                            variant="secondary"
                          >
                            {(isWriting || isApproveConfirming) && <Loader2 className="mr-2 size-4 animate-spin" />}
                            {isApproveConfirming ? "Approving..." : "Approve"}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleSell}
                            disabled={isWriting || isSellConfirming || !sellAmount || !sellQuote}
                            className="w-full"
                          >
                            {(isWriting || isSellConfirming) && <Loader2 className="mr-2 size-4 animate-spin" />}
                            {isSellConfirming ? "Confirming..." : "Sell"}
                          </Button>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {/* Graduated info */}
              {!isTrading && (
                <Card>
                  <CardHeader>
                    <CardTitle>Graduated</CardTitle>
                    <CardDescription>This token has graduated to Uniswap V3</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Trading is now available on Uniswap V3. The bonding curve has completed.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <DetailRow label="Pool">
                    <a
                      href={addressUrl(chainId, pool.pool)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {formatAddress(pool.pool)}
                      <ExternalLink className="size-3" />
                    </a>
                  </DetailRow>
                  <DetailRow label="Token">
                    <a
                      href={addressUrl(chainId, pool.token)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {formatAddress(pool.token)}
                      <ExternalLink className="size-3" />
                    </a>
                  </DetailRow>
                  <DetailRow label="Creator">{formatAddress(pool.creator)}</DetailRow>
                </CardContent>
              </Card>

              {/* Recent trades */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent trades</CardTitle>
                </CardHeader>
                <CardContent>
                  {tradesLoading && trades.length === 0 ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 rounded" />
                      ))}
                    </div>
                  ) : trades.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No trades yet</p>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {trades.map((trade) => (
                        <a
                          key={trade.txHash}
                          href={txUrl(chainId, trade.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-lg border p-2 text-xs hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {trade.type === "buy" ? (
                              <TrendingUp className="size-3.5 text-green-500" />
                            ) : (
                              <TrendingDown className="size-3.5 text-red-500" />
                            )}
                            <span className="text-muted-foreground">{formatAddress(trade.trader)}</span>
                          </div>
                          <div className="text-right">
                            <p className={trade.type === "buy" ? "text-green-500" : "text-red-500"}>
                              {trade.type === "buy" ? "+" : "-"}
                              {Number(formatUnits(trade.tokenAmount, 18)).toLocaleString(undefined, {
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-muted-foreground">
                              {formatUnits(trade.zilAmount, 18)} ZIL
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}
