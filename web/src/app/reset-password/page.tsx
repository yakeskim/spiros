"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"form" | "loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    // If we arrived here via /auth/callback, the Supabase client already has
    // the session from the recovery token. If we arrived directly with hash
    // tokens (legacy links), Supabase auto-detects them on init.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("form");
      } else {
        setError("Invalid or expired reset link. Please request a new one.");
        setStatus("error");
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("loading");
    setError("");

    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(err.message);
      setStatus("form");
    } else {
      setStatus("success");
    }
  }

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-gold text-lg text-shadow-pixel mb-8 text-center">Reset Password</h1>

        {status === "loading" && (
          <p className="text-[11px] text-text-dim text-center">Loading...</p>
        )}

        {status === "error" && (
          <div className="text-center">
            <p className="text-[11px] text-red-400 mb-6">{error}</p>
            <a href="/login" className="text-[11px] text-gold hover:underline">Go to login</a>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <p className="text-[11px] text-green-400 mb-4">Password updated successfully!</p>
            <p className="text-[11px] text-text-dim mb-4">You can now log in with your new password.</p>
            <a href="/login" className="text-[11px] text-gold hover:underline">Go to login</a>
          </div>
        )}

        {status === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-[10px] text-red-400 text-center">{error}</p>
            )}
            <div>
              <label className="block text-[11px] text-text-dim mb-2">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="6+ characters"
                className="w-full bg-bg-dark border-2 border-border-dark text-text-bright text-[11px] px-3 py-2 focus:border-gold outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-text-dim mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                placeholder="Repeat password"
                className="w-full bg-bg-dark border-2 border-border-dark text-text-bright text-[11px] px-3 py-2 focus:border-gold outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gold text-bg-darkest text-[11px] py-3 hover:bg-gold/80 transition-colors cursor-pointer"
            >
              Update Password
            </button>
          </form>
        )}
      </main>
      <Footer />
    </>
  );
}
