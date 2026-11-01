import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !serviceKey || !publicKey || !token) return json({ error: "Supabase profile service is not configured." }, 503);

  const authClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user?.email || !user.email_confirmed_at) return json({ error: "Sign in with a verified Supabase email first." }, 401);

  const service = createClient(url, serviceKey);
  const { error: profileError } = await service.from("profiles").upsert(
    { id: user.id, role: "student" }, { onConflict: "id", ignoreDuplicates: true },
  );
  if (profileError) return json({ error: "Student profile could not be prepared." }, 500);

  const { data: linked, error: linkError } = await service.rpc("link_existing_student_registration", {
    p_user_id: user.id,
    p_verified_email: user.email.toLowerCase(),
  });
  if (linkError) return json({ error: "Existing registration could not be linked. Contact the event team." }, 409);
  return json({ ok: true, linked: linked === true });
});
