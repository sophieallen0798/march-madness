// Supabase Edge Function: sync-bracket
// Fetches bracket (teams + games) from the public NCAA proxy API
// and upserts into Supabase.
//
// Invoke via POST /functions/v1/sync-bracket
// Body: { "sport": "basketball-men", "year": 2025 }
// Headers: Authorization: Bearer <supabase_user_jwt>
//
// The function verifies the caller is an admin (email in ADMIN_EMAILS env var).

import { createClient } from "jsr:@supabase/supabase-js@2";

const NCAA_API_BASE = "https://ncaa-api.henrygd.me";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, x-admin-code",
      },
    });
  }

  // ── Auth: only admins can call this ──────────────────────────────────────
  // Support either a Supabase JWT (Authorization: Bearer <token>) OR an admin access code
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminEmailsRaw = Deno.env.get("ADMIN_EMAILS") ?? "";
  const adminEmails = adminEmailsRaw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  // If an admin code is provided in header `x-admin-code` or in the POST body, accept it (development convenience)
  const adminCodeHeader = req.headers.get("x-admin-code") ?? "";
  // Use a dedicated admin access code for function calls (separate from SITE_ACCESS_CODE used for site gating)
  const adminCodeEnv = (Deno.env.get("ADMIN_ACCESS_CODE") ?? "").trim();

  // ── Parse body once (body stream can only be read once) ─────────────────
  let parsedBody: any = null;
  let adminCodeBody = "";
  try {
    const raw = await req.text();
    if (raw) {
      try {
        parsedBody = JSON.parse(raw);
        adminCodeBody = (parsedBody?.code ?? "").toString();
      } catch {
        // Not JSON — try urlencoded
        try {
          const params = new URLSearchParams(raw);
          adminCodeBody = params.get("code") ?? "";
        } catch {
          adminCodeBody = "";
        }
      }
    }
  } catch {
    adminCodeBody = "";
  }

  const providedAdminCode = (adminCodeHeader || adminCodeBody || "").trim();
  if (providedAdminCode && adminCodeEnv && providedAdminCode === adminCodeEnv) {
    // Bypass JWT validation — treat as admin
  } else {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Missing Authorization header", 401);
    }
    const jwt = authHeader.replace("Bearer ", "");

    // Verify the user's JWT and get their email
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonError("Invalid token", 401);
  }

  // ── Extract sport/year from already-parsed body ───────────────────────────
  let sport = "basketball-men";
  let year = 202;
  if (parsedBody) {
    if (parsedBody.sport) sport = parsedBody.sport;
    if (parsedBody.year) year = Number(parsedBody.year);
  }

  // ── Fetch from NCAA proxy API ─────────────────────────────────────────────
  const apiUrl = `${NCAA_API_BASE}/brackets/${sport}/d1/${year}`;
  let bracketData: any;
  try {
    const resp = await fetch(apiUrl);
    if (!resp.ok) throw new Error(`NCAA API returned ${resp.status}`);
    bracketData = await resp.json();
  } catch (err: any) {
    return jsonError(`Failed to fetch NCAA API: ${err.message}`, 502);
  }

  const championships = bracketData?.championships ?? bracketData?.Championships;
  if (!championships?.length) {
    return jsonError("No championship data in API response", 502);
  }
  const championship = championships[0];
  const apiGames: any[] = championship.games ?? championship.Games ?? [];

  // Build sectionId -> region name map from championship.regions.
  // This mirrors BracketSyncService.MapSectionIdToRegion() in the .NET service.
  // Men's and women's feeds use the same sectionId numbers (1-6) but different
  // region titles (e.g. men's sectionId 3 = "East", women's sectionId 3 = "Birmingham"),
  // so we must resolve the name from the championship's own regions array.
  const apiRegions: any[] = championship.regions ?? championship.Regions ?? [];
  const sectionToRegion = new Map<number, string>();
  for (const r of apiRegions) {
    const sid = Number(r.sectionId ?? r.SectionId ?? 0);
    const code = (r.regionCode ?? r.RegionCode ?? "") as string;
    const title = (r.title ?? r.Title ?? "") as string;
    if (sid) {
      sectionToRegion.set(sid, code === "CC" ? "Final" : (title || `Region${sid}`));
    }
  }

  // Helper: normalize start time to an ISO timestamp string or null.
  // Some API responses provide time-only strings like "18:40" which
  // Postgres cannot cast to timestamptz. Return null for time-only
  // values or invalid dates to avoid upsert errors.
  function parseStartTime(game: any): string | null {
    if (!game) return null;

    // Prefer epoch if provided
    const epoch = Number(game.startTimeEpoch ?? game.start_time_epoch ?? game.starttimeepoch ?? 0);
    if (epoch && !isNaN(epoch) && epoch > 0) {
      return new Date(epoch * 1000).toISOString();
    }

    // If both date and time are present, try to construct a local Date
    const dateStr = game.startDate ?? game.start_date ?? game.startdate ?? null;
    const timeStr = game.startTime ?? game.start_time ?? game.starttime ?? null;
    if (dateStr && timeStr) {
      // date expected like MM/DD/YYYY in feed
      const m = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      const t = String(timeStr).trim().match(/(\d{1,2}):(\d{2})/);
      if (m && t) {
        const month = Number(m[1]) - 1;
        const day = Number(m[2]);
        const year = Number(m[3]);
        const hour = Number(t[1]);
        const minute = Number(t[2]);
        const d = new Date(Date.UTC(year, month, day, hour, minute));
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }

    // If a full ISO-like string is present anywhere, try parsing it
    const raw = game.startTime ?? game.start_time ?? game.StartTime ?? null;
    if (raw) {
      const s = String(raw).trim();
      if (s.includes('T') || /\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }

    return null;
  }

  // ── Upsert using service role ─────────────────────────────────────────────
  const svc = createClient(supabaseUrl, supabaseServiceKey);

  // Collect all unique teams
  const teamMap = new Map<string, any>(); // key -> team
  for (const g of apiGames) {
    for (const t of (g.teams ?? g.Teams ?? [])) {
      const seo = t.seoName ?? t.SeoName ?? t.seoname ?? t.Seo ?? t.seo ?? null;
      const key = (seo ?? t.nameShort ?? t.NameShort ?? t.name ?? t.Name ?? '').toString().toLowerCase();
      if (key && !teamMap.has(key)) teamMap.set(key, t);
    }
  }

  // Upsert teams
  const teamRows = [...teamMap.values()].map((t) => ({
    name:       t.nameShort ?? t.NameShort ?? t.name ?? t.Name ?? "",
    seo_name:   t.seoName ?? t.SeoName ?? t.seoname ?? t.Seo ?? t.seo ?? "",
    name_full:  t.nameFull ?? t.NameFull ?? "",
    name_short: t.nameShort ?? t.NameShort ?? "",
    seed:       Number(t.seed ?? t.Seed ?? 0),
    logo_url:   t.logoUrl ?? t.LogoUrl ?? "",
    sport,
    year,
  }));

  if (teamRows.length) {
    const { error: teamErr } = await svc.from("teams").upsert(teamRows, {
      onConflict: "seo_name,sport,year",
      ignoreDuplicates: false,
    });
    if (teamErr) return jsonError(`Team upsert failed: ${teamErr.message}`, 500);
  }

  // Build name/seo -> id lookup. NCAA data sometimes omits seoName
  // or uses slightly different fields between men's and women's feeds.
  const { data: dbTeams } = await svc
    .from("teams")
    .select("id, seo_name, name_short, name_full")
    .eq("sport", sport)
    .eq("year", year);
  const teamIdByKey = new Map<string, number>();
  for (const t of (dbTeams ?? [])) {
    if (t.seo_name) teamIdByKey.set(String(t.seo_name).toLowerCase(), t.id);
    if (t.name_short) teamIdByKey.set(String(t.name_short).toLowerCase(), t.id);
    if (t.name_full) teamIdByKey.set(String(t.name_full).toLowerCase(), t.id);
  }

  // Upsert games
  const gameRows = apiGames.map((g: any) => {
    const teams: any[] = g.teams ?? g.Teams ?? [];
    const t1 = teams[0] ?? {};
    const t2 = teams[1] ?? {};
    const t1seo = (t1.seoName ?? t1.SeoName ?? t1.seoname ?? t1.seo ?? t1.Seo) as string | undefined;
    const t2seo = (t2.seoName ?? t2.SeoName ?? t2.seoname ?? t2.seo ?? t2.Seo) as string | undefined;
    const t1name = (t1.nameShort ?? t1.NameShort ?? t1.name ?? t1.Name ?? t1.nameFull ?? t1.NameFull) as string | undefined;
    const t2name = (t2.nameShort ?? t2.NameShort ?? t2.name ?? t2.Name ?? t2.nameFull ?? t2.NameFull) as string | undefined;
    // Some feeds denote winner by teams[].isWinner
    let winnerSeo = (g.winner?.seoName ?? g.winner?.SeoName ?? g.winner?.seoname ?? g.Winner?.seoName ?? g.Winner?.SeoName ?? g.Winner?.seoname ?? g.winner?.seo ?? g.Winner?.seo) as string | undefined;
    if (!winnerSeo) {
      const win = teams.find((x: any) => (x.isWinner ?? x.IsWinner) === true);
      winnerSeo = win ? (win.seoName ?? win.SeoName ?? win.seoname ?? win.seo ?? null) : undefined;
    }

    // Derive round from bracketId (first digit) or bracketPositionId (first digit)
    const bracketPositionId = Number(g.bracketPositionId ?? g.BracketPositionId ?? 0);
    const bracketIdApi      = Number(g.bracketId ?? g.BracketId ?? 0);
    const roundFromPos      = bracketPositionId > 0 ? Math.floor(bracketPositionId / 100) : 0;
    const sectionId         = Number(g.sectionId ?? g.SectionId ?? 0);
    const region            = sectionToRegion.get(sectionId) ?? (sectionId ? `Region${sectionId}` : "");

    return {
      contest_id:                 Number(g.contestId ?? g.ContestId ?? 0),
      bracket_position_id:        bracketPositionId,
      bracket_id_api:             bracketIdApi,
      victor_bracket_position_id: Number(g.victorBracketPositionId ?? g.VictorBracketPositionId ?? 0) || null,
      round:                      roundFromPos,
      region,
      section_id:                 sectionId,
      sport,
      year,
      team1_id:    (t1seo && teamIdByKey.get(t1seo.toLowerCase())) ?? (t1name && teamIdByKey.get(t1name.toLowerCase())) ?? null,
      team2_id:    (t2seo && teamIdByKey.get(t2seo.toLowerCase())) ?? (t2name && teamIdByKey.get(t2name.toLowerCase())) ?? null,
      winner_id:   (winnerSeo && teamIdByKey.get(String(winnerSeo).toLowerCase())) ?? null,
      game_state:  g.gameState ?? g.GameState ?? "pre",
      start_time:  parseStartTime(g),
      title:       g.title ?? g.Title ?? "",
      team1_score: g.teams?.[0]?.score != null ? Number(g.teams[0].score) : null,
      team2_score: g.teams?.[1]?.score != null ? Number(g.teams[1].score) : null,
    };
  }).filter((r) => r.bracket_position_id > 0);

  // Log any games missing key ids so we can inspect differences between feeds
  const problematic = gameRows.filter(g => !g.team1_id || !g.team2_id || !g.contest_id || !g.bracket_position_id);
  if (problematic.length) {
    console.log('sync-bracket: problematic games sample', JSON.stringify(problematic.slice(0,10)));
  }

  if (gameRows.length) {
    const { error: gameErr } = await svc.from("games").upsert(gameRows, {
      onConflict: "bracket_position_id,sport,year",
      ignoreDuplicates: false,
    });
    if (gameErr) return jsonError(`Game upsert failed: ${gameErr.message}`, 500);
  }

  return new Response(
    JSON.stringify({ success: true, teams: teamRows.length, games: gameRows.length }),
    { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
