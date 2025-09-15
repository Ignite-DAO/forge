export const forgeAirdropperAbi = [
  { type: "function", name: "fee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "treasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "setFee", stateMutability: "nonpayable", inputs: [{ name: "newFee", type: "uint256" }], outputs: [] },
  { type: "function", name: "setTreasury", stateMutability: "nonpayable", inputs: [{ name: "newTreasury", type: "address" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "airdrop",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "airdropEqual",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amountEach", type: "uint256" },
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
      { name: "total", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  { type: "event", name: "FeeUpdated", inputs: [{ name: "oldFee", type: "uint256", indexed: false }, { name: "newFee", type: "uint256", indexed: false }], anonymous: false },
  { type: "event", name: "TreasuryUpdated", inputs: [{ name: "oldTreasury", type: "address", indexed: true }, { name: "newTreasury", type: "address", indexed: true }], anonymous: false },
] as const;
