"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const SUPABASE_URL = "https://acdjnobbiwiobvmijans.supabase.co";

const TITLE_COLORS: Record<string, string> = {
  Novice: "text-text-dim",
  Apprentice: "text-green",
  Journeyman: "text-blue",
  Expert: "text-purple",
  Master: "text-gold",
  Grandmaster: "text-orange",
  Legend: "text-red",
};

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  free: { label: "FREE", color: "text-text-dim", bg: "bg-bg-mid/50", border: "border-border-dark", glow: "" },
  starter: { label: "STARTER", color: "text-green", bg: "bg-green/5", border: "border-green/30", glow: "shadow-[0_0_12px_rgba(46,230,122,0.15)]" },
  pro: { label: "PRO", color: "text-gold", bg: "bg-gold/5", border: "border-gold/30", glow: "shadow-[0_0_12px_rgba(245,197,66,0.15)]" },
  max: { label: "MAX", color: "text-purple", bg: "bg-purple/5", border: "border-purple/30", glow: "shadow-[0_0_12px_rgba(204,68,255,0.15)]" },
};

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

const MILESTONES = [
  { count: 1, label: "Recruiter", reward: '500 XP + "Recruiter" achievement', icon: "+" },
  { count: 3, label: "Squad Builder", reward: '"Referral Blue" avatar color', icon: "+" },
  { count: 5, label: "Team Captain", reward: '"Recruiter" profile frame + 1,000 XP', icon: "+" },
  { count: 10, label: "Commander", reward: "1 month free Starter", icon: "+" },
  { count: 25, label: "Ambassador", reward: '1 month free Pro + "Ambassador" title', icon: "+" },
  { count: 50, label: "Legend", reward: '"Legend" profile frame + permanent badge', icon: "+" },
];

/* Decorative corner borders matching the Hero section style */
function CornerBorders({ color = "gold/20" }: { color?: string }) {
  return (
    <>
      <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-${color}`} />
      <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-${color}`} />
      <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-${color}`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-${color}`} />
    </>
  );
}

export default function AccountPageWrapper() {
  return (
    <Suspense fallback={<><Header /><main className="max-w-3xl mx-auto px-4 py-16"><p className="text-xs text-text-dim text-center">Loading...</p></main><Footer /></>}>
      <AccountPage />
    </Suspense>
  );
}

function AccountPage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const searchParams = useSearchParams();

  // Profile editing
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Social stats
  const [friendsCount, setFriendsCount] = useState<number | null>(null);

  // Referral
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Trial prompt
  const [showTrialPrompt, setShowTrialPrompt] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq("status", "accepted")
      .then(({ count }) => {
        setFriendsCount(count ?? 0);
      });
  }, [user]);

  // Fetch referral data
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("referral_code, referral_count, referred_by")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setReferralCode(data.referral_code);
          setReferralCount(data.referral_count ?? 0);
        }
      });
  }, [user]);

  // Show trial prompt if redirected from referral signup
  useEffect(() => {
    if (searchParams.get("trial") === "starter" && profile?.referred_by) {
      setShowTrialPrompt(true);
    }
  }, [searchParams, profile]);

  async function handleStartTrial() {
    if (!user) return;
    setTrialLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setTrialLoading(false); return; }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: session.access_token,
        },
        body: JSON.stringify({ planKey: "starter_monthly", referralTrial: true }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // silently fail
    }
    setTrialLoading(false);
  }

  async function handleCopyCode() {
    if (!referralCode) return;
    await navigator.clipboard.writeText(referralCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function handleCopyLink() {
    if (!referralCode) return;
    await navigator.clipboard.writeText(`https://spiros.app/signup?ref=${referralCode}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleNameSave() {
    if (!user || !newName.trim()) return;
    if (newName.trim().length > 24) { setNameError("Name must be 1-24 characters"); setNameSaving(false); return; }
    setNameError("");
    setNameSaving(true);

    // Check rate limit
    const { data: rateProfile } = await supabase
      .from("profiles")
      .select("display_name_changed_count, display_name_changed_month")
      .eq("id", user.id)
      .single();

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let count = rateProfile?.display_name_changed_count || 0;
    if ((rateProfile?.display_name_changed_month || "") !== currentMonth) count = 0;

    if (count >= 2) {
      setNameError("You can only change your name 2 times per month.");
      setNameSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: newName.trim(),
        display_name_changed_count: count + 1,
        display_name_changed_month: currentMonth,
      })
      .eq("id", user.id);

    setNameSaving(false);
    if (error) {
      setNameError(error.message);
    } else {
      setEditingName(false);
      refreshProfile();
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    }
  }

  if (loading || !user) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-16">
          <p className="text-xs text-text-dim text-center">Loading...</p>
        </main>
        <Footer />
      </>
    );
  }

  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  const xpNeeded = xpForLevel(level);
  const xpPercent = Math.min(100, Math.round((xp / xpNeeded) * 100));
  const titleColor = TITLE_COLORS[profile?.title ?? ""] ?? "text-text-dim";
  const userTier = profile?.tier ?? "free";
  const tierConf = TIER_CONFIG[userTier] ?? TIER_CONFIG.free;
  const nextMilestone = MILESTONES.find(m => referralCount < m.count);
  const referralPercent = nextMilestone ? Math.round((referralCount / nextMilestone.count) * 100) : 100;

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">

        {/* Trial Prompt Banner */}
        {showTrialPrompt && (
          <section className="relative bg-gradient-to-r from-gold/10 via-gold/5 to-gold/10 border-2 border-gold/40 shadow-pixel-gold p-8 text-center space-y-4">
            <CornerBorders color="gold/40" />
            <h2 className="text-base text-gold text-shadow-pixel">Welcome! Start Your Free Trial</h2>
            <p className="text-xs text-text-bright leading-relaxed">
              You were referred by a friend! Enjoy <span className="text-gold">7 days of Starter</span> for free.
            </p>
            <p className="text-[11px] text-text-dim">
              Card required. Auto-charges $3.99/mo after trial if not cancelled.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={handleStartTrial}
                disabled={trialLoading}
                className="text-xs text-bg-darkest bg-gold px-8 py-3 border-2 border-gold-dark shadow-pixel-gold hover:brightness-110 active:shadow-pixel-pressed cursor-pointer disabled:opacity-50 transition-all"
              >
                {trialLoading ? "Loading..." : "Start 7-Day Free Trial"}
              </button>
              <button
                onClick={() => setShowTrialPrompt(false)}
                className="text-[11px] text-text-dim hover:text-text-bright cursor-pointer transition-colors"
              >
                Maybe later
              </button>
            </div>
          </section>
        )}

        {/* ═══════ CHARACTER CARD ═══════ */}
        <section className="relative bg-bg-dark border-2 border-border-light shadow-pixel-raised overflow-hidden">
          <CornerBorders color="gold/30" />

          {/* Top accent line */}
          <div className="h-1 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

          <div className="p-8 space-y-6">
            {/* Name + Title Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                {/* Display Name */}
                {editingName ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={20}
                      className="bg-bg-darkest border-2 border-border-dark text-text-bright text-sm px-3 py-2 focus:border-gold outline-none w-48"
                    />
                    <button
                      onClick={handleNameSave}
                      disabled={nameSaving}
                      className="text-[11px] text-bg-darkest bg-gold px-4 py-2 border-2 border-gold-dark shadow-pixel-gold hover:brightness-110 cursor-pointer disabled:opacity-50"
                    >
                      {nameSaving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameError(""); }}
                      className="text-[11px] text-text-dim hover:text-text-bright cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl text-text-bright text-shadow-pixel">{profile?.display_name ?? "Adventurer"}</h1>
                    <button
                      onClick={() => { setEditingName(true); setNewName(profile?.display_name ?? ""); }}
                      className="text-[11px] text-text-dim hover:text-gold cursor-pointer transition-colors"
                    >
                      [edit]
                    </button>
                  </div>
                )}
                {nameError && <p className="text-[11px] text-red-400">{nameError}</p>}

                {/* Title */}
                <p className={`text-xs ${titleColor}`}>{profile?.title ?? "Novice"}</p>
              </div>

              {/* Tier Badge */}
              <div className={`inline-flex items-center gap-2 px-5 py-2 border-2 ${tierConf.border} ${tierConf.bg} ${tierConf.glow}`}>
                <span className={`text-sm font-bold tracking-widest ${tierConf.color}`}>{tierConf.label}</span>
              </div>
            </div>

            {/* Level + XP Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-dim">Level <span className="text-gold text-shadow-pixel text-sm">{level}</span></span>
                <span className="text-[11px] text-text-dim">{xp.toLocaleString()} / {xpNeeded.toLocaleString()} XP</span>
              </div>
              <div className="h-3 bg-bg-darkest border-2 border-border-dark relative overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-dark to-gold xp-bar-shine transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-text-dim">
                <span>{xpPercent}% to next level</span>
                <span>{(xpNeeded - xp).toLocaleString()} XP remaining</span>
              </div>
            </div>

            {/* Email + Account Actions */}
            <div className="pt-2 border-t border-border-dark/50 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-text-dim w-20">Email</span>
                <span className="text-xs text-text-bright">{user.email}</span>
              </div>

              {passwordSuccess && (
                <p className="text-[11px] text-green-400">Password updated successfully!</p>
              )}

              {!showPasswordForm ? (
                <button
                  onClick={() => { setShowPasswordForm(true); setPasswordSuccess(false); }}
                  className="text-[11px] text-text-dim hover:text-gold cursor-pointer transition-colors"
                >
                  Change password
                </button>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm pt-2">
                  {passwordError && <p className="text-[11px] text-red-400">{passwordError}</p>}
                  <div>
                    <label className="block text-[11px] text-text-dim mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="8+ characters"
                      className="w-full bg-bg-darkest border-2 border-border-dark text-text-bright text-xs px-3 py-2 focus:border-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-dim mb-1">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Repeat password"
                      className="w-full bg-bg-darkest border-2 border-border-dark text-text-bright text-xs px-3 py-2 focus:border-gold outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="text-[11px] text-bg-darkest bg-gold px-5 py-2 border-2 border-gold-dark shadow-pixel-gold hover:brightness-110 cursor-pointer disabled:opacity-50"
                    >
                      {passwordSaving ? "Saving..." : "Update Password"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                      className="text-[11px] text-text-dim hover:text-text-bright cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ═══════ SUBSCRIPTION ═══════ */}
        <section className={`relative border-2 ${tierConf.border} ${tierConf.bg} ${tierConf.glow} shadow-pixel`}>
          <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm text-text-bright">Subscription</h2>
              <p className="text-xs text-text-dim">
                {userTier === "free"
                  ? "Unlock more features with a subscription"
                  : `Your ${tierConf.label} plan is active`}
              </p>
            </div>
            <a
              href="/settings/subscription"
              className="text-xs text-bg-darkest bg-gold px-6 py-2 border-2 border-gold-dark shadow-pixel-gold hover:brightness-110 transition-all text-center cursor-pointer"
            >
              {userTier === "free" ? "Upgrade" : "Manage"} &#8594;
            </a>
          </div>
        </section>

        {/* ═══════ STATS GRID ═══════ */}
        <section className="relative bg-bg-dark border-2 border-border-light shadow-pixel overflow-hidden">
          <CornerBorders />

          <div className="p-6 space-y-5">
            <h2 className="text-sm text-text-bright text-shadow-pixel">Stats</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Streak */}
              <div className="bg-bg-darkest border-2 border-border-dark p-4 text-center space-y-1 hover:border-orange/30 transition-colors">
                <p className="text-[11px] text-text-dim">Current Streak</p>
                <p className="text-orange text-lg text-shadow-pixel">{profile?.streak_current ?? 0}</p>
                <p className="text-[11px] text-text-dim">days</p>
              </div>

              {/* Best Streak */}
              <div className="bg-bg-darkest border-2 border-border-dark p-4 text-center space-y-1 hover:border-gold/30 transition-colors">
                <p className="text-[11px] text-text-dim">Best Streak</p>
                <p className="text-gold text-lg text-shadow-pixel">{profile?.streak_best ?? 0}</p>
                <p className="text-[11px] text-text-dim">days</p>
              </div>

              {/* Friends */}
              <div className="bg-bg-darkest border-2 border-border-dark p-4 text-center space-y-1 hover:border-blue/30 transition-colors">
                <p className="text-[11px] text-text-dim">Friends</p>
                <p className="text-blue text-lg text-shadow-pixel">
                  {friendsCount !== null ? friendsCount : "—"}
                </p>
                <p className="text-[11px] text-text-dim">online</p>
              </div>

              {/* Last Active */}
              <div className="bg-bg-darkest border-2 border-border-dark p-4 text-center space-y-1 hover:border-green/30 transition-colors">
                <p className="text-[11px] text-text-dim">Last Active</p>
                <p className="text-green text-xs text-shadow-pixel">
                  {profile?.last_seen_at
                    ? new Date(profile.last_seen_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-text-dim text-center">
              Open the Spiros app for detailed analytics and social features.
            </p>
          </div>
        </section>

        {/* ═══════ REFERRAL PROGRAM ═══════ */}
        {referralCode && (
          <section className="relative bg-bg-dark border-2 border-border-light shadow-pixel overflow-hidden">
            <CornerBorders color="gold/20" />

            {/* Accent */}
            <div className="h-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

            <div className="p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-sm text-text-bright text-shadow-pixel">Referral Program</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopyCode}
                    className="text-[11px] text-bg-darkest bg-gold px-4 py-2 border-2 border-gold-dark shadow-pixel-gold hover:brightness-110 cursor-pointer transition-all"
                  >
                    {codeCopied ? "Copied!" : "Copy Code"}
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="text-[11px] text-text-dim border-2 border-border-dark px-4 py-2 shadow-pixel hover:text-gold hover:border-gold/40 cursor-pointer transition-all"
                  >
                    {linkCopied ? "Copied!" : "Share Link"}
                  </button>
                </div>
              </div>

              {/* Code Display */}
              <div className="bg-bg-darkest border-2 border-gold/20 p-4 flex items-center justify-center">
                <span className="text-lg text-gold tracking-[0.3em] text-shadow-pixel">{referralCode}</span>
              </div>

              {/* Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-text-dim">Total Referrals: </span>
                    <span className="text-sm text-gold text-shadow-pixel">{referralCount}</span>
                  </div>
                  {nextMilestone && (
                    <span className="text-[11px] text-text-dim">
                      {nextMilestone.count - referralCount} more for <span className="text-text-bright">{nextMilestone.label}</span>
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-bg-darkest border border-border-dark relative overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gold-dark to-gold transition-all duration-500"
                    style={{ width: `${referralPercent}%` }}
                  />
                </div>
              </div>

              {/* Milestones */}
              <div className="space-y-2 pt-1">
                {MILESTONES.map((m) => {
                  const achieved = referralCount >= m.count;
                  return (
                    <div
                      key={m.count}
                      className={`flex items-center gap-3 px-3 py-2 border transition-colors ${
                        achieved
                          ? "border-green/20 bg-green/5"
                          : "border-transparent hover:border-border-dark/50"
                      }`}
                    >
                      <span className={`text-xs w-5 text-center ${achieved ? "text-green" : "text-text-dim/40"}`}>
                        {achieved ? "\u2713" : "\u25CB"}
                      </span>
                      <span className={`text-xs w-6 text-right ${achieved ? "text-green" : "text-text-dim"}`}>{m.count}</span>
                      <span className={`text-xs flex-1 ${achieved ? "text-green/80" : "text-text-dim"}`}>
                        {m.reward}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-text-dim text-center pt-1">
                Open the Spiros app for full milestone details and rewards.
              </p>
            </div>
          </section>
        )}

        {/* ═══════ SIGN OUT ═══════ */}
        <div className="text-center pt-2 pb-4">
          <button
            onClick={signOut}
            className="text-xs text-text-dim border-2 border-border-dark px-8 py-3 shadow-pixel hover:text-red hover:border-red/40 transition-all cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
