"use client";

import { Compass, Gift, Home, Rocket, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarResizeHandle } from "@/components/sidebar-resize-handle";
import {
  SidebarContent,
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

function SidebarButtons() {
  const pathname = usePathname();

  const renderItems = (items: typeof generalItems | typeof toolItems) =>
    items.map((item) => {
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
    </>
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
