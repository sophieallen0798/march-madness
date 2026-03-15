import { createClient } from "jsr:@supabase/supabase-js@2";

// Edge Function: scheduled-sync
// Calls existing edge functions (sync-bracket, update-scores) for both sports
// then upserts a single `sync_status` row `last_api_sync` with the current timestamp

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-admin-code",
      },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ADMIN_CODE = Deno.env.get("ADMIN_ACCESS_CODE") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const YEAR = Number(Deno.env.get("TOURNAMENT_YEAR") ?? "2026");

  const jobs = [
    { fn: "sync-bracket", sport: "basketball-men" },
    { fn: "sync-bracket", sport: "basketball-women" },
    { fn: "update-scores", sport: "basketball-men" },
    { fn: "update-scores", sport: "basketball-women" },
  ];

  const results: any[] = [];

  for (const j of jobs) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/${j.fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-code": ADMIN_CODE,
        },
        body: JSON.stringify({ sport: j.sport, year: YEAR }),
      });
      const json = await resp.json().catch(() => ({ status: resp.status }));
      results.push({ job: j, ok: resp.ok, result: json });
    } catch (err) {
      results.push({ job: j, ok: false, error: String(err) });
    }
  }

  const anyOk = results.some((r) => r.ok);

  // Upsert sync_status row when any job succeeded
  try {
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);
    if (anyOk) {
      await svc.from("sync_status").upsert({ id: "last_api_sync", last_refreshed_at: new Date().toISOString() });
    }
  } catch (err) {
    // Log but don't fail the entire function result — caller can inspect results
    console.error("scheduled-sync: failed to upsert sync_status", err);
  }

  return new Response(JSON.stringify({ success: anyOk, results }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
