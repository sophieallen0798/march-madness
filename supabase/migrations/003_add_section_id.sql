-- Add section_id to games table.
-- Stores the raw numeric sectionId from the NCAA API (1=First Four, 2-5=regions, 6=Final/Championship).
-- The `region` TEXT column continues to hold the human-readable name (e.g. "South", "East").
ALTER TABLE public.games
    ADD COLUMN IF NOT EXISTS section_id INTEGER NOT NULL DEFAULT 0;
