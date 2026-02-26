"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    // Supabase auto-detects hash tokens (#access_token=...&type=...) on init.
    // We just need to read the type and redirect accordingly.
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const type = params.get("type");

    // Give Supabase client a moment to process the hash tokens
    supabase.auth.getSession().then(({ data: { session }, error: err }) => {
      if (err) {
        setError(err.message);
        return;
      }

      if (type === "recovery") {
        window.location.href = "/reset-password";
      } else if (type === "signup" || type === "email_change") {
        window.location.href = "/account";
      } else if (session) {
        window.location.href = "/account";
      } else {
        window.location.href = "/login";
      }
    });
  }, []);

  if (error) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-[9px] text-red-400 mb-6">{error}</p>
        <a href="/login" className="text-[9px] text-gold hover:underline">Go to Login</a>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-[9px] text-text-dim">Redirecting...</p>
    </main>
  );
}
