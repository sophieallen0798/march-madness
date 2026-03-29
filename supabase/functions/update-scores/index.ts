// Supabase Edge Function: update-scores
// Fetches the latest bracket data from the NCAA API, updates game results
// (winner, scores, game state) in the database, then recalculates
// total_points on every bracket. Processes both basketball-men and
// basketball-women for 2026 on every invocation.
//
// Invoke via POST /functions/v1/update-scores
// Auth:    Authorization: Bearer <supabase_user_jwt>  (must be admin)
//       OR x-admin-code: <ADMIN_ACCESS_CODE> header

import { createClient } from "jsr:@supabase/supabase-js@2";

const NCAA_API_BASE = "https://ncaa-api.henrygd.me";
const YEAR          = 2026;
const SPORTS        = ["basketball-men", "basketball-women"] as const;
const PAGE_SIZE     = 1000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-admin-code",
};

interface SportResult {
  updatedGames: number;
  recalculatedBrackets: number;
  gameErrors: string[];
  error?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const supabaseUrl     = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // NOTE: auth checks removed — this function will run for any caller.
  // If you want to re-enable protection later, restore the admin-code check.
  const svc = createClient(supabaseUrl, serviceKey);

  // ── Process both sports in parallel ──────────────────────────────────────
  const sportResults = await Promise.all(
    SPORTS.map(async (sport) => [sport, await processSport(svc, sport, YEAR)] as const)
  );
  const results = Object.fromEntries(sportResults);

  // ── Update sync timestamp ─────────────────────────────────────────────────
  await svc.from("sync_status").upsert({
    id: "last_api_sync",
    last_refreshed_at: new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({ success: true, year: YEAR, results }),
    { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
  );
});

// ── Per-sport processing ──────────────────────────────────────────────────────

async function processSport(svc: any, sport: string, year: number): Promise<SportResult> {
  // Fetch latest bracket data from the NCAA API
  const apiUrl = `${NCAA_API_BASE}/brackets/${sport}/d1/${year}`;
  let apiGames: any[];
  try {
    const resp = await fetch(apiUrl);
    if (!resp.ok) throw new Error(`NCAA API returned ${resp.status}`);
    const data = await resp.json();
    const championship = (data?.championships ?? data?.Championships)?.[0];
    if (!championship) throw new Error("No championship data in response");
    apiGames = championship.games ?? championship.Games ?? [];
  } catch (err: any) {
    console.error(`processSport(${sport}): API error: ${err.message}`);
    return { updatedGames: 0, recalculatedBrackets: 0, gameErrors: [], error: err.message };
  }

  // Build team lookup (seo_name / name → DB id)
  const { data: dbTeams, error: teamsErr } = await svc
    .from("teams")
    .select("id, seo_name, name_short, name_full")
    .eq("sport", sport)
    .eq("year", year);

  if (teamsErr) {
    return { updatedGames: 0, recalculatedBrackets: 0, gameErrors: [], error: teamsErr.message };
  }

  const teamIdByKey = new Map<string, number>();
  for (const t of (dbTeams ?? [])) {
    for (const key of [t.seo_name, t.name_short, t.name_full]) {
      if (key) teamIdByKey.set(key.toLowerCase(), t.id);
    }
  }

  // Update game results
  let updatedGames = 0;
  const gameErrors: string[] = [];

  for (const g of apiGames) {
    const bracketPositionId = Number(g.bracketPositionId ?? g.BracketPositionId ?? 0);
    if (!bracketPositionId) continue;

    const teams         = g.teams ?? g.Teams ?? [];
    const gameState     = String(g.gameState ?? g.GameState ?? "P");
    const currentPeriod = String(g.currentPeriod ?? g.CurrentPeriod ?? "");

    // Winner: prefer explicit winner field, fall back to isWinner flag on a team.
    const winnerTeam = teams.find((t: any) => t.isWinner === true || t.IsWinner === true)
                       ?? g.winner ?? g.Winner ?? null;
    const winnerId   = winnerTeam ? resolveTeamId(winnerTeam, teamIdByKey) : null;

    const team1Score = parseScore(teams[0]?.score);
    const team2Score = parseScore(teams[1]?.score);

    const isFinal  = gameState === "F" || currentPeriod === "FINAL";
    const hasScore = team1Score !== null || team2Score !== null;
    if (!isFinal && !hasScore && !winnerId) continue;

    const updateData: Record<string, any> = { game_state: gameState, current_period: currentPeriod };
    if (team1Score !== null) updateData.team1_score = team1Score;
    if (team2Score !== null) updateData.team2_score = team2Score;
    if (winnerId   !== null) updateData.winner_id   = winnerId;

    const { error } = await svc
      .from("games")
      .update(updateData)
      .eq("bracket_position_id", bracketPositionId)
      .eq("sport", sport)
      .eq("year", year);

    if (error) gameErrors.push(`pos ${bracketPositionId}: ${error.message}`);
    else updatedGames++;
  }

  // Resolve combo picks (First Four play-in picks)
  // Once a play-in winner advances, collapse the two-team pick to that specific team.
  let page = 0;
  while (true) {
    const { data: batch } = await svc
      .from("picks")
      .select("id, picked_team_id, picked_team_id_2, games(team1_id, team2_id, sport, year)")
      .not("picked_team_id_2", "is", null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!batch || batch.length === 0) break;

    for (const p of batch) {
      const game = p.games;
      if (!game || game.sport !== sport || game.year !== year) continue;
      const t1   = game.team1_id as number | null;
      const t2   = game.team2_id as number | null;
      const pid  = Number(p.picked_team_id);
      const pid2 = Number(p.picked_team_id_2);
      const resolvedId = (t1 && (t1 === pid || t1 === pid2)) ? t1
                       : (t2 && (t2 === pid || t2 === pid2)) ? t2
                       : null;
      if (resolvedId) {
        await svc.from("picks")
          .update({ picked_team_id: resolvedId, picked_team_id_2: null })
          .eq("id", p.id);
      }
    }
    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  // Recalculate bracket totals
  // Points per correct pick = 2^(round - 1): Round 1 = 1pt, Round 2 = 2pt, etc.
  const { data: brackets } = await svc
    .from("brackets")
    .select("id")
    .eq("sport", sport)
    .eq("year", year);

  const bracketIds = (brackets ?? []).map((b: any) => b.id as number);
  let recalculatedBrackets = 0;

  console.log(`processSport(${sport}): ${bracketIds.length} brackets, ${updatedGames} game updates, ${gameErrors.length} errors`);

  if (bracketIds.length > 0) {
    const allPicks: any[] = [];
    const CHUNK = 500; // keep `.in()` lists reasonably small to avoid URL/DB limits
    for (let i = 0; i < bracketIds.length; i += CHUNK) {
      const chunk = bracketIds.slice(i, i + CHUNK);
      const chunkIndex = Math.floor(i / CHUNK);
      let ppage = 0;
      while (true) {
        const { data: batch, error: pickErr } = await svc
          .from("picks")
          .select("bracket_id, picked_team_id, picked_team_id_2, games(round, winner_id)")
          .in("bracket_id", chunk)
          .range(ppage * PAGE_SIZE, (ppage + 1) * PAGE_SIZE - 1);
        if (pickErr) { console.error(`processSport(${sport}): picks page ${ppage} error: ${pickErr.message}`); break; }
        if (!batch || batch.length === 0) break;
        console.log(`processSport(${sport}): fetched picks chunk=${chunkIndex} page=${ppage} count=${batch.length}`);
        allPicks.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        ppage++;
      }
    }

    // Debug: summary of picks fetched
    try {
      const picksWithWinner = allPicks.filter((p: any) => p.games && p.games.winner_id != null).length;
      const roundCounts: Record<string, number> = {};
      for (const p of allPicks) {
        const r = String(Number(p.games?.round ?? 0));
        roundCounts[r] = (roundCounts[r] || 0) + 1;
      }
      const missingWinnerSamples = allPicks
        .filter((p: any) => p.games && (p.games.winner_id == null))
        .slice(0, 8)
        .map((p: any) => ({ bracket_id: p.bracket_id, game_round: p.games?.round, winner_id: p.games?.winner_id }));

      console.log(`processSport(${sport}): totalPicks=${allPicks.length}, picksWithWinner=${picksWithWinner}, roundCounts=${JSON.stringify(roundCounts)}`);
      if (missingWinnerSamples.length) console.log(`processSport(${sport}): sample picks with missing winner_id: ${JSON.stringify(missingWinnerSamples)}`);
    } catch (e) {
      console.error(`processSport(${sport}): error while logging picks summary: ${e?.message ?? e}`);
    }

    const pointsByBracket = new Map<number, number>();

    // Normalize rounds and detect play-in combo picks.
    const roundValues = allPicks.map((p: any) => Number(p.games?.round ?? 0)).filter((r: number) => r > 0);
    const minRound = roundValues.length > 0 ? Math.min(...roundValues) : 1;

    // Detect play-in usage: find the smallest round where a pick used picked_team_id_2.
    const playInRounds = allPicks
      .filter((p: any) => p.picked_team_id_2 != null)
      .map((p: any) => Number(p.games?.round ?? 0))
      .filter((r: number) => r > 0);
    const minPlayInRound = playInRounds.length > 0 ? Math.min(...playInRounds) : null;

    // Build ordered distinct rounds seen in picks
    const roundsOrdered = Array.from(new Set(roundValues)).sort((a, b) => a - b);
    // Only treat a play-in if the earliest round contains combo (picked_team_id_2)
    const playInExists = minPlayInRound != null && roundsOrdered.length > 0 && minPlayInRound === roundsOrdered[0];

    console.log(`processSport(${sport}): minRound=${minRound}, minPlayInRound=${minPlayInRound}, roundsOrdered=${JSON.stringify(roundsOrdered)}, playInExists=${playInExists}`);

    let skippedNoWinner = 0;
    const awardCountsByRound: Record<number, number> = {};
    const awardPointsByRound: Record<number, number> = {};
    const awardedSamples: Array<any> = [];
    for (const p of allPicks) {
      const game = p.games;
      if (!game?.winner_id) { skippedNoWinner++; continue; }
      const roundNum = Number(game.round) || minRound;

      // Determine round index within ordered rounds and compute points.
      const roundIndex = roundsOrdered.indexOf(roundNum);
      let roundPoints = 0;
      if (roundIndex === -1) {
        // unexpected: fallback to old calculation
        const k = roundNum - minRound;
        roundPoints = Math.pow(2, Math.max(0, k));
      } else {
        if (playInExists && roundIndex === 0) {
          // earliest round is play-in -> scores 0
          roundPoints = 0;
        } else {
          const scoringIndex = roundIndex - (playInExists ? 1 : 0); // first full round -> 0
          roundPoints = Math.pow(2, Math.max(0, scoringIndex));
        }
      }

      const winnerId = Number(game.winner_id);
      const picked1   = Number(p.picked_team_id);
      const picked2   = p.picked_team_id_2 != null ? Number(p.picked_team_id_2) : null;
      if (picked1 === winnerId || picked2 === winnerId) {
        pointsByBracket.set(p.bracket_id, (pointsByBracket.get(p.bracket_id) ?? 0) + roundPoints);
        awardCountsByRound[roundNum] = (awardCountsByRound[roundNum] || 0) + 1;
        awardPointsByRound[roundNum] = (awardPointsByRound[roundNum] || 0) + roundPoints;
        if (awardedSamples.length < 8) awardedSamples.push({ bracket_id: p.bracket_id, round: roundNum, pts: roundPoints });
      }
    }

    for (const b of (brackets ?? [])) {
      const pts = pointsByBracket.get(b.id) ?? 0;
      const { error } = await svc.from("brackets").update({ total_points: pts }).eq("id", b.id);
      if (!error) recalculatedBrackets++;
    }
    console.log(`processSport(${sport}): scoring complete, skippedPicksNoWinner=${skippedNoWinner}, recalculatedBrackets=${recalculatedBrackets}`);
    console.log(`processSport(${sport}): awardedCounts=${JSON.stringify(awardCountsByRound)}, awardedPoints=${JSON.stringify(awardPointsByRound)}`);
    if (awardedSamples.length) console.log(`processSport(${sport}): sample awarded picks: ${JSON.stringify(awardedSamples)}`);
  }

  return { updatedGames, recalculatedBrackets, gameErrors };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Resolve a team object from the API to its DB id via seo name or short name.
function resolveTeamId(team: any, teamIdByKey: Map<string, number>): number | null {
  const seo   = String(team?.seoname ?? team?.seoName ?? team?.SeoName ?? team?.seo ?? "").toLowerCase();
  const short = String(team?.nameShort ?? team?.NameShort ?? team?.name ?? team?.Name ?? "").toLowerCase();
  return (seo && teamIdByKey.get(seo)) || (short && teamIdByKey.get(short)) || null;
}

// Return a numeric score or null; treats empty-string API values as null.
function parseScore(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}