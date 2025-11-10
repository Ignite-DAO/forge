import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Shield,
  Rocket,
  Gift,
  Coins,
  MousePointerClick,
  Sparkles,
  Clock,
  Megaphone,
  Lock,
  Wallet,
  Bot,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-10 sm:p-16">
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Launch in clicks. Grow without limits.
          </h1>
          <p className="text-base text-muted-foreground mt-4">
            Airdrops, launches and liquidity. All instant. All on chain.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link
                href="/create-token"
                className="inline-flex items-center gap-1.5"
              >
                Launch Token
                <Rocket className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link
                href="/airdrop"
                className="inline-flex items-center gap-1.5"
              >
                Start Airdrop
                <Gift className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link
                href="/discover"
                className="inline-flex items-center gap-1.5"
              >
                Browse Launches
                <Sparkles className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link
                href="/fair-launch"
                className="inline-flex items-center gap-1.5"
              >
                Fair Launchpad
                <Sparkles className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -left-24 -bottom-24 size-80 rounded-full bg-accent/30 blur-3xl" />
      </section>

      {/* Quick CTA row */}
      <section className="text-center">
        <p className="text-sm text-muted-foreground">Your project begins here.</p>
      </section>

      {/* Launch formats (preview) */}
      <section className="rounded-2xl bg-muted/30 p-8 sm:p-12">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Rocket className="size-4" />
            </span>
            Launch formats
            <Badge className="ml-2" variant="outline">
              Preview
            </Badge>
          </h2>
          <p className="text-base text-muted-foreground mt-3">
            Choose the path that fits your community and goals. Configure how you go live, including optional liquidity locks.
          </p>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Rocket className="size-5" />
              </span>
              <div className="text-base font-medium">Full launch</div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Kickstart with built-in liquidity and seamless DEX integration for stronger price discovery.
            </p>
            <Badge className="mt-3" variant="outline">
              Launching soon
            </Badge>
          </div>
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </span>
              <div className="text-base font-medium">Fair launch</div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Open to everyone, with optional liquidity locks that build instant community trust.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/fair-launch" className="inline-flex items-center gap-1.5">
                Build now
                <Sparkles className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="rounded-xl border border-border p-5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Gift className="size-5" />
              </span>
              <div className="text-base font-medium">Presale</div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Give early supporters exclusive access before the full launch goes live.
            </p>
            <Badge className="mt-3" variant="outline">
              Launching soon
            </Badge>
          </div>
        </div>
      </section>

      {/* Features and roadmap */}
      <section className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <h3 className="text-xl font-semibold">Current features</h3>
          <ul className="mt-4 space-y-3 text-base">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 text-primary" />
              <span>Create fixed‑supply ERC‑20 tokens in minutes.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 text-primary" />
              <span>Run simple, secure airdrops to many recipients.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 text-primary" />
              <span>Clean UX with transparent on‑chain confirmations.</span>
            </li>
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">What’s next</h3>
            <Badge variant="secondary" className="text-[11px]">
              Roadmap
            </Badge>
          </div>
          <div className="mt-4 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-base font-medium">
                <Lock className="size-4 text-muted-foreground" />
                Liquidity locks
                <Badge className="ml-2" variant="outline">
                  Coming soon
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Lock liquidity with customizable configurations to reinforce
                trust at launch and beyond.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-base font-medium">
                <MousePointerClick className="size-4 text-muted-foreground" />
                Flexible launch formats
                <Badge className="ml-2" variant="outline">
                  Coming soon
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Expand beyond the basic token drop with full, fair, and presale
                templates plus guardrails tuned for each path.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Who it’s for */}
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Who it’s for</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <BenefitPoint icon={<Rocket className="size-5" />} title="Founders">
            Launch without a dev team. Go from idea to token and distribution
            fast.
          </BenefitPoint>
          <BenefitPoint
            icon={<Megaphone className="size-5" />}
            title="Marketers"
          >
            Treat tokens like product funnels — plan, attribute, and iterate
            like performance campaigns.
          </BenefitPoint>
          <BenefitPoint icon={<Gift className="size-5" />} title="Communities">
            Reward early supporters and run airdrops safely with transparent
            flows.
          </BenefitPoint>
        </div>
      </section>

      {/* Trust & security */}
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">
          Trust and security
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-primary" />
            <span>Standards‑based ERC‑20 with OpenZeppelin foundations.</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-primary" />
            <span>
              Verified sources via Sourcify for transparent deployments.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-primary" />
            <span>Clear fees and on‑chain confirmations for every action.</span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-primary" />
            <span>Built for Zilliqa EVM with smooth wallet switching.</span>
          </li>
        </ul>
      </section>

      {/* How it works (spacious) */}
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-6 grid gap-10 md:grid-cols-3">
          <StepCard
            step={1}
            icon={<Coins className="size-5" />}
            title="Create your token"
          >
            Choose a name, symbol, decimals and total supply. Deploy with a
            click — minted to your wallet.
          </StepCard>
          <StepCard
            step={2}
            icon={<MousePointerClick className="size-5" />}
            title="Connect and confirm"
          >
            Connect your wallet and approve the transaction. We guide you
            through any network switches.
          </StepCard>
          <StepCard
            step={3}
            icon={<Gift className="size-5" />}
            title="Airdrop in clicks"
          >
            Paste addresses and amounts to distribute tokens securely — no
            spreadsheets required.
          </StepCard>
        </div>
      </section>

      {/* Why Forge */}
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">Why Forge</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <BenefitPoint icon={<Sparkles className="size-5" />} title="Simple">
            Create a fixed‑supply token and distribute it in minutes.
          </BenefitPoint>
          <BenefitPoint icon={<Shield className="size-5" />} title="Secure">
            Designed with best practices and transparent on‑chain actions.
          </BenefitPoint>
          <BenefitPoint icon={<Clock className="size-5" />} title="Fast">
            Streamlined flows that get you from idea to launch quickly.
          </BenefitPoint>
        </div>
      </section>

      {/* Torch Wallet */}
      <section className="relative overflow-hidden rounded-2xl border border-border p-8 sm:p-12">
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative z-10 grid gap-6 md:grid-cols-2 md:items-start">
          <div>
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Wallet className="size-5" />
              </span>
              Torch Wallet — Built for Zilliqa 2.0!
            </h3>
            <p className="text-base text-muted-foreground mt-2 max-w-2xl">
              Torch is the all‑in‑one platform for the Zilliqa ecosystem, now
              rebuilt for Zilliqa 2.0 with full EVM support.
            </p>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
              Buy ZIL, swap tokens, stake instantly, and manage both your legacy and EVM ZIL from a
              single, mobile‑first interface.
            </p>
            <div className="mt-5">
              <Button asChild size="lg" variant="outline">
                <a
                  href="https://torchwallet.io"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5"
                >
                  Explore Torch Wallet
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
          </div>
          <div>
            <ul className="grid gap-3 text-sm">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                <div>
                  <div className="font-medium">Dual‑Chain Support (Legacy & EVM)</div>
                  <div className="text-muted-foreground">Seamlessly manage ZIL on both chains in one place.</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                <div>
                  <div className="font-medium">Buy ZIL Instantly</div>
                  <div className="text-muted-foreground">Purchase ZIL directly inside the app with your preferred payment method.</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                <div>
                  <div className="font-medium">Instant Unstaking</div>
                  <div className="text-muted-foreground">Skip the 14‑day lockup. Unstake instantly for a small fee.</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                <div>
                  <div className="font-medium">DEX Swaps</div>
                  <div className="text-muted-foreground">Swap tokens and set price targets directly from your wallet.</div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
                <div>
                  <div className="font-medium">Built for Zilliqa 2.0</div>
                  <div className="text-muted-foreground">Full support for EVM assets, modern UX, and blazing fast performance.</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Focused CTAs */}
      <section className="text-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link
              href="/create-token"
              className="inline-flex items-center gap-1.5"
            >
              Create your token
              <Rocket className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/airdrop" className="inline-flex items-center gap-1.5">
              Run an airdrop
              <Gift className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="rounded-xl border border-border p-4 sm:p-6">
        <h2 className="text-base font-semibold">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="mt-2">
          <AccordionItem value="q1">
            <AccordionTrigger>
              Do I need any technical knowledge?
            </AccordionTrigger>
            <AccordionContent>
              No — Forge guides you through creating a token and running an
              airdrop with a friendly interface.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger>
              How long does it take to launch?
            </AccordionTrigger>
            <AccordionContent>
              Usually just a few minutes. Most time is spent confirming the
              wallet transaction.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q3">
            <AccordionTrigger>
              Can I airdrop to many addresses?
            </AccordionTrigger>
            <AccordionContent>
              Yes — paste a list of addresses and amounts. Forge batches these
              securely for you.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
}

function BenefitPoint({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="text-base font-medium">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mt-2">{children}</p>
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
          {step}
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
          <h3 className="text-base font-medium">{title}</h3>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-2">{children}</p>
    </div>
  );
}

//
