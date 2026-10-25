-- ════════════════════════════════════════════════════════════
-- PremadeGG · Esquema base (port de server/models/*.js)
-- ════════════════════════════════════════════════════════════

create extension if not exists pg_trgm with schema extensions;

-- ── Enums ────────────────────────────────────────────────────
-- El orden de valorant_rank importa: permite comparar rangos con < y >.
create type public.region as enum ('eu', 'na', 'ap', 'kr');
create type public.valorant_rank as enum (
  'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal', 'Radiant'
);
create type public.valorant_role as enum ('Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex');
create type public.profile_image_type as enum ('upload', 'avatar', 'riot_card');
create type public.staff_role as enum ('manager', 'analyst', 'content_creator', 'streamer');
create type public.lfg_status as enum ('open', 'full', 'closed');
create type public.member_status as enum ('pending', 'accepted');
create type public.request_status as enum ('pending', 'accepted', 'rejected');
create type public.conversation_type as enum ('direct', 'group');
create type public.notification_type as enum (
  'join_request', 'request_accepted', 'request_rejected', 'member_kicked'
);

-- ── Profiles (1:1 con auth.users) ────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Identidad Riot (null hasta completar el onboarding)
  riot_id text unique,
  puuid text unique,
  region public.region not null default 'eu',

  -- Datos de juego
  rank public.valorant_rank,
  role public.valorant_role,
  schedule text,
  karma numeric(2, 1) not null default 5 check (karma between 0 and 5),
  account_level integer,
  card_image text,
  last_rank_update timestamptz,

  -- Perfil
  bio text not null default '' check (char_length(bio) <= 500),
  profile_image text,
  profile_image_type public.profile_image_type not null default 'riot_card',
  favorite_agents text[] not null default '{}' check (
    cardinality(favorite_agents) <= 3
    and favorite_agents <@ array[
      'Brimstone', 'Phoenix', 'Sage', 'Sova', 'Viper', 'Cypher', 'Reyna', 'Killjoy', 'Breach',
      'Omen', 'Jett', 'Raze', 'Skye', 'Yoru', 'Astra', 'KAY/O', 'Chamber', 'Neon', 'Fade',
      'Harbor', 'Gekko', 'Deadlock', 'Iso', 'Clove', 'Vyse', 'Tejo', 'Waylay', 'Veto'
    ]::text[]
  ),
  favorite_role public.valorant_role,
  social_links jsonb not null default '{"discord": "", "twitter": "", "twitch": ""}',
  availability jsonb not null default '{}',

  -- Looking For Team
  looking_for_team boolean not null default false,
  lft_details text not null default '' check (char_length(lft_details) <= 300),

  -- Coach
  is_coach boolean not null default false,
  coach_details text not null default '' check (char_length(coach_details) <= 500),

  onboarded boolean not null default false,
  created_at timestamptz not null default now(),

  constraint onboarded_requires_riot check (
    not onboarded or (riot_id is not null and rank is not null and role is not null and schedule is not null)
  )
);

create index profiles_rank_role_karma_idx on public.profiles (rank, role, karma desc);
create index profiles_karma_idx on public.profiles (karma desc, id desc);
create index profiles_lft_karma_idx on public.profiles (looking_for_team, karma desc);
create index profiles_riot_id_trgm_idx on public.profiles using gin (riot_id extensions.gin_trgm_ops);

-- ── Teams ────────────────────────────────────────────────────
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 40),
  tag text not null check (char_length(btrim(tag)) between 1 and 6 and tag = upper(tag)),
  logo text,
  description text not null default '' check (char_length(description) <= 1500),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  coach_id uuid references public.profiles (id) on delete set null,
  region public.region not null default 'eu',
  target_rank public.valorant_rank not null default 'Gold',
  social_links jsonb not null default '{"discord": "", "twitter": "", "twitch": "", "youtube": ""}',
  -- [{ title, date, description }] — se edita siempre como un bloque desde el formulario
  achievements jsonb not null default '[]' check (jsonb_typeof(achievements) = 'array'),
  recruiting boolean not null default false,
  recruiting_roles text[] not null default '{}' check (
    recruiting_roles <@ array['Duelist', 'Controller', 'Initiator', 'Sentinel', 'Flex', 'Coach', 'Analyst']::text[]
  ),
  recruiting_details text not null default '' check (char_length(recruiting_details) <= 500),
  created_at timestamptz not null default now()
);

create index teams_region_rank_idx on public.teams (region, target_rank, created_at desc);
create index teams_recruiting_idx on public.teams (recruiting, created_at desc);
create index teams_created_idx on public.teams (created_at desc, id desc);
create index teams_owner_idx on public.teams (owner_id);
create index teams_name_trgm_idx on public.teams using gin (name extensions.gin_trgm_ops);
create index teams_tag_trgm_idx on public.teams using gin (tag extensions.gin_trgm_ops);

create table public.team_players (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.valorant_role not null default 'Flex',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_players_user_idx on public.team_players (user_id);

create table public.team_staff (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_staff_user_idx on public.team_staff (user_id);

create table public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 500),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now()
);
create unique index team_join_requests_pending_uidx
  on public.team_join_requests (team_id, user_id) where status = 'pending';

-- ── LFG ──────────────────────────────────────────────────────
create table public.lfg_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (char_length(description) <= 500),
  team_size smallint not null check (team_size in (2, 3, 5)),
  min_rank public.valorant_rank,
  min_karma numeric(2, 1) not null default 3 check (min_karma between 0 and 5),
  status public.lfg_status not null default 'open',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index lfg_posts_size_status_idx on public.lfg_posts (team_size, status, created_at desc);
create index lfg_posts_status_created_idx on public.lfg_posts (status, created_at desc, id desc);
create index lfg_posts_author_idx on public.lfg_posts (author_id);
create index lfg_posts_expires_idx on public.lfg_posts (expires_at);

create table public.lfg_members (
  post_id uuid not null references public.lfg_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.member_status not null default 'pending',
  joined_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index lfg_members_user_idx on public.lfg_members (user_id);

-- ── Reputación ───────────────────────────────────────────────
create table public.reputations (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  played_together boolean not null default false,
  created_at timestamptz not null default now(),
  unique (author_id, target_id),
  check (author_id <> target_id)
);
create index reputations_target_idx on public.reputations (target_id, created_at desc);

-- ── Mensajería ───────────────────────────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null default 'direct',
  name text check (char_length(name) <= 60),
  group_image text,
  admin_id uuid references public.profiles (id) on delete set null,
  team_id uuid unique references public.teams (id) on delete cascade,
  last_message_content text,
  last_message_sender uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_updated_idx on public.conversations (updated_at desc);

-- last_read_at sustituye al array readBy de Mongo: un mensaje está leído por un
-- participante si created_at <= last_read_at.
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_created_idx on public.messages (created_at);

-- ── Notificaciones ───────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  lfg_post_id uuid references public.lfg_posts (id) on delete set null,
  message text not null check (char_length(message) <= 300),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index notifications_recipient_idx on public.notifications (recipient_id, read, created_at desc);
create index notifications_expires_idx on public.notifications (expires_at);
