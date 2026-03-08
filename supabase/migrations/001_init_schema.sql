-- March Madness Tournament - Supabase Schema
-- Run this migration in your Supabase project's SQL editor

-- ────────────────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.teams (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    seo_name    TEXT NOT NULL DEFAULT '',
    name_full   TEXT NOT NULL DEFAULT '',
    name_short  TEXT NOT NULL DEFAULT '',
    seed        INTEGER NOT NULL DEFAULT 0,
    logo_url    TEXT NOT NULL DEFAULT '',
    region      TEXT NOT NULL DEFAULT '',
    sport       TEXT NOT NULL,
    year        INTEGER NOT NULL DEFAULT 2025,
    UNIQUE (seo_name, sport, year)
);

CREATE TABLE IF NOT EXISTS public.games (
    id                          SERIAL PRIMARY KEY,
    contest_id                  INTEGER NOT NULL DEFAULT 0,
    bracket_position_id         INTEGER NOT NULL,
    bracket_id_api              INTEGER NOT NULL DEFAULT 0,
    victor_bracket_position_id  INTEGER,
    round                       INTEGER NOT NULL,
    region                      TEXT NOT NULL DEFAULT '',
    sport                       TEXT NOT NULL,
    year                        INTEGER NOT NULL DEFAULT 2025,
    team1_id                    INTEGER REFERENCES public.teams (id),
    team2_id                    INTEGER REFERENCES public.teams (id),
    winner_id                   INTEGER REFERENCES public.teams (id),
    game_state                  TEXT NOT NULL DEFAULT 'pre',
    current_period              TEXT NOT NULL DEFAULT '',
    start_time                  TIMESTAMPTZ,
    title                       TEXT NOT NULL DEFAULT '',
    team1_score                 INTEGER,
    team2_score                 INTEGER,
    UNIQUE (bracket_position_id, sport, year)
);

CREATE TABLE IF NOT EXISTS public.app_users (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    auth_user_id UUID REFERENCES auth.users (id),
    company TEXT NOT NULL DEFAULT '',
    team TEXT NOT NULL DEFAULT '',
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.brackets (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES public.app_users (id),
    sport          TEXT NOT NULL,
    year           INTEGER NOT NULL DEFAULT 2025,
    bracket_name   TEXT NOT NULL,
    submitted_date TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    total_points   INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, sport, year)
);

CREATE TABLE IF NOT EXISTS public.picks (
    id              SERIAL PRIMARY KEY,
    bracket_id      INTEGER NOT NULL REFERENCES public.brackets (id),
    game_id         INTEGER NOT NULL REFERENCES public.games (id),
    picked_team_id  INTEGER NOT NULL REFERENCES public.teams (id),
    UNIQUE (bracket_id, game_id)
);

-- ────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────

ALTER TABLE public.teams     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brackets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picks     ENABLE ROW LEVEL SECURITY;

-- Public read (everyone can view tournament data, standings, brackets)
CREATE POLICY "teams: public read"     ON public.teams     FOR SELECT USING (true);
CREATE POLICY "games: public read"     ON public.games     FOR SELECT USING (true);
CREATE POLICY "app_users: public read" ON public.app_users FOR SELECT USING (true);
CREATE POLICY "brackets: public read"  ON public.brackets  FOR SELECT USING (true);
CREATE POLICY "picks: public read"     ON public.picks     FOR SELECT USING (true);

-- Anon inserts for bracket submission (no login required)
CREATE POLICY "app_users: anon insert" ON public.app_users FOR INSERT WITH CHECK (true);
CREATE POLICY "brackets: anon insert"  ON public.brackets  FOR INSERT WITH CHECK (true);
CREATE POLICY "picks: anon insert"     ON public.picks     FOR INSERT WITH CHECK (true);

-- NOTE: Teams and games are written only by Edge Functions (service-role key).
-- No additional insert/update/delete policies needed for those tables from the browser.

-- ────────────────────────────────────────────────────────
-- HELPFUL INDEXES
-- ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_games_sport_year    ON public.games (sport, year);
CREATE INDEX IF NOT EXISTS idx_brackets_sport_year ON public.brackets (sport, year);
CREATE INDEX IF NOT EXISTS idx_picks_bracket_id    ON public.picks (bracket_id);
CREATE INDEX IF NOT EXISTS idx_picks_game_id       ON public.picks (game_id);
