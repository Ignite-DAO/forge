export const forgeAirdropperAbi = [
  {
    type: "function",
    name: "airdrop",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "Airdropped",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "count", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
