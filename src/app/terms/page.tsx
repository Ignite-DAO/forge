import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Terms of Service | Torchpad",
  description:
    "Terms of Service for Torchpad - token launchpad on Zilliqa EVM.",
};

export default function TermsPage() {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Terms of Service
        </h1>
        <p className="text-muted-foreground mt-1">Last updated: February 2025</p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Risk Warning</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            Cryptocurrency and token trading involves substantial risk of loss
            and is not suitable for all individuals. You may lose some or all of
            your invested capital. The value of tokens can fluctuate
            significantly and may go to zero.
          </p>
          <p>
            Tokens created on Torchpad are user-generated and are not endorsed,
            verified, or guaranteed by Torchpad. Always conduct your own
            research before participating in any token launch or trade. This
            platform does not provide financial, investment, or legal advice.
            Past performance does not guarantee future results.
          </p>
        </AlertDescription>
      </Alert>

      <div className="space-y-6 text-sm text-muted-foreground">
        <Section title="1. Introduction">
          <p>
            Welcome to Torchpad. By accessing or using our platform, you agree
            to be bound by these Terms of Service. If you do not agree to these
            terms, do not use the platform.
          </p>
          <p>
            Torchpad is a decentralized application that provides tools for
            token creation, bonding curve launches, fair launches, and airdrop
            distribution on Zilliqa EVM. We do not take custody of your funds or
            tokens at any time.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 18 years old and legally able to enter into
            contracts to use Torchpad. You are responsible for ensuring that
            your use of the platform complies with all applicable laws and
            regulations in your jurisdiction.
          </p>
          <p>
            You represent that you are not a resident of, or located in, any
            jurisdiction where the use of cryptocurrency platforms is
            prohibited.
          </p>
        </Section>

        <Section title="3. Platform Description">
          <p>Torchpad provides the following services:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              <strong>Token Creation:</strong> Create ERC-20 compatible tokens
              with custom parameters including name, symbol, decimals, and total
              supply.
            </li>
            <li>
              <strong>Bonding Curve Launches:</strong> Launch tokens with
              automated market maker pricing that adjusts based on supply.
              Tokens can graduate to decentralized exchanges upon reaching
              market cap thresholds.
            </li>
            <li>
              <strong>Fair Launches:</strong> Community-first token raises where
              all participants contribute at the same price, with configurable
              soft caps, hard caps, and whitelisting.
            </li>
            <li>
              <strong>Airdrops:</strong> Distribute tokens to multiple
              recipients in a single transaction.
            </li>
          </ul>
        </Section>

        <Section title="4. Wallet Connection">
          <p>
            To use Torchpad, you must connect a compatible cryptocurrency wallet
            (such as Torch or MetaMask). You are solely responsible for the security of
            your wallet, private keys, and seed phrases. Torchpad never has
            access to your private keys.
          </p>
          <p>
            All transactions are executed on the blockchain and are irreversible
            once confirmed. You are responsible for verifying all transaction
            details before signing.
          </p>
        </Section>

        <Section title="5. Fees">
          <p>
            Torchpad charges platform fees for certain services including
            bonding curve launches and fair launches. These fees are clearly
            displayed before you confirm any transaction. All transactions also
            require gas fees paid to the blockchain network.
          </p>
          <p>
            Fee structures may change at any time. Current fees are displayed in
            the application interface.
          </p>
        </Section>

        <Section title="6. Token Creation and User-Generated Content">
          <p>
            When you create a token or launch on Torchpad, you are solely
            responsible for:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>The accuracy of all token information you provide</li>
            <li>Ensuring your token does not infringe on any trademarks or intellectual property rights</li>
            <li>Compliance with all applicable securities laws and regulations</li>
            <li>Any claims, damages, or losses arising from your token</li>
          </ul>
          <p className="mt-2">
            Torchpad does not review, endorse, or verify any tokens created on
            the platform. The presence of a token on Torchpad does not
            constitute any recommendation or approval.
          </p>
        </Section>

        <Section title="7. Security Responsibilities">
          <p>You are responsible for:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Maintaining the confidentiality of your wallet credentials</li>
            <li>All activities that occur through your connected wallet</li>
            <li>Verifying contract addresses and transaction details before signing</li>
            <li>Understanding the risks of smart contract interactions</li>
          </ul>
        </Section>

        <Section title="8. Intellectual Property">
          <p>
            The Torchpad platform, including its design, code, and branding, is
            protected by intellectual property rights. You may not copy,
            reproduce, or create derivative works without permission.
          </p>
          <p>
            The smart contracts deployed on the blockchain are open source and
            subject to their respective licenses.
          </p>
        </Section>

        <Section title="9. Prohibited Activities">
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Use the platform for any illegal purpose or to violate any laws</li>
            <li>Create tokens that infringe on trademarks or impersonate other projects</li>
            <li>Manipulate markets or engage in fraudulent trading practices</li>
            <li>Attempt to exploit, hack, or disrupt the platform or its smart contracts</li>
            <li>Use the platform if you are in a restricted jurisdiction</li>
            <li>Create or promote tokens as securities without proper registration</li>
          </ul>
        </Section>

        <Section title="10. Disclaimers">
          <p>
            TORCHPAD IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot;
            WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT
            WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR
            SECURE.
          </p>
          <p>
            We do not provide investment, financial, tax, or legal advice. Any
            information on the platform is for informational purposes only and
            should not be relied upon for making financial decisions.
          </p>
          <p>
            Smart contracts may contain bugs or vulnerabilities. While we strive
            to ensure security, we cannot guarantee that the contracts are free
            from defects.
          </p>
        </Section>

        <Section title="11. Limitation of Liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, TORCHPAD AND ITS OPERATORS
            SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO
            LOSS OF PROFITS, DATA, OR OTHER INTANGIBLE LOSSES.
          </p>
          <p>
            Our total liability for any claims arising from or relating to these
            terms or your use of the platform shall not exceed the fees you paid
            to us in the twelve months preceding the claim.
          </p>
        </Section>

        <Section title="12. Indemnification">
          <p>
            You agree to indemnify and hold harmless Torchpad and its operators
            from any claims, damages, losses, or expenses arising from your use
            of the platform, your tokens, or your violation of these terms.
          </p>
        </Section>

        <Section title="13. Modifications">
          <p>
            We may modify these Terms of Service at any time. Changes will be
            effective upon posting to the platform. Your continued use of
            Torchpad after changes constitutes acceptance of the modified terms.
          </p>
        </Section>

        <Section title="14. Definitions">
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>&quot;Platform&quot;</strong> refers to the Torchpad web application
              and associated smart contracts.
            </li>
            <li>
              <strong>&quot;Token&quot;</strong> refers to any ERC-20 compatible token
              created or traded on the platform.
            </li>
            <li>
              <strong>&quot;Wallet&quot;</strong> refers to your cryptocurrency wallet used
              to connect to the platform.
            </li>
            <li>
              <strong>&quot;Smart Contract&quot;</strong> refers to the self-executing code
              deployed on the blockchain that powers platform functionality.
            </li>
            <li>
              <strong>&quot;Graduation&quot;</strong> refers to the process where a bonding
              curve token&apos;s liquidity is migrated to a decentralized exchange.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
