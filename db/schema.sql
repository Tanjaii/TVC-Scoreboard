-- TVC Scoreboard schema. Safe to run repeatedly.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'scorekeeper')),
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_key on users (lower(email));

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_idx on sessions (user_id);

-- One-time staff invitation links. Only a hash of the token is stored.
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  role text not null check (role in ('admin', 'scorekeeper')),
  note text not null default '',
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references users (id) on delete set null,
  revoked_at timestamptz
);

create table if not exists login_attempts (
  id bigserial primary key,
  key text not null,
  at timestamptz not null default now()
);

create index if not exists login_attempts_key_idx on login_attempts (key, at);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null default '',
  logo_url text not null default '',
  info text not null default '',
  created_at timestamptz not null default now()
);

create unique index if not exists teams_name_key on teams (lower(name));

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  home_team_id uuid not null references teams (id) on delete restrict,
  away_team_id uuid not null references teams (id) on delete restrict,
  stage text not null default '',
  scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed')),
  sets jsonb not null default '[]'::jsonb,
  current_set jsonb,
  stats jsonb not null,
  is_broadcasting boolean not null default false,
  version integer not null default 1,
  updated_by uuid references users (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

-- At most one match can be live at a time.
create unique index if not exists matches_one_live on matches (status) where status = 'live';
create index if not exists matches_schedule_idx on matches (status, scheduled_at);
