-- =============================================
-- SPIROS — Migration 002: Community Projects, Chat, Profile Name Rate-Limit
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Profile rate-limit columns for display_name changes (2x/month)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name_changed_count integer DEFAULT 0;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name_changed_month text DEFAULT NULL;

-- 2. Community Projects
CREATE TABLE public.community_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  url text NOT NULL CHECK (url ~ '^https?://'),
  category text NOT NULL CHECK (category IN ('SaaS', 'Social', 'Creative', 'Dev Tools', 'Other')),
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_community_projects_user ON public.community_projects(user_id);
CREATE INDEX idx_community_projects_category ON public.community_projects(category);
CREATE INDEX idx_community_projects_created ON public.community_projects(created_at DESC);

-- 3. Project Votes
CREATE TABLE public.project_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.community_projects ON DELETE CASCADE NOT NULL,
  vote_type text NOT NULL CHECK (vote_type IN ('up', 'down')),
  UNIQUE(user_id, project_id)
);

CREATE INDEX idx_project_votes_project ON public.project_votes(project_id);

-- 4. Project Comments
CREATE TABLE public.project_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.community_projects ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_project_comments_project ON public.project_comments(project_id, created_at);

-- 5. Chat Messages (category channels)
CREATE TABLE public.chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel text NOT NULL CHECK (channel IN ('General', 'Help', 'SaaS', 'Social', 'Creative', 'Dev Tools', 'Other')),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  display_name text NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_messages_channel ON public.chat_messages(channel, created_at DESC);

-- 6. Direct Messages
CREATE TABLE public.direct_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz DEFAULT now(),
  read_at timestamptz DEFAULT NULL
);

CREATE INDEX idx_direct_messages_pair ON public.direct_messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_direct_messages_receiver ON public.direct_messages(receiver_id, created_at DESC);

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE public.community_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Community Projects: authenticated can read all, owners manage own
CREATE POLICY "Authenticated users can view community projects"
  ON public.community_projects FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own community projects"
  ON public.community_projects FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own community projects"
  ON public.community_projects FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own community projects"
  ON public.community_projects FOR DELETE USING (auth.uid() = user_id);

-- Project Votes: authenticated can read, users manage own
CREATE POLICY "Authenticated users can view votes"
  ON public.project_votes FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own votes"
  ON public.project_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON public.project_votes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON public.project_votes FOR DELETE USING (auth.uid() = user_id);

-- Project Comments: authenticated can read, users manage own
CREATE POLICY "Authenticated users can view comments"
  ON public.project_comments FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own comments"
  ON public.project_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.project_comments FOR DELETE USING (auth.uid() = user_id);

-- Chat Messages: authenticated can read and insert own
CREATE POLICY "Authenticated users can view chat messages"
  ON public.chat_messages FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own chat messages"
  ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Direct Messages: only sender/receiver can view, sender can insert
CREATE POLICY "Users can view own direct messages"
  ON public.direct_messages FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "Users can send direct messages to accepted friends"
  ON public.direct_messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = direct_messages.receiver_id)
        OR (addressee_id = auth.uid() AND requester_id = direct_messages.receiver_id)
      )
    )
  );

-- =============================================
-- Vote sync trigger: recalculate upvotes/downvotes on community_projects
-- =============================================
CREATE OR REPLACE FUNCTION public.sync_project_votes()
RETURNS trigger AS $$
DECLARE
  target_project_id uuid;
BEGIN
  -- Determine which project to update
  IF TG_OP = 'DELETE' THEN
    target_project_id := OLD.project_id;
  ELSE
    target_project_id := NEW.project_id;
  END IF;

  UPDATE public.community_projects SET
    upvotes = (SELECT COUNT(*) FROM public.project_votes WHERE project_id = target_project_id AND vote_type = 'up'),
    downvotes = (SELECT COUNT(*) FROM public.project_votes WHERE project_id = target_project_id AND vote_type = 'down'),
    updated_at = now()
  WHERE id = target_project_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vote_change
  AFTER INSERT OR UPDATE OR DELETE ON public.project_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_project_votes();

-- Updated_at triggers for new tables
CREATE TRIGGER community_projects_updated_at
  BEFORE UPDATE ON public.community_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
