"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Rocket } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { decodeEventLog, formatUnits, isAddress } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useNetwork } from "@/providers/network";
import { z } from "zod";
import { erc20Abi } from "@/abi/erc20";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { abis, getFairLaunchFactoryAddress } from "@/lib/contracts";
import { addressUrl, txUrl } from "@/lib/explorer";
import {
  type FairLaunchCurrencyCode,
  FairLaunchCurrencyId,
  type FairLaunchRouterKindCode,
  FairLaunchRouterKindId,
  formatTokenAmount,
  getCurrencyMeta,
  LIQUIDITY_MAX,
  LIQUIDITY_MIN,
  LOCK_OPTIONS,
  parseAmount,
  parseLockDuration,
  tokensForLiquidity,
  totalTokensRequired,
} from "@/lib/fairlaunch";
import { cn } from "@/lib/utils";

const decimalPattern = /^\d+(?:[.,]\d+)?$/;
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const formSchema = z
  .object({
    tokenAddress: z
      .string()
      .trim()
      .min(1, "Required")
      .refine((value) => isAddress(value), "Invalid address"),
    currency: z.enum(["ZIL", "USDC"]),
    saleAmount: z
      .string()
      .trim()
      .min(1, "Required")
      .refine((value) => decimalPattern.test(value), "Enter a number"),
    softCap: z
      .string()
      .trim()
      .min(1, "Required")
      .refine((value) => decimalPattern.test(value), "Enter a number"),
    hardCap: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || decimalPattern.test(value),
        "Enter a number",
      ),
    maxContribution: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || decimalPattern.test(value),
        "Enter a number",
      ),
    startTime: z.string().min(1, "Required"),
    endTime: z.string().min(1, "Required"),
    liquidityPercent: z.coerce.number().min(LIQUIDITY_MIN).max(LIQUIDITY_MAX),
    autoListing: z.boolean().default(true),
    routerKind: z.enum(["V2", "V3"]),
    v3FeeTier: z.enum(["100", "500", "2500", "10000"]),
    lockDuration: z.string(),
    whitelistEnabled: z.boolean().default(false),
    whitelistRoot: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) =>
          !value || value === ZERO_BYTES32 || /^0x[0-9a-fA-F]{64}$/.test(value),
        "Enter a bytes32 value",
      ),
    projectName: z.string().trim().min(1, "Required"),
    website: z.string().trim().optional(),
    twitter: z.string().trim().optional(),
    telegram: z.string().trim().optional(),
    logoUrl: z.string().trim().optional(),
    bannerUrl: z.string().trim().optional(),
    description: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      if (!data.hardCap) return true;
      return (
        parseFloat(data.hardCap.replace(",", ".")) >=
        parseFloat(data.softCap.replace(",", "."))
      );
    },
    {
      message: "Hard cap must be >= soft cap",
      path: ["hardCap"],
    },
  )
  .refine(
    (data) => {
      const start = Date.parse(data.startTime);
      const end = Date.parse(data.endTime);
      return Number.isFinite(start) && Number.isFinite(end) && end > start;
    },
    { message: "End time must be after the start time", path: ["endTime"] },
  )
  .refine(
    (data) => {
      if (!data.whitelistEnabled) return true;
      return Boolean(data.whitelistRoot && data.whitelistRoot !== ZERO_BYTES32);
    },
    {
      message: "Provide a whitelist Merkle root when whitelist is enabled",
      path: ["whitelistRoot"],
    },
  );

type FormValues = z.infer<typeof formSchema>;

const steps = [
  {
    title: "Verify token",
    description: "Provide the ERC-20 you plan to sell.",
  },
  { title: "Configure sale", description: "Set amounts, caps, and timing." },
  { title: "Project details", description: "Add basic metadata and links." },
  { title: "Review & launch", description: "Confirm approvals and deploy." },
] as const;

const stepFields: (keyof FormValues)[][] = [
  ["tokenAddress", "currency"],
  [
    "saleAmount",
    "softCap",
    "hardCap",
    "maxContribution",
    "startTime",
    "endTime",
    "liquidityPercent",
    "lockDuration",
  ],
  [
    "projectName",
    "website",
    "twitter",
    "telegram",
    "logoUrl",
    "bannerUrl",
    "description",
  ],
  [],
];

function formatDateTimeInput(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

function buildMetadata(values: FormValues) {
  return JSON.stringify(
    {
      version: 1,
      name: values.projectName,
      description: values.description ?? "",
      logoUrl: values.logoUrl ?? "",
      bannerUrl: values.bannerUrl ?? "",
      links: {
        website: values.website ?? "",
        twitter: values.twitter ?? "",
        telegram: values.telegram ?? "",
      },
    },
    null,
    2,
  );
}

function toUnix(value: string) {
  return Math.floor(new Date(value).getTime() / 1000);
}

export default function FairLaunchPage() {
  const { chainId } = useNetwork();
  const factory = getFairLaunchFactoryAddress(chainId);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId });

  const currentTime = Date.now();
  const defaultStart = formatDateTimeInput(
    new Date(currentTime + 60 * 60 * 1000),
  );
  const defaultEnd = formatDateTimeInput(
    new Date(currentTime + 24 * 60 * 60 * 1000),
  );

  const form = useForm<FormValues>({
    // Cast due to coerce types producing wider resolver signature.
    resolver: zodResolver(formSchema) as any,
    mode: "onChange",
    defaultValues: {
      tokenAddress: "" as `0x${string}`,
      currency: "ZIL",
      saleAmount: "1000000",
      softCap: "100",
      hardCap: "",
      maxContribution: "",
      startTime: defaultStart,
      endTime: defaultEnd,
      liquidityPercent: 80,
      autoListing: true,
      routerKind: "V3",
      v3FeeTier: "2500",
      lockDuration: LOCK_OPTIONS[1]?.value ?? "0",
      whitelistEnabled: false,
      whitelistRoot: "",
      projectName: "",
      website: "",
      twitter: "",
      telegram: "",
      logoUrl: "",
      bannerUrl: "",
      description: "",
    },
  });

  const { register, watch, handleSubmit, setValue, formState, trigger, reset } =
    form;
  const { errors, isValid } = formState;
  const [step, setStep] = useState(0);
  const [createdLaunch, setCreatedLaunch] = useState<{
    pool: `0x${string}`;
    txHash: `0x${string}`;
  } | null>(null);

  const tokenAddress = watch("tokenAddress");
  const currencyCode = watch("currency") as FairLaunchCurrencyCode;
  const liquidityPercent = watch("liquidityPercent");
  const saleAmount = watch("saleAmount");
  const autoListing = watch("autoListing");
  const whitelistEnabled = watch("whitelistEnabled");
  const v3FeeTier = watch("v3FeeTier");
  const routerKindValue = watch("routerKind");
  const lockDurationValue = watch("lockDuration");
  const softCapValue = watch("softCap");

  const tokenQueryEnabled = Boolean(isAddress(tokenAddress));

  const { data: tokenDecimals } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress as `0x${string}`,
    functionName: "decimals",
    chainId,
    query: { enabled: tokenQueryEnabled },
  });
  const { data: tokenSymbol } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress as `0x${string}`,
    functionName: "symbol",
    chainId,
    query: { enabled: tokenQueryEnabled },
  });
  const { data: tokenName } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress as `0x${string}`,
    functionName: "name",
    chainId,
    query: { enabled: tokenQueryEnabled },
  });

  const { data: creationFee } = useReadContract({
    abi: abis.forgeFairLaunchFactory,
    address: factory ?? undefined,
    functionName: "creationFee",
    chainId,
    query: { enabled: Boolean(factory) },
  });

  const currencyMeta = getCurrencyMeta(currencyCode);

  const parsedSaleAmount =
    tokenDecimals != null && decimalPattern.test(saleAmount) && saleAmount
      ? parseAmount(saleAmount.replace(",", "."), tokenDecimals)
      : null;

  const liquidityTokens =
    parsedSaleAmount != null
      ? tokensForLiquidity(parsedSaleAmount, liquidityPercent)
      : null;
  const tokensNeeded =
    parsedSaleAmount != null
      ? totalTokensRequired(parsedSaleAmount, liquidityPercent)
      : null;

  const { data: allowance } = useReadContract({
    abi: erc20Abi,
    address: tokenAddress as `0x${string}`,
    functionName: "allowance",
    args: [
      address ?? "0x0000000000000000000000000000000000000000",
      factory ?? "0x0000000000000000000000000000000000000000",
    ],
    chainId,
    query: {
      enabled: Boolean(address && factory && tokenQueryEnabled),
    },
  });

  const needsApproval =
    tokensNeeded != null && allowance != null ? allowance < tokensNeeded : true;

  const { writeContractAsync: approveAsync, isPending: isApproving } =
    useWriteContract();
  const {
    writeContract,
    data: launchHash,
    isPending: isLaunching,
  } = useWriteContract();
  const { isSuccess: launchConfirmed, isLoading: isConfirming } =
    useWaitForTransactionReceipt({
      hash: launchHash,
    });

  useEffect(() => {
    if (!launchConfirmed || !launchHash || !publicClient || !factory) return;
    (async () => {
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: launchHash,
        });
        const events = receipt.logs
          .map((log) => {
            try {
              return decodeEventLog({
                abi: abis.forgeFairLaunchFactory,
                data: log.data,
                topics: log.topics,
              });
            } catch {
              return null;
            }
          })
          .filter(Boolean) as Array<{ eventName: string; args: any }>;
        const created = events.find(
          (evt) => evt.eventName === "FairLaunchCreated",
        );
        if (created) {
          setCreatedLaunch({
            pool: created.args.pool,
            txHash: launchHash,
          });
        }
        toast.success("Launchpad deployed", {
          description: "Your fair launch contract is live.",
          action: {
            label: "View Tx",
            onClick: () => window.open(txUrl(chainId, launchHash), "_blank"),
          },
        });
      } catch {
        toast.success("Launchpad deployed");
      }
    })();
  }, [launchConfirmed, launchHash, publicClient, chainId, factory]);

  const onApprove = async () => {
    if (!tokenAddress || !factory || !tokensNeeded) return;
    if (!isConnected || !address) {
      toast.error("Connect wallet");
      return;
    }
    try {
      await approveAsync({
        abi: erc20Abi,
        address: tokenAddress as `0x${string}`,
        functionName: "approve",
        args: [factory, tokensNeeded],
        chainId,
      });
      toast.success("Approval submitted");
    } catch (error: any) {
      if (error?.name === "UserRejectedRequestError") return;
      toast.error("Failed to approve tokens", { description: error?.message });
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!factory || !isConnected || !address) {
      toast.error("Connect wallet");
      return;
    }
    if (!creationFee) {
      toast.error("Creation fee unavailable");
      return;
    }
    if (!tokenDecimals || parsedSaleAmount == null || tokensNeeded == null) {
      toast.error("Token details missing");
      return;
    }

    const saleAmountUnits = parsedSaleAmount;
    const softCapUnits = parseAmount(
      values.softCap.replace(",", "."),
      currencyMeta.decimals,
    );
    const hardCapUnits = values.hardCap
      ? parseAmount(values.hardCap.replace(",", "."), currencyMeta.decimals)
      : 0n;
    const maxContributionUnits = values.maxContribution
      ? parseAmount(
          values.maxContribution.replace(",", "."),
          currencyMeta.decimals,
        )
      : 0n;
    const lockDuration = parseLockDuration(values.lockDuration);
    const whitelistRoot =
      values.whitelistEnabled && values.whitelistRoot
        ? (values.whitelistRoot as `0x${string}`)
        : (ZERO_BYTES32 as `0x${string}`);

    try {
      writeContract({
        abi: abis.forgeFairLaunchFactory,
        address: factory,
        functionName: "createLaunch",
        args: [
          {
            token: values.tokenAddress as `0x${string}`,
            currency:
              FairLaunchCurrencyId[values.currency as FairLaunchCurrencyCode],
            tokensForSale: saleAmountUnits,
            softCap: softCapUnits,
            hardCap: hardCapUnits,
            maxContribution: maxContributionUnits,
            startTime: BigInt(toUnix(values.startTime)),
            endTime: BigInt(toUnix(values.endTime)),
            liquidityPercent: values.liquidityPercent,
            autoListing: values.autoListing,
            routerKind:
              FairLaunchRouterKindId[
                values.routerKind as FairLaunchRouterKindCode
              ],
            v3Fee: Number(values.v3FeeTier),
            lockDuration,
            whitelistRoot,
            whitelistEnabled: values.whitelistEnabled,
            metadataURI: buildMetadata(values),
          },
        ],
        value: creationFee,
        chainId,
      });
      toast.info("Creating launchpad...");
    } catch (error: any) {
      if (error?.name === "UserRejectedRequestError") return;
      toast.error("Failed to create launch", { description: error?.message });
    }
  });

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="tokenAddress" className="text-sm font-medium">
                Token address
              </Label>
              <Input
                id="tokenAddress"
                placeholder="0x..."
                {...register("tokenAddress")}
                autoComplete="off"
              />
              {errors.tokenAddress && (
                <p className="text-sm text-destructive">
                  {errors.tokenAddress.message}
                </p>
              )}
              {tokenName && (
                <p className="text-sm text-muted-foreground">
                  Detected token: {tokenName} ({tokenSymbol ?? "?"}) ·{" "}
                  {tokenDecimals ?? "?"} decimals
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Raise currency</Label>
              <p className="text-sm text-muted-foreground">
                ZIL — Raise in native ZIL with simple wallet contributions.
              </p>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                label={`Total selling amount (${tokenSymbol ?? "TOKEN"})`}
                error={errors.saleAmount?.message}
              >
                <Input
                  type="text"
                  placeholder="1000000"
                  {...register("saleAmount")}
                />
              </FormField>
              <FormField
                label={`Soft cap (${currencyMeta.symbol})`}
                error={errors.softCap?.message}
              >
                <Input type="text" placeholder="100" {...register("softCap")} />
              </FormField>
              <FormField
                label="Hard cap (optional)"
                error={errors.hardCap?.message}
              >
                <Input type="text" placeholder="200" {...register("hardCap")} />
              </FormField>
              <FormField
                label="Max per wallet (optional)"
                error={errors.maxContribution?.message}
              >
                <Input
                  type="text"
                  placeholder="5"
                  {...register("maxContribution")}
                />
              </FormField>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Start time" error={errors.startTime?.message}>
                <Input
                  type="datetime-local"
                  step="60"
                  {...register("startTime")}
                />
              </FormField>
              <FormField label="End time" error={errors.endTime?.message}>
                <Input
                  type="datetime-local"
                  step="60"
                  {...register("endTime")}
                />
              </FormField>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                label="Liquidity percentage"
                error={errors.liquidityPercent?.message}
              >
                <Input
                  type="number"
                  min={LIQUIDITY_MIN}
                  max={LIQUIDITY_MAX}
                  {...register("liquidityPercent", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  {LIQUIDITY_MIN}% minimum. Default 80%.
                </p>
              </FormField>
              <FormField
                label="Lock duration"
                error={errors.lockDuration?.message}
              >
                <Select
                  value={lockDurationValue}
                  onValueChange={(value) => setValue("lockDuration", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCK_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <div className="space-y-3 rounded-xl border p-5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={autoListing}
                  onChange={(event) =>
                    setValue("autoListing", event.target.checked)
                  }
                />
                Auto listing on PlunderSwap
              </label>
              {!autoListing && (
                <p className="text-xs text-muted-foreground">
                  Manual mode: you will receive the raised funds and liquidity
                  tokens to add the pool yourself.
                </p>
              )}
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <span className="text-sm font-medium">Router</span>
                <Select
                  value={routerKindValue}
                  onValueChange={(value) =>
                    setValue("routerKind", value as FormValues["routerKind"])
                  }
                  disabled={!autoListing}
                >
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="V2">
                      PlunderSwap V2 (LP tokens)
                    </SelectItem>
                    <SelectItem value="V3">
                      PlunderSwap V3 full-range
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {autoListing && routerKindValue === "V3" && (
                <div className="space-y-3 rounded-xl border p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    PlunderSwap V3 fee tier (full range)
                  </p>
                  <RadioGroup
                    value={v3FeeTier}
                    onValueChange={(value) =>
                      setValue("v3FeeTier", value as FormValues["v3FeeTier"])
                    }
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {[
                      {
                        value: "100",
                        label: "0.01% (100)",
                        hint: "Ultra-low fee for blue-chip pairs.",
                      },
                      {
                        value: "500",
                        label: "0.05% (500)",
                        hint: "Low volatility or deep-liquidity pairs.",
                      },
                      {
                        value: "2500",
                        label: "0.25% (2500)",
                        hint: "Balanced option for most new launches.",
                      },
                      {
                        value: "10000",
                        label: "1% (10000)",
                        hint: "High volatility or thin-liquidity assets.",
                      },
                    ].map((tier) => (
                      <RadioGroupItem key={tier.value} value={tier.value}>
                        <div className="font-medium">{tier.label}</div>
                        <p className="text-xs text-muted-foreground">
                          {tier.hint}
                        </p>
                      </RadioGroupItem>
                    ))}
                  </RadioGroup>
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-xl border p-5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={whitelistEnabled}
                  onChange={(event) =>
                    setValue("whitelistEnabled", event.target.checked)
                  }
                />
                Enable whitelist (Merkle root)
              </label>
              {whitelistEnabled && (
                <FormField
                  label="Merkle root"
                  error={errors.whitelistRoot?.message}
                >
                  <Input placeholder="0x…" {...register("whitelistRoot")} />
                  <p className="text-xs text-muted-foreground">
                    Use a standard keccak256-based Merkle tree (addresses
                    lower-cased).
                  </p>
                </FormField>
              )}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-5">
            <FormField label="Project name" error={errors.projectName?.message}>
              <Input
                placeholder="Torchpad Fair Launch"
                {...register("projectName")}
              />
            </FormField>
            <FormField label="Description" error={errors.description?.message}>
              <Textarea
                rows={5}
                placeholder="Explain the utility, roadmap, or anything contributors should know."
                {...register("description")}
              />
            </FormField>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Website" error={errors.website?.message}>
                <Input placeholder="https://…" {...register("website")} />
              </FormField>
              <FormField label="Twitter" error={errors.twitter?.message}>
                <Input placeholder="https://x.com/…" {...register("twitter")} />
              </FormField>
              <FormField label="Telegram" error={errors.telegram?.message}>
                <Input placeholder="https://t.me/…" {...register("telegram")} />
              </FormField>
              <FormField label="Logo URL" error={errors.logoUrl?.message}>
                <Input placeholder="https://…" {...register("logoUrl")} />
              </FormField>
              <FormField label="Banner URL" error={errors.bannerUrl?.message}>
                <Input placeholder="https://…" {...register("bannerUrl")} />
              </FormField>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-5">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Token
              </p>
              <p className="mt-1 text-sm font-medium">
                {tokenName ?? "—"} ({tokenSymbol ?? "—"}) ·{" "}
                {tokenDecimals ?? "—"} decimals
              </p>
              {tokenAddress && (
                <a
                  href={addressUrl(chainId, tokenAddress as `0x${string}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-muted-foreground hover:underline"
                >
                  View on explorer
                </a>
              )}
            </div>
            <div className="border-t pt-5 mt-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Tokens for sale
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {parsedSaleAmount != null && tokenDecimals != null
                      ? `${formatTokenAmount(parsedSaleAmount, tokenDecimals)} ${tokenSymbol ?? "TOKEN"}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Liquidity lock
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {lockDurationValue === "max"
                      ? "Indefinite"
                      : `${Number(lockDurationValue) / (24 * 60 * 60)} days`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Soft cap
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {softCapValue} {currencyMeta.symbol}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Liquidity %
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {liquidityPercent}%
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t pt-5 mt-5 space-y-2 text-sm">
              <p>
                <span className="font-medium">Tokens required:</span>{" "}
                {tokensNeeded != null && tokenDecimals != null
                  ? `${formatTokenAmount(tokensNeeded, tokenDecimals)} ${tokenSymbol ?? "TOKEN"}`
                  : "—"}
              </p>
              <p className="text-muted-foreground">
                {liquidityTokens != null && tokenDecimals != null
                  ? `${formatTokenAmount(liquidityTokens, tokenDecimals)} allocated to PlunderSwap liquidity (${liquidityPercent}%)`
                  : " "}
              </p>
            </div>
            <div className="border-t pt-5 mt-5 space-y-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Allowance status</p>
                <p className="text-xs text-muted-foreground">
                  Approve the factory to transfer the total tokens required for
                  the sale and liquidity.
                </p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current</span>
                <span
                  className={cn(
                    "font-medium",
                    needsApproval
                      ? "text-destructive"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {needsApproval ? "Needs approval" : "Ready"}
                </span>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-full font-semibold"
                onClick={onApprove}
                disabled={
                  !needsApproval ||
                  !factory ||
                  !tokenAddress ||
                  !tokensNeeded ||
                  !isConnected ||
                  isApproving
                }
              >
                {isApproving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Approving…
                  </>
                ) : (
                  "Approve tokens"
                )}
              </Button>
            </div>
            <div className="border-t pt-5 mt-5 space-y-3">
              <p className="text-sm font-semibold">Checklist</p>
              <div className="space-y-2.5 text-sm">
                <ChecklistItem
                  label="Wallet connected"
                  done={Boolean(isConnected)}
                />
                <ChecklistItem
                  label="Token verified"
                  done={tokenQueryEnabled && Boolean(tokenDecimals)}
                />
                <ChecklistItem
                  label="Form valid"
                  done={isValid}
                  hint={!isValid ? "Fill in all required fields" : undefined}
                />
                <ChecklistItem label="Allowance ready" done={!needsApproval} />
              </div>
            </div>
          </div>
        );
    }
  };

  const stepContent = renderStepContent();

  const canGoNext = step < steps.length - 1;

  const handleNext = async () => {
    const fields = stepFields[step];
    if (fields.length) {
      const valid = await trigger(fields);
      if (!valid) return;
    }
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handlePrev = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const creationFeeDisplay =
    creationFee != null ? `${formatUnits(creationFee, 18)} ZIL` : "—";

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fair launch</h1>
        <p className="mt-1 text-muted-foreground">
          Configure a community-first raise, accept ZIL or USDC, and auto-list
          on PlunderSwap.
        </p>
      </div>

      {!factory && (
        <div className="rounded-2xl border border-destructive bg-card p-6 max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold">Factory address missing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set NEXT_PUBLIC_FAIRLAUNCH_FACTORY_{chainId} to enable this feature.
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-card p-6 max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold">Fair launch builder</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow the steps to verify your token, configure the sale, and deploy
          the pool.
        </p>

        <div className="border-t pt-5 mt-5">
          <StepIndicator current={step} />
        </div>

        <div className="border-t pt-5 mt-5">{stepContent}</div>

        <div className="border-t pt-5 mt-5 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Creation fee:{" "}
            <span className="font-medium text-foreground">
              {creationFeeDisplay}
            </span>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={handlePrev}
              disabled={step === 0}
            >
              Back
            </Button>
            {canGoNext ? (
              <Button
                className="rounded-full font-semibold"
                onClick={handleNext}
              >
                Next
              </Button>
            ) : (
              <Button
                className="rounded-full font-semibold"
                onClick={onSubmit}
                disabled={
                  !isValid ||
                  !factory ||
                  isLaunching ||
                  isConfirming ||
                  needsApproval ||
                  !tokensNeeded
                }
              >
                {isLaunching || isConfirming ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Deploying…
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 size-4" />
                    Create launch
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {createdLaunch && (
        <div className="rounded-2xl bg-card p-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Check className="size-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold">Launchpad deployed</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your pool is live on-chain.
          </p>

          <div className="border-t pt-5 mt-5 space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Pool
              </p>
              <a
                href={addressUrl(chainId, createdLaunch.pool)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-muted-foreground hover:underline font-mono"
              >
                {createdLaunch.pool}
              </a>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Transaction
              </p>
              <a
                href={txUrl(chainId, createdLaunch.txHash)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-muted-foreground hover:underline font-mono"
              >
                {createdLaunch.txHash}
              </a>
            </div>
          </div>

          <div className="border-t pt-5 mt-5">
            <Button
              variant="outline"
              className="w-full rounded-full font-semibold"
              onClick={() => {
                reset();
                setStep(0);
                setCreatedLaunch(null);
              }}
            >
              Create another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-start">
      {steps.map((item, index) => (
        <div key={item.title} className="flex flex-1 flex-col items-center">
          <div className="flex w-full items-center">
            <div
              className={cn(
                "h-0.5 flex-1",
                index === 0
                  ? "bg-transparent"
                  : index <= current
                    ? "bg-foreground"
                    : "bg-muted",
              )}
            />
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                index === current
                  ? "bg-foreground text-background"
                  : index < current
                    ? "bg-foreground text-background"
                    : "border border-muted-foreground text-muted-foreground",
              )}
            >
              {index < current ? <Check className="size-4" /> : index + 1}
            </div>
            <div
              className={cn(
                "h-0.5 flex-1",
                index === steps.length - 1
                  ? "bg-transparent"
                  : index < current
                    ? "bg-foreground"
                    : "bg-muted",
              )}
            />
          </div>
          <p className="mt-2 text-center text-xs font-medium">{item.title}</p>
        </div>
      ))}
    </div>
  );
}

function ChecklistItem({
  label,
  done,
  hint,
}: {
  label: string;
  done: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs",
          done
            ? "bg-emerald-500/15 text-emerald-500"
            : "border border-muted-foreground/30 text-muted-foreground",
        )}
      >
        {done && <Check className="size-3" />}
      </span>
      <div>
        <p className={cn("text-sm font-medium", done && "text-foreground")}>
          {label}
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
