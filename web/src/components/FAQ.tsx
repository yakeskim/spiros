"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "What does Spiros track?",
    a: "Spiros tracks which applications and windows you use, how long you spend in each, and input activity like clicks and keystrokes. It groups this data into daily, weekly, and monthly views. It never records what you type — only counts.",
  },
  {
    q: "Is my data private?",
    a: "Absolutely. On the free plan, all data stays 100% local on your machine. Even on the Pro plan with cloud sync, your data is encrypted and never shared with third parties. You own your data completely.",
  },
  {
    q: "Does it slow down my computer?",
    a: "Not at all. Spiros runs as a lightweight background process using minimal CPU and memory. It's designed to be invisible — you won't notice it's there.",
  },
  {
    q: "What platforms are supported?",
    a: "Spiros currently supports Windows 10 and 11. macOS and Linux versions are on the roadmap and coming soon.",
  },
  {
    q: "How does gamification work?",
    a: "Every minute of tracked activity earns you XP. As you accumulate XP, you level up through ranks (Novice → Apprentice → Journeyman → ... → Legend). You can unlock achievements, build up your village, and compete with friends on leaderboards.",
  },
  {
    q: "How do I create an account?",
    a: "Download and install Spiros, then click 'Sign up' on the login screen inside the app. All you need is an email and password. Your account enables cloud sync, friends, and leaderboards.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — no contracts, no commitments. Cancel your Pro subscription anytime and you'll keep access through the end of your billing period. Your data is always yours to export.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 px-4 bg-bg-dark/50">
      <div className="max-w-3xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="text-[9px] text-gold border border-gold/40 bg-gold/10 px-3 py-1">
            ? QUEST LOG
          </span>
          <h2 className="text-lg sm:text-xl text-text-bright mt-6 text-shadow-pixel">
            QUEST LOG
          </h2>
          <p className="text-[10px] text-text-dim mt-4 leading-loose">
            Answers to the most common questions.
          </p>
        </div>

        {/* FAQ items */}
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="border-2 border-border-light bg-bg-panel shadow-pixel"
            >
              <button
                className="w-full text-left px-5 py-4 flex items-center justify-between cursor-pointer"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-[10px] text-text-bright pr-4">
                  {faq.q}
                </span>
                <span className="text-gold text-xs shrink-0">
                  {open === i ? "−" : "+"}
                </span>
              </button>
              {open === i && (
                <div className="px-5 pb-4 border-t border-border-dark">
                  <p className="text-[10px] text-text-dim leading-loose pt-3">
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
