// ─────────────────────────────────────────────────────────────────
// Supabase configuration
// Replace the two placeholder values below with your project's
// URL and anon (public) key from:
//   Supabase Dashboard → Project Settings → API
//
// The anon key is SAFE to commit – it is the public facing key
// protected by Row Level Security policies in your database.
// ─────────────────────────────────────────────────────────────────

//import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = "https://cariysgrjyouubotztay.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SCi5yb5NEhucwFQqK0JlGQ_cDesbTPr";

// Admin email addresses (must match Supabase Auth users)
const ADMIN_EMAILS = ["sophieallen0798@gmail.com"];

// Year of the current tournament
const TOURNAMENT_YEAR = 2025;

//                 import { createClient } from '@supabase/supabase-js'
// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
// Initialize the Supabase client (supabase-js v2 loaded from CDN in each page)
// Use the UMD client loaded on `window.supabase` and create the project client.
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


//Database=postgres;Username=postgres;Password=W9RwjAuzdDK2;SSL Mode=Require;Trust Server Certificate=true