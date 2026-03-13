// ─────────────────────────────────────────────────────────────────
// Supabase configuration
// Replace the two placeholder values below with your project's
// URL and anon (public) key from:
//   Supabase Dashboard → Project Settings → API
//
// The anon key is SAFE to commit – it is the public facing key
// protected by Row Level Security policies in your database.
// ─────────────────────────────────────────────────────────────────

const SUPABASE_URL     = "https://cariysgrjyouubotztay.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SCi5yb5NEhucwFQqK0JlGQ_cDesbTPr";

const ADMIN_EMAILS = ["sophieallen0798@gmail.com"];

const TOURNAMENT_YEAR = 2026;

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);