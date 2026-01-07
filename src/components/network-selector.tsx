"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zilliqa, zilliqaTestnet } from "@/lib/chains";
import { useNetwork } from "@/providers/network";

const networks = [
  { id: zilliqa.id, name: "Mainnet", color: "bg-emerald-500" },
  { id: zilliqaTestnet.id, name: "Testnet", color: "bg-amber-500" },
] as const;

export function NetworkSelector() {
  const { chainId, setChainId } = useNetwork();

  return (
    <Select
      value={String(chainId)}
      onValueChange={(value) => setChainId(Number(value))}
    >
      <SelectTrigger className="h-9 w-[120px] text-sm">
        <SelectValue>
          {(() => {
            const current = networks.find((n) => n.id === chainId);
            return current ? (
              <span className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${current.color}`} />
                {current.name}
              </span>
            ) : (
              "Select network"
            );
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {networks.map((network) => (
          <SelectItem key={network.id} value={String(network.id)}>
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${network.color}`} />
              {network.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
