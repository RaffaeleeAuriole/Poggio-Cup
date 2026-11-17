-- Poggio Open Cup — AGGIORNAMENTO v2 (marcatori)
-- Se hai già eseguito schema.sql: incolla SOLO questo file nel SQL Editor e premi Run.

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
