import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !serviceKey || !publicKey || !token) return json({ error: "Staff service is not configured." }, 503);
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) return json({ error: "Sign in again before managing staff." }, 401);
  const service = createClient(url, serviceKey);
  const { data: actor, error: actorError } = await service.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (actorError || actor?.role !== "admin") return json({ error: "Administrator permission is required." }, 403);

  try {
    const body = await request.json();
    const action = body.action;
    if (action === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const mobile = String(body.mobile ?? "").trim();
      const duties = Array.isArray(body.duties) ? body.duties.filter((v: unknown) => typeof v === "string").map((v: string) => v.trim()).filter(Boolean).slice(0, 30) : [];
      const accessModules = Array.isArray(body.access_modules) ? body.access_modules.filter((v: unknown) => typeof v === "string").map((v: string) => v.trim()).filter(Boolean).slice(0, 20) : [];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || fullName.length > 160 || mobile.length > 30) return json({ error: "Enter a valid email, name, and mobile number." }, 400);
      const { data: invite, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo: Deno.env.get("APP_SITE_URL") });
      if (inviteError || !invite.user) return json({ error: inviteError?.message ?? "Could not send teacher invitation." }, 400);
      const { error: profileError } = await service.from("profiles").update({ role: "teacher" }).eq("id", invite.user.id);
      if (profileError) return json({ error: "Invitation sent but staff role setup failed. Contact an administrator." }, 500);
      const { error: teacherError } = await service.from("teacher_profiles").upsert({ user_id: invite.user.id, email, full_name: fullName, mobile, duties, access_modules: accessModules, approval_status: "pending", invited_by: user.id, updated_at: new Date().toISOString() });
      if (teacherError) return json({ error: "Invitation sent but teacher profile setup failed. Contact an administrator." }, 500);
      await service.from("security_audit_log").insert({ actor_user_id: user.id, action: "teacher_invited", target_user_id: invite.user.id, details: { email, approval_status: "pending" } });
      return json({ ok: true, message: "Invitation sent. Approve the teacher after verifying their identity." });
    }
    if (action === "set_approval") {
      const target = String(body.user_id ?? "");
      const status = body.approval_status;
      if (!target || !["approved", "suspended"].includes(status)) return json({ error: "Invalid teacher approval update." }, 400);
      const { data: current } = await service.from("teacher_profiles").select("approval_status").eq("user_id", target).maybeSingle();
      if (!current) return json({ error: "Teacher account was not found." }, 404);
      const { error } = await service.from("teacher_profiles").update({ approval_status: status, updated_at: new Date().toISOString() }).eq("user_id", target);
      if (error) return json({ error: "Could not update teacher approval." }, 500);
      await service.from("security_audit_log").insert({ actor_user_id: user.id, action: status === "approved" ? "teacher_approved" : "teacher_suspended", target_user_id: target });
      return json({ ok: true });
    }
    return json({ error: "Unsupported staff action." }, 400);
  } catch {
    return json({ error: "Could not process the staff request." }, 400);
  }
});
