"use client";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useMemo } from "react";
import { http, WagmiProvider } from "wagmi";
import { chains, zilliqa, zilliqaTestnet } from "@/lib/chains";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "SET_ME_PROJECT_ID";

const wagmiConfig = getDefaultConfig({
  appName: "Forge",
  projectId,
  chains,
  transports: {
    [zilliqa.id]: http(),
    [zilliqaTestnet.id]: http(),
  },
  ssr: true,
});

export function Web3Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider initialChain={zilliqa}>
          {children}
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
