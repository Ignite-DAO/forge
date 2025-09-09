"use client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

export function Topbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  return (
    <header className="h-14 sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <span className="sm:hidden">
          <SidebarTrigger />
        </span>
        <span className="text-sm text-foreground/80">Forge</span>
      </div>
      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <ConnectWalletButton />
      </div>
    </header>
  );
}
