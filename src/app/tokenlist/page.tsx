"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTokenCreations, formatSupply } from "@/hooks/use-token-creations";
import { useChainId } from "wagmi";
import { addressUrl, txUrl } from "@/lib/explorer";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

export default function TokenListPage() {
  const chainId = useChainId();
  const { data, isLoading, refetch } = useTokenCreations();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!data) return [];
    const v = q.trim().toLowerCase();
    if (!v) return data;
    return data.filter(
      (t) =>
        t.name.toLowerCase().includes(v) ||
        t.symbol.toLowerCase().includes(v) ||
        t.token.toLowerCase().includes(v) ||
        t.creator.toLowerCase().includes(v),
    );
  }, [data, q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Token List"
        description="Tokens created via the factory on the active chain."
      />
      <Card>
        <CardHeader>
          <CardTitle>Deployed tokens</CardTitle>
          <CardDescription>
            Search and filter tokens created through the Forge factory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Input
              placeholder="Search by name, symbol, creator, or address"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered && filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Decimals</TableHead>
                    <TableHead>Supply</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={`${t.txHash}-${t.token}`}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.symbol}</TableCell>
                      <TableCell>{t.decimals}</TableCell>
                      <TableCell>
                        {formatSupply(t.supply, t.decimals)}
                      </TableCell>
                      <TableCell>
                        <a
                          href={addressUrl(chainId, t.token)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {t.token.slice(0, 6)}…{t.token.slice(-4)}
                        </a>
                      </TableCell>
                      <TableCell>
                        <a
                          href={addressUrl(chainId, t.creator)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {t.creator.slice(0, 6)}…{t.creator.slice(-4)}
                        </a>
                      </TableCell>
                      <TableCell>
                        <a
                          href={txUrl(chainId, t.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {t.txHash.slice(0, 6)}…
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tokens found.</p>
          )}
          <div className="mt-4">
            <button
              onClick={() => refetch()}
              className="h-8 px-3 rounded-md border border-black/[.08] dark:border-white/[.145] text-xs hover:bg-black/[.04] dark:hover:bg-white/[.06]"
            >
              Refresh
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
