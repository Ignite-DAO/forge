"use client";
import Image from "next/image";
import Link from "next/link";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { NetworkSelector } from "@/components/network-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex min-h-18 flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur sm:px-7 lg:px-9">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="size-9 rounded-full" />
        <Link href="/" aria-label="Torchpad homepage" className="sm:hidden">
          <Image src="/logo.png" alt="" width={26} height={26} />
        </Link>
        <span className="hidden text-sm text-muted-foreground sm:inline">
          A place to start something.
        </span>
        <span className="hidden rounded-full bg-orange-500/15 sm:inline-block px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
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
