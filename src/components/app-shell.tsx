"use client";

import Link from "next/link";
import { SidebarLayout } from "@/components/nav-sidebar";
import { Topbar } from "@/components/topbar";
import { SidebarInset } from "@/components/ui/sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarLayout>
      <SidebarInset className="isolate min-w-0 overflow-x-hidden">
        <Topbar />
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-9 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>
        <footer className="border-t border-border py-4 px-4 sm:px-6">
          <div className="mx-auto w-full max-w-6xl flex items-center flex-wrap justify-between gap-4 text-xs text-muted-foreground">
            <span>© 2026 Torchpad · A little spark goes a long way.</span>
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
