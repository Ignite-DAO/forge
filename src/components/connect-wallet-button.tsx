"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertTriangle, ChevronDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              } as React.CSSProperties,
            })}
          >
            {!connected ? (
              <Button size="sm" onClick={openConnectModal}>
                <Wallet className="size-4" />
                Connect Wallet
              </Button>
            ) : chain?.unsupported ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={openChainModal}
                title="Wrong network – click to switch"
              >
                <AlertTriangle className="size-4" />
                Switch Network
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={openAccountModal}
                className="max-w-[200px] truncate"
                title={account?.displayName}
              >
                <Wallet className="size-4" />
                <span className="truncate">{account?.displayName}</span>
                <ChevronDown className="size-4 opacity-60" />
              </Button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
