-- Migration 004: Add buy-in, office, and department fields to app_users
-- These fields are collected during new-user bracket submission and used
-- to sort/filter standings.

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS buy_in       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS buy_in_email TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS office       TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS department   TEXT    NOT NULL DEFAULT '';
