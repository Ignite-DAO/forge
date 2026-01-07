"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { parseEventLogs, parseUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useNetwork } from "@/providers/network";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { abis, getFactoryAddress } from "@/lib/contracts";
import { addressUrl, txUrl } from "@/lib/explorer";
import { nf, tryFormatUnits } from "@/lib/format";

export default function CreateTokenPage() {
  const { address, isConnected } = useAccount();
  const { chainId } = useNetwork();
  const factory = getFactoryAddress(chainId);

  const schema = z.object({
    name: z.string().min(1, "Required").max(64, "Max 64 characters"),
    symbol: z
      .string()
      .min(1, "Required")
      .max(11, "Max 11 characters")
      .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
    decimals: z.coerce.number().min(0, "Min 0").max(18, "Max 18"),
    supply: z
      .string()
      .min(1, "Required")
      .regex(/^\d+(?:[.,]\d+)?$/, "Enter a number"),
  });

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    // Cast to align with zodResolver + z.coerce typing
    resolver: zodResolver(schema) as any,
    mode: "onChange",
    defaultValues: { name: "", symbol: "", decimals: 18, supply: "" },
  });
  const { register, handleSubmit, formState } = form;
  const { errors, isValid } = formState;

  const { data: fee } = useReadContract({
    abi: abis.forgeTokenFactory,
    address: factory ?? undefined,
    functionName: "fee",
    chainId,
    query: { enabled: Boolean(factory) },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });
  const publicClient = usePublicClient({ chainId });

  const canSubmit = isConnected && !!factory && isValid;

  const [created, setCreated] = useState<{
    token: `0x${string}`;
    name: string;
    symbol: string;
    decimals: number;
    supply: bigint;
    txHash: `0x${string}`;
    creator: `0x${string}`;
  } | null>(null);

  useEffect(() => {
    async function decode() {
      if (!isConfirmed || !hash || !publicClient) return;
      try {
        const r = await publicClient.getTransactionReceipt({ hash });
        let found = false;
        for (const log of r.logs) {
          try {
            const decoded = (await (async () => {
              const { decodeEventLog } = await import("viem");
              return decodeEventLog({
                abi: abis.forgeTokenFactory as any,
                data: log.data,
                topics: log.topics as any,
              }) as any;
            })()) as any;
            if (decoded?.eventName === "TokenCreated") {
              const args = decoded.args as {
                token: `0x${string}`;
                creator: `0x${string}`;
                name: string;
                symbol: string;
                decimals: number;
                supply: bigint;
              };
              setCreated({
                token: args.token,
                name: args.name,
                symbol: args.symbol,
                decimals: Number(args.decimals),
                supply: BigInt(args.supply),
                txHash: hash!,
                creator: args.creator,
              });
              found = true;
              break;
            }
          } catch {
            // ignore non-matching logs
          }
        }
        if (!found && factory) {
          // Fallback: query logs by block for the factory and match tx hash
          const logs = await publicClient.getLogs({
            address: factory,
            event: {
              type: "event",
              name: "TokenCreated",
              inputs: [
                { name: "token", type: "address", indexed: true },
                { name: "creator", type: "address", indexed: true },
                { name: "name", type: "string", indexed: false },
                { name: "symbol", type: "string", indexed: false },
                { name: "decimals", type: "uint8", indexed: false },
                { name: "supply", type: "uint256", indexed: false },
              ],
            } as any,
            fromBlock: r.blockNumber,
            toBlock: r.blockNumber,
          });
          const match = logs.find((l: any) => l.transactionHash === hash);
          if (match) {
            const args = (match as any).args as {
              token: `0x${string}`;
              creator: `0x${string}`;
              name: string;
              symbol: string;
              decimals: number;
              supply: bigint;
            };
            setCreated({
              token: args.token,
              name: args.name,
              symbol: args.symbol,
              decimals: Number(args.decimals),
              supply: BigInt(args.supply),
              txHash: hash!,
              creator: args.creator,
            });
          }
        }
      } catch {
        // ignore decode errors
      }
      toast.success("Token created", {
        description: "Your token contract has been deployed.",
        action: {
          label: "View Tx",
          onClick: () => window.open(txUrl(chainId, hash!), "_blank"),
        },
      });
    }
    void decode();
  }, [isConfirmed, hash, chainId, publicClient]);

  const onSubmit = handleSubmit((values) => {
    if (!factory || !address) return;
    const supply = parseUnits(values.supply.replace(",", "."), values.decimals);
    setCreated(null);
    writeContract({
      abi: abis.forgeTokenFactory,
      address: factory,
      functionName: "createToken",
      args: [
        values.name.trim(),
        values.symbol.trim().toUpperCase(),
        values.decimals,
        supply,
      ],
      value: fee && (fee as bigint) > 0n ? (fee as bigint) : undefined,
      chainId,
    });
    toast("Transaction submitted", {
      description: "Confirm in your wallet and wait for confirmations.",
    });
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Token"
        description="Configure name, symbol, decimals and supply."
      />

      {!factory && (
        <Alert variant="destructive">
          <AlertTitle>Factory not configured</AlertTitle>
          <AlertDescription>
            Set env keys: NEXT_PUBLIC_FACTORY_ADDRESS_32769 /
            NEXT_PUBLIC_FACTORY_ADDRESS_33101 for the active chain.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <CardHeader>
            <CardTitle>Create token</CardTitle>
            <CardDescription>
              Set token metadata and total supply.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="My Token" {...register("name")} />
                {errors.name && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  maxLength={11}
                  placeholder="MTK"
                  {...register("symbol")}
                />
                {errors.symbol && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.symbol.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="decimals">Decimals (0–18)</Label>
                <Input
                  id="decimals"
                  type="number"
                  min={0}
                  max={18}
                  {...register("decimals", { valueAsNumber: true })}
                />
                {errors.decimals && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.decimals.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="supply">Total Supply (whole tokens)</Label>
                <Input
                  id="supply"
                  placeholder="1000000"
                  {...register("supply")}
                />
                {errors.supply && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.supply.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end text-xs text-muted-foreground">
              <div>
                <span>Fee: </span>
                <span>
                  {fee
                    ? `${nf().format(Number(tryFormatUnits(fee, 18)))} ZIL`
                    : "—"}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              type="submit"
              disabled={!canSubmit || isPending}
              aria-busy={isPending}
            >
              {isPending && <Loader2 className="animate-spin" />}
              {isPending ? "Confirm in wallet…" : "Create Token"}
            </Button>
            {hash && (
              <Button asChild variant="outline">
                <a href={txUrl(chainId, hash)} target="_blank" rel="noreferrer">
                  View Tx
                </a>
              </Button>
            )}
          </CardFooter>

          {isConfirming && (
            <p className="text-xs text-muted-foreground px-6 pb-4">
              Waiting for confirmations…
            </p>
          )}
        </form>
      </Card>

      {created && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge>
                <CheckCircle2 className="size-3" /> Success
              </Badge>
              <CardTitle className="text-base">Token created</CardTitle>
            </div>
            <CardDescription>
              Your token is live. Full supply has been minted to your wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="text-muted-foreground">Name</div>
              <div className="font-medium">{created.name}</div>
              <div className="text-muted-foreground">Symbol</div>
              <div className="font-medium">{created.symbol}</div>
              <div className="text-muted-foreground">Decimals</div>
              <div className="font-medium">{created.decimals}</div>
              <div className="text-muted-foreground">Total Supply</div>
              <div className="font-medium">
                {tryFormatUnits(created.supply, created.decimals)}
              </div>
              <div className="text-muted-foreground">Address</div>
              <div className="font-medium flex items-center gap-2">
                <a
                  href={addressUrl(chainId, created.token)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-mono"
                >
                  {created.token.slice(0, 6)}…{created.token.slice(-4)}
                </a>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(created.token).then(() =>
                      toast.success("Address copied", {
                        description: created.token,
                      }),
                    );
                  }}
                >
                  <Copy className="size-4" /> Copy
                </Button>
              </div>
              <div className="text-muted-foreground">Transaction</div>
              <div className="font-medium">
                <a
                  href={txUrl(chainId, created.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {created.txHash.slice(0, 8)}…
                </a>
              </div>
              <div className="text-muted-foreground">Minted To</div>
              <div className="font-medium flex items-center gap-2">
                <a
                  href={addressUrl(chainId, created.creator)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-mono"
                >
                  {created.creator.slice(0, 6)}…{created.creator.slice(-4)}
                </a>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(created.creator).then(() =>
                      toast.success("Address copied", {
                        description: created.creator,
                      }),
                    );
                  }}
                >
                  <Copy className="size-4" /> Copy
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline">
                <a
                  href={addressUrl(chainId, created.token)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-4" /> View on Explorer
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={txUrl(chainId, created.txHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-4" /> View Transaction
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
