import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Registration = {
  id: string;
  registration_number: string;
  email: string;
  full_name: string;
  mobile: string;
  school_name: string;
  education_level: string;
  city: string;
  state: string;
  district?: string | null;
  bank_account_last4?: string | null;
  selected_competition_codes?: string[] | null;
  status: "Pending" | "Approved" | "Rejected";
  submitted_at: string;
};

const statusStyle: Record<Registration["status"], string> = {
  Pending: "bg-amber-100 text-amber-800",
  Approved: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

export default function AdminStudents() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [districtFilter, setDistrictFilter] = useState("All");
  const [competitionFilter, setCompetitionFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [documentLinks, setDocumentLinks] = useState<Record<string, string>>({});

  const loadRegistrations = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    const { data, error: loadError } = await supabase
      .from("candidate_registrations")
      .select("id, registration_number, email, full_name, mobile, school_name, education_level, city, state, district, bank_account_last4, selected_competition_codes, status, submitted_at")
      .order("submitted_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else { setRegistrations((data ?? []) as Registration[]); setError(""); }
    setLoading(false);
  }, []);

  useEffect(() => { void loadRegistrations(); }, [loadRegistrations]);

  const review = async (registrationId: string, status: Registration["status"]) => {
    if (!supabase) return;
    setSaving(registrationId);
    setError("");
    setMessage("");
    const { error: reviewError } = await supabase.rpc("review_candidate_registration", {
      p_registration_id: registrationId,
      p_status: status,
    });
    if (reviewError) setError(reviewError.message);
    else {
      setMessage(`Registration marked ${status.toLowerCase()}.`);
      await loadRegistrations();
    }
    setSaving(null);
  };

  const filtered = useMemo(() => registrations.filter((item) => {
    const term = search.trim().toLowerCase();
    const matches = !term || [item.full_name, item.registration_number, item.email, item.mobile, item.school_name].some((value) => value.toLowerCase().includes(term));
    return matches && (filter === "All" || item.status === filter)
      && (stateFilter === "All" || item.state === stateFilter)
      && (districtFilter === "All" || item.district === districtFilter)
      && (competitionFilter === "All" || item.selected_competition_codes?.includes(competitionFilter));
  }), [registrations, search, filter, stateFilter, districtFilter, competitionFilter]);

  const openDocument = async (registrationId: string, kind: "photo" | "aadhaar") => {
    if (!supabase) return;
    setError("");
    const { data: doc, error: docError } = await supabase.from("gjm_registration_documents").select("storage_path").eq("registration_id", registrationId).eq("kind", kind).maybeSingle();
    if (docError || !doc) { setError(docError?.message || "Document unavailable."); return; }
    const { data, error: urlError } = await supabase.storage.from("student-registration-documents").createSignedUrl(doc.storage_path, 120);
    if (urlError || !data?.signedUrl) { setError(urlError?.message || "Could not open private document."); return; }
    setDocumentLinks((current) => ({ ...current, [`${registrationId}:${kind}`]: data.signedUrl }));
  };
  const states = useMemo(() => Array.from(new Set(registrations.map((r) => r.state))).sort(), [registrations]);
  const districts = useMemo(() => Array.from(new Set(registrations.filter((r) => stateFilter === "All" || r.state === stateFilter).map((r) => r.district).filter((v): v is string => Boolean(v)))).sort(), [registrations, stateFilter]);

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown">Candidate Registrations</h1>
          <p className="mt-1 text-sm text-brown-mid">Verified applications stored in Supabase</p>
        </div>
        <button onClick={() => { setLoading(true); void loadRegistrations(); }} className="rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon hover:bg-maroon/5">Refresh list</button>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {(["Pending", "Approved", "Rejected"] as const).map((status) => <div key={status} className="rounded-xl border border-cream-dark bg-cream p-4">
          <p className="text-xs text-brown-mid">{status}</p><p className="mt-1 text-2xl font-bold text-maroon">{registrations.filter((item) => item.status === status).length}</p>
        </div>)}
      </div>

      <div className="grid gap-3 rounded-xl border border-cream-dark bg-cream p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, registration, or school" className="min-w-0 flex-1 rounded-lg border border-cream-dark px-4 py-2 text-sm outline-none focus:border-gold" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-cream-dark px-3 py-2 text-sm outline-none focus:border-gold">
          <option>All</option><option>Pending</option><option>Approved</option><option>Rejected</option>
        </select>
        <select value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setDistrictFilter("All"); }} className="rounded-lg border border-cream-dark px-3 py-2 text-sm outline-none focus:border-gold"><option value="All">All states</option>{states.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} className="rounded-lg border border-cream-dark px-3 py-2 text-sm outline-none focus:border-gold"><option value="All">All districts</option>{districts.map((d) => <option key={d}>{d}</option>)}</select>
        <select value={competitionFilter} onChange={(event) => setCompetitionFilter(event.target.value)} className="rounded-lg border border-cream-dark px-3 py-2 text-sm outline-none focus:border-gold"><option value="All">All competitions</option><option value="shloka_uccharan">Shloka Uccharan</option><option value="geeta_quiz">Geeta Quiz</option><option value="digital_bhashan">Digital Bhashan</option><option value="geeta_art">Geeta Art</option></select>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {loading ? <div className="rounded-xl border border-cream-dark bg-cream p-10 text-center text-sm text-brown-mid">Loading registrations…</div> : (
        <div className="space-y-3">
          {filtered.map((item) => <article key={item.id} className="rounded-2xl border border-cream-dark bg-cream p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-brown">{item.full_name}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[item.status]}`}>{item.status}</span>
                </div>
                <p className="mt-1 text-xs text-brown-mid">{item.registration_number} · Submitted {new Date(item.submitted_at).toLocaleDateString()}</p>
                <div className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <p className="break-all text-brown-mid">Email: <span className="text-brown">{item.email}</span></p>
                  <p className="text-brown-mid">Mobile: <span className="text-brown">{item.mobile}</span></p>
                  <p className="text-brown-mid">School: <span className="text-brown">{item.school_name}</span></p>
                  <p className="text-brown-mid">Class: <span className="text-brown">{item.education_level}</span></p>
                  <p className="text-brown-mid sm:col-span-2">Location: <span className="text-brown">{item.city}, {item.state}</span></p>
                  {item.district && <p className="text-brown-mid">District: <span className="text-brown">{item.district}</span></p>}
                  {item.bank_account_last4 && <p className="text-brown-mid">Bank account: <span className="text-brown">••••{item.bank_account_last4}</span></p>}
                  {item.selected_competition_codes?.length ? <p className="text-brown-mid sm:col-span-2">Categories: <span className="text-brown">{item.selected_competition_codes.join(", ")}</span></p> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["photo", "aadhaar"] as const).map((kind) => documentLinks[`${item.id}:${kind}`]
                    ? <a key={kind} href={documentLinks[`${item.id}:${kind}`]} target="_blank" rel="noreferrer" className="rounded-lg border border-maroon px-3 py-2 text-xs font-semibold text-maroon hover:bg-maroon/5">Open {kind === "photo" ? "photo" : "private Aadhaar"} (2 minute link)</a>
                    : <button key={kind} type="button" onClick={() => void openDocument(item.id, kind)} className="rounded-lg border border-maroon px-3 py-2 text-xs font-semibold text-maroon hover:bg-maroon/5">Create {kind === "photo" ? "photo" : "private Aadhaar"} link</button>)}
                </div>
              </div>
              {item.status === "Pending" && <div className="flex shrink-0 gap-2 sm:flex-col">
                <button disabled={saving === item.id} onClick={() => void review(item.id, "Approved")} className="rounded-lg bg-green-700 px-4 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-50">Approve</button>
                <button disabled={saving === item.id} onClick={() => void review(item.id, "Rejected")} className="rounded-lg border border-red-600 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject</button>
              </div>}
            </div>
          </article>)}
          {!filtered.length && <div className="rounded-xl border border-cream-dark bg-cream p-10 text-center text-sm text-brown-mid">No registrations match this search.</div>}
        </div>
      )}
    </div>
  );
}
