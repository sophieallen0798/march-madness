// Supabase Edge Function: admin-code
// Validates an admin access code against the SITE_ACCESS_CODE environment variable.
//
// Invoke via POST /functions/v1/admin-code
// Body: { "code": "..." }
// No Authorization header required – this is a public endpoint.

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
    "Content-Type": "application/json",
  };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const provided = (body.code ?? "").trim();
  // Admin access code is separate from the site access code.
  const expected = (Deno.env.get("ADMIN_ACCESS_CODE") ?? "").trim();

  if (!expected) {
    // Env var not configured – fail closed
    return new Response(JSON.stringify({ success: false, error: "Admin access code not configured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const success = provided === expected;

  return new Response(JSON.stringify({ success }), {
    status: 200,
    headers: corsHeaders,
  });
});