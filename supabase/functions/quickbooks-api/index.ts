import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QB_CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID")!;
const QB_CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET")!;
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_API_BASE = "https://quickbooks.api.intuit.com/v3/company";
// For sandbox, use: https://sandbox-quickbooks.api.intuit.com/v3/company
const QB_SANDBOX_API_BASE = "https://sandbox-quickbooks.api.intuit.com/v3/company";

async function refreshTokens(supabaseAdmin: any, userId: string, refreshToken: string) {
  const basicAuth = btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`);
  const res = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabaseAdmin.from("quickbooks_tokens").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
  }).eq("user_id", userId);

  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Get tokens
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokens, error: tokensErr } = await supabaseAdmin
      .from("quickbooks_tokens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (tokensErr || !tokens) {
      return new Response(JSON.stringify({ error: "QuickBooks not connected", connected: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { endpoint, useSandbox } = await req.json();

    // Check if token expired, refresh if needed
    let accessToken = tokens.access_token;
    if (new Date(tokens.expires_at) <= new Date()) {
      accessToken = await refreshTokens(supabaseAdmin, userId, tokens.refresh_token);
    }

    const apiBase = useSandbox ? QB_SANDBOX_API_BASE : QB_API_BASE;
    const realmId = tokens.realm_id;

    // Build the QB API URL based on endpoint
    let qbUrl: string;
    let queryParams = "";
    
    switch (endpoint) {
      case "company-info":
        qbUrl = `${apiBase}/${realmId}/companyinfo/${realmId}`;
        break;
      case "accounts":
        qbUrl = `${apiBase}/${realmId}/query?query=${encodeURIComponent("SELECT * FROM Account WHERE AccountType = 'Bank' MAXRESULTS 100")}`;
        break;
      case "invoices":
        qbUrl = `${apiBase}/${realmId}/query?query=${encodeURIComponent("SELECT * FROM Invoice WHERE Balance > '0' ORDERBY DueDate MAXRESULTS 100")}`;
        break;
      case "all-invoices":
        qbUrl = `${apiBase}/${realmId}/query?query=${encodeURIComponent("SELECT * FROM Invoice ORDERBY MetaData.CreateTime DESC MAXRESULTS 100")}`;
        break;
      case "expenses":
        qbUrl = `${apiBase}/${realmId}/query?query=${encodeURIComponent("SELECT * FROM Purchase ORDERBY MetaData.CreateTime DESC MAXRESULTS 100")}`;
        break;
      case "profit-and-loss":
        qbUrl = `${apiBase}/${realmId}/reports/ProfitAndLoss?date_macro=This Month`;
        break;
      case "balance-sheet":
        qbUrl = `${apiBase}/${realmId}/reports/BalanceSheet`;
        break;
      case "status":
        return new Response(
          JSON.stringify({ connected: true, realmId: tokens.realm_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      default:
        return new Response(JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const qbRes = await fetch(qbUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const qbData = await qbRes.json();
    if (!qbRes.ok) {
      console.error("QB API error:", qbData);
      // If 401, try refresh once
      if (qbRes.status === 401) {
        try {
          accessToken = await refreshTokens(supabaseAdmin, userId, tokens.refresh_token);
          const retryRes = await fetch(qbUrl, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
          });
          const retryData = await retryRes.json();
          return new Response(JSON.stringify(retryData), {
            status: retryRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (refreshErr) {
          return new Response(JSON.stringify({ error: "Session expired, please reconnect QuickBooks" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    return new Response(JSON.stringify(qbData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("quickbooks-api error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
