"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const SUPABASE_URL = "https://acdjnobbiwiobvmijans.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjZGpub2JiaXdpb2J2bWlqYW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MjA4NDAsImV4cCI6MjA4NzQ5Njg0MH0.DGdR8JhI5MeRduDaTuz6jIHz-kwCzaRThfwK9vOUS_g";

export default function SignupPageWrapper() {
  return (
    <Suspense fallback={<><Header /><main className="max-w-md mx-auto px-4 py-16"><p className="text-[9px] text-text-dim text-center">Loading...</p></main><Footer /></>}>
      <SignupPage />
    </Suspense>
  );
}

function SignupPage() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<null | { referrer_name: string }>(null);
  const [referralError, setReferralError] = useState("");
  const [referralChecking, setReferralChecking] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Auto-fill referral code from ?ref= URL param
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref.toUpperCase());
    }
  }, [searchParams]);

  // Debounced referral code validation
  const validateReferral = useCallback(async (code: string) => {
    if (!code || code.length !== 8) {
      setReferralValid(null);
      setReferralError("");
      return;
    }

    setReferralChecking(true);
    setReferralError("");
    setReferralValid(null);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-referral`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ code }),
      });
      const result = await res.json();
      if (result.valid) {
        setReferralValid({ referrer_name: result.referrer_name });
      } else {
        setReferralError(result.error || "Invalid code");
      }
    } catch {
      setReferralError("Could not validate code");
    }
    setReferralChecking(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (referralCode.length === 8) {
        validateReferral(referralCode);
      } else {
        setReferralValid(null);
        setReferralError("");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [referralCode, validateReferral]);

  useEffect(() => {
    if (!loading && user) {
      window.location.href = "/account";
    }
  }, [user, loading]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    const signupMeta: Record<string, string> = { display_name: displayName };
    const isReferred = referralValid !== null;

    if (isReferred) {
      signupMeta.referred_by_code = referralCode.trim().toUpperCase();
    }

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: signupMeta,
        emailRedirectTo: `https://spiros.app/auth/callback${isReferred ? "?referred=true" : ""}`,
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
            <div>
              <label className="block text-[9px] text-text-dim mb-2">Referral Code (optional)</label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="e.g. ABCD1234"
                className="w-full bg-bg-dark border-2 border-border-dark text-text-bright text-[9px] px-3 py-2 focus:border-gold outline-none uppercase"
              />
              {referralChecking && (
                <p className="text-[9px] text-text-dim mt-1">Checking code...</p>
              )}
              {referralValid && (
                <p className="text-[9px] text-green-400 mt-1">
                  Referred by {referralValid.referrer_name} — You&apos;ll get 7 days free Starter!
                </p>
              )}
              {referralError && (
                <p className="text-[9px] text-red-400 mt-1">{referralError}</p>
              )}
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
