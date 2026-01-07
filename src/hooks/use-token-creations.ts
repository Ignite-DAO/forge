"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { usePublicClient } from "wagmi";
import { useNetwork } from "@/providers/network";
import { abis, getFactoryAddress } from "@/lib/contracts";

type TokenCreated = {
  token: `0x${string}`;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  supply: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
};

export function useTokenCreations(fromBlock?: bigint) {
  const { chainId } = useNetwork();
  const client = usePublicClient({ chainId });
  const address = getFactoryAddress(chainId);

  return useQuery({
    queryKey: ["token-creations", chainId, address, fromBlock?.toString()],
    enabled: Boolean(client && address),
    queryFn: async (): Promise<TokenCreated[]> => {
      if (!client || !address) return [];
      const logs = await client.getLogs({
        address,
        event: {
          type: "event",
          name: "TokenCreated",
          inputs: [
            { name: "token", type: "address", indexed: false },
            { name: "creator", type: "address", indexed: true },
            { name: "name", type: "string", indexed: false },
            { name: "symbol", type: "string", indexed: false },
            { name: "decimals", type: "uint8", indexed: false },
            { name: "supply", type: "uint256", indexed: false },
          ],
        } as any,
        fromBlock: fromBlock ?? BigInt(0),
        toBlock: "latest",
      });

      return logs.map((l) => {
        const args = (l as any).args as {
          token: `0x${string}`;
          creator: `0x${string}`;
          name: string;
          symbol: string;
          decimals: number;
          supply: bigint;
        };
        return {
          token: args.token,
          creator: args.creator,
          name: args.name,
          symbol: args.symbol,
          decimals: Number(args.decimals),
          supply: BigInt(args.supply),
          txHash: (l as any).transactionHash!,
          blockNumber: (l as any).blockNumber!,
        } satisfies TokenCreated;
      });
    },
  });
}

export function formatSupply(supply: bigint, decimals: number) {
  try {
    return formatUnits(supply, decimals);
  } catch {
    return supply.toString();
  }
}
