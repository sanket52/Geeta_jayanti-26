import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const maxPhoto = 2 * 1024 * 1024, maxPdf = 5 * 1024 * 1024;
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
  const encryptionSecret = Deno.env.get("BANK_DATA_ENCRYPTION_KEY");
  if (!authorization || !url || !serviceKey || !publicKey || !encryptionSecret) return json({ error: "Registration service is not configured." }, 503);
  try {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const authClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user?.email || !user.email_confirmed_at) return json({ error: "Sign in with a verified Supabase account before registering." }, 401);
    const identity = { sub: user.id, email: user.email.toLowerCase() };
    const form = await req.formData();
    const registrationText = form.get("registration");
    const photo = form.get("photo"), aadhaar = form.get("aadhaar");
    if (typeof registrationText !== "string" || !(photo instanceof File) || !(aadhaar instanceof File)) return json({ error: "Registration details, photo, and Aadhaar PDF are required." }, 400);
    const data = JSON.parse(registrationText);
    if (String(data.email).trim().toLowerCase() !== identity.email) return json({ error: "The verified email does not match." }, 400);
    if (String(data.accountNumber ?? "") !== String(data.confirmAccount ?? "")) return json({ error: "Bank account numbers do not match." }, 400);
    if (photo.size < 1 || photo.size > maxPhoto || !["image/jpeg", "image/png"].includes(photo.type)) return json({ error: "Photo must be a JPG or PNG no larger than 2 MB." }, 400);
    if (aadhaar.size < 1 || aadhaar.size > maxPdf || aadhaar.type !== "application/pdf") return json({ error: "Aadhaar must be a PDF no larger than 5 MB." }, 400);
    const [photoBytes, pdfBytes] = await Promise.all([photo.arrayBuffer(), aadhaar.arrayBuffer()]);
    const p = new Uint8Array(photoBytes), a = new Uint8Array(pdfBytes);
    const jpeg = p.length >= 3 && p[0] === 0xff && p[1] === 0xd8 && p[2] === 0xff;
    const png = p.length >= 8 && hex(p.slice(0, 8)) === "89504e470d0a1a0a";
    if ((photo.type === "image/jpeg" && !jpeg) || (photo.type === "image/png" && !png)) return json({ error: "Photo file signature does not match its type." }, 400);
    const pdfHeader = new TextDecoder().decode(a.slice(0, 5)) === "%PDF-";
    const tail = new TextDecoder("latin1").decode(a.slice(-2048));
    if (!pdfHeader || !tail.includes("%%EOF")) return json({ error: "The Aadhaar PDF appears invalid or incomplete." }, 400);
    try { await PDFDocument.load(a, { ignoreEncryption: false, throwOnInvalidObject: true }); }
    catch { return json({ error: "The Aadhaar PDF is damaged, encrypted, or cannot be opened." }, 400); }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(data.ifsc || "") || !/^\d{9,18}$/.test(data.accountNumber || "")) return json({ error: "Bank details are invalid." }, 400);
    const { data: districts, error: districtError } = await createClient(url, serviceKey).from("gjm_india_districts").select("district").eq("state", data.state);
    if (districtError) return json({ error: "Address validation is temporarily unavailable." }, 503);
    if (!districts?.some((d) => d.district === data.district)) return json({ error: "Select a district belonging to the selected state." }, 400);

    const keyBytes = Uint8Array.from(atob(encryptionSecret), (c) => c.charCodeAt(0));
    if (![16, 24, 32].includes(keyBytes.length)) return json({ error: "Bank encryption is not configured correctly." }, 503);
    const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(data.accountNumber));
    const encrypted = btoa(String.fromCharCode(...new Uint8Array(cipher)));
    const ivEncoded = btoa(String.fromCharCode(...iv));

    const service = createClient(url, serviceKey);
    const { error: profileError } = await service.from("profiles").upsert(
      { id: identity.sub, role: "student" }, { onConflict: "id", ignoreDuplicates: true },
    );
    if (profileError) return json({ error: "Student profile could not be prepared." }, 500);
    const token = crypto.randomUUID();
    const photoExt = photo.type === "image/png" ? "png" : "jpg";
    const photoPath = `${identity.sub}/${token}/photo.${photoExt}`, aadhaarPath = `${identity.sub}/${token}/aadhaar.pdf`;
    const bucket = service.storage.from("student-registration-documents");
    const photoUpload = await bucket.upload(photoPath, p, { contentType: photo.type, upsert: false });
    if (photoUpload.error) return json({ error: "Could not securely upload the photo." }, 500);
    const pdfUpload = await bucket.upload(aadhaarPath, a, { contentType: "application/pdf", upsert: false });
    if (pdfUpload.error) { await bucket.remove([photoPath]); return json({ error: "Could not securely upload the Aadhaar PDF." }, 500); }
    // The identity and email come from Supabase Auth's verified user lookup.
    const payload = { ...data, userId: identity.sub, email: identity.email, emailVerified: true, accountCiphertext: encrypted, accountIv: ivEncoded, photoPath, photoType: photo.type, photoSize: photo.size, aadhaarPath, aadhaarSize: aadhaar.size };
    const { data: result, error: submitError } = await service.rpc("complete_student_registration", { p_data: payload });
    if (submitError) { await bucket.remove([photoPath, aadhaarPath]); return json({ error: submitError.message }, 400); }
    const row = Array.isArray(result) ? result[0] : result;
    return json({ registration_number: row?.registration_number, status: row?.status });
  } catch (error) {
    console.error("Registration submission failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Secure registration could not be completed. Please try again." }, 500);
  }
});
