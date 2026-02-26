"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      window.location.href = "/account";
    }
  }, [user, loading]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err) {
      setError(err.message);
      setSubmitting(false);
    }
    // On success, onAuthStateChange fires and the useEffect above redirects
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://spiros.app/auth/callback",
    });

    setSubmitting(false);
    if (err) {
      setError(err.message);
    } else {
      setResetSent(true);
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="max-w-md mx-auto px-4 py-16">
          <p className="text-[9px] text-text-dim text-center">Loading...</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-gold text-lg text-shadow-pixel mb-8 text-center">
          {forgotMode ? "Forgot Password" : "Login"}
        </h1>

        {!forgotMode ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {error && <p className="text-[8px] text-red-400 text-center">{error}</p>}
            <div>
              <label className="block text-[9px] text-text-dim mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-bg-dark border-2 border-border-dark text-text-bright text-[9px] px-3 py-2 focus:border-gold outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-dim mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Your password"
                className="w-full bg-bg-dark border-2 border-border-dark text-text-bright text-[9px] px-3 py-2 focus:border-gold outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gold text-bg-darkest text-[9px] py-3 hover:bg-gold/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Logging in..." : "Login"}
            </button>
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => { setForgotMode(true); setError(""); }}
                className="text-[8px] text-text-dim hover:text-gold transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
              <a href="/signup" className="text-[8px] text-gold hover:underline">
                Create account
              </a>
            </div>
          </form>
        ) : resetSent ? (
          <div className="text-center">
            <p className="text-[9px] text-green-400 mb-4">Check your email for a reset link.</p>
            <button
              type="button"
              onClick={() => { setForgotMode(false); setResetSent(false); setError(""); }}
              className="text-[8px] text-gold hover:underline cursor-pointer"
            >
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {error && <p className="text-[8px] text-red-400 text-center">{error}</p>}
            <p className="text-[8px] text-text-dim text-center mb-2">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <div>
              <label className="block text-[9px] text-text-dim mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-bg-dark border-2 border-border-dark text-text-bright text-[9px] px-3 py-2 focus:border-gold outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gold text-bg-darkest text-[9px] py-3 hover:bg-gold/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send Reset Link"}
            </button>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setForgotMode(false); setError(""); }}
                className="text-[8px] text-text-dim hover:text-gold transition-colors cursor-pointer"
              >
                Back to login
              </button>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </>
  );
}
