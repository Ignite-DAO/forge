"use client";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { NetworkSelector } from "@/components/network-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Topbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  return (
    <header className="h-14 sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <span className="sm:hidden">
          <SidebarTrigger />
        </span>
        <a href="/" className="flex items-center gap-2 select-none sm:hidden">
          <img
            src="/forge_logo.svg"
            alt="Forge"
            className="h-6 w-6 brightness-0 dark:brightness-100"
            height={24}
            width={24}
          />
        </a>
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <NetworkSelector />
        <ConnectWalletButton />
      </div>
    </header>
  );
}
