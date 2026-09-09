"use client";

import { ArrowDown, ArrowUpRight, Shuffle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const moods = ["sunshine", "lilac", "mint"] as const;

export function LaunchStudio() {
  const [moodIndex, setMoodIndex] = useState(0);

  return (
    <section className="launch-studio relative isolate overflow-hidden rounded-[2rem]">
      <div className="relative z-10 grid items-center gap-6 px-6 pb-7 pt-8 sm:px-10 sm:pt-12 xl:grid-cols-2 xl:px-12">
        <div className="studio-copy">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide">
            <span className="size-2 rounded-full bg-primary" />A home for
            Zilliqa creators
          </p>
          <h1 className="mt-6 max-w-[12ch] text-balance text-5xl font-semibold tracking-tight sm:text-7xl">
            Big ideas.
            <br />
            <span className="studio-headline-accent">Start here.</span>
          </h1>
          <p className="mt-5 max-w-[36ch] text-pretty text-base/7 text-muted-foreground sm:text-lg/7">
            That token you&apos;ve been dreaming about? Give it a name, find
            your people, and bring it to life.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 px-6">
              <Link href="/bonding-curve">
                Let&apos;s launch <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-12 px-4">
              <a href="#launches">
                Explore launches <ArrowDown className="size-4" />
              </a>
            </Button>
          </div>
        </div>
        <div className="token-playground" data-mood={moods[moodIndex]}>
          <div className="token-orbit token-orbit-outer" aria-hidden="true" />
          <div className="token-orbit token-orbit-inner" aria-hidden="true" />
          <div className="token-sticker sticker-top" aria-hidden="true">
            100% your idea
          </div>
          <div className="spark-star spark-star-one" aria-hidden="true" />
          <div className="spark-star spark-star-two" aria-hidden="true" />
          <div className="little-token" aria-hidden="true">
            z
          </div>
          <div className="happy-token" aria-hidden="true">
            <div className="token-face">
              <span />
              <span />
              <i />
            </div>
            <div className="token-rim" />
          </div>
          <div className="token-sticker sticker-bottom" aria-hidden="true">
            <Sparkles className="size-4" /> Small spark. Big energy.
          </div>
          <button
            type="button"
            className="shuffle-token flex items-center gap-2 rounded-full px-4 py-2 text-sm hover:bg-card focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => setMoodIndex((index) => (index + 1) % moods.length)}
            aria-label={`Change token color. Current color: ${moods[moodIndex]}`}
          >
            <Shuffle className="size-4 shrink-0" /> Give it a spin
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-foreground/10 pt-5 text-sm text-muted-foreground xl:col-span-2">
          <span>No code. All you.</span>
          <span className="hidden h-1 w-1 rounded-full bg-foreground/25 sm:block" />
          <span>Create, launch, and share on Zilliqa.</span>
          <Link
            href="/faq"
            className="flex items-center gap-1.5 text-foreground hover:underline xl:ml-auto"
          >
            New here? Start with the basics{" "}
            <ArrowUpRight className="size-4 shrink-0" />
          </Link>
        </div>
      </div>
    </section>
  );
}

const creatorTools = [
  {
    href: "/create-token",
    number: "01",
    title: "Make it yours",
    description: "A name, a symbol, a token of your own.",
    action: "Create a token",
    tone: "tool-peach",
    mark: "Aa",
  },
  {
    href: "/fair-launch",
    number: "02",
    title: "Bring your people",
    description: "Give your community a place to start.",
    action: "Start a fair launch",
    tone: "tool-lilac",
    mark: "◎",
  },
  {
    href: "/airdrop",
    number: "03",
    title: "Spread the love",
    description: "Send tokens to a whole crowd at once.",
    action: "Create an airdrop",
    tone: "tool-mint",
    mark: "↗",
  },
];

export function CreatorTools() {
  return (
    <section aria-label="Creator tools" className="grid gap-4 lg:grid-cols-3">
      {creatorTools.map((tool) => (
        <Link
          key={tool.href}
          href={tool.href}
          className={`creator-tool group relative flex flex-col overflow-hidden rounded-3xl p-6 ${tool.tone}`}
        >
          <div className="flex items-start justify-between gap-4">
            <p className="font-mono text-xs text-muted-foreground">
              {tool.number} / THE CREATOR TOOLKIT
            </p>
            <ArrowUpRight className="size-4 shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
          </div>
          <div className="tool-mark" aria-hidden="true">
            {tool.mark}
          </div>
          <h2 className="mt-2 text-balance text-xl font-semibold">
            {tool.title}
          </h2>
          <p className="mt-2 max-w-[27ch] text-pretty text-base/6 text-muted-foreground sm:text-sm/6">
            {tool.description}
          </p>
          <p className="mt-5 text-sm font-semibold underline decoration-foreground/20 underline-offset-4 group-hover:decoration-foreground">
            {tool.action}
          </p>
        </Link>
      ))}
    </section>
  );
}
