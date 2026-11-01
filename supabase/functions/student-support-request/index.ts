import { createClient } from "npm:@supabase/supabase-js@2";

const recipients = ["sanketbhardwaj413@gmail.com", "geetajayanti2627@gmail.com"];
const categories = ["Registration", "Login / OTP Problem", "Competition", "Examination", "Document Upload", "Result / Certificate", "Technical Issue", "Other"] as const;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupportPayload = {
  requestId: string;
  name: string;
  email: string;
  mobile?: string;
  subject: string;
  message: string;
  category: string;
  website?: string;
  formStartedAt: number;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function safeText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max) : "";
}

function validate(body: SupportPayload) {
  const name = safeText(body.name, 120);
  const email = safeText(body.email, 254).toLowerCase();
  const mobile = safeText(body.mobile, 30);
  const subject = safeText(body.subject, 180);
  const message = safeText(body.message, 5000);
  const category = safeText(body.category, 40);
  if (!uuidPattern.test(body.requestId || "")) return { error: "Please refresh the form and try again." };
  if (body.website) return { error: "Your request could not be submitted." };
  if (!Number.isFinite(body.formStartedAt) || Date.now() - body.formStartedAt < 2500 || Date.now() - body.formStartedAt > 2 * 60 * 60 * 1000) return { error: "Please review the form and try again." };
  if (name.length < 2 || !emailPattern.test(email) || !subject || !message || !categories.includes(category as typeof categories[number])) return { error: "Complete all required fields with a valid email address." };
  if (mobile && !/^[+0-9()\s.-]{7,30}$/.test(mobile)) return { error: "Enter a valid mobile number, or leave it blank." };
  return { value: { name, email, mobile, subject, message, category } };
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function submittedAt(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function supportHtml(request: { name: string; email: string; mobile: string; subject: string; message: string; category: string; submittedAt: string }) {
  const row = (label: string, value: string) => `<tr><th align="left" style="padding:10px 12px;border-bottom:1px solid #eee;color:#5c0f0f;vertical-align:top">${label}</th><td style="padding:10px 12px;border-bottom:1px solid #eee;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`;
  return `<div style="font-family:Arial,sans-serif;color:#2c1508;line-height:1.55;max-width:680px;margin:auto"><div style="background:#5c0f0f;color:#fff;padding:22px 26px"><h1 style="font-size:20px;margin:0">New Student Support Request</h1><p style="margin:4px 0 0">Geeta Jayanti Mahotsav 2026</p></div><div style="padding:24px"><p>Dear Geeta Jayanti Mahotsav Support Team,</p><p>A new student support request has been submitted through the official website chatbot.</p><h2 style="font-size:16px;color:#8b1a1a">Student Details</h2><table style="border-collapse:collapse;width:100%">${row("Name", request.name)}${row("Email", request.email)}${row("Mobile", request.mobile || "Not provided")}${row("Category", request.category)}${row("Subject", request.subject)}${row("Message", request.message)}${row("Submission Date", request.submittedAt)}</table><p>Please review this request and respond to the student.</p><p>Regards,<br>Geeta Jayanti Mahotsav 2026<br>Maharshi Panini Ved Vedang Vidhyapeeth Gurukul<br>RB-22, Sector 36, Greater Noida, Uttar Pradesh<br>Contact: 9456984723 / 7500790387</p></div></div>`;
}

function confirmationHtml(name: string, subject: string, category: string) {
  return `<div style="font-family:Arial,sans-serif;color:#2c1508;line-height:1.55;max-width:640px;margin:auto"><div style="background:#5c0f0f;color:#fff;padding:22px 26px"><h1 style="font-size:20px;margin:0">Support request received</h1><p style="margin:4px 0 0">Geeta Jayanti Mahotsav 2026</p></div><div style="padding:24px"><p>Dear ${escapeHtml(name)},</p><p>Thank you for contacting Geeta Jayanti Mahotsav 2026.</p><p>We have successfully received your support request. Our team will review your query and assist you.</p><h2 style="font-size:16px;color:#8b1a1a">Your Request Details</h2><ul><li><strong>Subject:</strong> ${escapeHtml(subject)}</li><li><strong>Category:</strong> ${escapeHtml(category)}</li></ul><p>For additional assistance, contact:<br>9456984723<br>7500790387</p><p>Regards,<br>Geeta Jayanti Mahotsav 2026<br>Maharshi Panini Ved Vedang Vidhyapeeth Gurukul</p></div></div>`;
}

async function sendResend(apiKey: string, from: string, to: string[], subject: string, html: string, idempotencyKey: string, replyTo?: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  return { accepted: response.ok && typeof body.id === "string", id: typeof body.id === "string" ? body.id : null };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  let payload: SupportPayload;
  try { payload = await request.json(); } catch { return json({ error: "Submit a valid support request." }, 400); }
  if (!payload || typeof payload !== "object") return json({ error: "Submit a valid support request." }, 400);
  const checked = validate(payload);
  if (checked.error || !checked.value) return json({ error: checked.error }, 400);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !from || !emailPattern.test(from.replace(/^.*<([^<>]+)>$/, "$1")) || !supabaseUrl || !serviceKey) return json({ error: "Email support is temporarily unavailable. Please call the event support numbers." }, 503);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { name, email, mobile, subject, message, category } = checked.value;
  const fingerprintSource = [email, category, subject, message].join("\u001f");
  const [emailHash, fingerprint] = await Promise.all([hmac(serviceKey, email), hmac(serviceKey, fingerprintSource)]);
  const { data: claim, error: claimError } = await supabase.rpc("claim_gjm_support_request", { p_request_id: payload.requestId, p_email_hash: emailHash, p_request_fingerprint: fingerprint });
  if (claimError) return json({ error: "Email support is not ready yet. Please call the event support numbers." }, 503);
  if (claim === "rate_limited") return json({ error: "Please wait before sending another support request." }, 429);
  if (claim === "duplicate_request" || claim === "duplicate_submission") return json({ error: "This request was already submitted or is being processed. Please wait for the team to respond." }, 409);
  if (typeof claim !== "string" || !claim.startsWith("claimed:")) return json({ error: "This request could not be processed. Please call the event support numbers." }, 400);

  const submitted = { name, email, mobile, subject, message, category, submittedAt: submittedAt(claim.slice("claimed:".length)) };
  let support;
  try {
    support = await sendResend(apiKey, from, recipients, "New Student Support Request – Geeta Jayanti Mahotsav 2026", supportHtml(submitted), payload.requestId, email);
  } catch {
    await supabase.from("gjm_support_request_events").update({ status: "provider_failed", completed_at: new Date().toISOString() }).eq("request_id", payload.requestId);
    return json({ error: "We could not send your request right now. Please call the event support numbers." }, 502);
  }
  if (!support.accepted) {
    await supabase.from("gjm_support_request_events").update({ status: "provider_failed", completed_at: new Date().toISOString() }).eq("request_id", payload.requestId);
    return json({ error: "We could not send your request right now. Please call the event support numbers." }, 502);
  }
  await supabase.from("gjm_support_request_events").update({ status: "support_sent", support_provider_id: support.id }).eq("request_id", payload.requestId);

  let confirmationSent = false;
  let confirmationId: string | null = null;
  try {
    const confirmation = await sendResend(apiKey, from, [email], "Your Support Request Has Been Received – Geeta Jayanti Mahotsav 2026", confirmationHtml(name, subject, category), `${payload.requestId}-confirmation`);
    confirmationSent = confirmation.accepted;
    confirmationId = confirmation.id;
  } catch { /* The support team already accepted the request; report confirmation failure separately. */ }
  await supabase.from("gjm_support_request_events").update({ status: confirmationSent ? "sent" : "confirmation_failed", confirmation_provider_id: confirmationId, completed_at: new Date().toISOString() }).eq("request_id", payload.requestId);
  return json({ accepted: true, confirmationSent });
});
