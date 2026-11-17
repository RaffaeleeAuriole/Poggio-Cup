-- Poggio Open Cup — schema Supabase
-- Supabase -> SQL Editor -> New query -> incolla tutto -> Run

create table if not exists public.teams (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(name) between 1 and 40),
  color      text not null default '#1d2fe0' check (color ~ '^#[0-9a-fA-F]{6}$'),
  logo_url   text,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id           bigint generated always as identity primary key,
  first_name   text not null,
  last_name    text not null,
  team_id      bigint not null references public.teams(id) on delete restrict,
  number       int check (number between 0 and 999),
  role         text not null default 'Jolly'
               check (role in ('Portiere','Difensore','Centrocampista','Attaccante','Jolly')),
  photo_url    text,
  goals        int not null default 0 check (goals >= 0),
  assists      int not null default 0 check (assists >= 0),
  mvp          int not null default 0 check (mvp >= 0),
  yellow_cards int not null default 0 check (yellow_cards >= 0),
  clean_sheets int not null default 0 check (clean_sheets >= 0),
  created_at   timestamptz not null default now()
);

create table if not exists public.matches (
  id           bigint generated always as identity primary key,
  home_team_id bigint not null references public.teams(id) on delete restrict,
  away_team_id bigint not null references public.teams(id) on delete restrict,
  match_date   timestamptz not null,
  matchday     int check (matchday between 1 and 99),
  home_goals   int check (home_goals >= 0),
  away_goals   int check (away_goals >= 0),
  created_at   timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  check ((home_goals is null) = (away_goals is null))
);

create table if not exists public.admins (
  id         bigint generated always as identity primary key,
  username   text not null unique,
  code_hash  text not null,
  role       text not null default 'admin' check (role in ('admin','superadmin')),
  created_at timestamptz not null default now()
);

create index if not exists players_team_idx on public.players(team_id);
create index if not exists matches_date_idx on public.matches(match_date);

-- Gol per partita (marcatori)
create table if not exists public.goals (
  id        bigint generated always as identity primary key,
  match_id  bigint not null references public.matches(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete restrict,
  minute    int check (minute between 0 and 130),
  own_goal  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists goals_match_idx on public.goals(match_id);
create index if not exists goals_player_idx on public.goals(player_id);
alter table public.goals enable row level security;

-- SICUREZZA: Row Level Security attiva e NESSUNA policy.
-- Così la chiave pubblica (anon) non può leggere né scrivere nulla direttamente:
-- tutto passa dal tuo PHP, che usa la chiave segreta lato server.
alter table public.teams   enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.admins  enable row level security;

-- Bucket pubblico per foto giocatori e loghi (solo lettura pubblica; scrive il PHP).
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
