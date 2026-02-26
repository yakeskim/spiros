"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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

export default function AccountPage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();

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

  async function handleNameSave() {
    if (!user || !newName.trim()) return;
    setNameError("");
    setNameSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: newName.trim() })
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

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
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

  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-16 space-y-8">
        <h1 className="text-gold text-lg text-shadow-pixel text-center">Account</h1>

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
                  className="text-[7px] text-text-dim hover:text-gold cursor-pointer"
                >
                  [edit]
                </button>
              </div>
            )}
          </div>
          {nameError && <p className="text-[7px] text-red-400 ml-24">{nameError}</p>}

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
                {passwordError && <p className="text-[7px] text-red-400">{passwordError}</p>}
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

        {/* Stats Panel */}
        <section className="bg-bg-dark border-2 border-border-dark shadow-pixel p-6 space-y-4">
          <h2 className="text-[11px] text-text-bright mb-4">Stats</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {/* Level */}
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[7px] text-text-dim mb-1">Level</p>
              <p className="text-gold text-sm text-shadow-pixel">{level}</p>
            </div>

            {/* Title */}
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[7px] text-text-dim mb-1">Title</p>
              <p className={`text-[9px] ${titleColor}`}>{profile?.title ?? "Novice"}</p>
            </div>

            {/* XP */}
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-[7px] text-text-dim mb-1">XP</p>
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
              <p className="text-[7px] text-text-dim mb-1">Current Streak</p>
              <p className="text-orange text-sm text-shadow-pixel">{profile?.streak_current ?? 0}</p>
              <p className="text-[7px] text-text-dim">days</p>
            </div>

            {/* Best Streak */}
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[7px] text-text-dim mb-1">Best Streak</p>
              <p className="text-gold text-sm text-shadow-pixel">{profile?.streak_best ?? 0}</p>
              <p className="text-[7px] text-text-dim">days</p>
            </div>
          </div>
        </section>

        {/* Social Preview */}
        <section className="bg-bg-dark border-2 border-border-dark shadow-pixel p-6 space-y-4">
          <h2 className="text-[11px] text-text-bright mb-4">Social</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[7px] text-text-dim mb-1">Friends</p>
              <p className="text-blue text-sm text-shadow-pixel">
                {friendsCount !== null ? friendsCount : "—"}
              </p>
            </div>
            <div className="bg-bg-darkest border-2 border-border-dark p-3 text-center">
              <p className="text-[7px] text-text-dim mb-1">Last Active</p>
              <p className="text-[8px] text-text-bright">
                {profile?.last_seen_at
                  ? new Date(profile.last_seen_at).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          <p className="text-[7px] text-text-dim text-center pt-2">
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
