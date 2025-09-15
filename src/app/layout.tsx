import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/app-shell";
import "@rainbow-me/rainbowkit/styles.css";
import { Web3Providers } from "@/providers/web3";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Forge",
  description: "Forge ERC-20 tokens and airdrop on Zilliqa EVM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Web3Providers>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <AppShell>{children}</AppShell>
            <Toaster position="top-right" richColors />
          </ThemeProvider>
        </Web3Providers>
      </body>
    </html>
  );
}
