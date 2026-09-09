"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";
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
import { z } from "zod";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { abis, getFactoryAddress } from "@/lib/contracts";
import { addressUrl, txUrl } from "@/lib/explorer";
import { nf, tryFormatUnits } from "@/lib/format";
import { useNetwork } from "@/providers/network";

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
  const [previewName, previewSymbol, previewSupply] = form.watch([
    "name",
    "symbol",
    "supply",
  ]);

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
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Make it yours"
        description="Give your idea a name and a token of its own. No code needed."
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

      <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
        <div className="rounded-3xl border bg-card p-6 sm:p-8">
          <form onSubmit={onSubmit}>
            <p className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
              01 / Give it an identity
            </p>
            <h2 className="text-xl font-semibold">Meet your new token</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose what people will call it and how many will exist.
            </p>

            <div className="border-t pt-5 mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Sunshine Club"
                    {...register("name")}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input
                    id="symbol"
                    maxLength={11}
                    placeholder="e.g. SUN"
                    {...register("symbol")}
                  />
                  {errors.symbol && (
                    <p className="text-xs text-destructive">
                      {errors.symbol.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="decimals">Decimals (0-18)</Label>
                  <Input
                    id="decimals"
                    type="number"
                    min={0}
                    max={18}
                    {...register("decimals", { valueAsNumber: true })}
                  />
                  {errors.decimals && (
                    <p className="text-xs text-destructive">
                      {errors.decimals.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="supply">Total Supply (whole tokens)</Label>
                  <Input
                    id="supply"
                    placeholder="1000000"
                    {...register("supply")}
                  />
                  {errors.supply && (
                    <p className="text-xs text-destructive">
                      {errors.supply.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-5 mt-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Creation fee:{" "}
                {fee
                  ? `${nf().format(Number(tryFormatUnits(fee, 18)))} ZIL`
                  : "---"}
              </p>

              <Button
                type="submit"
                disabled={!canSubmit || isPending}
                aria-busy={isPending}
                className="w-full rounded-full text-base font-semibold"
                size="lg"
              >
                {isPending && <Loader2 className="animate-spin" />}
                {isPending ? "Confirm in wallet..." : "Create Token"}
              </Button>

              {!isConnected && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted p-4">
                  <p className="text-base text-muted-foreground sm:text-sm">
                    Connect your wallet when you&apos;re ready.
                  </p>
                  <ConnectWalletButton />
                </div>
              )}

              {hash && (
                <Button
                  asChild
                  variant="outline"
                  className="w-full rounded-full"
                >
                  <a
                    href={txUrl(chainId, hash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Tx
                  </a>
                </Button>
              )}

              {isConfirming && (
                <p className="text-xs text-muted-foreground">
                  Waiting for confirmations...
                </p>
              )}
            </div>
          </form>
        </div>
        <aside
          className="space-y-5 xl:sticky xl:top-24"
          aria-label="Your token preview"
        >
          <div className="token-preview overflow-hidden rounded-3xl p-7">
            <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              A first look
            </p>
            <div className="my-8 flex justify-center" aria-hidden="true">
              <div className="flex size-28 rotate-[-8deg] items-center justify-center rounded-[38%] bg-primary text-3xl font-semibold text-primary-foreground">
                {previewSymbol.trim().slice(0, 3).toUpperCase() || "YOU"}
              </div>
            </div>
            <div className="rounded-2xl bg-card p-5">
              <h2 className="break-words text-2xl font-semibold tracking-tight">
                {previewName.trim() || "Your next big idea"}
              </h2>
              <p className="mt-1 break-all text-base text-muted-foreground">
                {previewSymbol.trim().toUpperCase() || "TOKEN"}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm">
                <span className="text-muted-foreground">Total supply</span>
                <span className="max-w-full break-all font-medium tabular-nums">
                  {previewSupply || "0"}
                </span>
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              A preview of what you&apos;re creating.
            </p>
          </div>
          <div className="px-2">
            <h3 className="text-base font-semibold">Yours from the start</h3>
            <p className="mt-2 text-pretty text-base/7 text-muted-foreground sm:text-sm/6">
              The full supply goes to your wallet. Creating a token is a
              separate step from launching it for trading.
            </p>
          </div>
        </aside>
      </div>

      {created && (
        <div className="rounded-3xl border bg-card p-6 sm:p-8 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold">Token created</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your token is live. Full supply has been minted to your wallet.
          </p>

          <div className="border-t pt-5 mt-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Name
                </p>
                <p className="mt-1 text-sm font-medium">{created.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Symbol
                </p>
                <p className="mt-1 text-sm font-medium">{created.symbol}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Decimals
                </p>
                <p className="mt-1 text-sm font-medium">{created.decimals}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Total Supply
                </p>
                <p className="mt-1 text-sm font-medium">
                  {tryFormatUnits(created.supply, created.decimals)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Address
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <a
                    href={addressUrl(chainId, created.token)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground hover:underline font-mono"
                  >
                    {created.token.slice(0, 6)}...{created.token.slice(-4)}
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
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Transaction
                </p>
                <p className="mt-1 text-sm font-medium">
                  <a
                    href={txUrl(chainId, created.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:underline"
                  >
                    {created.txHash.slice(0, 8)}...
                  </a>
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Minted To
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <a
                    href={addressUrl(chainId, created.creator)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground hover:underline font-mono"
                  >
                    {created.creator.slice(0, 6)}...
                    {created.creator.slice(-4)}
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
            </div>
          </div>

          <div className="border-t pt-5 mt-5 flex flex-wrap gap-2">
            <Button asChild size="lg" className="rounded-full font-semibold">
              <a
                href={addressUrl(chainId, created.token)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-4" /> View on Explorer
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <a
                href={txUrl(chainId, created.txHash)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-4" /> View Transaction
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
