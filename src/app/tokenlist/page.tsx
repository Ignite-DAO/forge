"use client";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSupply, useTokenCreations } from "@/hooks/use-token-creations";
import { addressUrl, txUrl } from "@/lib/explorer";
import { useNetwork } from "@/providers/network";

export default function TokenListPage() {
  const { chainId } = useNetwork();
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
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Token List</h1>
        <p className="mt-1 text-muted-foreground">
          Tokens created via the factory on the active chain.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl font-bold">
                Deployed tokens
              </CardTitle>
              {!isLoading && (
                <Badge variant="secondary">{filtered.length} found</Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Search and filter tokens created through the Torchpad factory.
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search by name, symbol, creator, or address"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
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
                          className="text-primary hover:text-primary/80 transition-colors font-mono"
                        >
                          {t.token.slice(0, 6)}...{t.token.slice(-4)}
                        </a>
                      </TableCell>
                      <TableCell>
                        <a
                          href={addressUrl(chainId, t.creator)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors font-mono"
                        >
                          {t.creator.slice(0, 6)}...{t.creator.slice(-4)}
                        </a>
                      </TableCell>
                      <TableCell>
                        <a
                          href={txUrl(chainId, t.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          {t.txHash.slice(0, 6)}...
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
        </CardContent>
      </Card>
    </div>
  );
}
