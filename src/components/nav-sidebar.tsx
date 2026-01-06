"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarRail,
} from "@/components/ui/sidebar";
import { SidebarResizeHandle } from "@/components/sidebar-resize-handle";
import { Compass, Gift, Home, Rocket, Sparkles } from "lucide-react";

const items = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/create-token", label: "Create Token", icon: Sparkles },
  { href: "/airdrop", label: "Airdrop", icon: Gift },
  { href: "/bonding-curve", label: "Launch", icon: Rocket },
  { href: "/fair-launch", label: "Launch Builder", icon: Compass },
  { href: "/discover", label: "Launches", icon: Sparkles },
] as const;

function SidebarButtons() {
  const pathname = usePathname();
  // We could use useSidebar() to conditionally wrap in Tooltip when collapsed,
  // but rendering the buttons is sufficient and avoids context issues.
  return (
    <SidebarMenu>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={pathname === item.href}>
              <Link href={item.href}>
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider className="w-full overflow-x-hidden">
      <UiSidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <div className="h-10 flex items-center px-2">
            <Link href="/" className="flex items-center gap-2 select-none">
              <Image
                src="/forge_logo_text.svg"
                alt="Forge"
                className="h-4 brightness-0 dark:brightness-100"
                height={16}
                width={96}
                priority
              />
            </Link>
          </div>
        </SidebarHeader>
        <SidebarContent className="no-scrollbar">
          <SidebarButtons />
          <SidebarSeparator />
        </SidebarContent>
        <SidebarRail />
      </UiSidebar>
      <SidebarResizeHandle />
      {children}
    </SidebarProvider>
  );
}
