"use client";

import { SidebarLayout } from "@/components/nav-sidebar";
import { Topbar } from "@/components/topbar";
import { SidebarInset } from "@/components/ui/sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarLayout>
      <SidebarInset className="overflow-x-hidden">
        <Topbar />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </SidebarInset>
    </SidebarLayout>
  );
}
