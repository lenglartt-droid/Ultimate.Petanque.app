-- ============================================================
-- Ultimate Petanque — Complete Database Schema
-- Generated: 2026-04-10
-- Backend: OnSpace Cloud (Supabase-compatible PostgreSQL)
-- ============================================================

-- ============================================================
-- 1. HELPER FUNCTIONS
-- ============================================================

-- Check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and is_admin = true
  );
$$;

-- Check if current user is meetup creator
create or replace function public.is_meetup_creator(meetup_uuid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.terrain_meetups
    where id = meetup_uuid and creator_id = auth.uid()
  );
$$;

-- Handle new user registration (auto-create profile)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- Sync user metadata changes
create or replace function public.sync_user_metadata()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.user_profiles
  set email = new.email
  where id = new.id and email != new.email;
  return new;
end;
$$;

-- Log soft deletes before actual deletion
create or replace function public.log_soft_delete()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.soft_deletes (user_id, table_name, item_id)
  values (old.user_id, tg_table_name, old.id);
  return old;
end;
$$;

-- Get community statistics (used by admin dashboard)
create or replace function public.get_community_stats()
returns json
language sql
security definer
stable
as $$
  select json_build_object(
    'total_users', (select count(*) from public.user_profiles),
    'total_matches', (select count(*) from public.matches),
    'total_challenges', (select count(*) from public.challenges),
    'total_clubs', (select count(*) from public.clubs),
    'total_terrains', (select count(*) from public.terrains),
    'total_tournaments', (select count(*) from public.tournaments)
  );
$$;

-- Get premium user IDs
create or replace function public.get_premium_user_ids()
returns uuid[]
language sql
security definer
stable
as $$
  select array_agg(id) from public.user_profiles where is_premium = true;
$$;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- -----------------------------------------------------------
-- user_profiles — Core user data (auto-synced from auth.users)
-- -----------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  username text,
  email text not null,
  role text default 'Milieu',
  level text default 'Intermédiaire',
  club text,
  avatar text,
  consent_accepted boolean not null default false,
  consent_date timestamptz,
  is_public_profile boolean not null default false,
  federation_card_url text,
  is_premium boolean not null default false,
  is_admin boolean not null default false,
  xp integer not null default 0,
  experience text,
  created_at timestamptz default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can view own profile" on public.user_profiles for select to authenticated using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update to authenticated using (auth.uid() = id);
create policy "Users can delete own profile" on public.user_profiles for delete to authenticated using (auth.uid() = id);
create policy "admin_select_all_user_profiles" on public.user_profiles for select to authenticated using (is_admin());
create policy "admin_update_all_user_profiles" on public.user_profiles for update to authenticated using (is_admin());

-- -----------------------------------------------------------
-- players — Player profiles with stats and ELO
-- -----------------------------------------------------------
create table if not exists public.players (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  avatar text,
  club text,
  club_id uuid,
  role text not null default 'Milieu',
  level text not null default 'Intermédiaire',
  location jsonb,
  stats jsonb default '{"wins": 0, "losses": 0, "tirRate": 0, "winRate": 0, "pointRate": 0, "carreauRate": 0, "matchesPlayed": 0, "avgPointsScored": 0, "avgPointsConceded": 0}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  phone text,
  email text,
  country text default 'France',
  nickname text,
  boules jsonb,
  is_public boolean not null default false,
  handedness text,
  terrain_id uuid references public.terrains(id) on delete set null,
  terrain_name text,
  show_contact_public boolean not null default false,
  elo_rating integer not null default 1000,
  elo_tireur integer not null default 1000,
  elo_pointeur integer not null default 1000,
  elo_milieu integer not null default 1000,
  last_match_date timestamptz,
  experience text,
  city text
);

alter table public.players enable row level security;

create index idx_players_city on public.players using btree (city);
create index idx_players_country on public.players using btree (country);
create index idx_players_elo_rating on public.players using btree (elo_rating);
create index idx_players_last_match_date on public.players using btree (last_match_date);

create policy "authenticated_select_own_players" on public.players for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_players" on public.players for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_players" on public.players for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_players" on public.players for delete to authenticated using (user_id = auth.uid());
create policy "public_select_players" on public.players for select using (is_public = true);
create policy "shared_select_players" on public.players for select to authenticated using (exists (select 1 from shared_items si where si.item_type = 'player' and si.item_id = players.id and (si.shared_with_id = auth.uid() or si.is_public_link = true)));
create policy "shared_update_players" on public.players for update to authenticated using (exists (select 1 from shared_items si where si.item_type = 'player' and si.item_id = players.id and si.shared_with_id = auth.uid() and si.permission = 'write'));

-- -----------------------------------------------------------
-- matches — Match records with detailed scoring
-- -----------------------------------------------------------
create table if not exists public.matches (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  date timestamptz not null default now(),
  mode text not null default 'Entraînement',
  format text not null default 'Doublette',
  tournament_id uuid references public.tournaments(id) on delete set null,
  tournament_name text,
  tournament_phase text,
  tournament_bracket text,
  bracket_match_id text,
  team_a jsonb not null,
  team_b jsonb not null,
  winner text not null,
  duration integer default 0,
  menes jsonb default '[]'::jsonb,
  player_actions jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  series_info jsonb,
  terrain_id uuid references public.terrains(id) on delete set null,
  terrain_type text,
  boules_set_id uuid references public.boules_sets(id) on delete set null,
  participant_user_ids uuid[] default '{}'::uuid[],
  notes text,
  witness_count integer not null default 0,
  is_attested boolean not null default false
);

alter table public.matches enable row level security;

create index idx_matches_participant_user_ids on public.matches using gin (participant_user_ids);

create policy "authenticated_select_own_matches" on public.matches for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_matches" on public.matches for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_matches" on public.matches for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_matches" on public.matches for delete to authenticated using (user_id = auth.uid());
create policy "participant_select_shared_matches" on public.matches for select to authenticated using (exists (select 1 from match_share_requests msr where msr.item_type = 'match' and msr.item_id = matches.id and msr.recipient_user_id = auth.uid() and msr.status = 'accepted'));
create policy "participant_update_shared_matches" on public.matches for update to authenticated using (exists (select 1 from match_share_requests msr where msr.item_type = 'match' and msr.item_id = matches.id and msr.recipient_user_id = auth.uid() and msr.status = 'accepted' and msr.permission = 'write'));
create policy "shared_select_matches" on public.matches for select to authenticated using (exists (select 1 from shared_items si where si.item_type = 'match' and si.item_id = matches.id and (si.shared_with_id = auth.uid() or si.is_public_link = true)));

-- -----------------------------------------------------------
-- challenges — Shooting challenges and drills
-- -----------------------------------------------------------
create table if not exists public.challenges (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  type text not null,
  date timestamptz not null default now(),
  player_id uuid,
  player_name text,
  shots jsonb,
  success_count integer,
  total_shots integer,
  carreau_count integer,
  success_rate numeric(5,2),
  precision_shots jsonb,
  total_points integer,
  max_points integer,
  atelier_scores jsonb,
  duration integer,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  mode text default 'solo',
  opponent_id uuid,
  opponent_name text,
  opponent_result jsonb,
  winner text,
  series_info jsonb,
  detailed_shots jsonb,
  boules_set_id uuid references public.boules_sets(id) on delete set null,
  terrain_id uuid references public.terrains(id) on delete set null,
  sponsor_id uuid references public.ambassadors(id) on delete set null,
  sponsor_name text,
  sponsor_photo text,
  participant_user_ids uuid[] default '{}'::uuid[],
  witness_count integer not null default 0,
  is_attested boolean not null default false
);

alter table public.challenges enable row level security;

create index idx_challenges_participant_user_ids on public.challenges using gin (participant_user_ids);
create index idx_challenges_sponsor on public.challenges using btree (sponsor_id);

create policy "authenticated_select_own_challenges" on public.challenges for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_challenges" on public.challenges for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_challenges" on public.challenges for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_challenges" on public.challenges for delete to authenticated using (user_id = auth.uid());
create policy "participant_select_shared_challenges" on public.challenges for select to authenticated using (exists (select 1 from match_share_requests msr where msr.item_type = 'challenge' and msr.item_id = challenges.id and msr.recipient_user_id = auth.uid() and msr.status = 'accepted'));
create policy "participant_update_shared_challenges" on public.challenges for update to authenticated using (exists (select 1 from match_share_requests msr where msr.item_type = 'challenge' and msr.item_id = challenges.id and msr.recipient_user_id = auth.uid() and msr.status = 'accepted' and msr.permission = 'write'));
create policy "shared_select_challenges" on public.challenges for select to authenticated using (exists (select 1 from shared_items si where si.item_type = 'challenge' and si.item_id = challenges.id and (si.shared_with_id = auth.uid() or si.is_public_link = true)));

-- -----------------------------------------------------------
-- tournaments — Tournament management
-- -----------------------------------------------------------
create table if not exists public.tournaments (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  date date not null,
  end_date date,
  type text not null default 'Mixte',
  format text not null default 'Doublette',
  location jsonb not null,
  club_id uuid,
  club_name text,
  status text not null default 'À venir',
  participants integer default 0,
  max_participants integer default 32,
  prize text,
  description text,
  teams jsonb,
  phases jsonb,
  current_phase_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  terrain_id uuid references public.terrains(id) on delete set null,
  terrain_name text,
  terrain_type text,
  tournament_level text,
  tournament_category text,
  registration_type text,
  tournament_scope text,
  registration_cost numeric(10,2),
  prize_won numeric(10,2),
  final_result text,
  is_public boolean not null default false
);

alter table public.tournaments enable row level security;

create policy "authenticated_select_own_tournaments" on public.tournaments for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_tournaments" on public.tournaments for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_tournaments" on public.tournaments for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_tournaments" on public.tournaments for delete to authenticated using (user_id = auth.uid());
create policy "public_select_tournaments" on public.tournaments for select using (is_public = true);
create policy "shared_select_tournaments" on public.tournaments for select to authenticated using (exists (select 1 from shared_items si where si.item_type = 'tournament' and si.item_id = tournaments.id and (si.shared_with_id = auth.uid() or si.is_public_link = true)));
create policy "shared_update_tournaments" on public.tournaments for update to authenticated using (exists (select 1 from shared_items si where si.item_type = 'tournament' and si.item_id = tournaments.id and si.shared_with_id = auth.uid() and si.permission = 'write'));

-- -----------------------------------------------------------
-- terrains — Playing courts/terrains
-- -----------------------------------------------------------
create table if not exists public.terrains (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  address text not null,
  city text not null,
  location jsonb not null default '{"latitude": 0, "longitude": 0}'::jsonb,
  type text not null,
  description text,
  facilities text[],
  photos text[],
  club_id uuid references public.clubs(id) on delete set null,
  club_name text,
  is_public boolean default true,
  courts_count integer default 1,
  lighting boolean default false,
  covered boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public_access boolean not null default true,
  environment text default 'outdoor',
  parking boolean default false,
  toilets boolean not null default false
);

alter table public.terrains enable row level security;

create policy "authenticated_select_own_terrains" on public.terrains for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_terrains" on public.terrains for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_terrains" on public.terrains for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_terrains" on public.terrains for delete to authenticated using (user_id = auth.uid());
create policy "public_select_terrains" on public.terrains for select using (is_public = true);
create policy "admin_select_all_terrains" on public.terrains for select to authenticated using (is_admin());
create policy "admin_update_all_terrains" on public.terrains for update to authenticated using (is_admin());
create policy "admin_delete_all_terrains" on public.terrains for delete to authenticated using (is_admin());
create policy "shared_select_terrains" on public.terrains for select to authenticated using (exists (select 1 from shared_items si where si.item_type = 'terrain' and si.item_id = terrains.id and (si.shared_with_id = auth.uid() or si.is_public_link = true)));
create policy "shared_update_terrains" on public.terrains for update to authenticated using (exists (select 1 from shared_items si where si.item_type = 'terrain' and si.item_id = terrains.id and si.shared_with_id = auth.uid() and si.permission = 'write'));

-- -----------------------------------------------------------
-- clubs — Club management
-- -----------------------------------------------------------
create table if not exists public.clubs (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  logo text,
  address text,
  city text not null,
  location jsonb,
  members_count integer default 0,
  founded_year integer,
  description text,
  facilities text[],
  contact_email text,
  contact_phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  terrain_id uuid references public.terrains(id) on delete set null,
  terrain_name text,
  country text default 'France',
  membership_cost numeric(10,2),
  is_public boolean not null default false,
  show_contact_public boolean not null default false,
  club_card_url text,
  website text,
  facebook_url text,
  instagram_handle text,
  is_verified boolean not null default false,
  admin_user_ids uuid[] default '{}'::uuid[],
  admin_permissions jsonb default '{}'::jsonb
);

alter table public.clubs enable row level security;

create index idx_clubs_admin_user_ids on public.clubs using gin (admin_user_ids);

create policy "authenticated_select_own_clubs" on public.clubs for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_clubs" on public.clubs for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_clubs" on public.clubs for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_clubs" on public.clubs for delete to authenticated using (user_id = auth.uid());
create policy "public_select_clubs" on public.clubs for select using (is_public = true);
create policy "admin_select_all_clubs" on public.clubs for select to authenticated using (is_admin());
create policy "admin_update_all_clubs" on public.clubs for update to authenticated using (is_admin());
create policy "coadmin_select_clubs" on public.clubs for select to authenticated using (auth.uid() = any (admin_user_ids));
create policy "coadmin_update_clubs" on public.clubs for update to authenticated using (auth.uid() = any (admin_user_ids));
create policy "shared_select_clubs" on public.clubs for select to authenticated using (exists (select 1 from shared_items si where si.item_type = 'club' and si.item_id = clubs.id and (si.shared_with_id = auth.uid() or si.is_public_link = true)));
create policy "shared_update_clubs" on public.clubs for update to authenticated using (exists (select 1 from shared_items si where si.item_type = 'club' and si.item_id = clubs.id and si.shared_with_id = auth.uid() and si.permission = 'write'));

-- -----------------------------------------------------------
-- boules_sets — Player equipment
-- -----------------------------------------------------------
create table if not exists public.boules_sets (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  brand text,
  diameter numeric(4,1),
  weight integer,
  serial_number text,
  hardness text,
  is_primary boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  photo text,
  purchase_price numeric(10,2)
);

alter table public.boules_sets enable row level security;

create policy "authenticated_select_own_boules_sets" on public.boules_sets for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_boules_sets" on public.boules_sets for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_boules_sets" on public.boules_sets for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_boules_sets" on public.boules_sets for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
-- ambassadors — Ambassador/sponsor profiles
-- -----------------------------------------------------------
create table if not exists public.ambassadors (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  display_name text not null,
  bio text,
  photo text,
  youtube_url text,
  tiktok_url text,
  instagram_handle text,
  twitter_handle text,
  website_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  badge_type text not null default 'ambassador',
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ambassador_level text not null default 'decouverte',
  referral_code text unique,
  referral_count integer not null default 0,
  total_referral_xp integer not null default 0,
  brand_color text
);

alter table public.ambassadors enable row level security;

create index idx_ambassadors_active on public.ambassadors using btree (is_active);
create index idx_ambassadors_level on public.ambassadors using btree (ambassador_level);
create index idx_ambassadors_player on public.ambassadors using btree (player_id);
create index idx_ambassadors_referral_code on public.ambassadors using btree (referral_code);
create index idx_ambassadors_user on public.ambassadors using btree (user_id);

create policy "anon_select_active_ambassadors" on public.ambassadors for select to anon using (is_active = true);
create policy "authenticated_select_active_ambassadors" on public.ambassadors for select to authenticated using (is_active = true);
create policy "own_select_ambassadors" on public.ambassadors for select to authenticated using (user_id = auth.uid());
-- Admins must see inactive rows (admin UI + PostgREST RETURNING after PATCH).
create policy "admin_select_all_ambassadors" on public.ambassadors for select to authenticated using (is_admin());
create policy "own_update_ambassadors" on public.ambassadors for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "authenticated_insert_own_ambassadors" on public.ambassadors for insert to authenticated with check (user_id = auth.uid());
create policy "admin_insert_ambassadors" on public.ambassadors for insert to authenticated with check (is_admin());
-- Explicit WITH CHECK: new row may have is_active = false; must not inherit a row-only USING as WITH CHECK.
create policy "admin_update_ambassadors" on public.ambassadors for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin_delete_ambassadors" on public.ambassadors for delete to authenticated using (is_admin());

-- -----------------------------------------------------------
-- ambassador_analytics — Tracking ambassador impressions/clicks
-- -----------------------------------------------------------
create table if not exists public.ambassador_analytics (
  id uuid not null default gen_random_uuid() primary key,
  ambassador_id uuid not null references public.ambassadors(id) on delete cascade,
  event_type text not null,
  social_platform text,
  created_at timestamptz default now(),
  source_page text,
  viewer_id uuid
);

alter table public.ambassador_analytics enable row level security;

create index idx_ambassador_analytics_ambassador on public.ambassador_analytics using btree (ambassador_id);
create index idx_ambassador_analytics_created on public.ambassador_analytics using btree (created_at);
create index idx_ambassador_analytics_event on public.ambassador_analytics using btree (event_type);
create index idx_ambassador_analytics_source_page on public.ambassador_analytics using btree (source_page);
create index idx_ambassador_analytics_viewer on public.ambassador_analytics using btree (viewer_id);

create policy "admin_select_ambassador_analytics" on public.ambassador_analytics for select to authenticated using (is_admin());
create policy "authenticated_insert_ambassador_analytics" on public.ambassador_analytics for insert to authenticated with check (true);

-- -----------------------------------------------------------
-- elo_history — ELO rating change history
-- -----------------------------------------------------------
create table if not exists public.elo_history (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  elo_before integer not null,
  elo_after integer not null,
  elo_delta integer not null,
  match_id uuid references public.matches(id) on delete set null,
  opponent_elo integer,
  opponent_name text,
  won boolean not null,
  recorded_at timestamptz not null default now()
);

alter table public.elo_history enable row level security;

create index idx_elo_history_player on public.elo_history using btree (player_id);
create index idx_elo_history_user on public.elo_history using btree (user_id);

create policy "anon_select_elo_history" on public.elo_history for select to anon using (true);
create policy "authenticated_select_all_elo_history" on public.elo_history for select to authenticated using (true);
create policy "authenticated_insert_own_elo_history" on public.elo_history for insert to authenticated with check (user_id = auth.uid());

-- -----------------------------------------------------------
-- elo_seasons — Seasonal ELO snapshots
-- -----------------------------------------------------------
create table if not exists public.elo_seasons (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  season_year integer not null,
  peak_elo integer not null default 1000,
  final_elo integer not null default 1000,
  final_rank text not null default 'bronze',
  matches_played integer not null default 0,
  wins integer not null default 0,
  elo_tireur integer,
  elo_pointeur integer,
  elo_milieu integer,
  created_at timestamptz default now(),
  unique(player_id, season_year)
);

alter table public.elo_seasons enable row level security;

create index idx_elo_seasons_player on public.elo_seasons using btree (player_id);
create index idx_elo_seasons_user on public.elo_seasons using btree (user_id);
create index idx_elo_seasons_year on public.elo_seasons using btree (season_year);

create policy "anon_select_elo_seasons" on public.elo_seasons for select to anon using (true);
create policy "authenticated_select_elo_seasons" on public.elo_seasons for select to authenticated using (true);
create policy "authenticated_insert_own_elo_seasons" on public.elo_seasons for insert to authenticated with check (user_id = auth.uid());

-- -----------------------------------------------------------
-- shared_items — Sharing system
-- -----------------------------------------------------------
create table if not exists public.shared_items (
  id uuid not null default gen_random_uuid() primary key,
  owner_id uuid not null references public.user_profiles(id) on delete cascade,
  shared_with_id uuid references public.user_profiles(id) on delete cascade,
  share_code text not null unique,
  item_type text not null,
  item_id uuid not null,
  permission text not null default 'read',
  is_public_link boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  associated_items jsonb,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  first_viewed_at timestamptz
);

alter table public.shared_items enable row level security;

create index idx_shared_items_item on public.shared_items using btree (item_type, item_id);
create index idx_shared_items_owner on public.shared_items using btree (owner_id);
create index idx_shared_items_share_code on public.shared_items using btree (share_code);
create index idx_shared_items_shared_with on public.shared_items using btree (shared_with_id);

create policy "owner_select_shared_items" on public.shared_items for select to authenticated using (owner_id = auth.uid());
create policy "owner_insert_shared_items" on public.shared_items for insert to authenticated with check (owner_id = auth.uid());
create policy "owner_update_shared_items" on public.shared_items for update to authenticated using (owner_id = auth.uid());
create policy "owner_delete_shared_items" on public.shared_items for delete to authenticated using (owner_id = auth.uid());
create policy "recipient_select_shared_items" on public.shared_items for select to authenticated using (shared_with_id = auth.uid());
create policy "authenticated_select_by_share_code" on public.shared_items for select to authenticated using (is_public_link = true);

-- -----------------------------------------------------------
-- match_share_requests — Match/challenge sharing requests
-- -----------------------------------------------------------
create table if not exists public.match_share_requests (
  id uuid not null default gen_random_uuid() primary key,
  item_type text not null,
  item_id uuid not null,
  sender_user_id uuid not null references public.user_profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending',
  permission text not null default 'read',
  sender_name text,
  item_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(item_type, item_id, recipient_user_id)
);

alter table public.match_share_requests enable row level security;

create index idx_match_share_requests_item on public.match_share_requests using btree (item_type, item_id);
create index idx_match_share_requests_recipient on public.match_share_requests using btree (recipient_user_id);
create index idx_match_share_requests_recipient_status on public.match_share_requests using btree (recipient_user_id, status);
create index idx_match_share_requests_sender on public.match_share_requests using btree (sender_user_id);
create index idx_match_share_requests_status on public.match_share_requests using btree (status);

create policy "sender_select_share_requests" on public.match_share_requests for select to authenticated using (sender_user_id = auth.uid());
create policy "sender_insert_share_requests" on public.match_share_requests for insert to authenticated with check (sender_user_id = auth.uid());
create policy "sender_delete_share_requests" on public.match_share_requests for delete to authenticated using (sender_user_id = auth.uid());
create policy "recipient_select_share_requests" on public.match_share_requests for select to authenticated using (recipient_user_id = auth.uid());
create policy "recipient_update_share_requests" on public.match_share_requests for update to authenticated using (recipient_user_id = auth.uid());

-- -----------------------------------------------------------
-- match_witness_requests — Match attestation by witnesses
-- -----------------------------------------------------------
create table if not exists public.match_witness_requests (
  id uuid not null default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade,
  requester_user_id uuid not null references public.user_profiles(id) on delete cascade,
  witness_user_id uuid not null references public.user_profiles(id) on delete cascade,
  witness_name text,
  status text not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz default now(),
  attestation_type text not null default 'standard',
  item_snapshot jsonb,
  item_type text not null default 'match',
  item_id uuid,
  unique(match_id, witness_user_id)
);

alter table public.match_witness_requests enable row level security;

create index idx_match_witness_requests_item on public.match_witness_requests using btree (item_type, item_id);
create index idx_match_witness_requests_match on public.match_witness_requests using btree (match_id);
create index idx_match_witness_requests_status on public.match_witness_requests using btree (status);
create index idx_match_witness_requests_witness on public.match_witness_requests using btree (witness_user_id);

create policy "authenticated_insert_witness_requests" on public.match_witness_requests for insert to authenticated with check (requester_user_id = auth.uid());
create policy "authenticated_select_own_witness_requests" on public.match_witness_requests for select to authenticated using (requester_user_id = auth.uid() or witness_user_id = auth.uid());
create policy "witness_update_own_requests" on public.match_witness_requests for update to authenticated using (witness_user_id = auth.uid());
create policy "requester_delete_own_requests" on public.match_witness_requests for delete to authenticated using (requester_user_id = auth.uid());

-- -----------------------------------------------------------
-- terrain_meetups — Meetup scheduling
-- -----------------------------------------------------------
create table if not exists public.terrain_meetups (
  id uuid not null default gen_random_uuid() primary key,
  creator_id uuid not null references public.user_profiles(id) on delete cascade,
  terrain_id uuid not null references public.terrains(id) on delete cascade,
  title text not null,
  date timestamptz not null,
  max_participants integer not null default 8,
  status text not null default 'active',
  share_code text not null unique,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  end_time timestamptz
);

alter table public.terrain_meetups enable row level security;

create index idx_terrain_meetups_creator on public.terrain_meetups using btree (creator_id);
create index idx_terrain_meetups_date on public.terrain_meetups using btree (date);
create index idx_terrain_meetups_share_code on public.terrain_meetups using btree (share_code);
create index idx_terrain_meetups_terrain on public.terrain_meetups using btree (terrain_id);

create policy "authenticated_select_by_share_code" on public.terrain_meetups for select to authenticated using (true);
create policy "creator_select_own_meetups" on public.terrain_meetups for select to authenticated using (creator_id = auth.uid());
create policy "creator_insert_meetups" on public.terrain_meetups for insert to authenticated with check (creator_id = auth.uid());
create policy "creator_update_meetups" on public.terrain_meetups for update to authenticated using (creator_id = auth.uid());
create policy "creator_delete_meetups" on public.terrain_meetups for delete to authenticated using (creator_id = auth.uid());
create policy "participant_select_meetups" on public.terrain_meetups for select to authenticated using (exists (select 1 from terrain_meetup_responses r where r.meetup_id = terrain_meetups.id and r.user_id = auth.uid()));

-- -----------------------------------------------------------
-- terrain_meetup_responses — Meetup RSVPs
-- -----------------------------------------------------------
create table if not exists public.terrain_meetup_responses (
  id uuid not null default gen_random_uuid() primary key,
  meetup_id uuid not null references public.terrain_meetups(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz default now(),
  unique(meetup_id, user_id)
);

alter table public.terrain_meetup_responses enable row level security;

create index idx_terrain_meetup_responses_meetup on public.terrain_meetup_responses using btree (meetup_id);
create index idx_terrain_meetup_responses_user on public.terrain_meetup_responses using btree (user_id);

create policy "user_select_own_responses" on public.terrain_meetup_responses for select to authenticated using (user_id = auth.uid());
create policy "user_insert_own_response" on public.terrain_meetup_responses for insert to authenticated with check (user_id = auth.uid());
create policy "user_update_own_response" on public.terrain_meetup_responses for update to authenticated using (user_id = auth.uid());
create policy "user_delete_own_response" on public.terrain_meetup_responses for delete to authenticated using (user_id = auth.uid());
create policy "creator_select_meetup_responses" on public.terrain_meetup_responses for select to authenticated using (is_meetup_creator(meetup_id));
create policy "creator_insert_invitations" on public.terrain_meetup_responses for insert to authenticated with check (is_meetup_creator(meetup_id) and status = 'pending');

-- -----------------------------------------------------------
-- meetup_messages — Meetup chat messages
-- -----------------------------------------------------------
create table if not exists public.meetup_messages (
  id uuid not null default gen_random_uuid() primary key,
  meetup_id uuid not null references public.terrain_meetups(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  user_name text not null,
  user_avatar text,
  message text not null,
  created_at timestamptz default now()
);

alter table public.meetup_messages enable row level security;

create index idx_meetup_messages_created on public.meetup_messages using btree (created_at);
create index idx_meetup_messages_meetup on public.meetup_messages using btree (meetup_id);

create policy "participant_select_meetup_messages" on public.meetup_messages for select to authenticated using (exists (select 1 from terrain_meetup_responses r where r.meetup_id = meetup_messages.meetup_id and r.user_id = auth.uid()) or exists (select 1 from terrain_meetups m where m.id = meetup_messages.meetup_id and m.creator_id = auth.uid()));
create policy "participant_insert_meetup_messages" on public.meetup_messages for insert to authenticated with check (user_id = auth.uid() and (exists (select 1 from terrain_meetup_responses r where r.meetup_id = meetup_messages.meetup_id and r.user_id = auth.uid() and r.status = 'accepted') or exists (select 1 from terrain_meetups m where m.id = meetup_messages.meetup_id and m.creator_id = auth.uid())));
create policy "own_delete_meetup_messages" on public.meetup_messages for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
-- meetup_message_reactions — Chat emoji reactions
-- -----------------------------------------------------------
create table if not exists public.meetup_message_reactions (
  id uuid not null default gen_random_uuid() primary key,
  meetup_id uuid not null references public.terrain_meetups(id) on delete cascade,
  message_id uuid not null references public.meetup_messages(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, reaction_type)
);

alter table public.meetup_message_reactions enable row level security;

create index idx_meetup_message_reactions_meetup on public.meetup_message_reactions using btree (meetup_id);
create index idx_meetup_message_reactions_message on public.meetup_message_reactions using btree (message_id);

-- -----------------------------------------------------------
-- meetup_read_receipts — Chat read indicators
-- -----------------------------------------------------------
create table if not exists public.meetup_read_receipts (
  id uuid not null default gen_random_uuid() primary key,
  meetup_id uuid not null references public.terrain_meetups(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  last_read_message_id uuid not null references public.meetup_messages(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  unique(meetup_id, user_id)
);

alter table public.meetup_read_receipts enable row level security;

create index idx_meetup_read_receipts_meetup on public.meetup_read_receipts using btree (meetup_id);
create index idx_meetup_read_receipts_user on public.meetup_read_receipts using btree (user_id);

-- -----------------------------------------------------------
-- meetup_typing — Typing indicators
-- -----------------------------------------------------------
create table if not exists public.meetup_typing (
  id uuid not null default gen_random_uuid() primary key,
  meetup_id uuid not null references public.terrain_meetups(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  user_name text not null default '',
  updated_at timestamptz not null default now(),
  unique(meetup_id, user_id)
);

alter table public.meetup_typing enable row level security;

create index idx_meetup_typing_meetup on public.meetup_typing using btree (meetup_id);

-- -----------------------------------------------------------
-- terrain_reviews — Terrain ratings and reviews
-- -----------------------------------------------------------
create table if not exists public.terrain_reviews (
  id uuid not null default gen_random_uuid() primary key,
  terrain_id uuid not null references public.terrains(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text,
  rating integer not null,
  comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  photo_url text,
  flagged boolean default false,
  flag_count integer default 0,
  moderation_status text default 'active',
  unique(terrain_id, user_id)
);

alter table public.terrain_reviews enable row level security;

create index idx_terrain_reviews_rating on public.terrain_reviews using btree (rating);
create index idx_terrain_reviews_terrain on public.terrain_reviews using btree (terrain_id);
create index idx_terrain_reviews_user on public.terrain_reviews using btree (user_id);

create policy "anon_select_terrain_reviews" on public.terrain_reviews for select to anon using (true);
create policy "authenticated_select_terrain_reviews" on public.terrain_reviews for select to authenticated using (true);
create policy "authenticated_insert_own_review" on public.terrain_reviews for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_review" on public.terrain_reviews for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_review" on public.terrain_reviews for delete to authenticated using (user_id = auth.uid());
create policy "admin_select_all_terrain_reviews" on public.terrain_reviews for select to authenticated using (is_admin());
create policy "admin_update_terrain_reviews" on public.terrain_reviews for update to authenticated using (is_admin());
create policy "admin_delete_terrain_reviews" on public.terrain_reviews for delete to authenticated using (is_admin());

-- -----------------------------------------------------------
-- review_votes — Upvotes/downvotes on reviews
-- -----------------------------------------------------------
create table if not exists public.review_votes (
  id uuid not null default gen_random_uuid() primary key,
  review_id uuid not null references public.terrain_reviews(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  vote_type text not null,
  created_at timestamptz default now(),
  unique(review_id, user_id)
);

alter table public.review_votes enable row level security;

create index idx_review_votes_review on public.review_votes using btree (review_id);
create index idx_review_votes_user on public.review_votes using btree (user_id);

create policy "authenticated_select_review_votes" on public.review_votes for select to authenticated using (true);
create policy "authenticated_insert_own_review_votes" on public.review_votes for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_delete_own_review_votes" on public.review_votes for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
-- club_invitations — Club membership invitations
-- -----------------------------------------------------------
create table if not exists public.club_invitations (
  id uuid not null default gen_random_uuid() primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  club_name text not null,
  club_logo text,
  invited_player_id uuid not null references public.players(id) on delete cascade,
  invited_player_name text not null,
  invited_user_id uuid references public.user_profiles(id) on delete set null,
  inviter_user_id uuid not null references public.user_profiles(id) on delete cascade,
  inviter_name text not null,
  message text,
  status text not null default 'pending',
  decline_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.club_invitations enable row level security;

create index idx_club_invitations_club on public.club_invitations using btree (club_id);
create index idx_club_invitations_invited_user on public.club_invitations using btree (invited_user_id);
create index idx_club_invitations_inviter on public.club_invitations using btree (inviter_user_id);
create index idx_club_invitations_status on public.club_invitations using btree (status);

-- -----------------------------------------------------------
-- club_member_roles — Club member role assignments
-- -----------------------------------------------------------
create table if not exists public.club_member_roles (
  id uuid not null default gen_random_uuid() primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role text not null default 'player',
  assigned_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(club_id, player_id)
);

alter table public.club_member_roles enable row level security;

create index idx_club_member_roles_club on public.club_member_roles using btree (club_id);
create index idx_club_member_roles_player on public.club_member_roles using btree (player_id);
create index idx_club_member_roles_user on public.club_member_roles using btree (user_id);

create policy "authenticated_select_club_member_roles" on public.club_member_roles for select to authenticated using (true);

-- -----------------------------------------------------------
-- club_claim_requests — Club ownership claims
-- -----------------------------------------------------------
create table if not exists public.club_claim_requests (
  id uuid not null default gen_random_uuid() primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  requester_user_id uuid not null references public.user_profiles(id) on delete cascade,
  current_owner_id uuid not null references public.user_profiles(id) on delete cascade,
  requester_name text,
  requester_email text,
  message text,
  proof_url text,
  status text not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(club_id, requester_user_id)
);

alter table public.club_claim_requests enable row level security;

create index idx_club_claims_club on public.club_claim_requests using btree (club_id);
create index idx_club_claims_owner on public.club_claim_requests using btree (current_owner_id);
create index idx_club_claims_requester on public.club_claim_requests using btree (requester_user_id);
create index idx_club_claims_status on public.club_claim_requests using btree (status);

-- -----------------------------------------------------------
-- player_transfer_requests — Player data transfer system
-- -----------------------------------------------------------
create table if not exists public.player_transfer_requests (
  id uuid not null default gen_random_uuid() primary key,
  sender_user_id uuid not null references public.user_profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.user_profiles(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  player_name text not null,
  status text not null default 'pending',
  match_count integer not null default 0,
  challenge_count integer not null default 0,
  message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.player_transfer_requests enable row level security;

create index idx_player_transfer_player on public.player_transfer_requests using btree (player_id);
create index idx_player_transfer_recipient on public.player_transfer_requests using btree (recipient_user_id);
create index idx_player_transfer_sender on public.player_transfer_requests using btree (sender_user_id);
create index idx_player_transfer_status on public.player_transfer_requests using btree (status);

-- -----------------------------------------------------------
-- player_transfer_archives — Archived resolved transfers
-- -----------------------------------------------------------
create table if not exists public.player_transfer_archives (
  id uuid not null default gen_random_uuid() primary key,
  original_id uuid not null,
  player_name text not null,
  sender_user_id uuid not null references public.user_profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null,
  match_count integer not null default 0,
  challenge_count integer not null default 0,
  message text,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz not null default now()
);

alter table public.player_transfer_archives enable row level security;

create index idx_transfer_archives_archived on public.player_transfer_archives using btree (archived_at);
create index idx_transfer_archives_status on public.player_transfer_archives using btree (status);

create policy "admin_select_transfer_archives" on public.player_transfer_archives for select to authenticated using (is_admin());
create policy "admin_delete_transfer_archives" on public.player_transfer_archives for delete to authenticated using (is_admin());

-- -----------------------------------------------------------
-- sponsored_events — Ambassador-sponsored challenges
-- -----------------------------------------------------------
create table if not exists public.sponsored_events (
  id uuid not null default gen_random_uuid() primary key,
  ambassador_id uuid not null references public.ambassadors(id) on delete cascade,
  creator_user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  description text,
  challenge_type text not null,
  challenge_mode text not null default 'solo',
  event_date date not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  scope text not null default 'world',
  terrain_id uuid references public.terrains(id) on delete set null,
  terrain_name text,
  city text,
  country text default 'France',
  max_participants integer not null default 50,
  min_witnesses integer not null default 2,
  status text not null default 'upcoming',
  share_code text not null unique,
  results_published boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sponsored_events enable row level security;

create index idx_sponsored_events_ambassador on public.sponsored_events using btree (ambassador_id);
create index idx_sponsored_events_creator on public.sponsored_events using btree (creator_user_id);
create index idx_sponsored_events_date on public.sponsored_events using btree (event_date);
create index idx_sponsored_events_share_code on public.sponsored_events using btree (share_code);
create index idx_sponsored_events_status on public.sponsored_events using btree (status);

create policy "authenticated_select_sponsored_events" on public.sponsored_events for select to authenticated using (true);
create policy "creator_insert_sponsored_events" on public.sponsored_events for insert to authenticated with check (creator_user_id = auth.uid());
create policy "creator_update_sponsored_events" on public.sponsored_events for update to authenticated using (creator_user_id = auth.uid());
create policy "creator_delete_sponsored_events" on public.sponsored_events for delete to authenticated using (creator_user_id = auth.uid());

-- -----------------------------------------------------------
-- sponsored_event_participants — Event participation
-- -----------------------------------------------------------
create table if not exists public.sponsored_event_participants (
  id uuid not null default gen_random_uuid() primary key,
  event_id uuid not null references public.sponsored_events(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending',
  challenge_id uuid references public.challenges(id) on delete set null,
  rank integer,
  score_value numeric(10,2),
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(event_id, user_id)
);

alter table public.sponsored_event_participants enable row level security;

create index idx_sponsored_event_participants_event on public.sponsored_event_participants using btree (event_id);
create index idx_sponsored_event_participants_user on public.sponsored_event_participants using btree (user_id);

-- -----------------------------------------------------------
-- sponsored_event_witnesses — Event result attestation
-- -----------------------------------------------------------
create table if not exists public.sponsored_event_witnesses (
  id uuid not null default gen_random_uuid() primary key,
  event_id uuid not null references public.sponsored_events(id) on delete cascade,
  participant_id uuid not null references public.sponsored_event_participants(id) on delete cascade,
  witness_user_id uuid not null references public.user_profiles(id) on delete cascade,
  attested boolean not null default false,
  attested_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique(event_id, participant_id, witness_user_id)
);

alter table public.sponsored_event_witnesses enable row level security;

create index idx_sponsored_event_witnesses_event on public.sponsored_event_witnesses using btree (event_id);
create index idx_sponsored_event_witnesses_participant on public.sponsored_event_witnesses using btree (participant_id);

-- -----------------------------------------------------------
-- event_notifications — Event-related notifications
-- -----------------------------------------------------------
create table if not exists public.event_notifications (
  id uuid not null default gen_random_uuid() primary key,
  event_id uuid not null references public.sponsored_events(id) on delete cascade,
  recipient_user_id uuid not null references public.user_profiles(id) on delete cascade,
  sender_user_id uuid references public.user_profiles(id) on delete set null,
  type text not null,
  participant_id uuid references public.sponsored_event_participants(id) on delete cascade,
  title text not null,
  message text,
  is_read boolean not null default false,
  action_url text,
  created_at timestamptz default now()
);

alter table public.event_notifications enable row level security;

create index idx_event_notifications_created on public.event_notifications using btree (created_at);
create index idx_event_notifications_event on public.event_notifications using btree (event_id);
create index idx_event_notifications_recipient on public.event_notifications using btree (recipient_user_id);
create index idx_event_notifications_unread on public.event_notifications using btree (recipient_user_id, is_read);

-- -----------------------------------------------------------
-- push_tokens — Device push notification tokens
-- -----------------------------------------------------------
create table if not exists public.push_tokens (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'unknown',
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.push_tokens enable row level security;

create index idx_push_tokens_user_active on public.push_tokens using btree (user_id, active);

create policy "authenticated_select_own_push_tokens" on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_push_tokens" on public.push_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_push_tokens" on public.push_tokens for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_push_tokens" on public.push_tokens for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
-- user_badges — Unlocked badges
-- -----------------------------------------------------------
create table if not exists public.user_badges (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  badge_id text not null,
  unlocked_at timestamptz not null default now(),
  unique(user_id, badge_id)
);

alter table public.user_badges enable row level security;

create index idx_user_badges_badge on public.user_badges using btree (badge_id);
create index idx_user_badges_user on public.user_badges using btree (user_id);

create policy "authenticated_select_own_badges" on public.user_badges for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_badges" on public.user_badges for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_delete_own_badges" on public.user_badges for delete to authenticated using (user_id = auth.uid());
create policy "public_select_badges" on public.user_badges for select using (true);

-- -----------------------------------------------------------
-- user_preferences — User settings and favorites
-- -----------------------------------------------------------
create table if not exists public.user_preferences (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade unique,
  favorite_terrain_ids jsonb not null default '[]'::jsonb,
  favorite_club_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  notification_preferences jsonb not null default '{"event_created": true, "share_request": true, "event_reminder": true, "ranking_changed": true, "meetup_invitation": true}'::jsonb,
  followed_player_ids jsonb not null default '[]'::jsonb
);

alter table public.user_preferences enable row level security;

create policy "authenticated_select_own_preferences" on public.user_preferences for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_preferences" on public.user_preferences for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_update_own_preferences" on public.user_preferences for update to authenticated using (user_id = auth.uid());
create policy "authenticated_delete_own_preferences" on public.user_preferences for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
-- weekly_leaderboard_snapshots — Weekly ranking snapshots
-- -----------------------------------------------------------
create table if not exists public.weekly_leaderboard_snapshots (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  week_start date not null,
  rank integer not null,
  matches_played integer not null default 0,
  wins integer not null default 0,
  win_rate numeric(5,2) not null default 0,
  tir_rate numeric(5,2) not null default 0,
  carreau_count integer not null default 0,
  city text,
  club text,
  club_id uuid,
  created_at timestamptz default now(),
  elo_rating integer not null default 1000,
  unique(user_id, week_start)
);

alter table public.weekly_leaderboard_snapshots enable row level security;

create index idx_weekly_snapshots_rank on public.weekly_leaderboard_snapshots using btree (rank);
create index idx_weekly_snapshots_user_week on public.weekly_leaderboard_snapshots using btree (user_id, week_start);
create index idx_weekly_snapshots_week on public.weekly_leaderboard_snapshots using btree (week_start);

create policy "anon_select_weekly_snapshots" on public.weekly_leaderboard_snapshots for select to anon using (true);
create policy "authenticated_select_weekly_snapshots" on public.weekly_leaderboard_snapshots for select to authenticated using (true);
create policy "authenticated_insert_own_weekly_snapshots" on public.weekly_leaderboard_snapshots for insert to authenticated with check (user_id = auth.uid());

-- -----------------------------------------------------------
-- tournament_notifications — Tournament reminder subscriptions
-- -----------------------------------------------------------
create table if not exists public.tournament_notifications (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  enabled boolean default true,
  remind_days_before integer default 1,
  created_at timestamptz default now(),
  unique(user_id, tournament_id)
);

alter table public.tournament_notifications enable row level security;

-- -----------------------------------------------------------
-- feature_votes — Community roadmap voting
-- -----------------------------------------------------------
create table if not exists public.feature_votes (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  feature_id text not null,
  created_at timestamptz default now(),
  unique(user_id, feature_id)
);

alter table public.feature_votes enable row level security;

create index idx_feature_votes_feature on public.feature_votes using btree (feature_id);
create index idx_feature_votes_user on public.feature_votes using btree (user_id);

create policy "authenticated_select_all_feature_votes" on public.feature_votes for select to authenticated using (true);
create policy "authenticated_insert_own_feature_votes" on public.feature_votes for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_delete_own_feature_votes" on public.feature_votes for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
-- feed_reactions — Activity feed reactions
-- -----------------------------------------------------------
create table if not exists public.feed_reactions (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  feed_item_id text not null,
  reaction_type text not null,
  created_at timestamptz default now(),
  unique(user_id, feed_item_id, reaction_type)
);

alter table public.feed_reactions enable row level security;

create index idx_feed_reactions_item on public.feed_reactions using btree (feed_item_id);
create index idx_feed_reactions_user on public.feed_reactions using btree (user_id);

create policy "authenticated_select_feed_reactions" on public.feed_reactions for select to authenticated using (true);
create policy "authenticated_insert_own_feed_reactions" on public.feed_reactions for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_delete_own_feed_reactions" on public.feed_reactions for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
-- trust_score_history — Weekly trust score snapshots
-- -----------------------------------------------------------
create table if not exists public.trust_score_history (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  trust_score integer not null,
  level text not null,
  flags jsonb not null default '[]'::jsonb,
  week_start date not null,
  recorded_at timestamptz not null default now(),
  unique(player_id, week_start)
);

alter table public.trust_score_history enable row level security;

create index idx_trust_score_history_player_week on public.trust_score_history using btree (player_id, week_start);
create index idx_trust_score_history_user on public.trust_score_history using btree (user_id);

-- -----------------------------------------------------------
-- suspicious_players — Anti-cheat flagged players
-- -----------------------------------------------------------
create table if not exists public.suspicious_players (
  id uuid not null default gen_random_uuid() primary key,
  player_id uuid not null references public.players(id) on delete cascade unique,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  trust_score integer not null default 50,
  flags jsonb not null default '[]'::jsonb,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'flagged',
  admin_notes text,
  analyzed_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.suspicious_players enable row level security;

create index idx_suspicious_players_score on public.suspicious_players using btree (trust_score);
create index idx_suspicious_players_status on public.suspicious_players using btree (status);
create index idx_suspicious_players_user on public.suspicious_players using btree (user_id);

create policy "admin_select_suspicious" on public.suspicious_players for select to authenticated using (is_admin());
create policy "admin_update_suspicious" on public.suspicious_players for update to authenticated using (is_admin());
create policy "admin_delete_suspicious" on public.suspicious_players for delete to authenticated using (is_admin());
create policy "own_select_suspicious" on public.suspicious_players for select to authenticated using (user_id = auth.uid());
create policy "public_select_trust_scores" on public.suspicious_players for select using (true);
create policy "service_insert_suspicious" on public.suspicious_players for insert to authenticated with check (true);

-- -----------------------------------------------------------
-- device_registrations — Multi-account prevention
-- -----------------------------------------------------------
create table if not exists public.device_registrations (
  id uuid not null default gen_random_uuid() primary key,
  device_fingerprint text not null,
  user_id uuid references public.user_profiles(id) on delete cascade,
  email text,
  registered_at timestamptz not null default now(),
  ip_hint text
);

alter table public.device_registrations enable row level security;

create index idx_device_registrations_email on public.device_registrations using btree (email);
create index idx_device_registrations_fingerprint on public.device_registrations using btree (device_fingerprint);
create index idx_device_registrations_registered on public.device_registrations using btree (registered_at);

create policy "anon_select_device_registrations" on public.device_registrations for select to anon using (true);
create policy "anon_insert_device_registrations" on public.device_registrations for insert to anon with check (true);
create policy "authenticated_select_own_device_registrations" on public.device_registrations for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_device_registrations" on public.device_registrations for insert to authenticated with check (true);
create policy "admin_select_all_device_registrations" on public.device_registrations for select to authenticated using (is_admin());

-- -----------------------------------------------------------
-- player_reports — Abuse reports
-- -----------------------------------------------------------
create table if not exists public.player_reports (
  id uuid not null default gen_random_uuid() primary key,
  reporter_id uuid not null references public.user_profiles(id) on delete cascade,
  reported_player_id uuid not null references public.players(id) on delete cascade,
  reported_user_id uuid references public.user_profiles(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'pending',
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.player_reports enable row level security;

create index idx_player_reports_reported on public.player_reports using btree (reported_player_id);
create index idx_player_reports_reporter on public.player_reports using btree (reporter_id);
create index idx_player_reports_status on public.player_reports using btree (status);

-- -----------------------------------------------------------
-- ban_appeals — Ban appeal system
-- -----------------------------------------------------------
create table if not exists public.ban_appeals (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  report_id uuid references public.player_reports(id) on delete set null,
  message text not null,
  status text not null default 'pending',
  admin_response text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ban_appeals enable row level security;

create index idx_ban_appeals_status on public.ban_appeals using btree (status);
create index idx_ban_appeals_user on public.ban_appeals using btree (user_id);

-- -----------------------------------------------------------
-- soft_deletes — Deleted item audit log
-- -----------------------------------------------------------
create table if not exists public.soft_deletes (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  table_name text not null,
  item_id uuid not null,
  deleted_at timestamptz not null default now()
);

alter table public.soft_deletes enable row level security;

create index idx_soft_deletes_table_item on public.soft_deletes using btree (table_name, item_id);
create index idx_soft_deletes_user_deleted on public.soft_deletes using btree (user_id, deleted_at);

create policy "authenticated_select_own_soft_deletes" on public.soft_deletes for select to authenticated using (user_id = auth.uid());
create policy "authenticated_insert_own_soft_deletes" on public.soft_deletes for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_delete_own_soft_deletes" on public.soft_deletes for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
-- merge_logs — Player merge audit trail
-- -----------------------------------------------------------
create table if not exists public.merge_logs (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  merge_type text not null,
  target_id uuid not null,
  target_name text not null,
  source_id uuid not null,
  source_name text not null,
  source_snapshot jsonb not null,
  reassigned_relations jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.merge_logs enable row level security;

create index idx_merge_logs_user_created on public.merge_logs using btree (user_id, created_at);

-- -----------------------------------------------------------
-- modification_logs — Collaborative edit tracking
-- -----------------------------------------------------------
create table if not exists public.modification_logs (
  id uuid not null default gen_random_uuid() primary key,
  item_type text not null,
  item_id uuid not null,
  owner_id uuid not null references public.user_profiles(id) on delete cascade,
  modifier_id uuid not null references public.user_profiles(id) on delete cascade,
  modifier_name text,
  modifier_email text,
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.modification_logs enable row level security;

create index idx_modification_logs_created on public.modification_logs using btree (created_at);
create index idx_modification_logs_item on public.modification_logs using btree (item_type, item_id);
create index idx_modification_logs_owner on public.modification_logs using btree (owner_id);

-- -----------------------------------------------------------
-- share_access_logs — Shared item view tracking
-- -----------------------------------------------------------
create table if not exists public.share_access_logs (
  id uuid not null default gen_random_uuid() primary key,
  shared_item_id uuid not null references public.shared_items(id) on delete cascade,
  owner_id uuid not null references public.user_profiles(id) on delete cascade,
  viewer_id uuid not null references public.user_profiles(id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  source_page text,
  viewed_at timestamptz not null default now()
);

alter table public.share_access_logs enable row level security;

create index idx_share_access_logs_owner on public.share_access_logs using btree (owner_id);
create index idx_share_access_logs_shared_item on public.share_access_logs using btree (shared_item_id);
create index idx_share_access_logs_viewed_at on public.share_access_logs using btree (viewed_at);
create index idx_share_access_logs_viewer on public.share_access_logs using btree (viewer_id);

-- -----------------------------------------------------------
-- share_notifications — Share access notifications
-- -----------------------------------------------------------
create table if not exists public.share_notifications (
  id uuid not null default gen_random_uuid() primary key,
  owner_id uuid not null references public.user_profiles(id) on delete cascade,
  accessor_id uuid not null references public.user_profiles(id) on delete cascade,
  accessor_name text,
  accessor_email text,
  item_type text not null,
  item_id uuid not null,
  item_name text,
  permission text not null default 'read',
  share_code text,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.share_notifications enable row level security;

create index idx_share_notifications_created on public.share_notifications using btree (created_at);
create index idx_share_notifications_owner on public.share_notifications using btree (owner_id);

-- -----------------------------------------------------------
-- promo_codes — Promotional code system
-- -----------------------------------------------------------
create table if not exists public.promo_codes (
  id uuid not null default gen_random_uuid() primary key,
  code text not null unique,
  max_uses integer not null default 1,
  current_uses integer not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.promo_codes enable row level security;

create policy "authenticated_select_active_promo_codes" on public.promo_codes for select to authenticated using (is_active = true);

-- -----------------------------------------------------------
-- promo_code_redemptions — Promo code usage tracking
-- -----------------------------------------------------------
create table if not exists public.promo_code_redemptions (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  redeemed_at timestamptz default now(),
  unique(user_id, promo_code_id)
);

alter table public.promo_code_redemptions enable row level security;

-- -----------------------------------------------------------
-- purchase_receipts — IAP receipt validation
-- -----------------------------------------------------------
create table if not exists public.purchase_receipts (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  platform text not null,
  product_id text not null,
  transaction_id text,
  receipt_data text,
  verified boolean not null default false,
  created_at timestamptz default now()
);

alter table public.purchase_receipts enable row level security;

create policy "authenticated_insert_own_receipt" on public.purchase_receipts for insert to authenticated with check (user_id = auth.uid());
create policy "authenticated_select_own_receipts" on public.purchase_receipts for select to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------
-- onboarding_step_logs — Onboarding funnel analytics
-- -----------------------------------------------------------
create table if not exists public.onboarding_step_logs (
  id uuid not null default gen_random_uuid() primary key,
  session_id text not null,
  user_id uuid references public.user_profiles(id) on delete set null,
  step_number integer not null,
  step_name text not null,
  action text not null default 'enter',
  created_at timestamptz default now()
);

alter table public.onboarding_step_logs enable row level security;

create index idx_onboarding_logs_created on public.onboarding_step_logs using btree (created_at);
create index idx_onboarding_logs_session on public.onboarding_step_logs using btree (session_id);
create index idx_onboarding_logs_step on public.onboarding_step_logs using btree (step_number);

create policy "admin_select_onboarding_logs" on public.onboarding_step_logs for select to authenticated using (is_admin());
create policy "anon_insert_onboarding_logs" on public.onboarding_step_logs for insert to anon with check (true);
create policy "authenticated_insert_onboarding_logs" on public.onboarding_step_logs for insert to authenticated with check (true);

-- -----------------------------------------------------------
-- ADMIN TABLES
-- -----------------------------------------------------------

-- admin_activity_logs
create table if not exists public.admin_activity_logs (
  id uuid not null default gen_random_uuid() primary key,
  admin_user_id uuid not null references public.user_profiles(id) on delete cascade,
  admin_name text,
  action_type text not null,
  action_detail text,
  target_type text,
  target_id uuid,
  target_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.admin_activity_logs enable row level security;

create index idx_admin_activity_logs_created on public.admin_activity_logs using btree (created_at desc);
create index idx_admin_activity_logs_type on public.admin_activity_logs using btree (action_type);

create policy "admin_insert_activity_logs" on public.admin_activity_logs for insert to authenticated with check (is_admin());
create policy "admin_select_activity_logs" on public.admin_activity_logs for select to authenticated using (is_admin());

-- admin_permissions
create table if not exists public.admin_permissions (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  permission text not null,
  granted_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now(),
  unique(user_id, permission)
);

alter table public.admin_permissions enable row level security;

create index idx_admin_permissions_perm on public.admin_permissions using btree (permission);
create index idx_admin_permissions_user on public.admin_permissions using btree (user_id);

-- announcements
create table if not exists public.announcements (
  id uuid not null default gen_random_uuid() primary key,
  admin_user_id uuid not null references public.user_profiles(id) on delete cascade,
  admin_name text,
  title_fr text not null,
  title_en text not null,
  message_fr text not null,
  message_en text not null,
  target_type text not null default 'all',
  target_value text,
  push_sent_count integer not null default 0,
  push_error_count integer not null default 0,
  created_at timestamptz default now()
);

alter table public.announcements enable row level security;

create index idx_announcements_admin on public.announcements using btree (admin_user_id);
create index idx_announcements_created on public.announcements using btree (created_at);

-- app_config
create table if not exists public.app_config (
  id text not null default 'main' primary key,
  maintenance_mode boolean not null default false,
  maintenance_message_fr text,
  maintenance_message_en text,
  maintenance_end_time timestamptz,
  maintenance_started_at timestamptz,
  updated_at timestamptz default now(),
  scheduled_maintenance_at timestamptz,
  scheduled_message_fr text,
  scheduled_message_en text,
  scheduled_duration_minutes integer,
  scheduled_send_push boolean not null default true,
  disabled_push_types jsonb not null default '[]'::jsonb
);

alter table public.app_config enable row level security;

create policy "anon_select_app_config" on public.app_config for select to anon using (true);
create policy "authenticated_select_app_config" on public.app_config for select to authenticated using (true);
create policy "admin_insert_app_config" on public.app_config for insert to authenticated with check (is_admin());
create policy "admin_update_app_config" on public.app_config for update to authenticated using (is_admin());

-- maintenance_logs
create table if not exists public.maintenance_logs (
  id uuid not null default gen_random_uuid() primary key,
  admin_user_id uuid not null references public.user_profiles(id) on delete cascade,
  admin_name text,
  action text not null,
  message_fr text,
  message_en text,
  end_time timestamptz,
  push_sent boolean not null default false,
  created_at timestamptz default now(),
  push_sent_count integer not null default 0,
  push_error_count integer not null default 0
);

alter table public.maintenance_logs enable row level security;

create index idx_maintenance_logs_created on public.maintenance_logs using btree (created_at);

-- ============================================================
-- 3. TRIGGERS
-- ============================================================

-- Auto-create user profile on auth signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sync user metadata on auth update
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.sync_user_metadata();

-- Soft delete logging triggers
create trigger on_boules_sets_delete before delete on public.boules_sets for each row execute function public.log_soft_delete();
create trigger on_challenges_delete before delete on public.challenges for each row execute function public.log_soft_delete();
create trigger on_clubs_delete before delete on public.clubs for each row execute function public.log_soft_delete();
create trigger on_matches_delete before delete on public.matches for each row execute function public.log_soft_delete();
create trigger on_players_delete before delete on public.players for each row execute function public.log_soft_delete();
create trigger on_terrains_delete before delete on public.terrains for each row execute function public.log_soft_delete();
create trigger on_tournaments_delete before delete on public.tournaments for each row execute function public.log_soft_delete();

-- ============================================================
-- 4. STORAGE BUCKETS
-- ============================================================

-- Note: Bucket creation via SQL
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('boules-photos', 'boules-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('club-cards', 'club-cards', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']),
  ('federation-cards', 'federation-cards', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']),
  ('terrain-photos', 'terrain-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Storage RLS Policies
create policy "avatars_public_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars_authenticated_upload" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'avatars');
create policy "avatars_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'avatars');
create policy "avatars_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars');

create policy "boules_photos_public_read" on storage.objects for select using (bucket_id = 'boules-photos');
create policy "boules_photos_authenticated_upload" on storage.objects for insert to authenticated with check (bucket_id = 'boules-photos');
create policy "boules_photos_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'boules-photos');
create policy "boules_photos_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = 'boules-photos');

create policy "club_cards_public_read" on storage.objects for select using (bucket_id = 'club-cards');
create policy "club_cards_authenticated_upload" on storage.objects for insert to authenticated with check (bucket_id = 'club-cards');
create policy "club_cards_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'club-cards');
create policy "club_cards_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = 'club-cards');

create policy "federation_cards_public_read" on storage.objects for select using (bucket_id = 'federation-cards');
create policy "federation_cards_authenticated_upload" on storage.objects for insert to authenticated with check (bucket_id = 'federation-cards');
create policy "federation_cards_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'federation-cards');
create policy "federation_cards_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = 'federation-cards');

create policy "terrain_photos_public_read" on storage.objects for select using (bucket_id = 'terrain-photos');
create policy "terrain_photos_authenticated_upload" on storage.objects for insert to authenticated with check (bucket_id = 'terrain-photos');
create policy "terrain_photos_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'terrain-photos');
create policy "terrain_photos_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = 'terrain-photos');

-- ============================================================
-- END OF SCHEMA
-- ============================================================
