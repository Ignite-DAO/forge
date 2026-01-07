"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSwitchChain } from "wagmi";
import { zilliqa, zilliqaTestnet } from "@/lib/chains";

type NetworkContextValue = {
  chainId: number;
  isTestnet: boolean;
  setChainId: (chainId: number) => void;
  switchToMainnet: () => void;
  switchToTestnet: () => void;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

const STORAGE_KEY = "forge-selected-chain";
const DEFAULT_CHAIN_ID = zilliqa.id;

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainIdState] = useState<number>(DEFAULT_CHAIN_ID);
  const { switchChain } = useSwitchChain();

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (parsed === zilliqa.id || parsed === zilliqaTestnet.id) {
        setChainIdState(parsed);
      }
    }
  }, []);

  const setChainId = useCallback(
    (newChainId: number) => {
      if (newChainId !== zilliqa.id && newChainId !== zilliqaTestnet.id) {
        return;
      }
      setChainIdState(newChainId);
      localStorage.setItem(STORAGE_KEY, String(newChainId));
      // Also request wallet to switch chain
      switchChain?.({ chainId: newChainId });
    },
    [switchChain],
  );

  const switchToMainnet = useCallback(() => {
    setChainId(zilliqa.id);
  }, [setChainId]);

  const switchToTestnet = useCallback(() => {
    setChainId(zilliqaTestnet.id);
  }, [setChainId]);

  const isTestnet = chainId === zilliqaTestnet.id;

  return (
    <NetworkContext.Provider
      value={{
        chainId,
        isTestnet,
        setChainId,
        switchToMainnet,
        switchToTestnet,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider");
  }
  return context;
}
