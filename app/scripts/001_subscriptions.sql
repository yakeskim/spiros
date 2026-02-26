-- 001_subscriptions.sql — Subscription system schema
-- Run this in Supabase SQL Editor

-- ===== Subscriptions table =====
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team')),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ===== Profile columns for subscription features =====
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS avatar_color text,
  ADD COLUMN IF NOT EXISTS profile_frame text,
  ADD COLUMN IF NOT EXISTS custom_title text,
  ADD COLUMN IF NOT EXISTS streak_freezes_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_freeze_last_reset text;

-- ===== Chat rate limiting table =====
CREATE TABLE IF NOT EXISTS chat_rate_limits (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  message_count integer DEFAULT 0,
  reset_date text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ===== RLS Policies =====
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert/update subscriptions (webhook)
CREATE POLICY "Service role manages subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read/update their own rate limits
CREATE POLICY "Users can manage own rate limits"
  ON chat_rate_limits FOR ALL
  USING (auth.uid() = user_id);

-- ===== Trigger: sync tier from subscriptions to profiles =====
CREATE OR REPLACE FUNCTION sync_tier_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET tier = NEW.tier
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_subscription_tier_change
  AFTER INSERT OR UPDATE OF tier ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_tier_to_profile();

-- ===== Trigger: updated_at on subscriptions =====
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- ===== Enable Realtime on subscriptions =====
ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;

-- ===== Index for faster lookups =====
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
