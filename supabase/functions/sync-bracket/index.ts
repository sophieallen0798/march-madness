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
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  // ── Auth: only admins can call this ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError("Missing Authorization header", 401);
  }
  const jwt = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminEmailsRaw = Deno.env.get("ADMIN_EMAILS") ?? "";
  const adminEmails = adminEmailsRaw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  // Verify the user's JWT and get their email
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError("Invalid token", 401);
  if (!adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    return jsonError("Forbidden: not an admin", 403);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let sport = "basketball-men";
  let year = 2025;
  try {
    const body = await req.json();
    if (body.sport) sport = body.sport;
    if (body.year) year = Number(body.year);
  } catch {
    // defaults are fine
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

  // ── Upsert using service role ─────────────────────────────────────────────
  const svc = createClient(supabaseUrl, supabaseServiceKey);

  // Collect all unique teams
  const teamMap = new Map<string, any>(); // seoName -> team
  for (const g of apiGames) {
    for (const t of (g.teams ?? g.Teams ?? [])) {
      const seo = t.seoName ?? t.SeoName;
      if (seo && !teamMap.has(seo)) teamMap.set(seo, t);
    }
  }

  // Upsert teams
  const teamRows = [...teamMap.values()].map((t) => ({
    name:       t.nameShort ?? t.NameShort ?? t.name ?? t.Name ?? "",
    seo_name:   t.seoName ?? t.SeoName ?? "",
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

  // Build seoName -> id lookup
  const { data: dbTeams } = await svc
    .from("teams")
    .select("id, seo_name")
    .eq("sport", sport)
    .eq("year", year);
  const teamIdBySeo = new Map<string, number>();
  for (const t of (dbTeams ?? [])) teamIdBySeo.set(t.seo_name, t.id);

  // Upsert games
  const gameRows = apiGames.map((g: any) => {
    const teams: any[] = g.teams ?? g.Teams ?? [];
    const t1seo = teams[0]?.seoName ?? teams[0]?.SeoName;
    const t2seo = teams[1]?.seoName ?? teams[1]?.SeoName;
    const winnerSeo = g.winner?.seoName ?? g.winner?.SeoName ?? g.Winner?.seoName ?? g.Winner?.SeoName;

    // Derive round from bracketId (first digit) or bracketPositionId (first digit)
    const bracketPositionId = Number(g.bracketPositionId ?? g.BracketPositionId ?? 0);
    const bracketIdApi      = Number(g.bracketId ?? g.BracketId ?? 0);
    const roundFromPos      = bracketPositionId > 0 ? Math.floor(bracketPositionId / 100) : 0;
    const region            = g.region ?? g.Region ?? "";

    return {
      contest_id:                 Number(g.contestId ?? g.ContestId ?? 0),
      bracket_position_id:        bracketPositionId,
      bracket_id_api:             bracketIdApi,
      victor_bracket_position_id: Number(g.victorBracketPositionId ?? g.VictorBracketPositionId ?? 0) || null,
      round:                      roundFromPos,
      region,
      sport,
      year,
      team1_id:    t1seo ? (teamIdBySeo.get(t1seo) ?? null) : null,
      team2_id:    t2seo ? (teamIdBySeo.get(t2seo) ?? null) : null,
      winner_id:   winnerSeo ? (teamIdBySeo.get(winnerSeo) ?? null) : null,
      game_state:  g.gameState ?? g.GameState ?? "pre",
      start_time:  g.startTime ?? g.StartTime ?? null,
      title:       g.title ?? g.Title ?? "",
      team1_score: g.teams?.[0]?.score != null ? Number(g.teams[0].score) : null,
      team2_score: g.teams?.[1]?.score != null ? Number(g.teams[1].score) : null,
    };
  }).filter((r) => r.bracket_position_id > 0);

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
