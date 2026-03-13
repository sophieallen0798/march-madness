// Supabase Edge Function: update-scores
// Fetches latest scoreboard from NCAA proxy API and updates game results
// in Supabase.  Also recalculates total_points on every affected bracket.
//
// Invoke via POST /functions/v1/update-scores
// Body: { "sport": "basketball-men", "year": 2025 }
// Headers: Authorization: Bearer <supabase_user_jwt>  (must be admin)

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

  // ── Auth ──────────────────────────────────────────────────────────────────
  // Support either Supabase JWT or an admin code (x-admin-code header)
  const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey  = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminEmailsRaw   = Deno.env.get("ADMIN_EMAILS") ?? "";
  const adminEmails      = adminEmailsRaw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  const adminCodeHeader = req.headers.get("x-admin-code") ?? "";
  // Use a dedicated admin access code for function calls (separate from SITE_ACCESS_CODE used for site gating)
  const adminCodeEnv = (Deno.env.get("ADMIN_ACCESS_CODE") ?? "").trim();

  // Attempt to read code from request body (support JSON or urlencoded form)
  let adminCodeBody = "";
  try {
    const raw = await req.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        adminCodeBody = (parsed?.code ?? "").toString();
      } catch {
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
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Missing auth", 401);
    const jwt = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return jsonError("Invalid token", 401);
    if (!adminEmails.includes(user.email?.toLowerCase() ?? "")) {
      return jsonError("Forbidden", 403);
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let sport = "basketball-men";
  let year  = 2025;
  try {
    const body = await req.json();
    if (body.sport) sport = body.sport;
    if (body.year)  year  = Number(body.year);
  } catch { /* defaults */ }

  const svc = createClient(supabaseUrl, serviceKey);

  // ── Fetch scoreboard from NCAA proxy API ───────────────────────────────────
  const apiUrl = `${NCAA_API_BASE}/scoreboard/${sport}/d1`;
  let scoreboardData: any;
  try {
    const resp = await fetch(apiUrl);
    if (!resp.ok) throw new Error(`NCAA API returned ${resp.status}`);
    scoreboardData = await resp.json();
  } catch (err: any) {
    return jsonError(`Failed to fetch scoreboard: ${err.message}`, 502);
  }

  const games: any[] = scoreboardData?.games ?? scoreboardData?.Games ?? [];

  // ── Build contestId -> game lookup from our DB ────────────────────────────
  const { data: dbGames } = await svc
    .from("games")
    .select("id, contest_id, bracket_position_id, team1_id, team2_id")
    .eq("sport", sport)
    .eq("year", year);

  const gameByContestId = new Map<number, any>();
  for (const g of (dbGames ?? [])) gameByContestId.set(g.contest_id, g);

  // ── Build seoName -> teamId ───────────────────────────────────────────────
  const { data: dbTeams } = await svc
    .from("teams")
    .select("id, seo_name")
    .eq("sport", sport)
    .eq("year", year);
  const teamIdBySeo = new Map<string, number>();
  for (const t of (dbTeams ?? [])) teamIdBySeo.set(t.seo_name, t.id);

  let updatedGames = 0;

  for (const apiGame of games) {
    const contestId = Number(apiGame.contestId ?? apiGame.ContestId ?? 0);
    const dbGame = gameByContestId.get(contestId);
    if (!dbGame) continue;

    const apiTeams: any[] = apiGame.teams ?? apiGame.Teams ?? [];
    const winnerTeam = apiTeams.find(
      (t: any) => (t.isWinner ?? t.IsWinner) === true || String(t.winner ?? t.Winner) === "true",
    );
    const winnerSeo   = winnerTeam?.seoName ?? winnerTeam?.SeoName;
    const winnerId    = winnerSeo ? (teamIdBySeo.get(winnerSeo) ?? null) : null;
    const gameState   = apiGame.gameState ?? apiGame.GameState ?? "pre";
    const t1Score     = apiTeams[0]?.score != null ? Number(apiTeams[0].score) : null;
    const t2Score     = apiTeams[1]?.score != null ? Number(apiTeams[1].score) : null;
    const currentPer  = String(apiGame.currentPeriod ?? apiGame.CurrentPeriod ?? "");

    const { error: updErr } = await svc
      .from("games")
      .update({ winner_id: winnerId, game_state: gameState, team1_score: t1Score, team2_score: t2Score, current_period: currentPer })
      .eq("id", dbGame.id);

    if (!updErr) updatedGames++;
  }

  // ── Recalculate total_points for all brackets of this sport/year ──────────
  const { data: brackets } = await svc
    .from("brackets")
    .select("id")
    .eq("sport", sport)
    .eq("year", year);

  // ── Resolve combo picks where the play-in winner is now known ─────────────
  // When a round 2 game's team slot has been filled (sync-bracket ran after the
  // play-in), update any picks that still carry picked_team_id_2 for that game
  // to a single resolved team (the one that actually entered the game).
  const { data: comboPicks } = await svc
    .from("picks")
    .select("id, picked_team_id, picked_team_id_2, games(id, team1_id, team2_id, sport, year)")
    .not("picked_team_id_2", "is", null);

  for (const p of (comboPicks ?? [])) {
    const game = (p as any).games;
    if (!game || game.sport !== sport || game.year !== year) continue;
    const t1 = game.team1_id as number | null;
    const t2 = game.team2_id as number | null;
    const pid  = p.picked_team_id as number;
    const pid2 = (p as any).picked_team_id_2 as number;
    let resolvedId: number | null = null;
    if (t1 && (t1 === pid || t1 === pid2)) resolvedId = t1;
    else if (t2 && (t2 === pid || t2 === pid2)) resolvedId = t2;
    if (resolvedId) {
      await svc.from("picks")
        .update({ picked_team_id: resolvedId, picked_team_id_2: null })
        .eq("id", p.id);
    }
  }

  // ── Fetch picks (after resolution) and recalculate points ─────────────────
  const { data: allPickRows } = await svc
    .from("picks")
    .select("bracket_id, game_id, picked_team_id, picked_team_id_2, games(round, winner_id)")
    .in("bracket_id", (brackets ?? []).map((b: any) => b.id));

  const pointsByBracket = new Map<number, number>();
  for (const p of (allPickRows ?? [])) {
    const game = (p as any).games;
    if (!game) continue;
    const round       = game.round as number;
    const roundPoints = Math.pow(2, round - 1);
    const pid2        = (p as any).picked_team_id_2 as number | null;
    if (game.winner_id &&
        (p.picked_team_id === game.winner_id || pid2 === game.winner_id)) {
      pointsByBracket.set(p.bracket_id, (pointsByBracket.get(p.bracket_id) ?? 0) + roundPoints);
    }
  }

  for (const [bracketId, points] of pointsByBracket.entries()) {
    await svc.from("brackets").update({ total_points: points }).eq("id", bracketId);
  }

  return new Response(
    JSON.stringify({ success: true, updatedGames, bracketsRecalculated: brackets?.length ?? 0 }),
    { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
