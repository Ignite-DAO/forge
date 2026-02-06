"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { zilliqa, zilliqaTestnet } from "@/lib/chains";

const SUPPORTED_CHAIN_IDS: Set<number> = new Set([zilliqa.id, zilliqaTestnet.id]);

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
  const [preferredChainId, setPreferredChainId] =
    useState<number>(DEFAULT_CHAIN_ID);
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (SUPPORTED_CHAIN_IDS.has(parsed)) {
        setPreferredChainId(parsed);
      }
    }
  }, []);

  const chainId = useMemo(() => {
    if (chain && SUPPORTED_CHAIN_IDS.has(chain.id)) {
      return chain.id;
    }
    return preferredChainId;
  }, [chain, preferredChainId]);

  const setChainId = useCallback(
    (newChainId: number) => {
      if (!SUPPORTED_CHAIN_IDS.has(newChainId)) {
        return;
      }
      localStorage.setItem(STORAGE_KEY, String(newChainId));
      if (chain) {
        switchChain?.({ chainId: newChainId });
      } else {
        setPreferredChainId(newChainId);
      }
    },
    [chain, switchChain],
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
