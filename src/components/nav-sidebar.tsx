"use client";

import { Compass, Gift, Headset, HelpCircle, Home, Rocket, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarResizeHandle } from "@/components/sidebar-resize-handle";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  Sidebar as UiSidebar,
  useSidebar,
} from "@/components/ui/sidebar";

const generalItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/bonding-curve", label: "Launch", icon: Rocket },
] as const;

const toolItems = [
  { href: "/create-token", label: "Create Token", icon: Sparkles },
  { href: "/airdrop", label: "Airdrop", icon: Gift },
  { href: "/fair-launch", label: "Fair Launch", icon: Compass },
] as const;

const resourceItems = [
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  { href: "https://t.me/TorchHelpdesk", label: "Helpdesk", icon: Headset, external: true },
] as const;

function TorchWalletBanner() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  if (isCollapsed) {
    return (
      <a
        href="https://torchwallet.io"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center p-2"
        title="Torch Wallet"
      >
        <Image
          src="https://torchwallet.io/images/logo.png"
          alt="Torch Wallet"
          width={20}
          height={20}
          className="rounded"
        />
      </a>
    );
  }

  return (
    <a
      href="https://torchwallet.io"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-amber-500/10 p-3 transition-colors hover:from-orange-500/20 hover:to-amber-500/20"
    >
      <Image
        src="https://torchwallet.io/images/logo.png"
        alt="Torch Wallet"
        width={24}
        height={24}
        className="rounded"
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium">Torch Wallet</span>
        <span className="text-xs text-muted-foreground">
          Zilliqa's most advanced wallet
        </span>
      </div>
    </a>
  );
}

function SidebarLogo() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Link href="/" className="flex items-center gap-2 select-none">
      {isCollapsed ? (
        <Image
          src="/logo.png"
          alt="Torchpad"
          className="h-7 w-7 shrink-0 object-contain brightness-0 dark:brightness-100"
          height={28}
          width={28}
          priority
        />
      ) : (
        <Image
          src="/logo-with-text.png"
          alt="Torchpad"
          className="h-7 w-auto brightness-0 dark:brightness-100"
          height={28}
          width={168}
          priority
        />
      )}
    </Link>
  );
}

function SidebarButtons() {
  const pathname = usePathname();

  const renderItems = (items: typeof generalItems | typeof toolItems | typeof resourceItems) =>
    items.map((item) => {
      const Icon = item.icon;
      const isExternal = "external" in item && item.external;
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton asChild isActive={pathname === item.href}>
            {isExternal ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                <Icon className="size-4" />
                <span>{item.label}</span>
              </a>
            ) : (
              <Link href={item.href}>
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>{renderItems(generalItems)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Tools</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>{renderItems(toolItems)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Resources</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>{renderItems(resourceItems)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="w-full overflow-x-hidden">
      <UiSidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="h-10 flex items-center px-2">
            <SidebarLogo />
          </div>
        </SidebarHeader>
        <SidebarContent className="no-scrollbar">
          <SidebarButtons />
          <SidebarSeparator />
        </SidebarContent>
        <SidebarFooter className="p-2">
          <TorchWalletBanner />
        </SidebarFooter>
        <SidebarRail />
      </UiSidebar>
      <SidebarResizeHandle />
      {children}
    </SidebarProvider>
  );
}
