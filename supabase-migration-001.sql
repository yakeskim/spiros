-- =============================================
-- SYNCHRON — Migration 001: Online Presence + Friend Re-requests
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Add last_seen_at for online presence
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen
  ON public.profiles(last_seen_at DESC NULLS LAST);

-- 2. Allow deleting declined friendships (so users can re-request)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'friendships'
    AND policyname = 'Users can delete declined requests they sent'
  ) THEN
    CREATE POLICY "Users can delete declined requests they sent"
      ON public.friendships FOR DELETE USING (
        auth.uid() = requester_id AND status = 'declined'
      );
  END IF;
END $$;
