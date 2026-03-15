-- Migration 006: Add sync_status table to record last backend sync time

CREATE TABLE IF NOT EXISTS public.sync_status (
  id TEXT PRIMARY KEY,
  last_refreshed_at timestamptz NOT NULL DEFAULT now()
);

-- Optionally insert an initial row
INSERT INTO public.sync_status (id, last_refreshed_at)
SELECT 'last_api_sync', NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.sync_status WHERE id = 'last_api_sync');
