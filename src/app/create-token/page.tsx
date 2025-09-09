"use client";
import { useEffect, useMemo } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseUnits } from "viem";
import { abis, getFactoryAddress } from "@/lib/contracts";
import { addressUrl, txUrl } from "@/lib/explorer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { nf, tryFormatUnits } from "@/lib/format";

export default function CreateTokenPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
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
    query: { enabled: Boolean(factory) },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const canSubmit = isConnected && !!factory && isValid;

  useEffect(() => {
    if (isConfirmed && hash) {
      toast.success("Token created", {
        description: "Your token contract has been deployed.",
        action: {
          label: "View Tx",
          onClick: () => {
            window.open(txUrl(chainId, hash), "_blank");
          },
        },
      });
    }
  }, [isConfirmed, hash, chainId]);

  const onSubmit = handleSubmit((values) => {
    if (!factory || !address) return;
    const supply = parseUnits(values.supply.replace(",", "."), values.decimals);
    writeContract({
      abi: abis.forgeTokenFactory,
      address: factory,
      functionName: "createToken",
      args: [
        values.name.trim(),
        values.symbol.trim().toUpperCase(),
        values.decimals,
        supply,
        address,
      ],
      value: (fee as bigint | undefined) ?? BigInt(0),
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

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>
                <span>Network: </span>
                <span className="font-medium">{chainId}</span>
              </div>
              <div>
                <span>Factory: </span>
                {factory ? (
                  <a
                    className="underline"
                    href={addressUrl(chainId, factory)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {factory.slice(0, 6)}…{factory.slice(-4)}
                  </a>
                ) : (
                  <span>not set</span>
                )}
              </div>
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
            <Button type="submit" disabled={!canSubmit || isPending}>
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
          {isConfirmed && (
            <p className="text-xs text-green-600 dark:text-green-400 px-6 pb-4">
              Token created successfully.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
