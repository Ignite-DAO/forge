"use client";

import Link from "next/link";
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
        <footer className="border-t border-border py-4 px-4 sm:px-6">
          <div className="mx-auto w-full max-w-6xl flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>© 2026 Torchpad</span>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </footer>
      </SidebarInset>
    </SidebarLayout>
  );
}
