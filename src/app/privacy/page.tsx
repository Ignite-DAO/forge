import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Torchpad",
  description: "Privacy Policy for Torchpad - token launchpad on Zilliqa EVM.",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground mt-1">Last updated: February 2025</p>
      </div>

      <div className="space-y-6 text-sm text-muted-foreground">
        <Section title="1. Information We Collect">
          <p>
            Torchpad is designed to minimize data collection. We do not require
            account registration or collect personal information such as names,
            emails, or phone numbers.
          </p>
          <p>When you use Torchpad, we may collect:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              <strong>Wallet Address:</strong> Your public blockchain address
              when you connect your wallet. This is necessary to enable
              transactions.
            </li>
            <li>
              <strong>Transaction Data:</strong> Records of your interactions
              with our smart contracts, which are publicly visible on the
              blockchain.
            </li>
            <li>
              <strong>Usage Data:</strong> Anonymous analytics data such as
              pages visited, features used, and general interaction patterns.
            </li>
            <li>
              <strong>Device Information:</strong> Browser type, operating
              system, and device identifiers for security and optimization
              purposes.
            </li>
          </ul>
        </Section>

        <Section title="2. Blockchain Data">
          <p>
            Torchpad operates on a public blockchain. All transactions,
            including token creation, trades, and transfers, are permanently
            recorded on the blockchain and publicly visible. This includes:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Your wallet address</li>
            <li>Transaction amounts and timestamps</li>
            <li>Token metadata you provide during creation</li>
            <li>Smart contract interactions</li>
          </ul>
          <p className="mt-2">
            This blockchain data cannot be deleted or modified. By using
            Torchpad, you acknowledge that your transactions will be permanently
            and publicly recorded.
          </p>
        </Section>

        <Section title="3. How We Use Information">
          <p>We use collected information to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Provide and maintain the platform</li>
            <li>Display your token holdings and transaction history</li>
            <li>Improve platform functionality and user experience</li>
            <li>Detect and prevent fraud or abuse</li>
            <li>Comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="4. Third-Party Services">
          <p>
            Torchpad integrates with third-party services that have their own
            privacy policies:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              <strong>Wallet Providers:</strong> When you connect wallets like
              Torch, MetaMask, WalletConnect, or others through RainbowKit,
              those providers may collect data according to their privacy
              policies.
            </li>
            <li>
              <strong>Blockchain Networks:</strong> Zilliqa and associated RPC
              providers process your transactions.
            </li>
            <li>
              <strong>Analytics Services:</strong> We may use analytics tools to
              understand platform usage patterns.
            </li>
          </ul>
          <p className="mt-2">
            We encourage you to review the privacy policies of any third-party
            services you interact with.
          </p>
        </Section>

        <Section title="5. Cookies and Local Storage">
          <p>Torchpad uses cookies and browser local storage to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Remember your wallet connection preferences</li>
            <li>Store your selected network and theme settings</li>
            <li>Maintain session state</li>
            <li>Collect anonymous analytics data</li>
          </ul>
          <p className="mt-2">
            You can configure your browser to reject cookies, but this may
            affect platform functionality.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <p>
            Off-chain data (such as analytics and logs) is retained only as long
            as necessary for the purposes described in this policy or as
            required by law.
          </p>
          <p>
            Blockchain data is permanent and immutable. We cannot delete
            transaction history or token data recorded on the blockchain.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data (where technically possible)</li>
            <li>Object to or restrict certain processing</li>
            <li>Data portability</li>
          </ul>
          <p className="mt-2">
            Note that blockchain data cannot be modified or deleted due to its
            immutable nature.
          </p>
        </Section>

        <Section title="8. Children&apos;s Privacy">
          <p>
            Torchpad is not intended for use by individuals under 18 years of
            age. We do not knowingly collect information from children. If we
            become aware that we have collected data from a child, we will take
            steps to delete it.
          </p>
        </Section>

        <Section title="9. International Users">
          <p>
            Torchpad is accessible globally. By using the platform, you consent
            to the transfer and processing of your information in jurisdictions
            that may have different data protection laws than your own.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with an updated revision date. Your continued
            use of Torchpad after changes constitutes acceptance of the updated
            policy.
          </p>
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
