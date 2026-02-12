"use client";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { NetworkSelector } from "@/components/network-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Topbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  return (
    <header className="h-14 sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <a href="/" className="flex items-center gap-2 select-none sm:hidden">
          <img
            src="/logo.png"
            alt="Torchpad"
            className="h-8 brightness-0 dark:brightness-100"
            height={32}
          />
        </a>
        <SidebarTrigger className="size-8 rounded-md" />
        <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
          Beta
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <NetworkSelector />
        <ConnectWalletButton />
      </div>
    </header>
  );
}
