# GitHub Pages + Supabase Hosting Guide

This document walks you through deploying the **March Madness** bracket app on
**GitHub Pages** (frontend) + **Supabase** (database, auth, and serverless functions).

---

## Why this architecture?

| Requirement | Solution |
|---|---|
| Free hosting | GitHub Pages (free for public repos) |
| Database | Supabase PostgreSQL (free tier) |
| Authentication | Supabase Auth |
| Server-side API sync | Supabase Edge Functions (Deno, free tier) |
| No server needed | All app logic runs in the browser via JS + Supabase SDK |

---

## Step 1 – Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project** and give it a name (e.g. `march-madness`).
3. Choose the free tier and a region near your users.
4. Note your **Project URL** and **anon (public) key** from  
   `Project Settings → API`.

---

## Step 2 – Run the database migration

1. In your Supabase dashboard, open the **SQL Editor**.
2. Copy and paste the contents of `supabase/migrations/001_init_schema.sql`.
3. Click **Run** to create all tables, indexes, and RLS policies.

---

## Step 3 – Create your admin account

1. In Supabase, go to `Authentication → Users → Add user`.
2. Create a user with the admin email (e.g. `sophieallen0798@gmail.com`).
3. Set a strong password.

---

## Step 4 – Configure the static site

Open `docs/js/config.js` and replace the placeholder values:

```js
const SUPABASE_URL      = "https://YOUR_PROJECT_REF.supabase.co"; // ← your project URL
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE";                   // ← your anon key

const ADMIN_EMAILS = ["sophieallen0798@gmail.com"];                // ← admin email(s)
```

> **Security note:** The **anon key** is intentionally public. It is designed
> to be embedded in client-side code. Your data is protected by the Row Level
> Security (RLS) policies in the database migration – anonymous users can only
> read data and insert new bracket submissions; they cannot delete or modify
> existing records.

---

## Step 5 – Deploy the Edge Functions

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) then run:

```bash
# Log in
supabase login

# Link to your project (get the project ref from the dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Set required environment variables for the functions
supabase secrets set ADMIN_EMAILS="sophieallen0798@gmail.com"

# Deploy both functions
supabase functions deploy sync-bracket
supabase functions deploy update-scores
```

The CLI picks up the function code from `supabase/functions/`.

---

## Step 6 – Push to GitHub and enable GitHub Pages

1. Create a **public** GitHub repository (required for the free Pages tier).
2. Push this project:
   ```bash
   git init
   git add .
   git commit -m "Initial static site"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. In the GitHub repository, go to  
   `Settings → Pages → Build and deployment`.
4. Set **Source** to `Deploy from a branch`.
5. Set **Branch** to `main` and **Folder** to `/docs`.
6. Click **Save**.

GitHub will publish the site to `https://YOUR_USERNAME.github.io/YOUR_REPO/`.

> **Tip:** The included `.github/workflows/deploy-pages.yml` workflow will
> automatically redeploy whenever you push changes to the `docs/` folder.

---

## Step 7 – First-time use (sync tournament data)

1. Browse to your published site.
2. Click **Sign in** and log in with your admin email.
3. Navigate to **Admin**.
4. Click **Sync Men's Bracket from API** and **Sync Women's Bracket from API**.
   - This calls `supabase/functions/sync-bracket` which fetches teams and
     games from the public NCAA proxy API and writes them to your database.
5. Users can now visit **Submit Bracket** to fill out their picks.

During the tournament, click **Update Scores** after each round completes to
refresh winners and recalculate everyone's points.

---

## File structure

```
docs/                         ← GitHub Pages root (static files only)
├── index.html
├── submit-bracket.html
├── standings.html
├── my-bracket.html
├── admin.html
├── login.html
├── 404.html
├── css/
│   └── styles.css
└── js/
    ├── config.js             ← ⚠️  EDIT THIS with your Supabase credentials
    ├── auth.js
    └── bracket-render.js

supabase/
├── migrations/
│   └── 001_init_schema.sql   ← Run this in Supabase SQL Editor
└── functions/
    ├── sync-bracket/
    │   └── index.ts          ← Fetches NCAA API bracket data
    └── update-scores/
        └── index.ts          ← Fetches NCAA scoreboard, updates winners

.github/
└── workflows/
    └── deploy-pages.yml      ← Auto-deploys docs/ to GitHub Pages
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "Error loading bracket" on the site | Run Sync in Admin first; or check Supabase credentials in `config.js` |
| Admin page shows "Access Denied" | Make sure you're signed in with an email listed in `ADMIN_EMAILS` in `config.js` |
| Edge Function returns 401 | Re-login in the browser (session may have expired) |
| Edge Function returns 403 | Your Supabase account email must match `ADMIN_EMAILS` |
| Bracket picks not saving | Check browser console for Supabase error; RLS must allow anon INSERT |
| GitHub Pages not updating | Check `Actions` tab in GitHub for deployment status |

---

## Local development

Since the site is plain HTML/JS, you can preview it with any static file server:

```bash
# Python (built-in)
cd docs
python -m http.server 8080

# Node.js (npx)
npx serve docs
```

Then open `http://localhost:8080`.
