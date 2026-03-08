-- 002_migrate_pascal_to_lowercase.sql
-- Safe migration: create lowercase tables (if missing), copy data from
-- PascalCase EF-created tables, update sequences, and optionally rename
-- the old tables to *_old for manual verification before drop.
-- Run this in Supabase SQL editor after backing up your DB.

BEGIN;

-- 1) Ensure lowercase tables exist (definitions match 001_init_schema.sql)
-- Teams
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

-- Games
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

-- App users
CREATE TABLE IF NOT EXISTS public.app_users (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    auth_user_id UUID REFERENCES auth.users (id),
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    UNIQUE (name)
);

-- Brackets
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

-- Picks
CREATE TABLE IF NOT EXISTS public.picks (
    id              SERIAL PRIMARY KEY,
    bracket_id      INTEGER NOT NULL REFERENCES public.brackets (id),
    game_id         INTEGER NOT NULL REFERENCES public.games (id),
    picked_team_id  INTEGER NOT NULL REFERENCES public.teams (id),
    UNIQUE (bracket_id, game_id)
);

-- 2) Copy data from PascalCase tables if they exist and target tables are empty.
DO $$
BEGIN
    -- Teams
    IF to_regclass('"Teams"') IS NOT NULL AND (SELECT count(*) FROM public.teams) = 0 THEN
        INSERT INTO public.teams (id, name, seo_name, name_full, name_short, seed, logo_url, region, sport, year)
        SELECT "Id", "Name", "SeoName", "NameFull", "NameShort", "Seed", "LogoUrl", "Region", "Sport", "Year"
        FROM "Teams";
        PERFORM setval(pg_get_serial_sequence('public.teams','id'), (SELECT COALESCE(MAX(id),0) FROM public.teams));
    END IF;

    -- Games
    IF to_regclass('"Games"') IS NOT NULL AND (SELECT count(*) FROM public.games) = 0 THEN
        INSERT INTO public.games (id, contest_id, bracket_position_id, bracket_id_api, victor_bracket_position_id, round, region, sport, year, team1_id, team2_id, winner_id, game_state, current_period, start_time, title, team1_score, team2_score)
        SELECT "Id", "ContestId", "BracketPositionId", COALESCE("BracketId",0), "VictorBracketPositionId", "Round", "Region", "Sport", "Year", "Team1Id", "Team2Id", "WinnerId", "GameState", "CurrentPeriod", "StartTime", "Title", "Team1Score", "Team2Score"
        FROM "Games";
        PERFORM setval(pg_get_serial_sequence('public.games','id'), (SELECT COALESCE(MAX(id),0) FROM public.games));
    END IF;

    -- Users -> app_users
    IF to_regclass('"Users"') IS NOT NULL AND (SELECT count(*) FROM public.app_users) = 0 THEN
        INSERT INTO public.app_users (id, name, created_date)
        SELECT "Id", "Name", "CreatedDate"
        FROM "Users";
        PERFORM setval(pg_get_serial_sequence('public.app_users','id'), (SELECT COALESCE(MAX(id),0) FROM public.app_users));
    END IF;

    -- Brackets
    IF to_regclass('"Brackets"') IS NOT NULL AND (SELECT count(*) FROM public.brackets) = 0 THEN
        INSERT INTO public.brackets (id, user_id, sport, year, bracket_name, submitted_date, total_points)
        SELECT "Id", "UserId", "Sport", "Year", "BracketName", "SubmittedDate", "TotalPoints"
        FROM "Brackets";
        PERFORM setval(pg_get_serial_sequence('public.brackets','id'), (SELECT COALESCE(MAX(id),0) FROM public.brackets));
    END IF;

    -- Picks
    IF to_regclass('"Picks"') IS NOT NULL AND (SELECT count(*) FROM public.picks) = 0 THEN
        INSERT INTO public.picks (id, bracket_id, game_id, picked_team_id)
        SELECT "Id", "BracketId", "GameId", "PickedTeamId"
        FROM "Picks";
        PERFORM setval(pg_get_serial_sequence('public.picks','id'), (SELECT COALESCE(MAX(id),0) FROM public.picks));
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 3) Optional: rename old PascalCase tables out of the way after verifying data.
-- Uncomment the following RENAME statements only after you verify the copied data.

-- ALTER TABLE IF EXISTS "Picks" RENAME TO "Picks_old";
-- ALTER TABLE IF EXISTS "Brackets" RENAME TO "Brackets_old";
-- ALTER TABLE IF EXISTS "Games" RENAME TO "Games_old";
-- ALTER TABLE IF EXISTS "Teams" RENAME TO "Teams_old";
-- ALTER TABLE IF EXISTS "Users" RENAME TO "Users_old";

COMMIT;

-- NOTE: This script copies data but does NOT create RLS policies or indexes.
-- Run 001_init_schema.sql (or re-run it) to ensure policies and helpful indexes exist.
-- After running, verify counts:
-- SELECT (SELECT count(*) FROM "Teams") AS old_teams, (SELECT count(*) FROM public.teams) AS new_teams;
-- Repeat for Games, Users/app_users, Brackets, Picks.
