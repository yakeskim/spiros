"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface Profile {
  display_name: string | null;
  level: number;
  xp: number;
  title: string | null;
  streak_current: number;
  streak_best: number;
  last_seen_at: string | null;
  tier: string | null;
  referred_by: string | null;
}

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  // Fetch profile and subscription tier in parallel
  const [profileRes, subRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, level, xp, title, streak_current, streak_best, last_seen_at, tier")
      .eq("id", userId)
      .single(),
    supabase
      .from("subscriptions")
      .select("tier, status")
      .eq("user_id", userId)
      .single(),
  ]);

  if (profileRes.error || !profileRes.data) return null;

  const profile = profileRes.data as Profile;

  // Subscription table is the source of truth for tier
  if (subRes.data && subRes.data.status === "active") {
    profile.tier = subRes.data.tier;
  } else if (!profile.tier) {
    profile.tier = "free";
  }

  return profile;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    setProfile(p);
  }, [user]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) {
        fetchProfile(newUser.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
