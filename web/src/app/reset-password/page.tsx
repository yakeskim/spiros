"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const SUPABASE_URL = "https://acdjnobbiwiobvmijans.supabase.co";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"form" | "loading" | "success" | "error">("loading");
  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    // Supabase redirects with tokens in the URL hash:
    // #access_token=...&refresh_token=...&type=recovery
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const type = params.get("type");

    if (token && type === "recovery") {
      setAccessToken(token);
      setStatus("form");
    } else {
      setError("Invalid or expired reset link. Please request a new one from the app.");
      setStatus("error");
    }
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

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: accessToken,
        },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json();
        setError(data.msg || data.error_description || "Failed to reset password. The link may have expired.");
        setStatus("form");
      }
    } catch {
      setError("Network error. Please try again.");
      setStatus("form");
    }
  }

  return (
    <>
      <Header />
      <main className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-gold text-lg text-shadow-pixel mb-8 text-center">Reset Password</h1>

        {status === "loading" && (
          <p className="text-[9px] text-text-dim text-center">Loading...</p>
        )}

        {status === "error" && (
          <div className="text-center">
            <p className="text-[9px] text-red-400 mb-6">{error}</p>
            <a href="/" className="text-[9px] text-gold hover:underline">Back to home</a>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <p className="text-[9px] text-green-400 mb-4">Password updated successfully!</p>
            <p className="text-[9px] text-text-dim">You can now log in with your new password in the Spiros app.</p>
          </div>
        )}

        {status === "form" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-[8px] text-red-400 text-center">{error}</p>
            )}
            <div>
              <label className="block text-[9px] text-text-dim mb-2">New Password</label>
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
              <label className="block text-[9px] text-text-dim mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                placeholder="Repeat password"
                className="w-full bg-bg-dark border-2 border-border-dark text-text-bright text-[9px] px-3 py-2 focus:border-gold outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gold text-bg-darkest text-[9px] py-3 hover:bg-gold/80 transition-colors cursor-pointer"
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
