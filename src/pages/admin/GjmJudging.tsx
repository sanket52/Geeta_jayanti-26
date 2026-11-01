import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadCsv } from "../../lib/adminExport";
import { supabase } from "../../lib/supabase";

type Criterion = { id: string; competition_code: string; criterion: string; max_marks: number; position: number; is_active: boolean };
type Submission = {
  id: string; competition_code: string; status: string; submitted_at: string | null; result_published: boolean;
  candidate_registrations: { registration_number: string; full_name: string; age_category: string | null };
  gjm_submission_files: { id: string; file_kind: string; file_size: number; content_type: string; duration_seconds: number | null; storage_path: string }[];
  gjm_evaluations: { marks: Record<string, number>; total_marks: number; feedback: string; status: string }[];
};
type QuizAttempt = { id: string; started_at: string; expires_at: string; correct_count: number | null; raw_score: number | null; normalized_score: number | null; visibility_flags: number; fullscreen_exits: number; network_interruptions: number; submission_reason: string | null; submitted_at: string | null; gjm_quiz_attempt_events: { id: number; event_type: string; occurred_at: string; details: { client_detected_at?: string | null } }[]; candidate_registrations: { registration_number: string; full_name: string; age_category: string | null } };
type EventSettings = { event_date: string; registration_opens_at: string; registration_closes_at: string; submissions_close_at: string; judging_opens_at: string; judging_closes_at: string; results_at: string; preparations_start_at: string; preparations_end_at: string; registration_window_confirmed: boolean; submit_on_tab_switch: boolean; submit_on_window_blur: boolean; submit_on_fullscreen_exit: boolean };
type AgeRule = { category: string; minimum_age: number; maximum_age: number | null; is_active: boolean };
type CompetitionSetting = { code: string; title: string; is_open: boolean; max_video_seconds: number | null; max_upload_bytes: number };
const titles: Record<string, string> = { shloka_uccharan: "Shloka Uccharan", geeta_quiz: "Rashtriya Geeta Gyan Quiz", digital_bhashan: "Digital Bhashan", geeta_art: "Geeta-Inspired Art" };
const codeOptions = Object.entries(titles);
const fieldClass = "rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm text-brown outline-none focus:border-gold";
const localDateTime = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export default function GjmJudging() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [ageRules, setAgeRules] = useState<AgeRule[]>([]);
  const [competitionSettings, setCompetitionSettings] = useState<CompetitionSetting[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [judges, setJudges] = useState<{ id: string; role: string }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selected, setSelected] = useState("");
  const [filterCode, setFilterCode] = useState("all");
  const [filterAge, setFilterAge] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [judgeUser, setJudgeUser] = useState("");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [previewFile, setPreviewFile] = useState<{ url: string; contentType: string } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    setLoading(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user?.id ?? "").maybeSingle();
    setIsAdmin(profile?.role === "admin");
    const [submissionResult, criteriaResult, judgeResult, quizResult, scheduleResult, ageResult, competitionResult] = await Promise.all([
      supabase.from("gjm_submissions").select("id,competition_code,status,submitted_at,result_published,candidate_registrations!inner(registration_number,full_name,age_category),gjm_submission_files(id,file_kind,file_size,content_type,duration_seconds,storage_path),gjm_evaluations(marks,total_marks,feedback,status)").order("submitted_at", { ascending: false }),
      supabase.from("gjm_evaluation_criteria").select("id,competition_code,criterion,max_marks,position,is_active").order("position"),
      profile?.role === "admin" ? supabase.from("profiles").select("id,role").eq("role", "teacher") : Promise.resolve({ data: [], error: null }),
      profile?.role === "admin" ? supabase.from("gjm_quiz_attempts").select("id,started_at,expires_at,correct_count,raw_score,normalized_score,visibility_flags,fullscreen_exits,network_interruptions,submission_reason,submitted_at,gjm_quiz_attempt_events(id,event_type,occurred_at,details),candidate_registrations!inner(registration_number,full_name,age_category)").order("started_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
      supabase.from("gjm_event_settings").select("event_date,registration_opens_at,registration_closes_at,submissions_close_at,judging_opens_at,judging_closes_at,results_at,preparations_start_at,preparations_end_at,registration_window_confirmed,submit_on_tab_switch,submit_on_window_blur,submit_on_fullscreen_exit").eq("id", true).single(),
      supabase.from("gjm_age_category_rules").select("category,minimum_age,maximum_age,is_active").order("minimum_age"),
      supabase.from("gjm_competitions").select("code,title,is_open,max_video_seconds,max_upload_bytes").order("title"),
    ]);
    if (submissionResult.error) setError(submissionResult.error.message);
    else setSubmissions((submissionResult.data ?? []) as unknown as Submission[]);
    if (criteriaResult.error) setError(criteriaResult.error.message);
    else setCriteria((criteriaResult.data ?? []) as Criterion[]);
    setJudges((judgeResult.data ?? []) as { id: string; role: string }[]);
    setQuizAttempts((quizResult.data ?? []) as unknown as QuizAttempt[]);
    if (scheduleResult.data) setEventSettings(scheduleResult.data as EventSettings);
    if (ageResult.data) setAgeRules(ageResult.data as AgeRule[]);
    if (competitionResult.data) setCompetitionSettings(competitionResult.data as CompetitionSetting[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => submissions.filter((item) => (filterCode === "all" || item.competition_code === filterCode)
    && (filterAge === "all" || item.candidate_registrations.age_category === filterAge)
    && (filterStatus === "all" || item.status === filterStatus)), [submissions, filterAge, filterCode, filterStatus]);
  const visibleQuizAttempts = useMemo(() => quizAttempts.filter((attempt) =>
    (filterCode === "all" || filterCode === "geeta_quiz")
    && (filterAge === "all" || attempt.candidate_registrations.age_category === filterAge)
    && (filterStatus === "all" || (filterStatus === "Submitted" ? Boolean(attempt.submitted_at) : filterStatus === "In progress" && !attempt.submitted_at))),
  [quizAttempts, filterAge, filterCode, filterStatus]);
  const active = submissions.find((item) => item.id === selected) ?? visible[0];
  const activeCriteria = criteria.filter((item) => item.competition_code === active?.competition_code && item.is_active);
  const activeEvaluation = active?.gjm_evaluations?.[0];

  useEffect(() => {
    if (!active) return;
    setSelected(active.id);
    setMarks(Object.fromEntries(activeCriteria.map((criterion) => [criterion.id, String(activeEvaluation?.marks?.[criterion.id] ?? "")] )));
    setFeedback(activeEvaluation?.feedback ?? "");
    setPreviewFile(null);
  }, [active?.id]);

  const saveEvaluation = async (finalize: boolean) => {
    if (!supabase || !active) return;
    setError(""); setMessage("");
    const parsed = Object.fromEntries(activeCriteria.map((criterion) => [criterion.id, Number(marks[criterion.id])]));
    if (Object.values(marks).some((value) => value === "" || !Number.isFinite(Number(value)))) { setError("Enter a score for all four criteria."); return; }
    const { data, error: saveError } = await supabase.rpc("save_gjm_evaluation", { p_submission_id: active.id, p_marks: parsed, p_feedback: feedback, p_finalize: finalize });
    if (saveError) setError(saveError.message);
    else { setMessage(`${finalize ? "Evaluation finalized" : "Draft saved"} · ${data}/100 marks.`); await load(); }
  };

  const openFile = async (file: Submission["gjm_submission_files"][number]) => {
    if (!supabase) return;
    const { data, error: urlError } = await supabase.storage.from("gjm-competition-submissions").createSignedUrl(file.storage_path, 300);
    if (urlError) setError(urlError.message);
    else setPreviewFile({ url: data.signedUrl, contentType: file.content_type });
  };

  const assignJudge = async () => {
    if (!supabase || !active || !judgeUser) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error: assignError } = await supabase.from("gjm_judge_assignments").insert({ submission_id: active.id, judge_user_id: judgeUser, assigned_by: auth.user?.id });
    if (assignError) setError(assignError.message); else setMessage("Judge assigned to this submission.");
  };

  const publish = async (submission: Submission) => {
    if (!supabase) return;
    const { error: publishError } = await supabase.rpc("publish_gjm_result", { p_submission_id: submission.id });
    if (publishError) setError(publishError.message); else { setMessage("Result published for the participant."); await load(); }
  };

  const saveSchedule = async () => {
    if (!supabase || !eventSettings) return;
    const opens = new Date(eventSettings.registration_opens_at).getTime();
    const closes = new Date(eventSettings.registration_closes_at).getTime();
    if (closes <= opens) { setError("Registration closing time must be after opening time."); return; }
    const { data: auth } = await supabase.auth.getUser();
    const { error: scheduleError } = await supabase.from("gjm_event_settings").update({ ...eventSettings, updated_at: new Date().toISOString(), updated_by: auth.user?.id }).eq("id", true);
    if (scheduleError) setError(scheduleError.message); else setMessage("Mahotsav schedule saved.");
  };

  const saveRubric = async () => {
    if (!supabase || !active) return;
    const configured = criteria.filter((criterion) => criterion.competition_code === active.competition_code && criterion.is_active);
    if (configured.length !== 4 || configured.some((criterion) => !criterion.criterion.trim() || Number(criterion.max_marks) !== 25)) {
      setError("Each active rubric must have four named criteria worth 25 marks each."); return;
    }
    for (const criterion of configured) {
      const { error: rubricError } = await supabase.from("gjm_evaluation_criteria").update({ criterion: criterion.criterion.trim() }).eq("id", criterion.id);
      if (rubricError) { setError(rubricError.message); return; }
    }
    setMessage("Evaluation criteria saved.");
    await load();
  };

  const saveAgeRules = async () => {
    if (!supabase) return;
    const activeRules = ageRules.filter((rule) => rule.is_active).sort((a,b) => a.minimum_age - b.minimum_age);
    if (activeRules.length !== 4 || activeRules[0].minimum_age !== 0) { setError("Keep all four categories active and start the first category at age zero."); return; }
    for (let index = 1; index < activeRules.length; index++) {
      const previousMax = activeRules[index - 1].maximum_age;
      if (previousMax === null || activeRules[index].minimum_age <= previousMax) { setError("Age ranges must not overlap. Leave gaps only where the organizer still needs to clarify a boundary."); return; }
    }
    if (activeRules[activeRules.length - 1].maximum_age !== null) { setError("The Open category must remain without an upper age limit."); return; }
    for (const rule of activeRules) {
      const { error: ruleError } = await supabase.from("gjm_age_category_rules").update({ minimum_age: rule.minimum_age, maximum_age: rule.maximum_age, is_active: true, updated_at: new Date().toISOString() }).eq("category", rule.category);
      if (ruleError) { setError(ruleError.message); return; }
    }
    setMessage("Age category rules saved.");
    await load();
  };

  const saveCompetitionSettings = async () => {
    if (!supabase) return;
    for (const setting of competitionSettings) {
      if (!Number.isFinite(setting.max_upload_bytes) || setting.max_upload_bytes < 1 || setting.max_upload_bytes > 524288000 || (setting.max_video_seconds !== null && setting.max_video_seconds < 1)) {
        setError("Upload limit must be from 1 byte through 500 MiB; video duration must be a positive number of seconds."); return;
      }
      const { error: settingError } = await supabase.from("gjm_competitions").update({ is_open: setting.is_open, max_upload_bytes: setting.max_upload_bytes, max_video_seconds: setting.max_video_seconds, updated_at: new Date().toISOString() }).eq("code", setting.code);
      if (settingError) { setError(settingError.message); return; }
    }
    setMessage("Competition eligibility and upload limits saved.");
    await load();
  };

  const exportRows = () => downloadCsv("gjm-competition-submissions.csv", ["Registration ID", "Participant", "Age Category", "Competition", "Status", "Total", "Published"], [
    ...visible.map((item) => [item.candidate_registrations.registration_number, item.candidate_registrations.full_name, item.candidate_registrations.age_category ?? "Review", titles[item.competition_code] ?? item.competition_code, item.status, item.gjm_evaluations?.[0]?.total_marks ?? "", item.result_published ? "Yes" : "No"]),
    ...visibleQuizAttempts.map((attempt) => [attempt.candidate_registrations.registration_number, attempt.candidate_registrations.full_name, attempt.candidate_registrations.age_category ?? "Review", titles.geeta_quiz, attempt.submitted_at ? "Submitted" : "In progress", attempt.raw_score ?? "", "Immediate quiz result"]),
  ]);

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-gold">Authorized review</p><h1 style={{ fontFamily: "var(--font-display)" }} className="mt-1 text-2xl font-bold text-brown">Mahotsav submissions & judging</h1><p className="mt-1 text-sm text-brown-mid">Private files, assigned judge access, criterion-based scoring.</p></div><button onClick={exportRows} className="rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon hover:bg-maroon/5">Export filtered CSV</button></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {isAdmin && eventSettings && <details className="rounded-2xl border border-cream-dark bg-cream"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-brown">Quiz exam mode policy</summary><div className="space-y-4 border-t border-cream-dark p-5"><p className="text-xs text-brown-mid">Choose which detected browser events automatically submit the exam. Focus changes may also come from legitimate system interruptions.</p><div className="grid gap-3 sm:grid-cols-3"><label className="flex items-start gap-2 text-xs text-brown-mid"><input type="checkbox" checked={eventSettings.submit_on_tab_switch} onChange={(event) => setEventSettings((current) => current ? { ...current, submit_on_tab_switch: event.target.checked } : current)} className="mt-0.5 accent-maroon" />Auto-submit when the quiz tab is hidden</label><label className="flex items-start gap-2 text-xs text-brown-mid"><input type="checkbox" checked={eventSettings.submit_on_window_blur} onChange={(event) => setEventSettings((current) => current ? { ...current, submit_on_window_blur: event.target.checked } : current)} className="mt-0.5 accent-maroon" />Auto-submit when the browser loses focus</label><label className="flex items-start gap-2 text-xs text-brown-mid"><input type="checkbox" checked={eventSettings.submit_on_fullscreen_exit} onChange={(event) => setEventSettings((current) => current ? { ...current, submit_on_fullscreen_exit: event.target.checked } : current)} className="mt-0.5 accent-maroon" />Auto-submit when fullscreen ends</label></div><button onClick={() => void saveSchedule()} className="rounded-lg bg-maroon px-4 py-2 text-xs font-semibold text-cream">Save exam policy</button></div></details>}
    {isAdmin && eventSettings && <details className="rounded-2xl border border-gold/30 bg-cream"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-brown">Event schedule and registration window settings</summary><div className="grid gap-3 border-t border-cream-dark p-5 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-medium text-brown-mid">Event date<input type="date" value={eventSettings.event_date} onChange={(event) => setEventSettings((current) => current ? { ...current, event_date: event.target.value } : current)} className={`${fieldClass} mt-1 block w-full`} /></label>{([["registration_opens_at","Registration opens"],["registration_closes_at","Registration closes"],["submissions_close_at","Submissions deadline"],["judging_opens_at","Judging opens"],["judging_closes_at","Judging closes"],["results_at","Results publish date"],["preparations_start_at","Final preparations start"],["preparations_end_at","Final preparations end"]] as const).map(([key,label]) => <label key={key} className="text-xs font-medium text-brown-mid">{label}<input type="datetime-local" value={localDateTime(eventSettings[key])} onChange={(event) => setEventSettings((current) => current ? { ...current, [key]: new Date(event.target.value).toISOString() } : current)} className={`${fieldClass} mt-1 block w-full`} /></label>)}<label className="flex items-start gap-2 text-xs leading-relaxed text-brown-mid sm:col-span-2"><input type="checkbox" checked={eventSettings.registration_window_confirmed} onChange={(event) => setEventSettings((current) => current ? { ...current, registration_window_confirmed: event.target.checked } : current)} className="mt-0.5 accent-maroon" />Organizer confirmed the stated registration/quiz window and closing time.</label><div className="sm:col-span-2 lg:col-span-3"><button onClick={() => void saveSchedule()} className="rounded-lg bg-maroon px-4 py-2 text-xs font-semibold text-cream">Save schedule</button>{!eventSettings.registration_window_confirmed && <p className="mt-2 text-xs text-amber-800">The brief says the 1 December quiz/registration window needs clarification; confirm the time before enabling registration.</p>}</div></div></details>}
    {isAdmin && <details className="rounded-2xl border border-cream-dark bg-cream"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-brown">Age category boundaries</summary><div className="space-y-3 border-t border-cream-dark p-5">{ageRules.map((rule) => <div key={rule.category} className="grid grid-cols-[minmax(120px,1fr)_1fr_1fr] items-center gap-2 text-xs"><strong className="text-brown">{rule.category}</strong><label className="text-brown-mid">Minimum<input aria-label={`${rule.category} minimum age`} type="number" min="0" value={rule.minimum_age} onChange={(event) => setAgeRules((current) => current.map((item) => item.category === rule.category ? { ...item, minimum_age: Number(event.target.value) } : item))} className={`${fieldClass} mt-1 block w-full`} /></label><label className="text-brown-mid">Maximum<input aria-label={`${rule.category} maximum age; blank is no limit`} type="number" min={rule.minimum_age} value={rule.maximum_age ?? ""} onChange={(event) => setAgeRules((current) => current.map((item) => item.category === rule.category ? { ...item, maximum_age: event.target.value === "" ? null : Number(event.target.value) } : item))} className={`${fieldClass} mt-1 block w-full`} placeholder="No limit" /></label></div>)}<p className="text-xs text-amber-800">The supplied brief leaves ages 18 and 30 unresolved. Keep those gaps until the organizer confirms placement.</p><button onClick={() => void saveAgeRules()} className="rounded-lg bg-maroon px-4 py-2 text-xs font-semibold text-cream">Save age rules</button></div></details>}
    {isAdmin && <details className="rounded-2xl border border-cream-dark bg-cream"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-brown">Competition availability and upload limits</summary><div className="space-y-3 border-t border-cream-dark p-5">{competitionSettings.map((setting) => <div key={setting.code} className="grid gap-3 rounded-xl bg-cream-dark/50 p-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] sm:items-center"><strong className="text-sm text-brown">{setting.title}</strong><label className="flex items-center gap-2 text-xs text-brown-mid"><input type="checkbox" checked={setting.is_open} onChange={(event) => setCompetitionSettings((current) => current.map((item) => item.code === setting.code ? { ...item, is_open: event.target.checked } : item))} className="accent-maroon" />Open</label><label className="text-xs text-brown-mid">Max file MB<input type="number" min="1" max="500" value={Math.round(setting.max_upload_bytes / 1048576)} onChange={(event) => setCompetitionSettings((current) => current.map((item) => item.code === setting.code ? { ...item, max_upload_bytes: Number(event.target.value) * 1048576 } : item))} className={`${fieldClass} mt-1 block w-full`} /></label><label className="text-xs text-brown-mid">Max video seconds<input type="number" min="1" value={setting.max_video_seconds ?? ""} disabled={setting.max_video_seconds === null} onChange={(event) => setCompetitionSettings((current) => current.map((item) => item.code === setting.code ? { ...item, max_video_seconds: Number(event.target.value) } : item))} className={`${fieldClass} mt-1 block w-full disabled:bg-cream-dark`} /></label></div>)}<p className="text-xs text-brown-mid">The private storage bucket enforces a hard ceiling of 500 MiB. Video durations are checked by the browser and verified against submitted metadata; this setup does not include server-side media transcoding.</p><button onClick={() => void saveCompetitionSettings()} className="rounded-lg bg-maroon px-4 py-2 text-xs font-semibold text-cream">Save category settings</button></div></details>}
    <section className="grid gap-3 rounded-xl border border-cream-dark bg-cream p-4 sm:grid-cols-3">
      <select aria-label="Filter by competition" value={filterCode} onChange={(event) => setFilterCode(event.target.value)} className={fieldClass}><option value="all">All competitions</option>{codeOptions.map(([code,title]) => <option key={code} value={code}>{title}</option>)}</select>
      <select aria-label="Filter by age category" value={filterAge} onChange={(event) => setFilterAge(event.target.value)} className={fieldClass}><option value="all">All age categories</option>{["Sub-Junior","Junior","Senior","Open"].map((age) => <option key={age}>{age}</option>)}</select>
      <select aria-label="Filter by status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className={fieldClass}><option value="all">All statuses</option>{["Draft","In progress","Submitted","Evaluated"].map((status) => <option key={status}>{status}</option>)}</select>
    </section>
    {loading ? <p className="rounded-xl bg-cream p-5 text-sm text-brown-mid">Loading authorized submissions…</p> : visible.length === 0 ? <p className="rounded-xl border border-cream-dark bg-cream p-6 text-sm text-brown-mid">No submissions match these filters.</p> : <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
      <section className="space-y-2">{visible.map((item) => <button key={item.id} onClick={() => setSelected(item.id)} className={`w-full rounded-xl border p-4 text-left transition ${active?.id === item.id ? "border-maroon bg-maroon/5" : "border-cream-dark bg-cream hover:border-gold"}`}><div className="flex justify-between gap-2"><span className="font-semibold text-brown">{item.candidate_registrations.full_name}</span><span className="text-xs text-brown-mid">{item.status}</span></div><p className="mt-1 text-xs text-brown-mid">{item.candidate_registrations.registration_number} · {item.candidate_registrations.age_category}</p><p className="mt-1 text-xs text-maroon">{titles[item.competition_code] ?? item.competition_code}</p></button>)}</section>
      {active && <section className="space-y-5 rounded-2xl border border-cream-dark bg-cream p-5 sm:p-6">
        <div><h2 style={{ fontFamily: "var(--font-display)" }} className="text-xl font-bold text-brown">{active.candidate_registrations.full_name}</h2><p className="mt-1 text-sm text-brown-mid">{active.candidate_registrations.registration_number} · {active.candidate_registrations.age_category} · {titles[active.competition_code]}</p></div>
        <div><h3 className="mb-2 text-sm font-semibold text-brown">Submission files</h3>{active.gjm_submission_files?.length ? <div className="flex flex-wrap gap-2">{active.gjm_submission_files.map((file) => <button key={file.id} onClick={() => void openFile(file)} className="rounded-lg border border-maroon px-3 py-2 text-xs font-semibold text-maroon hover:bg-maroon/5">Open {file.file_kind.split("_").join(" ")} · {(file.file_size / 1048576).toFixed(1)} MB</button>)}</div> : <p className="text-xs text-brown-mid">No files uploaded.</p>}{previewFile && (previewFile.contentType.startsWith("image/") ? <img src={previewFile.url} alt="Participant submission preview" className="mt-3 max-h-[28rem] w-full rounded-xl bg-black object-contain" /> : <video src={previewFile.url} controls playsInline className="mt-3 max-h-[28rem] w-full rounded-xl bg-black" />)}</div>
        {active.competition_code !== "geeta_quiz" && <div className="space-y-3"><h3 className="text-sm font-semibold text-brown">Evaluation · total out of 100</h3>{activeCriteria.map((criterion) => <div key={criterion.id} className="grid gap-2 text-xs text-brown-mid sm:grid-cols-[1fr_7rem] sm:items-center"><label>{isAdmin && activeEvaluation?.status !== "Final" ? <input aria-label="Rubric criterion" value={criterion.criterion} onChange={(event) => setCriteria((current) => current.map((item) => item.id === criterion.id ? { ...item, criterion: event.target.value } : item))} className={`${fieldClass} w-full`} /> : criterion.criterion}<span className="ml-2 text-brown-light">/ {criterion.max_marks}</span></label><input aria-label={`Marks for ${criterion.criterion}`} type="number" min="0" max={criterion.max_marks} step="0.5" value={marks[criterion.id] ?? ""} onChange={(event) => setMarks((current) => ({ ...current, [criterion.id]: event.target.value }))} className={fieldClass} disabled={activeEvaluation?.status === "Final"} /></div>)}{isAdmin && <button onClick={() => void saveRubric()} className="rounded-lg border border-gold px-3 py-2 text-xs font-semibold text-brown">Save rubric labels</button>}<label className="block text-xs font-medium text-brown-mid">Feedback / remarks<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} disabled={activeEvaluation?.status === "Final"} className={`${fieldClass} mt-1 w-full`} /></label><p className="text-sm font-semibold text-maroon">Calculated total: {activeCriteria.reduce((sum, criterion) => sum + (Number(marks[criterion.id]) || 0), 0)} / 100</p>{activeEvaluation?.status === "Final" ? <p className="text-xs text-green-800">Final evaluation saved. Revisions require administrator action.</p> : <div className="flex flex-wrap gap-2"><button onClick={() => void saveEvaluation(false)} className="rounded-lg border border-maroon px-4 py-2 text-xs font-semibold text-maroon">Save draft</button><button onClick={() => void saveEvaluation(true)} className="rounded-lg bg-maroon px-4 py-2 text-xs font-semibold text-cream">Finalize evaluation</button></div>}</div>}
        {isAdmin && <div className="flex flex-wrap items-center gap-2 border-t border-cream-dark pt-4"><select aria-label="Judge" value={judgeUser} onChange={(event) => setJudgeUser(event.target.value)} className={fieldClass}><option value="">Assign a judge…</option>{judges.map((judge) => <option key={judge.id} value={judge.id}>{judge.id}</option>)}</select><button onClick={() => void assignJudge()} disabled={!judgeUser} className="rounded-lg border border-maroon px-3 py-2 text-xs font-semibold text-maroon disabled:opacity-50">Assign judge</button>{active.status === "Evaluated" && !active.result_published && <button onClick={() => void publish(active)} className="rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-brown">Publish result</button>}{active.result_published && <span className="text-xs font-semibold text-green-800">Result published</span>}</div>}
      </section>}
    </div>}
    {isAdmin && <section className="overflow-hidden rounded-2xl border border-cream-dark bg-cream"><div className="border-b border-cream-dark px-5 py-4"><h2 className="font-semibold text-brown">Quiz attempts and activity flags</h2><p className="mt-1 text-xs text-brown-mid">Focus events are review signals and may include legitimate interruptions.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="bg-cream-dark/60 text-xs uppercase text-brown-mid"><tr><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Started</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Elapsed</th><th className="px-4 py-3">Raw /25</th><th className="px-4 py-3">Percent</th><th className="px-4 py-3">Status / reason</th><th className="px-4 py-3">Hidden tabs</th><th className="px-4 py-3">Fullscreen exits</th><th className="px-4 py-3">Network interruptions</th><th className="px-4 py-3">Event timestamps</th></tr></thead><tbody>{visibleQuizAttempts.map((attempt) => <tr key={attempt.id} className="border-t border-cream-dark align-top"><td className="px-4 py-3">{attempt.candidate_registrations.registration_number}</td><td className="px-4 py-3">{attempt.candidate_registrations.full_name}</td><td className="px-4 py-3 whitespace-nowrap">{new Date(attempt.started_at).toLocaleString()}</td><td className="px-4 py-3 whitespace-nowrap">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "—"}</td><td className="px-4 py-3">{attempt.submitted_at ? `${Math.max(0, Math.floor((new Date(attempt.submitted_at).getTime() - new Date(attempt.started_at).getTime()) / 60000))} min` : "In progress"}</td><td className="px-4 py-3">{attempt.raw_score ?? "—"}</td><td className="px-4 py-3">{attempt.normalized_score ?? "—"}</td><td className="px-4 py-3">{attempt.submitted_at ? `Submitted · ${attempt.submission_reason ?? "unknown"}` : "In progress"}</td><td className="px-4 py-3">{attempt.visibility_flags}</td><td className="px-4 py-3">{attempt.fullscreen_exits}</td><td className="px-4 py-3">{attempt.network_interruptions}</td><td className="px-4 py-3"><ul className="space-y-1">{(attempt.gjm_quiz_attempt_events ?? []).map((event) => <li key={event.id} className="whitespace-nowrap text-xs">{event.event_type.replace(/_/g, " ")} · {new Date(event.occurred_at).toLocaleString()}{event.details?.client_detected_at && <span className="block text-brown-light">Detected on device: {new Date(event.details.client_detected_at).toLocaleString()}</span>}</li>)}</ul></td></tr>)}</tbody></table>{visibleQuizAttempts.length === 0 && <p className="px-5 py-6 text-sm text-brown-mid">No quiz attempts match these filters.</p>}</div></section>}
  </div>;
}
