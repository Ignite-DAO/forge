"use client";

import { Globe, Loader2, Rocket, Send, Upload, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useNetwork } from "@/providers/network";
import { PageHeader } from "@/components/page-header";
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
import { Textarea } from "@/components/ui/textarea";
import { abis, getBondingCurveFactoryAddress } from "@/lib/contracts";

export default function BondingCurveLaunchPage() {
  const { chainId } = useNetwork();
  const factory = getBondingCurveFactoryAddress(chainId);
  const publicClient = usePublicClient({ chainId });
  const { address, isConnected } = useAccount();

  const { refetch: refetchPoolCount } = useReadContract({
    abi: abis.forgeBondingCurveFactory,
    address: factory ?? undefined,
    functionName: "poolCount",
    chainId,
    query: { enabled: Boolean(factory) },
  });

  const { data: creationFeeData } = useReadContract({
    abi: abis.forgeBondingCurveFactory,
    address: factory ?? undefined,
    functionName: "creationFee",
    chainId,
    query: { enabled: Boolean(factory) },
  });

  // Create form state
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [createTx, setCreateTx] = useState<`0x${string}` | null>(null);
  const [createdPool, setCreatedPool] = useState<`0x${string}` | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { writeContractAsync, isPending: isCreating } = useWriteContract();
  const { isLoading: isCreateConfirming, isSuccess: isCreateSuccess } =
    useWaitForTransactionReceipt({
      hash: createTx ?? undefined,
    });

  // Image handling
  const handleImageSelect = useCallback((file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image too large", { description: "Max file size is 2MB" });
      return;
    }
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/svg+xml",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid format", {
        description: "Use PNG, JPG, GIF, SVG, or WebP",
      });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleImageSelect(file);
    },
    [handleImageSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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
      setIsUploading(true);

      // First, create the pool to get the address
      const tx = await writeContractAsync({
        abi: abis.forgeBondingCurveFactory,
        address: factory,
        functionName: "createPool",
        args: [
          {
            name: name.trim(),
            symbol: symbol.trim().toUpperCase(),
            metadataURI: "",
          },
        ],
        value: creationFeeData ?? 0n,
        chainId,
      });
      setCreateTx(tx);
      toast.info("Transaction submitted");
    } catch (err: any) {
      if (err?.name === "UserRejectedRequestError") return;
      toast.error("Failed to create", { description: err?.message });
    } finally {
      setIsUploading(false);
    }
  };

  // Handle successful creation - upload metadata after
  useEffect(() => {
    if (isCreateSuccess && createTx && publicClient) {
      const client = publicClient as NonNullable<typeof publicClient>;
      client.getTransactionReceipt({ hash: createTx }).then(async (receipt) => {
        const poolCreatedLog = receipt.logs.find((log) => {
          try {
            return (
              log.topics[0] ===
                "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0" ||
              log.topics.length === 4
            );
          } catch {
            return false;
          }
        });

        let poolAddress: `0x${string}` | null = null;
        if (poolCreatedLog && poolCreatedLog.topics[1]) {
          poolAddress =
            `0x${poolCreatedLog.topics[1].slice(26)}` as `0x${string}`;
          setCreatedPool(poolAddress);
        }

        // Upload metadata if we have any
        if (
          poolAddress &&
          (imageFile || description || website || twitter || telegram)
        ) {
          try {
            const formData = new FormData();
            formData.append("poolAddress", poolAddress);
            formData.append("chainId", String(chainId));
            formData.append("launchType", "bonding_curve");
            formData.append("name", name.trim());
            formData.append("symbol", symbol.trim().toUpperCase());
            if (description) formData.append("description", description);
            if (website) formData.append("website", website);
            if (twitter) formData.append("twitter", twitter);
            if (telegram) formData.append("telegram", telegram);
            if (imageFile) formData.append("image", imageFile);

            await fetch("/api/launches/metadata", {
              method: "POST",
              body: formData,
            });
          } catch {
            // Metadata upload failed but pool was created
          }
        }

        void refetchPoolCount();
        // Reset form
        setName("");
        setSymbol("");
        setDescription("");
        setWebsite("");
        setTwitter("");
        setTelegram("");
        clearImage();
        setCreateTx(null);
      });
    }
  }, [
    isCreateSuccess,
    createTx,
    publicClient,
    refetchPoolCount,
    chainId,
    name,
    symbol,
    description,
    website,
    twitter,
    telegram,
    imageFile,
    clearImage,
  ]);

  const creationFee = creationFeeData ? formatUnits(creationFeeData, 18) : "0";
  const isSubmitting = isUploading || isCreating || isCreateConfirming;

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
              Set `NEXT_PUBLIC_BONDING_CURVE_FACTORY_{chainId}` to enable
              bonding curve pools.
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
            Create a new token with an instant bonding curve. Graduates to
            Uniswap V3 at target market cap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {createdPool ? (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Token created successfully!
              </p>
              <Button asChild>
                <Link href={`/discover/${createdPool}`}>
                  View your token
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatedPool(null)}
              >
                Create another
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Token image (optional)</Label>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      handleImageSelect(e.target.files[0])
                    }
                  />
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="size-[120px] rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearImage();
                        }}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="size-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Drag & drop or click to upload
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, GIF, SVG, WebP (max 2MB)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Awesome Token"
                  maxLength={64}
                />
              </div>

              {/* Symbol */}
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="AWESOME"
                  maxLength={12}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's your token about?"
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <Label className="text-muted-foreground">
                  Links (optional)
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Globe className="size-4 text-muted-foreground shrink-0" />
                    <Input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <svg
                      className="size-4 text-muted-foreground shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <Input
                      value={twitter}
                      onChange={(e) => setTwitter(e.target.value)}
                      placeholder="@handle"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Send className="size-4 text-muted-foreground shrink-0" />
                    <Input
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="t.me/yourchannel"
                    />
                  </div>
                </div>
              </div>

              {Number(creationFee) > 0 && (
                <p className="text-sm text-muted-foreground">
                  Creation fee: {creationFee} ZIL
                </p>
              )}

              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !name.trim() || !symbol.trim()}
                className="w-full"
                size="lg"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {isUploading
                  ? "Uploading..."
                  : isCreating
                    ? "Confirm in wallet..."
                    : isCreateConfirming
                      ? "Creating..."
                      : "Launch token"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
