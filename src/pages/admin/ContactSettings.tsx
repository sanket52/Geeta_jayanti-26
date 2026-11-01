import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { defaultEventContact, isValidEmail } from "../../lib/eventContact";

export default function ContactSettings() {
  const [contact, setContact] = useState(defaultEventContact);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!supabase) { if (active) { setNotice("Supabase is not configured."); setLoading(false); } return; }
      const { data: role } = await supabase.rpc("current_user_role");
      if (role !== "admin") { if (active) { setNotice("Administrator access is required to manage official contact details."); setLoading(false); } return; }
      const { data, error } = await supabase.from("gjm_event_settings").select("organization_name, organization_name_hi, contact_phone_1, contact_phone_2, support_email, support_email_verified, organization_address, phone_1_whatsapp_confirmed, phone_2_whatsapp_confirmed").eq("id", true).maybeSingle();
      if (active) {
        if (error) setNotice("Apply supabase/geeta_jayanti_contact_settings.sql to enable contact settings.");
        else if (data) setContact({ ...defaultEventContact, ...data, support_email: data.support_email || "", support_email_verified: Boolean(data.support_email_verified) });
        setAllowed(true);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const save = async () => {
    if (!supabase || !allowed) return;
    const email = contact.support_email.trim();
    if (!contact.organization_name.trim() || !contact.organization_name_hi.trim() || !contact.organization_address.trim()) { setNotice("Organization names in both languages and the address are required."); return; }
    if (!/^\d{10}$/.test(contact.contact_phone_1) || !/^\d{10}$/.test(contact.contact_phone_2)) { setNotice("Enter each contact number as exactly 10 digits."); return; }
    if (email && !isValidEmail(email)) { setNotice("Enter a valid official support email or leave the field blank."); return; }
    if (contact.support_email_verified && !email) { setNotice("Enter the official email before marking it verified."); return; }
    setBusy(true); setNotice("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("gjm_event_settings").update({
      organization_name: contact.organization_name.trim(), organization_name_hi: contact.organization_name_hi.trim(), contact_phone_1: contact.contact_phone_1,
      contact_phone_2: contact.contact_phone_2, support_email: email && contact.support_email_verified ? email : null,
      support_email_verified: Boolean(email && contact.support_email_verified), organization_address: contact.organization_address.trim(),
      phone_1_whatsapp_confirmed: contact.phone_1_whatsapp_confirmed, phone_2_whatsapp_confirmed: contact.phone_2_whatsapp_confirmed,
      updated_at: new Date().toISOString(), updated_by: user?.id ?? null,
    }).eq("id", true);
    setBusy(false);
    setNotice(error ? `Could not save contact settings: ${error.message}` : "Official contact settings saved. Public pages and the chatbot will use these details.");
  };

  const change = <K extends keyof typeof defaultEventContact>(key: K, value: (typeof defaultEventContact)[K]) => setContact((current) => ({ ...current, [key]: value }));
  if (loading) return <p className="text-sm text-brown-mid">Loading official contact settings…</p>;
  if (!allowed) return <p className="rounded-xl border border-cream-dark bg-white p-5 text-sm text-brown-mid">{notice}</p>;
  const field = "mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2.5 text-sm text-brown outline-none focus:border-gold";
  return <section className="mx-auto max-w-3xl space-y-5"><div><span className="text-xs font-semibold uppercase tracking-widest text-gold">Website content</span><h1 className="mt-1 text-2xl font-bold text-maroon">Official Contact Settings</h1><p className="mt-1 text-sm text-brown-mid">These centrally stored details appear on the public contact page, footer, and chatbot.</p></div>
    {notice && <p role="status" className="rounded-lg bg-white px-4 py-3 text-sm text-brown-mid">{notice}</p>}
    <div className="space-y-4 rounded-xl border border-cream-dark bg-white p-5">
      <label className="block text-sm font-medium text-brown">Organization name<input value={contact.organization_name} onChange={(e) => change("organization_name", e.target.value)} className={field}/></label>
      <label className="block text-sm font-medium text-brown">Organization name · Hindi<input value={contact.organization_name_hi} onChange={(e) => change("organization_name_hi", e.target.value)} className={field}/></label>
      <label className="block text-sm font-medium text-brown">Contact number 1<input type="tel" inputMode="numeric" value={contact.contact_phone_1} onChange={(e) => change("contact_phone_1", e.target.value.replace(/\D/g, "").slice(0, 10))} className={field}/></label>
      <label className="flex items-start gap-2 text-xs text-brown-mid"><input type="checkbox" checked={contact.phone_1_whatsapp_confirmed} onChange={(e) => change("phone_1_whatsapp_confirmed", e.target.checked)} className="mt-0.5 accent-maroon"/>I confirm contact number 1 has WhatsApp enabled.</label>
      <label className="block text-sm font-medium text-brown">Contact number 2<input type="tel" inputMode="numeric" value={contact.contact_phone_2} onChange={(e) => change("contact_phone_2", e.target.value.replace(/\D/g, "").slice(0, 10))} className={field}/></label>
      <label className="flex items-start gap-2 text-xs text-brown-mid"><input type="checkbox" checked={contact.phone_2_whatsapp_confirmed} onChange={(e) => change("phone_2_whatsapp_confirmed", e.target.checked)} className="mt-0.5 accent-maroon"/>I confirm contact number 2 has WhatsApp enabled.</label>
      <label className="block text-sm font-medium text-brown">Official event support email<input type="email" autoComplete="email" value={contact.support_email} onChange={(e) => setContact((current) => ({ ...current, support_email: e.target.value, support_email_verified: false }))} placeholder="Leave blank until the official address is confirmed" className={field}/></label>
      <p className="-mt-3 text-xs text-brown-light">An email is stored and shown publicly only when you confirm it as the verified event address.</p>
      <label className="flex items-start gap-2 text-xs leading-relaxed text-brown-mid"><input type="checkbox" checked={contact.support_email_verified} disabled={!contact.support_email.trim()} onChange={(e) => change("support_email_verified", e.target.checked)} className="mt-0.5 accent-maroon"/>I confirm this is the verified official event support email and authorize displaying it publicly.</label>
      <label className="block text-sm font-medium text-brown">Full address<input value={contact.organization_address} onChange={(e) => change("organization_address", e.target.value)} className={field}/></label>
      <button disabled={busy} onClick={() => void save()} className="rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-50">{busy ? "Saving…" : "Save contact settings"}</button>
    </div></section>;
}
