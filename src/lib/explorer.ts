export function txUrl(chainId: number, txHash: `0x${string}`) {
  const base =
    chainId === 33101
      ? "https://otterscan.testnet.zilliqa.com"
      : "https://otterscan.zilliqa.com";
  return `${base}/tx/${txHash}`;
}

export function addressUrl(chainId: number, address: `0x${string}`) {
  const base =
    chainId === 33101
      ? "https://otterscan.testnet.zilliqa.com"
      : "https://otterscan.zilliqa.com";
  return `${base}/address/${address}`;
}
