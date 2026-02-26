-- 002_tier_restructure.sql — Restructure tiers: free/pro/team → free/starter/pro/max
-- Run this in Supabase SQL Editor AFTER 001_subscriptions.sql

-- ===== Migrate existing team → max =====
UPDATE subscriptions SET tier = 'max' WHERE tier = 'team';
UPDATE profiles SET tier = 'max' WHERE tier = 'team';

-- ===== Update CHECK constraint on subscriptions.tier =====
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('free', 'starter', 'pro', 'max'));

-- ===== Update profiles.tier (add constraint if not exists) =====
-- profiles.tier has no CHECK by default, but add one for safety
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tier_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_tier_check
      CHECK (tier IN ('free', 'starter', 'pro', 'max'));
  END IF;
END$$;
