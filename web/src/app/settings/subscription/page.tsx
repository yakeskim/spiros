"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { TIERS } from "@/lib/tiers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PixelBorder from "@/components/PixelBorder";
import PixelButton from "@/components/PixelButton";

const TIER_COLORS: Record<string, string> = {
  starter: "text-green",
  pro: "text-gold",
  max: "text-purple",
};

const TIER_BORDER_COLORS: Record<string, string> = {
  starter: "border-green/40",
  pro: "border-gold/40",
  max: "border-purple/40",
};

interface SubscriptionDetails {
  tier: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

export default function SubscriptionSettingsPage() {
  const { user, profile, loading } = useAuth();
  const [sub, setSub] = useState<SubscriptionDetails | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [user, loading]);

  // Fetch subscription details from Supabase
  useEffect(() => {
    if (!user) return;
    supabase
      .from("subscriptions")
      .select("tier, status, cancel_at_period_end, current_period_end, stripe_customer_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setSub(data as SubscriptionDetails | null);
        setSubLoading(false);
      });
  }, [user]);

  // Subscription table is the source of truth for tier
  const userTier = (sub?.status === "active" && sub?.tier) ? sub.tier : (profile?.tier ?? "free");

  async function openStripePortal() {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://acdjnobbiwiobvmijans.supabase.co"}/functions/v1/create-portal-session`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        console.error("Portal error:", json.error);
      }
    } catch (err) {
      console.error("Failed to open portal:", err);
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading || !user) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16">
          <p className="text-[11px] text-text-dim text-center">Loading...</p>
        </main>
        <Footer />
      </>
    );
  }

  const tierOrder: Record<string, number> = { free: 0, starter: 1, pro: 2, max: 3 };
  const currentOrder = tierOrder[userTier] ?? 0;
  const upgradeTiers = TIERS.filter((t) => (tierOrder[t.id] ?? 0) > currentOrder);
  const isFree = userTier === "free";

  const statusText = sub?.cancel_at_period_end
    ? "Cancels at period end"
    : sub?.status
    ? sub.status.charAt(0).toUpperCase() + sub.status.slice(1)
    : "Active";

  const renewLabel = sub?.cancel_at_period_end ? "Expires" : "Renews";
  const renewDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-16 space-y-10">
        <div className="text-center">
          <h1 className="text-gold text-lg text-shadow-pixel">Subscription</h1>
          <p className="text-[11px] text-text-dim mt-2">
            Manage your Spiros subscription
          </p>
        </div>

        {/* Current Plan Card */}
        <PixelBorder className="p-6 space-y-4">
          <h2 className="text-[13px] text-text-bright">Your Plan</h2>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-dim w-20 shrink-0">Tier</span>
            <span
              className={`text-[12px] font-pixel ${
                TIER_COLORS[userTier] ?? "text-text-dim"
              }`}
            >
              {userTier.toUpperCase()}
            </span>
          </div>

          {!isFree && (
            <>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-text-dim w-20 shrink-0">Status</span>
                <span className="text-[11px] text-text-bright">{statusText}</span>
              </div>

              {renewDate && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-text-dim w-20 shrink-0">
                    {renewLabel}
                  </span>
                  <span className="text-[11px] text-text-bright">{renewDate}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={openStripePortal}
                  disabled={portalLoading || subLoading}
                  className="text-[11px] text-gold border-2 border-gold/40 px-4 py-2 hover:bg-gold/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {portalLoading ? "Opening..." : "Manage Billing & Invoices"}
                </button>
                <p className="text-[11px] text-text-dim mt-2">
                  Update payment method, view invoices, or cancel via Stripe
                </p>
              </div>
            </>
          )}

          {isFree && (
            <p className="text-[10px] text-text-dim">
              You&apos;re on the free plan. Upgrade below to unlock premium features.
            </p>
          )}
        </PixelBorder>

        {/* Upgrade Cards */}
        {upgradeTiers.length > 0 && (
          <div>
            <h2 className="text-[13px] text-text-bright mb-4">
              {isFree ? "Choose a Plan" : "Upgrade"}
            </h2>
            <div
              className={`grid gap-6 ${
                upgradeTiers.length >= 3
                  ? "grid-cols-1 md:grid-cols-3"
                  : upgradeTiers.length === 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 max-w-sm"
              }`}
            >
              {upgradeTiers.map((tier) => (
                <PixelBorder
                  key={tier.id}
                  highlight={tier.highlight}
                  className={`p-6 flex flex-col ${
                    TIER_BORDER_COLORS[tier.id] ?? ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs ${tier.color}`}>{tier.name}</span>
                    {tier.highlight && (
                      <span className="text-[11px] text-bg-darkest bg-gold px-2 py-0.5">
                        BEST
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-xl text-text-bright text-shadow-pixel">
                      {tier.monthlyPrice}
                    </span>
                    <span className="text-[11px] text-text-dim">{tier.period}</span>
                  </div>
                  <p className="text-[10px] text-text-dim mb-4">
                    or {tier.annualMonthlyPrice}/mo billed {tier.annualTotalPrice}/yr
                    {tier.annualSave && (
                      <span className="text-green ml-1">({tier.annualSave})</span>
                    )}
                  </p>

                  <ul className="flex-1 space-y-2 mb-6">
                    {tier.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-[11px] text-text-dim"
                      >
                        <span className="text-green mt-0.5">&#10003;</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <PixelButton
                    variant={tier.highlight ? "primary" : "ghost"}
                    href="/download"
                    className="w-full"
                  >
                    {isFree ? `GET ${tier.name}` : `UPGRADE TO ${tier.name}`}
                  </PixelButton>
                  <p className="text-[11px] text-text-dim text-center mt-2">
                    Subscribe in the Spiros desktop app
                  </p>
                </PixelBorder>
              ))}
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="text-center space-y-2">
          <a
            href="/account"
            className="text-[11px] text-text-dim hover:text-gold transition-colors block"
          >
            &larr; Back to Account
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
