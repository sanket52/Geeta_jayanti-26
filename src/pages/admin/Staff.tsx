import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Teacher = { user_id: string; full_name: string; email: string; mobile: string | null; duties: string[]; access_modules: string[]; approval_status: "pending" | "approved" | "suspended" };
const emptyDraft = { full_name: "", email: "", mobile: "", duties: "", access_modules: "" };
const fieldClass = "w-full rounded-lg border border-cream-dark bg-white px-3 py-2.5 text-sm text-brown";

export default function AdminStaff() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    const { data, error: loadError } = await supabase.from("teacher_profiles").select("user_id,email,full_name,mobile,duties,access_modules,approval_status").order("created_at", { ascending: false });
    if (loadError) setError("Could not load staff. Apply supabase_staff_security.sql and sign in as an administrator.");
    else setTeachers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invoke = async (payload: Record<string, unknown>) => {
    if (!supabase) { setError("Supabase is not configured."); return false; }
    setBusy(true); setError(""); setMessage("");
    const { data, error: invokeError } = await supabase.functions.invoke("admin-manage-teacher", { body: payload });
    setBusy(false);
    if (invokeError || data?.error) { setError(data?.error ?? invokeError?.message ?? "Staff operation failed."); return false; }
    setMessage(data?.message ?? "Teacher account updated.");
    await load();
    return true;
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    const succeeded = await invoke({ action: "invite", full_name: draft.full_name, email: draft.email, mobile: draft.mobile, duties: draft.duties.split(",").map((item) => item.trim()).filter(Boolean), access_modules: draft.access_modules.split(",").map((item) => item.trim()).filter(Boolean) });
    if (succeeded) { setFormOpen(false); setDraft(emptyDraft); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-widest text-gold">ERP Access Control</span><h1 style={{ fontFamily: "var(--font-display)" }} className="mt-1 text-2xl font-bold text-brown">Teachers, Roles & Duties</h1><p className="text-sm text-brown-mid">Teacher access starts pending and requires administrator approval.</p></div><button onClick={() => setFormOpen((value) => !value)} className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream">Invite Teacher</button></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    {formOpen && <form onSubmit={(event) => void invite(event)} className="grid gap-4 rounded-2xl border-2 border-gold/30 bg-cream p-6 md:grid-cols-2">
      <label className="text-xs text-brown-mid">Teacher name *<input required minLength={2} maxLength={160} value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} className={`${fieldClass} mt-1`} /></label>
      <label className="text-xs text-brown-mid">Email *<input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} className={`${fieldClass} mt-1`} /></label>
      <label className="text-xs text-brown-mid">Mobile<input value={draft.mobile} onChange={(event) => setDraft({ ...draft, mobile: event.target.value })} className={`${fieldClass} mt-1`} /></label>
      <label className="text-xs text-brown-mid">Duties, comma separated<input value={draft.duties} onChange={(event) => setDraft({ ...draft, duties: event.target.value })} className={`${fieldClass} mt-1`} /></label>
      <label className="text-xs text-brown-mid md:col-span-2">Staff modules (informational; database policies enforce access)<input value={draft.access_modules} onChange={(event) => setDraft({ ...draft, access_modules: event.target.value })} className={`${fieldClass} mt-1`} /></label>
      <div className="flex gap-2 md:col-span-2"><button disabled={busy} className="rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-50">{busy ? "Sending…" : "Send invitation"}</button><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-cream-dark px-5 py-2.5 text-sm">Cancel</button></div>
    </form>}
    {loading ? <p className="text-sm text-brown-mid">Loading staff…</p> : teachers.length === 0 ? <p className="rounded-xl border border-cream-dark bg-cream p-5 text-sm text-brown-mid">No teacher accounts are configured yet.</p> : <div className="grid gap-4 lg:grid-cols-2">{teachers.map((teacher) => <article key={teacher.user_id} className="rounded-2xl border border-cream-dark bg-cream p-5">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-brown">{teacher.full_name}</h2><p className="text-sm text-brown-mid">{teacher.email}{teacher.mobile ? ` · ${teacher.mobile}` : ""}</p></div><span className="rounded-full bg-cream-dark px-2 py-1 text-xs font-semibold capitalize text-brown-mid">{teacher.approval_status}</span></div>
      <p className="mt-4 text-xs font-semibold uppercase text-brown-mid">Duties</p><p className="mt-1 text-sm text-brown">{teacher.duties.join(", ") || "No duties listed"}</p><p className="mt-3 text-xs font-semibold uppercase text-brown-mid">Modules</p><p className="mt-1 text-sm text-brown">{teacher.access_modules.join(", ") || "No modules listed"}</p>
      <div className="mt-4 flex gap-3">{teacher.approval_status !== "approved" && <button disabled={busy} onClick={() => void invoke({ action: "set_approval", user_id: teacher.user_id, approval_status: "approved" })} className="text-xs font-semibold text-maroon disabled:opacity-50">Approve access</button>}{teacher.approval_status === "approved" && <button disabled={busy} onClick={() => void invoke({ action: "set_approval", user_id: teacher.user_id, approval_status: "suspended" })} className="text-xs font-semibold text-red-700 disabled:opacity-50">Suspend access</button>}</div>
    </article>)}</div>}
  </div>;
}
