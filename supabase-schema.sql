-- =============================================
-- SYNCHRON — Supabase Database Schema
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  avatar_url text,
  bio text,
  level integer default 1,
  xp integer default 0,
  title text default 'Novice',
  streak_current integer default 0,
  streak_best integer default 0,
  last_seen_at timestamptz default null,
  display_name_changed_count integer default 0,
  display_name_changed_month text default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Activity days (synced from desktop app)
create table public.activity_days (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  summary jsonb default '{}'::jsonb,
  entries jsonb default '[]'::jsonb,
  updated_at timestamptz default now(),
  unique(user_id, date)
);

-- 3. Friendships
create table public.friendships (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references auth.users on delete cascade not null,
  addressee_id uuid references auth.users on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- =============================================
-- Indexes
-- =============================================
create index idx_activity_user_date on public.activity_days(user_id, date);
create index idx_friendships_requester on public.friendships(requester_id);
create index idx_friendships_addressee on public.friendships(addressee_id);
create index idx_profiles_display_name on public.profiles(display_name);

-- =============================================
-- Row Level Security
-- =============================================
alter table public.profiles enable row level security;
alter table public.activity_days enable row level security;
alter table public.friendships enable row level security;

-- Profiles: anyone can read, users update their own
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Activity: users manage their own data
create policy "Users can manage own activity"
  on public.activity_days for all using (auth.uid() = user_id);

-- Activity: accepted friends can view your data
create policy "Friends can view activity"
  on public.activity_days for select using (
    exists (
      select 1 from public.friendships
      where status = 'accepted'
      and (
        (requester_id = auth.uid() and addressee_id = activity_days.user_id)
        or (addressee_id = auth.uid() and requester_id = activity_days.user_id)
      )
    )
  );

-- Friendships: users see their own
create policy "Users can view own friendships"
  on public.friendships for select using (
    auth.uid() = requester_id or auth.uid() = addressee_id
  );

create policy "Users can send friend requests"
  on public.friendships for insert with check (auth.uid() = requester_id);

create policy "Users can respond to friend requests"
  on public.friendships for update using (auth.uid() = addressee_id);

create policy "Users can remove friendships"
  on public.friendships for delete using (
    auth.uid() = requester_id or auth.uid() = addressee_id
  );

-- =============================================
-- Auto-create profile on signup
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- Updated_at auto-update
-- =============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger activity_days_updated_at
  before update on public.activity_days
  for each row execute function public.update_updated_at();
