"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function SignupPage() {
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      window.location.href = "/account";
    }
  }, [user, loading]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: "https://spiros.app/auth/callback",
      },
    });

    setSubmitting(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
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
        <h1 className="text-gold text-lg text-shadow-pixel mb-8 text-center">Create Account</h1>

        {success ? (
          <div className="text-center">
            <p className="text-[9px] text-green-400 mb-4">Check your email to confirm your account.</p>
            <a href="/login" className="text-[8px] text-gold hover:underline">
              Go to login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            {error && <p className="text-[8px] text-red-400 text-center">{error}</p>}
            <div>
              <label className="block text-[9px] text-text-dim mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full bg-bg-dark border-2 border-border-dark text-text-bright text-[9px] px-3 py-2 focus:border-gold outline-none"
              />
            </div>
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
                placeholder="6+ characters"
                className="w-full bg-bg-dark border-2 border-border-dark text-text-bright text-[9px] px-3 py-2 focus:border-gold outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gold text-bg-darkest text-[9px] py-3 hover:bg-gold/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Creating account..." : "Sign Up"}
            </button>
            <div className="text-center pt-2">
              <a href="/login" className="text-[8px] text-text-dim hover:text-gold transition-colors">
                Already have an account? Login
              </a>
            </div>
          </form>
        )}
      </main>
      <Footer />
    </>
  );
}
