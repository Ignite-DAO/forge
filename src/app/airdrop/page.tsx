"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useNetwork } from "@/providers/network";
import { z } from "zod";
import { erc20Abi } from "@/abi/erc20";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { abis, getAirdropperAddress } from "@/lib/contracts";
import { nf, tryFormatUnits } from "@/lib/format";

type Row = { address: string; amount: string };

function parseLines(input: string): Row[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/[,\s]+/).map((p) => p.trim());
      return {
        address: (parts[0] || "").toLowerCase(),
        amount: parts[1] || "",
      };
    });
}

const schema = z.object({
  token: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid address"),
  rows: z.string().min(1, "Paste address,amount rows"),
});

type FormValues = z.infer<typeof schema>;

export default function AirdropPage() {
  const { chainId } = useNetwork();
  const { address: sender } = useAccount();
  const airdropper = getAirdropperAddress(chainId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { token: "", rows: "" },
  });
  const { register, watch, formState } = form;
  const { errors, isValid } = formState;

  const token = watch("token");
  const raw = watch("rows");
  const rows = useMemo(() => parseLines(raw).slice(0, 500), [raw]);

  const { data: decimals } = useReadContract({
    abi: erc20Abi,
    address: token as `0x${string}` | undefined,
    functionName: "decimals",
    chainId,
    query: { enabled: /^0x[a-fA-F0-9]{40}$/.test(token) },
  });

  const recipients = useMemo(
    () => rows.map((r) => r.address as `0x${string}`),
    [rows],
  );
  const amounts = useMemo(() => {
    const d = Number(decimals ?? 18);
    try {
      return rows.map((r) => parseUnits(r.amount || "0", d));
    } catch {
      return [] as bigint[];
    }
  }, [rows, decimals]);

  const total = useMemo(
    () => amounts.reduce((a, b) => a + b, BigInt(0)),
    [amounts],
  );

  // Airdropper fee (if any)
  const { data: dropFee } = useReadContract({
    abi: abis.forgeAirdropper,
    address: airdropper ?? undefined,
    functionName: "fee",
    chainId,
    query: { enabled: Boolean(airdropper) },
  });

  const { data: allowance } = useReadContract({
    abi: erc20Abi,
    address: token as `0x${string}` | undefined,
    functionName: "allowance",
    args: sender && airdropper ? [sender, airdropper] : undefined,
    chainId,
    query: { enabled: Boolean(sender && airdropper && token) },
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const [action, setAction] = useState<"approve" | "airdrop" | null>(null);
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const invalidRows = rows.filter(
    (r, i) =>
      !/^0x[a-fA-F0-9]{40}$/.test(r.address) || amounts[i] == (null as any),
  );
  const ready =
    isValid &&
    rows.length > 0 &&
    amounts.length === rows.length &&
    recipients.every((a) => /^0x[a-fA-F0-9]{40}$/.test(a)) &&
    invalidRows.length === 0 &&
    Boolean(airdropper);

  function onApprove() {
    if (!ready || !airdropper) return;
    setAction("approve");
    writeContract({
      abi: erc20Abi,
      address: token as `0x${string}`,
      functionName: "approve",
      args: [airdropper, total],
      chainId,
    });
  }

  function onAirdrop() {
    if (!ready || !airdropper) return;
    setAction("airdrop");
    writeContract({
      abi: abis.forgeAirdropper,
      address: airdropper,
      functionName: "airdrop",
      args: [token as `0x${string}`, recipients as `0x${string}`[], amounts],
      value:
        dropFee && (dropFee as bigint) > 0n ? (dropFee as bigint) : undefined,
      chainId,
    });
    toast("Airdrop submitted", {
      description: "Confirm in wallet and wait for confirmations.",
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Airdrop"
        description="Paste recipients and amounts to distribute tokens."
      />

      <Card>
        <CardHeader>
          <CardTitle>Batch distribution</CardTitle>
          <CardDescription>
            Paste CSV or a list of address,amount per line.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!airdropper && (
            <Alert variant="destructive">
              <AlertTitle>Airdropper not configured</AlertTitle>
              <AlertDescription>
                Set env keys: NEXT_PUBLIC_AIRDROPPER_ADDRESS_32769 /
                NEXT_PUBLIC_AIRDROPPER_ADDRESS_33101 for the active chain.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="token">Token address</Label>
              <Input id="token" placeholder="0x..." {...register("token")} />
              {errors.token && (
                <p className="text-xs text-destructive mt-1">
                  {errors.token.message}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Decimals</Label>
              <Input
                value={decimals?.toString() ?? ""}
                readOnly
                placeholder="—"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rows">Recipients (address,amount)</Label>
            <Textarea
              id="rows"
              rows={8}
              placeholder="0xabc...,100\n0xdef...,250"
              {...register("rows")}
            />
            {errors.rows && (
              <p className="text-xs text-destructive mt-1">
                {errors.rows.message}
              </p>
            )}
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-4">
            <div>Rows: {rows.length}</div>
            <div>Total: {nf().format(Number(total))} wei</div>
            <div>Allowance: {allowance ? allowance.toString() : "—"}</div>
            <div>
              Fee:{" "}
              {dropFee && dropFee > 0n
                ? `${nf().format(Number(tryFormatUnits(dropFee, 18)))} ZIL`
                : "—"}
            </div>
            {invalidRows.length > 0 && (
              <div className="text-destructive">
                Invalid rows: {invalidRows.length}
              </div>
            )}
          </div>

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Address</TableHead>
                    <TableHead>Amount (human)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((r, idx) => {
                    const invalid =
                      !/^0x[a-fA-F0-9]{40}$/.test(r.address) ||
                      r.amount.trim() === "";
                    return (
                      <TableRow
                        key={idx}
                        className={invalid ? "bg-destructive/5" : undefined}
                      >
                        <TableCell className="font-mono text-xs">
                          {r.address}
                        </TableCell>
                        <TableCell className="text-xs">{r.amount}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {rows.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Showing first 50 of {rows.length} rows.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={
                !ready || (allowance ?? BigInt(0)) >= total || isPending
              }
              onClick={onApprove}
            >
              {isPending && action === "approve" && (
                <Loader2 className="animate-spin" />
              )}
              {isPending && action === "approve"
                ? "Confirm in wallet…"
                : "Approve"}
            </Button>
            <Button
              type="button"
              disabled={!ready || (allowance ?? BigInt(0)) < total || isPending}
              onClick={onAirdrop}
            >
              {isPending && action === "airdrop" && (
                <Loader2 className="animate-spin" />
              )}
              {isPending && action === "airdrop"
                ? "Confirm in wallet…"
                : "Run Airdrop"}
            </Button>
          </div>

          {isConfirming && (
            <p className="text-xs text-muted-foreground">
              Waiting for confirmations…
            </p>
          )}
          {isConfirmed && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Airdrop completed.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
