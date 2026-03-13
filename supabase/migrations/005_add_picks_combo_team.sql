-- Migration 005: Add secondary team ID to picks for play-in combo picks
-- When a Round 1 (First Four) game has both teams but the winner hasn't played yet,
-- the round 2 slot shows "Team1/Team2". A user can pick that combined option.
-- The pick is stored with picked_team_id = team1.id and picked_team_id_2 = team2.id.
-- Scoring: correct if winner_id matches either team.
-- Resolution: once the play-in winner is known (team slot filled), update-scores
--             sets picked_team_id = winner and clears picked_team_id_2.

ALTER TABLE public.picks
  ADD COLUMN IF NOT EXISTS picked_team_id_2 INTEGER REFERENCES public.teams(id);
