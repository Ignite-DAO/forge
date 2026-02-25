"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqCategories = [
  {
    title: "General",
    questions: [
      {
        q: "What is Torchpad?",
        a: "Torchpad is a token launchpad that lets you create tokens, launch bonding curves, run fair launches, and distribute airdrops—all on-chain.",
      },
      {
        q: "What blockchain does it run on?",
        a: "Torchpad runs on Zilliqa 2.0, an EVM-compatible blockchain.",
      },
      {
        q: "Do I need to connect a wallet?",
        a: "Yes. You need a connected wallet (like Torch or MetaMask) to create tokens, launch, or interact with any on-chain features.",
      },
      {
        q: "Are there any fees?",
        a: "There's a small platform fee for bonding curve launches and fair launches. Token creation and airdrops only require gas fees.",
      },
    ],
  },
  {
    title: "Bonding Curve",
    questions: [
      {
        q: "How does a bonding curve work?",
        a: "A bonding curve automatically sets token prices based on supply. As more tokens are bought, the price increases along a mathematical curve.",
      },
      {
        q: "What is graduation?",
        a: "Graduation happens when a bonding curve token reaches its market cap threshold, triggering automatic liquidity migration.",
      },
      {
        q: "What happens when a token graduates?",
        a: "The token's liquidity is automatically migrated to PlunderSwap, where it becomes freely tradable on the open market.",
      },
      {
        q: "Can I sell tokens before graduation?",
        a: "Yes. You can sell tokens back to the bonding curve at any time before graduation at the current curve price.",
      },
      {
        q: "What determines the graduation threshold?",
        a: "The graduation threshold is set by the protocol and represents the market cap at which liquidity migrates to PlunderSwap.",
      },
    ],
  },
  {
    title: "Fair Launch",
    questions: [
      {
        q: "What is a fair launch?",
        a: "A fair launch is a community-first token raise where everyone contributes at the same price, with no presale or insider advantages.",
      },
      {
        q: "What's the difference between soft cap and hard cap?",
        a: "Soft cap is the minimum raise needed for the launch to succeed. Hard cap is the maximum amount that can be raised.",
      },
      {
        q: "How does whitelisting work?",
        a: "Creators can optionally whitelist addresses that are allowed to participate in the raise, restricting access to approved participants.",
      },
      {
        q: "What happens if the soft cap isn't reached?",
        a: "Contributors can claim a full refund of their contribution if the soft cap isn't reached by the deadline.",
      },
    ],
  },
  {
    title: "Token Creation",
    questions: [
      {
        q: "What kind of tokens can I create?",
        a: "You can create standard ERC-20 tokens with custom name, symbol, decimals, and total supply.",
      },
      {
        q: "Where do the tokens go after creation?",
        a: "The entire token supply is minted directly to your connected wallet address.",
      },
    ],
  },
  {
    title: "Airdrops",
    questions: [
      {
        q: "What's the maximum number of recipients?",
        a: "You can airdrop to up to 500 recipients in a single transaction.",
      },
      {
        q: "What format should my CSV be in?",
        a: "Each line should contain an address and amount separated by a comma: 0xAddress,amount",
      },
      {
        q: "Do I need to approve tokens first?",
        a: "Yes. You must approve the airdrop contract to spend your tokens before executing the distribution.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-muted-foreground mt-2">
          Everything you need to know about using Torchpad.
        </p>
      </div>

      <div className="space-y-8">
        {faqCategories.map((category) => (
          <section key={category.title}>
            <h2 className="text-lg font-semibold mb-3">{category.title}</h2>
            <Accordion
              type="single"
              collapsible
              className="rounded-2xl border border-border"
            >
              {category.questions.map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`${category.title}-${index}`}
                  className="px-5"
                >
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </div>
  );
}
