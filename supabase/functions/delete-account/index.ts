/**
 * Optional Edge Function: delete production data then auth user.
 * Deploy: supabase functions deploy delete-account --no-verify-jwt
 * Call from app only after user confirms DELETE (use user's JWT in Authorization header).
 *
 * Requires secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto in Supabase).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "missing_authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "not_authenticated" }, 401);
    }

    const { data: wipe, error: rpcErr } = await userClient.rpc("fabric_flo_delete_my_account");
    if (rpcErr) {
      return json({ error: rpcErr.message }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      return json(
        {
          error: "auth_delete_failed",
          detail: delErr.message,
          dataWiped: wipe,
        },
        500
      );
    }

    return json({ ok: true, dataWiped: wipe });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
