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

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

const MILESTONES = [
  { count: 1, label: "Recruiter", reward: '500 XP + "Recruiter" achievement' },
  { count: 3, label: "Squad Builder", reward: '"Referral Blue" avatar color' },
  { count: 5, label: "Team Captain", reward: '"Recruiter" profile frame + 1,000 XP' },
  { count: 10, label: "Commander", reward: "1 month free Starter" },
  { count: 25, label: "Ambassador", reward: '1 month free Pro + "Ambassador" title' },
  { count: 50, label: "Legend", reward: '"Legend" profile frame + permanent badge' },
];

export default function AccountPageWrapper() {
  return (
    <Suspense fallback={<><Header /><main className="max-w-2xl mx-auto px-4 py-16"><p className="text-[9px] text-text-dim text-center">Loading...</p></main><Footer /></>}>
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
        <main className="max-w-2xl mx-auto px-4 py-16">
          <p className="text-[9px] text-text-dim text-center">Loading...</p>
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
  const nextMilestone = MILESTONES.find(m => referralCount < m.count);

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-16 space-y-8">
        <h1 className="text-gold text-lg text-shadow-pixel text-center">Account</h1>

        {/* Trial Prompt Banner */}
        {showTrialPrompt && (
          <section className="bg-bg-dark border-2 border-gold shadow-pixel p-6 text-center space-y-3">
            <h2 className="text-[11px] text-gold">Welcome! Start Your Free Trial</h2>
            <p className="text-[8px] text-text-bright">
              You were referred by a friend! Enjoy 7 days of Starter for free.
            </p>
            <p className="text-[9px] text-text-dim">
              Card required. Auto-charges $3.99/mo after trial if not cancelled.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleStartTrial}
                disabled={trialLoading}
                className="text-[9px] text-bg-darkest bg-gold px-6 py-2 hover:bg-gold/80 cursor-pointer disabled:opacity-50"
              >
                {trialLoading ? "Loading..." : "Start 7-Day Free Trial"}
              </button>
              <button
                onClick={() => setShowTrialPrompt(false)}
                className="text-[8px] text-text-dim hover:text-text-bright cursor-pointer"
              >
                Maybe later
              </button>
            </div>
          </section>
        )}

        {/* Profile Card */}
        <section className="bg-bg-dark border-2 border-border-dark shadow-pixel p-6 space-y-4">
          <h2 className="text-[11px] text-text-bright mb-4">Profile</h2>

          {/* Display Name */}
          <div className="flex items-center gap-3">
            <span className="text-[8px] text-text-dim w-24 shrink-0">Display Name</span>
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={20}
                  className="flex-1 bg-bg-darkest border-2 border-border-dark text-text-bright text-[9px] px-2 py-1 focus:border-gold outline-none"
                />
                <button
                  onClick={handleNameSave}
                  disabled={nameSaving}
                  className="text-[8px] text-bg-darkest bg-gold px-3 py-1 hover:bg-gold/80 cursor-pointer disabled:opacity-50"
                >
                  {nameSaving ? "..." : "Save"}
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameError(""); }}
                  className="text-[8px] text-text-dim hover:text-text-bright cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-[9px] text-text-bright">{profile?.display_name ?? "—"}</span>
                <button
                  onClick={() => { setEditingName(true); setNewName(profile?.display_name ?? ""); }}
                  className="text-[9px] text-text-dim hover:text-gold cursor-pointer"
                >
                  [edit]
                </button>
              </div>
            )}
          </div>
          {nameError && <p className="text-[9px] text-red-400 ml-24">{nameError}</p>}

          {/* Email */}
          <div className="flex items-center gap-3">
            <span className="text-[8px] text-text-dim w-24 shrink-0">Email</span>
            <span className="text-[9px] text-text-bright">{user.email}</span>
          </div>

          {/* Change Password */}
          <div className="pt-2">
            {passwordSuccess && (
              <p className="text-[8px] text-green-400 mb-2">Password updated successfully!</p>
            )}
            {!showPasswordForm ? (
              <button
                onClick={() => { setShowPasswordForm(true); setPasswordSuccess(false); }}
                className="text-[8px] text-text-dim hover:text-gold cursor-pointer"
              >
                Change password
              </button>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-3 max-w-xs">
                {passwordError && <p className="text-[9px] text-red-400">{passwordError}</p>}
                <div>
                  <label className="block text-[8px] text-text-dim mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="6+ characters"
                    className="w-full bg-bg-darkest border-2 border-border-dark text-text-bright text-[9px] px-2 py-1 focus:border-gold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[8px] text-text-dim mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Repeat password"
                    className="w-full bg-bg-darkest border-2 border-border-dark text-text-bright text-[9px] px-2 py-1 focus:border-gold outline-none"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="text-[8px] text-bg-darkest bg-gold px-4 py-1 hover:bg-gold/80 cursor-pointer disabled:opacity-50"
                  >
                    {passwordSaving ? "Saving..." : "Update Password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPasswordForm(false); setPasswordError(""); }}
                    className="text-[8px] text-text-dim hover:text-text-bright cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Subscription */}
        <section className="bg-bg-dark border-2 border-border-dark shadow-pixel p-6 space-y-4">
          <h2 className="text-[11px] text-text-bright mb-4">Subscription</h2>

          <div className="flex items-center gap-3">
            <span className="text-[8px] text-text-dim w-24 shrink-0">Current Tier</span>
            <span
              className={`text-[10px] font-pixel ${
                userTier === "max"
                  ? "text-purple"
                  : userTier === "pro"
                  ? "text-gold"
                  : userTier === "starter"
                  ? "text-green"
                  : "text-text-dim"
              }`}
            >
              {userTier === "max"
                ? "MAX"
                : userTier === "pro"
                ? "PRO"
                : userTier === "starter"
                ? "STARTER"
                : "FREE"}
            </span>
          </div>

          <a
            href="/settings/subscription"
            className="text-[9px] text-gold hover:underline transition-colors inline-block"
          >
            {userTier === "free" ? "Upgrade your tier" : "Manage subscription"} &#8594;
          </a>
        </section>

        {/* Referral Program */}
        {referralCode && (
          <section className="bg-bg-dark border-2 border-border-dark shadow-pixel p-6 space-y-4">
            <h2 className="text-[11px] text-text-bright mb-4">Referral Program</h2>

            {/* Referral Code */}
            <div className="flex items-center gap-3">
              <span className="text-[8px] text-text-dim w-24 shrink-0">Your Code</span>
              <span className="text-[11px] text-gold tracking-widest">{referralCode}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyCode}
                className="text-[8px] text-bg-darkest bg-gold px-3 py-1 hover:bg-gold/80 cursor-pointer"
              >
                {codeCopied ? "Copied!" : "Copy Code"}
              </button>
              <button
                onClick={handleCopyLink}
                className="text-[8px] text-text-dim border border-border-dark px-3 py-1 hover:text-gold hover:border-gold cursor-pointer"
              >
                {linkCopied ? "Copied!" : "Share Link"}
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 pt-2">
              <div>
                <p className="text-[9px] text-text-dim">Total Referrals</p>
                <p className="text-gold text-sm text-shadow-pixel">{referralCount}</p>
              </div>
              {nextMilestone && (
                <div>
                  <p className="text-[9px] text-text-dim">Next Reward</p>
                  <p className="text-[8px] text-text-bright">
                    {nextMilestone.count - referralCount} more for {nextMilestone.label}
                  </p>
                </div>
              )}
            </div>

            {/* Milestone preview */}
            <div className="pt-2 space-y-1">
              {MILESTONES.map((m) => (
                <div
                  key={m.count}
                  className={`flex items-center gap-2 text-[9px] ${
                    referralCount >= m.count ? "text-green-400" : "text-text-dim opacity-60"
                  }`}
                >
                  <span>{referralCount >= m.count ? "[x]" : "[ ]"}</span>
                  <span className="w-6 text-right">{m.count}</span>
                  <span>- {m.reward}</span>
                </div>
              ))}
            </div>

            <p className="text-[9px] text-text-dim text-center pt-2">
              Open the Spiros app for full milestone details and rewards.
            </p>
          </section>
        )}

        {/* Stats Panel */}
        <section className="bg-bg-dark border-2 border-border-dark shadow-pixel p-6 space-y-4">
          <h2 className="text-[11px] text-text-bright mb-4">Stats</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Level */}
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[9px] text-text-dim mb-1">Level</p>
              <p className="text-gold text-sm text-shadow-pixel">{level}</p>
            </div>

            {/* Title */}
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[9px] text-text-dim mb-1">Title</p>
              <p className={`text-[9px] ${titleColor}`}>{profile?.title ?? "Novice"}</p>
            </div>

            {/* XP */}
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-[9px] text-text-dim mb-1">XP</p>
              <p className="text-[9px] text-text-bright">{xp} / {xpNeeded}</p>
              <div className="mt-2 h-2 bg-bg-dark border border-border-dark relative overflow-hidden">
                <div
                  className="h-full bg-gold xp-bar-shine"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>

            {/* Current Streak */}
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[9px] text-text-dim mb-1">Current Streak</p>
              <p className="text-orange text-sm text-shadow-pixel">{profile?.streak_current ?? 0}</p>
              <p className="text-[9px] text-text-dim">days</p>
            </div>

            {/* Best Streak */}
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[9px] text-text-dim mb-1">Best Streak</p>
              <p className="text-gold text-sm text-shadow-pixel">{profile?.streak_best ?? 0}</p>
              <p className="text-[9px] text-text-dim">days</p>
            </div>
          </div>
        </section>

        {/* Social Preview */}
        <section className="bg-bg-dark border-2 border-border-dark shadow-pixel p-6 space-y-4">
          <h2 className="text-[11px] text-text-bright mb-4">Social</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[9px] text-text-dim mb-1">Friends</p>
              <p className="text-blue text-sm text-shadow-pixel">
                {friendsCount !== null ? friendsCount : "—"}
              </p>
            </div>
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[9px] text-text-dim mb-1">Last Active</p>
              <p className="text-[8px] text-text-bright">
                {profile?.last_seen_at
                  ? new Date(profile.last_seen_at).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          <p className="text-[9px] text-text-dim text-center pt-2">
            Open the Spiros app for full social features.
          </p>
        </section>

        {/* Sign Out */}
        <div className="text-center pt-4">
          <button
            onClick={signOut}
            className="text-[9px] text-text-dim border-2 border-border-dark px-6 py-2 hover:text-red hover:border-red transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
