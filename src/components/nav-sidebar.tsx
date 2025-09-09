"use client";

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
import { Home, Coins, Gift, List } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const items = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/create-token", label: "Create Token", icon: Coins },
  { href: "/airdrop", label: "Airdrop", icon: Gift },
  { href: "/tokenlist", label: "Token List", icon: List },
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
            <span className="text-sm font-semibold tracking-tight select-none">
              Forge
            </span>
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
