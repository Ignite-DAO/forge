"use client";

import {
  Compass,
  Gift,
  Headset,
  HelpCircle,
  Home,
  Rocket,
  Sparkles,
} from "lucide-react";
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
  Sidebar as UiSidebar,
  useSidebar,
} from "@/components/ui/sidebar";

const generalItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/bonding-curve", label: "Launch", icon: Rocket },
] as const;

const toolItems = [
  { href: "/create-token", label: "Create Token", icon: Sparkles },
  { href: "/airdrop", label: "Airdrop", icon: Gift },
  { href: "/fair-launch", label: "Fair Launch", icon: Compass },
] as const;

const resourceItems = [
  { href: "/faq", label: "FAQ", icon: HelpCircle },
  {
    href: "https://t.me/TorchHelpdesk",
    label: "Helpdesk",
    icon: Headset,
    external: true,
  },
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
        className="flex items-center justify-center rounded-lg p-2.5 transition-colors hover:bg-sidebar-accent/50"
        title="Torch Wallet"
      >
        <Image
          src="https://torchwallet.io/images/logo.png"
          alt="Torch Wallet"
          width={22}
          height={22}
          className="rounded"
        />
      </a>
    );
  }

  return (
    <div className="rounded-xl border p-3.5">
      <div className="flex items-center gap-3.5">
        <Image
          src="https://torchwallet.io/images/logo.png"
          alt="Torch Wallet"
          width={26}
          height={26}
          className="rounded"
        />
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold">Torch Wallet</span>
          <span className="text-xs text-muted-foreground">
            Bonded tokens are tradable instantly.
          </span>
        </div>
      </div>
      <a
        href="https://torchwallet.io"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center rounded-full bg-foreground py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
      >
        Start now
      </a>
    </div>
  );
}

function SidebarLogo() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Link href="/" className="flex items-center gap-2.5 select-none">
      <Image
        src="/logo.png"
        alt="Torchpad"
        className="h-8 w-8 shrink-0 object-contain"
        height={32}
        width={32}
        priority
      />
      {!isCollapsed && (
        <span className="text-lg font-bold tracking-tight">Torchpad</span>
      )}
    </Link>
  );
}

function SidebarButtons() {
  const pathname = usePathname();

  const renderItems = (
    items: typeof generalItems | typeof toolItems | typeof resourceItems,
  ) =>
    items.map((item) => {
      const Icon = item.icon;
      const isExternal = "external" in item && item.external;
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href}
            className="h-10 gap-2.5 rounded-xl px-3 text-[15px] font-medium transition-colors group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-2.5!"
          >
            {isExternal ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer">
                <Icon className="size-[1.05rem] shrink-0" />
                <span>{item.label}</span>
              </a>
            ) : (
              <Link href={item.href}>
                <Icon className="size-[1.05rem] shrink-0" />
                <span>{item.label}</span>
              </Link>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <>
      <SidebarGroup className="p-2.5">
        <SidebarGroupContent>
          <SidebarMenu className="gap-1.5">
            {renderItems(generalItems)}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="p-2.5 pt-2">
        <SidebarGroupLabel className="px-3 text-[11px] font-semibold tracking-[0.08em] text-sidebar-foreground/60">
          Tools
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1.5">
            {renderItems(toolItems)}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="p-2.5 pt-2">
        <SidebarGroupLabel className="px-3 text-[11px] font-semibold tracking-[0.08em] text-sidebar-foreground/60">
          Resources
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1.5">
            {renderItems(resourceItems)}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="w-full overflow-x-hidden">
      <UiSidebar variant="inset" collapsible="icon">
        <SidebarHeader className="p-2.5 pb-1">
          <div className="flex h-12 items-center rounded-xl pr-3">
            <SidebarLogo />
          </div>
        </SidebarHeader>
        <SidebarContent className="no-scrollbar">
          <SidebarButtons />
        </SidebarContent>
        <SidebarFooter className="p-2.5 pt-1.5">
          <TorchWalletBanner />
        </SidebarFooter>
        <SidebarRail />
      </UiSidebar>
      <SidebarResizeHandle />
      {children}
    </SidebarProvider>
  );
}
