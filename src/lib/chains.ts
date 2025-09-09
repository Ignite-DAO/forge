import { defineChain } from "viem";

export const zilliqa = defineChain({
  id: 32769,
  name: "Zilliqa",
  nativeCurrency: { name: "ZIL", symbol: "ZIL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.zilliqa.com"] },
  },
  blockExplorers: {
    default: {
      name: "Otterscan",
      url: "https://otterscan.zilliqa.com",
    },
  },
});

export const zilliqaTestnet = defineChain({
  id: 33101,
  name: "Zilliqa Testnet",
  nativeCurrency: { name: "ZIL", symbol: "ZIL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.testnet.zilliqa.com"] },
  },
  blockExplorers: {
    default: {
      name: "Otterscan",
      url: "https://otterscan.testnet.zilliqa.com",
    },
  },
});

export const chains = [zilliqa, zilliqaTestnet] as const;
