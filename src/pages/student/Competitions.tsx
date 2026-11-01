import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseAccessToken, getSupabaseUserId, supabase as supabase } from "../../lib/supabase";

const bucket = "gjm-competition-submissions";
const categories = [
  { code: "shloka_uccharan", title: "Shloka Uccharan", description: "Recite five Bhagavad Gita shlokas from memory. One clear, unedited video, up to 3 minutes. No music or reading from a book.", kind: "performance_video", accept: "video/webm,video/mp4,video/quicktime", max: 180 },
  { code: "geeta_quiz", title: "Rashtriya Geeta Gyan Quiz", description: "50 questions · 25 minutes · one attempt. Your progress is saved securely; leaving the tab is recorded for the judges.", kind: "quiz", accept: "", max: 0 },
  { code: "digital_bhashan", title: "Digital Bhashan", description: "Upload your speech video in Hindi, Sanskrit, or English. Duration depends on your age category.", kind: "performance_video", accept: "video/webm,video/mp4,video/quicktime", max: 300 },
  { code: "geeta_art", title: "Geeta-Inspired Drawing / Painting", description: "Submit a handmade artwork photo, a photo of you with the artwork, and a 20–30 second process video. Digital and AI artwork is not accepted.", kind: "artwork_photo", accept: "image/jpeg,image/png,image/webp", max: 0 },
] as const;

type Candidate = { id: string; registration_number: string; status: string; age_category: string | null; birth_date: string | null; parental_consent: boolean };
type Entry = { id: string; submission_id?: string; competition_code: string; status: string; submitted_at: string | null; result_published?: boolean; total_marks?: number; feedback?: string };
type QuizQuestion = { id: string; text: string; options: string[]; selected: string | null };
type QuizRun = { attempt_id: string; started_at: string; expires_at: string; server_now: string; submitted: boolean; raw_score: number | null; normalized_score: number | null; submission_reason?: string | null; submit_on_tab_switch: boolean; submit_on_window_blur: boolean; submit_on_fullscreen_exit: boolean; questions: QuizQuestion[] };
type QuizSubmissionReason = "MANUAL_SUBMIT" | "TIME_EXPIRED" | "TAB_SWITCH" | "WINDOW_HIDDEN" | "WINDOW_BLUR" | "FULLSCREEN_EXIT";
type FileKind = "performance_video" | "artwork_photo" | "participant_photo" | "process_video";

const artFiles: { kind: FileKind; label: string; accept: string; max: number }[] = [
  { kind: "artwork_photo", label: "Artwork photo", accept: "image/jpeg,image/png,image/webp", max: 0 },
  { kind: "participant_photo", label: "You with your artwork", accept: "image/jpeg,image/png,image/webp", max: 0 },
  { kind: "process_video", label: "20–30 second process video", accept: "video/webm,video/mp4,video/quicktime", max: 30 },
];

function getMediaDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement("video");
    const timeout = window.setTimeout(() => finish(new Error("Could not read video duration. Try exporting the video as MP4 or WebM.")), 12000);
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      media.removeAttribute("src");
      if (error) reject(error);
      else resolve(media.duration);
    };
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      if (!Number.isFinite(media.duration) || media.duration <= 0) finish(new Error("The selected video has no readable duration."));
      else finish();
    };
    media.onerror = () => finish(new Error("The selected video could not be opened."));
    media.src = url;
  });
}

function ageLimit(category: string | null) {
  if (category === "Sub-Junior") return { min: 120, max: 180, label: "2–3 minutes" };
  if (category === "Junior") return { min: 180, max: 240, label: "3–4 minutes" };
  return { min: 240, max: 300, label: "4–5 minutes" };
}

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function readLocal(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeLocal(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Server-side answer saving remains the fallback. */ }
}
function removeLocal(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* Storage may be unavailable in private browser contexts. */ }
}

async function uploadWithProgress(path: string, file: File, onProgress: (percent: number) => void) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const accessToken = await getSupabaseAccessToken();
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!accessToken || !projectUrl || !publicKey) throw new Error("Your secure upload session has expired. Sign in again and retry.");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${projectUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${encodedPath}`);
    request.setRequestHeader("apikey", publicKey);
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("Content-Type", file.type);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    request.onerror = () => reject(new Error("Network error while uploading. Check your connection and retry."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) { onProgress(100); resolve(); return; }
      try {
        const response = JSON.parse(request.responseText) as { message?: string; error?: string };
        reject(new Error(response.message || response.error || `Upload failed (${request.status}).`));
      } catch { reject(new Error(`Upload failed (${request.status}).`)); }
    };
    request.send(file);
  });
}

export default function StudentCompetitions() {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState("");
  const [parentalConsent, setParentalConsent] = useState(false);
  const [files, setFiles] = useState<Record<string, { kind: FileKind; file_size: number }[]>>({});
  const [quiz, setQuiz] = useState<QuizRun | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizPending, setQuizPending] = useState(false);
  const [readyToStart, setReadyToStart] = useState(false);
  const [quizPolicy, setQuizPolicy] = useState({ submit_on_tab_switch: true, submit_on_window_blur: false, submit_on_fullscreen_exit: true });
  const [remaining, setRemaining] = useState(0);
  const [language, setLanguage] = useState("Hindi");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const answersRef = useRef(answers);
  const submitLockRef = useRef<string | null>(null);
  const serverClockOffsetRef = useRef(0);
  const pendingSubmissionRef = useRef<{ attempt_id: string; answers: Record<string, string>; reason: QuizSubmissionReason; detected_at: string } | null>(null);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured. Competition participation is unavailable."); return; }
    setBusy(true);
    try {
      const userId = await getSupabaseUserId();
      if (!userId) throw new Error("Sign in with the Supabase account used for participant registration.");
      const { data: record, error: recordError } = await supabase.from("candidate_registrations").select("id,registration_number,status,age_category,birth_date,parental_consent").eq("user_id", userId).single();
      if (recordError) throw new Error("No participant registration was found for this account.");
      const { data: policy } = await supabase.from("gjm_event_settings").select("submit_on_tab_switch,submit_on_window_blur,submit_on_fullscreen_exit").eq("id", true).maybeSingle();
      if (policy) setQuizPolicy(policy);
      setCandidate(record as Candidate);
      setBirthDate(record.birth_date ?? "");
      setParentalConsent(Boolean(record.parental_consent));
      const { data: entryRows, error: entryError } = await supabase.from("gjm_participant_competitions").select("id,competition_code").eq("registration_id", record.id);
      if (entryError) throw new Error(entryError.message);
      const entriesForCandidate = (entryRows ?? []).map((entry) => ({ ...entry, status: "Registered", submitted_at: null })) as Entry[];
      const { data: submissionRows } = await supabase.from("gjm_submissions").select("id,competition_code,status,submitted_at,result_published").eq("registration_id", record.id);
      const { data: evaluationRows } = await supabase.from("gjm_evaluations").select("submission_id,total_marks,feedback,status");
      for (const entry of entriesForCandidate) {
        const submission = (submissionRows ?? []).find((item) => item.competition_code === entry.competition_code);
        if (submission) {
          Object.assign(entry, { submission_id: submission.id, status: submission.status, submitted_at: submission.submitted_at, result_published: submission.result_published });
          const evaluation = (evaluationRows ?? []).find((item) => item.submission_id === submission.id);
          if (evaluation) Object.assign(entry, { total_marks: evaluation.total_marks, feedback: evaluation.feedback });
        }
      }
      setEntries(entriesForCandidate);
      setSelectedCodes(entriesForCandidate.map((entry) => entry.competition_code));
      const { data: fileRows } = await supabase.from("gjm_submission_files").select("file_kind,file_size,submission_id");
      const grouped: Record<string, { kind: FileKind; file_size: number }[]> = {};
      for (const entry of entriesForCandidate) {
        const submission = (submissionRows ?? []).find((item) => item.competition_code === entry.competition_code);
        grouped[entry.competition_code] = (fileRows ?? []).filter((file) => file.submission_id === submission?.id).map((file) => ({ kind: file.file_kind as FileKind, file_size: file.file_size }));
      }
      setFiles(grouped);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load participant competitions.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const eventAge = useMemo(() => {
    if (!birthDate) return null;
    const dob = new Date(`${birthDate}T00:00:00`);
    const event = new Date("2026-12-20T00:00:00");
    let age = event.getFullYear() - dob.getFullYear();
    if (event.getMonth() < dob.getMonth() || (event.getMonth() === dob.getMonth() && event.getDate() < dob.getDate())) age--;
    return age;
  }, [birthDate]);

  const saveSelections = async () => {
    if (!supabase || !candidate) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { data, error: rpcError } = await supabase.rpc("register_gjm_competitions", { p_birth_date: birthDate, p_parental_consent: parentalConsent, p_codes: selectedCodes });
      if (rpcError) throw new Error(rpcError.message);
      setMessage(`Categories saved. Your age category is ${data}.`);
      await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save competition choices."); }
    finally { setBusy(false); }
  };

  const submitQuiz = useCallback(async (attemptId: string, reason: QuizSubmissionReason, nextAnswers = answersRef.current, detectedAt = new Date().toISOString()) => {
    if (!supabase || submitLockRef.current === attemptId) return;
    const pendingKey = `gjm-quiz-pending:${attemptId}`;
    const payload = { attempt_id: attemptId, answers: nextAnswers, reason, detected_at: detectedAt };
    submitLockRef.current = attemptId;
    pendingSubmissionRef.current = payload;
    setQuizPending(true); setError(""); setMessage("");
    try {
      writeLocal(pendingKey, JSON.stringify(payload));
      const submitted = await supabase.rpc("submit_gjm_quiz", { p_attempt_id: attemptId, p_answers: nextAnswers, p_reason: reason, p_detected_at: payload.detected_at });
      if (submitted.error) throw new Error(submitted.error.message);
      removeLocal(pendingKey);
      pendingSubmissionRef.current = null;
      const score = submitted.data as { correct_count: number; raw_score: number; normalized_score: number; submission_reason?: string };
      setQuiz((current) => current?.attempt_id === attemptId ? { ...current, submitted: true, raw_score: score.raw_score, normalized_score: score.normalized_score, submission_reason: score.submission_reason ?? reason } : current);
      const automatic = reason !== "MANUAL_SUBMIT";
      setMessage(automatic
        ? `Your exam was automatically submitted (${score.submission_reason ?? reason}). Result: ${score.raw_score}/25 · ${score.normalized_score}/100.`
        : `Quiz submitted. ${score.correct_count}/50 correct · ${score.raw_score}/25 · ${score.normalized_score}/100.`);
      setReadyToStart(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } catch (submitError) {
      const reasonLabel = reason === "MANUAL_SUBMIT" ? "Submission" : "Automatic submission";
      setError(`${reasonLabel} could not reach the server. Saved answers remain attached to this one attempt; reconnect to retry the submission.`);
      void supabase.rpc("record_gjm_quiz_event", { p_attempt_id: attemptId, p_event_type: "AUTO_SUBMIT_FAILED", p_details: { reason } });
    } finally {
      submitLockRef.current = null;
      setQuizPending(Boolean(readLocal(pendingKey) || pendingSubmissionRef.current?.attempt_id === attemptId));
    }
  }, []);

  const startQuiz = async () => {
    if (!supabase || !readyToStart) return;
    setBusy(true); setError(""); setMessage("");
    try {
      try { await document.documentElement.requestFullscreen(); }
      catch { setMessage("Fullscreen could not be enabled by this browser. The attempt will still use the published focus rules."); }
      const { data, error: rpcError } = await supabase.rpc("start_gjm_quiz");
      if (rpcError) throw new Error(rpcError.message);
      const run = data as QuizRun;
      serverClockOffsetRef.current = new Date(run.server_now).getTime() - Date.now();
      setQuiz(run);
      const serverAnswers = Object.fromEntries(run.questions.filter((question) => question.selected).map((question) => [question.id, question.selected as string]));
      const savedAnswers = readLocal(`gjm-quiz-answers:${run.attempt_id}`);
      const recoveredAnswers = savedAnswers ? { ...serverAnswers, ...(JSON.parse(savedAnswers) as Record<string, string>) } : serverAnswers;
      setAnswers(recoveredAnswers);
      setRemaining(Math.max(0, new Date(run.expires_at).getTime() - (Date.now() + serverClockOffsetRef.current)));
      setReadyToStart(false);
      if (run.submitted) {
        setMessage(`Quiz submitted (${run.submission_reason ?? "previous attempt"}). Result: ${run.raw_score}/25 (${run.normalized_score}/100).`);
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      } else {
        const pending = readLocal(`gjm-quiz-pending:${run.attempt_id}`);
        if (pending) {
          const queued = JSON.parse(pending) as { reason: QuizSubmissionReason; answers: Record<string, string>; detected_at?: string };
          void submitQuiz(run.attempt_id, queued.reason, queued.answers, queued.detected_at);
        }
      }
    } catch (startError) { setError(startError instanceof Error ? startError.message : "Could not start or resume the quiz."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!quiz || quiz.submitted) return;
    const refreshClock = () => {
      const value = new Date(quiz.expires_at).getTime() - (Date.now() + serverClockOffsetRef.current);
      setRemaining(Math.max(0, value));
      if (value <= 0) void submitQuiz(quiz.attempt_id, "TIME_EXPIRED");
    };
    refreshClock();
    const timer = window.setInterval(refreshClock, 1000);
    return () => window.clearInterval(timer);
  }, [quiz?.attempt_id, quiz?.expires_at, quiz?.submitted, submitQuiz]);

  useEffect(() => {
    const client = supabase;
    if (!quiz || quiz.submitted || !client) return;
    const saveTimer = window.setTimeout(() => {
      writeLocal(`gjm-quiz-answers:${quiz.attempt_id}`, JSON.stringify(answers));
      void client.rpc("save_gjm_quiz_answers", { p_attempt_id: quiz.attempt_id, p_answers: answers });
    }, 300);
    return () => window.clearTimeout(saveTimer);
  }, [quiz?.attempt_id, quiz?.submitted, answers]);

  useEffect(() => {
    const client = supabase;
    if (!quiz || quiz.submitted || !client) return;
    const attemptId = quiz.attempt_id;
    const reportEvent = (eventType: string) => { void client.rpc("record_gjm_quiz_event", { p_attempt_id: attemptId, p_event_type: eventType }); };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (quiz.submit_on_tab_switch) void submitQuiz(attemptId, "WINDOW_HIDDEN");
        else reportEvent("WINDOW_HIDDEN");
      }
    };
    const onBlur = () => {
      if (quiz.submit_on_window_blur) void submitQuiz(attemptId, "WINDOW_BLUR");
      else reportEvent("WINDOW_BLUR");
    };
    const onFocus = () => reportEvent("WINDOW_FOCUS");
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && quiz.submit_on_fullscreen_exit) {
        void submitQuiz(attemptId, "FULLSCREEN_EXIT");
      } else if (!document.fullscreenElement) reportEvent("FULLSCREEN_EXIT");
    };
    const onOffline = () => {
      writeLocal(`gjm-quiz-offline:${attemptId}`, new Date().toISOString());
    };
    const onOnline = () => {
      const offlineAt = readLocal(`gjm-quiz-offline:${attemptId}`);
      if (offlineAt) {
        removeLocal(`gjm-quiz-offline:${attemptId}`);
        void client.rpc("record_gjm_quiz_event", { p_attempt_id: attemptId, p_event_type: "NETWORK_INTERRUPTION", p_details: { detected_at: offlineAt } });
        void client.rpc("record_gjm_quiz_event", { p_attempt_id: attemptId, p_event_type: "NETWORK_RESTORED", p_details: { detected_at: new Date().toISOString() } });
      }
      const pending = readLocal(`gjm-quiz-pending:${attemptId}`);
      if (pending) {
        const queued = JSON.parse(pending) as { reason: QuizSubmissionReason; answers: Record<string, string>; detected_at?: string };
        void client.rpc("record_gjm_quiz_event", { p_attempt_id: attemptId, p_event_type: "SUBMISSION_RETRY" });
        void submitQuiz(attemptId, queued.reason, queued.answers, queued.detected_at);
      } else if (pendingSubmissionRef.current?.attempt_id === attemptId) {
        const queued = pendingSubmissionRef.current;
        void client.rpc("record_gjm_quiz_event", { p_attempt_id: attemptId, p_event_type: "SUBMISSION_RETRY" });
        void submitQuiz(attemptId, queued.reason, queued.answers);
      } else if (Date.now() + serverClockOffsetRef.current >= new Date(quiz.expires_at).getTime()) void submitQuiz(attemptId, "TIME_EXPIRED");
      else { setQuizPending(false); void client.rpc("save_gjm_quiz_answers", { p_attempt_id: attemptId, p_answers: answersRef.current }); }
    };
    const onNavigate = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (target) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("click", onNavigate, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("click", onNavigate, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [quiz?.attempt_id, quiz?.submitted, quiz?.submit_on_tab_switch, quiz?.submit_on_window_blur, quiz?.submit_on_fullscreen_exit, quiz?.expires_at, submitQuiz]);

  const uploadFile = async (code: string, kind: FileKind, file: File, maxSeconds: number) => {
    if (!supabase || !candidate) return;
    setBusy(true); setError(""); setMessage("Checking file type and duration…"); setUploadProgress(0);
    let objectPath = "";
    try {
      if (file.size > 500 * 1024 * 1024) throw new Error("File exceeds the 500 MB upload limit.");
      let duration: number | null = null;
      if (file.type.startsWith("video/")) {
        duration = await getMediaDuration(file);
        if (maxSeconds === 180 && duration > 180) throw new Error("Shloka video must be no longer than 3 minutes.");
        if (code === "digital_bhashan") {
          const timing = ageLimit(candidate.age_category);
          if (duration < timing.min || duration > timing.max) throw new Error(`Your ${candidate.age_category} speech should be ${timing.label}.`);
        }
        if (kind === "process_video" && (duration < 20 || duration > 30)) throw new Error("The process video must be 20–30 seconds long.");
      } else if (!file.type.match(/^image\/(jpeg|png|webp)$/)) throw new Error("Use a JPEG, PNG, or WebP image.");

      const { data: existing } = await supabase.from("gjm_submissions").select("id,status").eq("registration_id", candidate.id).eq("competition_code", code).maybeSingle();
      if (existing?.status === "Submitted" || existing?.status === "Evaluated") throw new Error("This competition submission has already been finalized.");
      let submissionId = existing?.id;
      if (!submissionId) {
        const { data: created, error: createError } = await supabase.from("gjm_submissions").insert({ registration_id: candidate.id, competition_code: code }).select("id").single();
        if (createError) throw new Error(createError.message);
        submissionId = created.id;
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const studentId = await getSupabaseUserId();
      if (!studentId) throw new Error("Your Supabase session expired. Sign in again and retry.");
      objectPath = `${studentId}/${submissionId}/${kind}-${Date.now()}-${safeName}`;
      setMessage("Uploading securely…");
      await uploadWithProgress(objectPath, file, setUploadProgress);
      const { error: metadataError } = await supabase.from("gjm_submission_files").insert({ submission_id: submissionId, storage_path: objectPath, file_kind: kind, content_type: file.type, file_size: file.size, duration_seconds: duration });
      if (metadataError) {
        await supabase.storage.from(bucket).remove([objectPath]);
        throw new Error(metadataError.message);
      }

      const currentKinds = [...(files[code] ?? []).map((item) => item.kind), kind];
      const ready = code === "geeta_art"
        ? ["artwork_photo", "participant_photo", "process_video"].every((required) => currentKinds.includes(required as FileKind))
        : currentKinds.includes("performance_video");
      if (ready) {
        const result = await supabase.rpc("submit_gjm_submission", { p_submission_id: submissionId, p_language: code === "digital_bhashan" ? language : null });
        if (result.error) throw new Error(result.error.message);
        setMessage("Your submission was uploaded and sent for judging.");
      } else setMessage("File uploaded securely. Add the remaining required files to submit.");
      await load();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Upload failed. Please retry."); }
    finally { setBusy(false); setUploadProgress(null); }
  };

  const finalizeSubmission = async (entry: Entry, code: string) => {
    if (!supabase || !entry.submission_id) return;
    setBusy(true); setError(""); setMessage("");
    const { error: submitError } = await supabase.rpc("submit_gjm_submission", { p_submission_id: entry.submission_id, p_language: code === "digital_bhashan" ? language : null });
    if (submitError) setError(submitError.message);
    else setMessage("Your submission was sent for judging.");
    await load();
    setBusy(false);
  };

  if (busy && !candidate) return <div className="rounded-xl bg-cream p-6 text-sm text-brown-mid">Loading your competition registration…</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown">Mahotsav competitions</h1>
        <p className="mt-1 text-sm text-brown-mid">Registration ID: <strong>{candidate?.registration_number ?? "—"}</strong> · {candidate?.age_category ?? "Age category pending"}</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {uploadProgress !== null && <div aria-live="polite" className="rounded-xl border border-cream-dark bg-cream p-4"><div className="mb-2 flex justify-between text-xs text-brown-mid"><span>{message}</span><strong>{uploadProgress}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-cream-dark"><div className="h-full rounded-full bg-maroon transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} /></div></div>}

      {candidate && entries.length === 0 && <section className="rounded-2xl border border-gold/30 bg-cream p-5 sm:p-6">
        <h2 className="font-semibold text-brown">Select up to two categories</h2>
        <p className="mt-1 text-xs text-brown-mid">Existing participants can add their choices here without creating another registration. Choices are locked after saving.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{categories.map((item) => <label key={item.code} className="flex items-center gap-3 rounded-lg bg-cream-dark/60 p-3 text-sm text-brown-mid"><input type="checkbox" checked={selectedCodes.includes(item.code)} disabled={!selectedCodes.includes(item.code) && selectedCodes.length >= 2} onChange={(event) => setSelectedCodes((current) => event.target.checked ? [...current, item.code] : current.filter((code) => code !== item.code))} className="accent-maroon" />{item.title}</label>)}</div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="text-xs font-medium text-brown-mid">Date of birth<input type="date" max="2026-12-20" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="mt-1 block rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm" /></label>{eventAge !== null && eventAge < 18 && <label className="flex items-start gap-2 text-xs text-brown-mid"><input type="checkbox" checked={parentalConsent} onChange={(event) => setParentalConsent(event.target.checked)} className="mt-0.5 accent-maroon" />Parent / guardian consent confirmed</label>}<button disabled={busy || selectedCodes.length === 0 || selectedCodes.length > 2} onClick={saveSelections} className="rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-cream hover:bg-maroon-dark disabled:opacity-50">Save categories</button></div>
        {eventAge === 18 || eventAge === 30 ? <p className="mt-3 text-xs text-amber-800">Age {eventAge} is an unresolved rulebook boundary and needs organizer confirmation before category assignment.</p> : null}
      </section>}

      {entries.length > 0 && categories.filter((item) => entries.some((entry) => entry.competition_code === item.code)).map((item) => {
        const entry = entries.find((candidateEntry) => candidateEntry.competition_code === item.code)!;
        const uploadedKinds = new Set((files[item.code] ?? []).map((file) => file.kind));
        const isFinal = entry.status === "Submitted" || entry.status === "Evaluated";
        return <section key={item.code} className="overflow-hidden rounded-2xl border border-cream-dark bg-cream">
          <div className="border-b border-cream-dark bg-cream-dark/60 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-gold">{candidate?.age_category ?? "Participant"}</p><h2 style={{ fontFamily: "var(--font-display)" }} className="mt-1 text-lg font-bold text-brown">{item.title}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${isFinal ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{entry.status}</span></div><p className="mt-3 text-sm leading-relaxed text-brown-mid">{item.description}</p></div>
          {item.code === "geeta_quiz" ? <div className="p-5">
            {!quiz && <div className="space-y-4 rounded-xl border border-gold/30 bg-cream-dark/40 p-4"><div><h3 className="font-semibold text-brown">Before you start</h3><p className="mt-1 text-sm leading-relaxed text-brown-mid">You will have 25 minutes for 50 questions. Your server-set deadline cannot be extended by refreshing or reconnecting. Only one attempt is allowed; answers and scores are finalized by the server.</p></div><ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-brown-mid"><li>{quizPolicy.submit_on_tab_switch ? "Hiding or switching away from this quiz tab automatically submits your attempt." : "Hiding this tab is logged for review; it will not automatically submit."}</li><li>{quizPolicy.submit_on_window_blur ? "Losing browser focus automatically submits your attempt." : "Browser focus changes are logged and do not automatically submit."}</li><li>{quizPolicy.submit_on_fullscreen_exit ? "Exiting fullscreen automatically submits your attempt." : "Fullscreen exit is logged and does not automatically submit."}</li><li>The browser cannot close other tabs or reliably detect screenshots. Focus changes may be caused by system prompts or interruptions.</li></ul><label className="flex items-start gap-2 text-sm text-brown-mid"><input type="checkbox" checked={readyToStart} onChange={(event) => setReadyToStart(event.target.checked)} className="mt-0.5 accent-maroon" /><span>I have read the exam rules and am ready to begin.</span></label><button disabled={busy || !readyToStart || candidate?.status !== "Approved"} onClick={() => void startQuiz()} className="rounded-lg bg-maroon px-5 py-3 text-sm font-semibold text-cream hover:bg-maroon-dark disabled:opacity-50">{candidate?.status !== "Approved" ? "Available after registration approval" : "Start Exam"}</button></div>}
            {quiz && !quiz.submitted && <div className="space-y-5"><div className={`sticky top-0 z-10 flex items-center justify-between rounded-lg px-4 py-3 text-cream ${remaining < 5 * 60 * 1000 ? "bg-red-800" : "bg-maroon"}`}><span className="text-sm font-semibold">Time Remaining</span><span role="timer" aria-label={`Time remaining ${formatRemaining(remaining)}`} className="font-mono text-lg font-bold">{formatRemaining(remaining)}</span></div>{quizPending && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Submission is queued securely on this device and will retry when the network returns. Your answers are locked.</p>}<p className="text-xs text-brown-mid">Exam events are handled according to the rules shown before you started. The website cannot close other tabs or reliably detect screenshots.</p>{quiz.questions.map((question, index) => <fieldset key={question.id} disabled={quizPending} className="rounded-xl border border-cream-dark p-4"><legend className="px-1 text-sm font-semibold text-brown">{index + 1}. {question.text}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => { const letter = String.fromCharCode(65 + optionIndex); return <label key={letter} className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${answers[question.id] === letter ? "border-maroon bg-maroon/5 text-brown" : "border-cream-dark text-brown-mid"}`}><input type="radio" name={question.id} checked={answers[question.id] === letter} onChange={() => setAnswers((current) => ({ ...current, [question.id]: letter }))} className="accent-maroon" /><span>{option}</span></label>; })}</div></fieldset>)}<button disabled={busy || quizPending} onClick={() => void submitQuiz(quiz.attempt_id, "MANUAL_SUBMIT")} className="rounded-lg bg-maroon px-5 py-3 text-sm font-semibold text-cream hover:bg-maroon-dark disabled:opacity-50">Submit Exam</button></div>}
            {quiz?.submitted && <div className="rounded-xl bg-green-50 p-4 text-sm text-green-900"><p>Quiz result · <strong>{quiz.raw_score}/25</strong> raw · <strong>{quiz.normalized_score}/100</strong> percentage</p>{quiz.submission_reason && quiz.submission_reason !== "MANUAL_SUBMIT" && <p className="mt-1">Automatically submitted: {quiz.submission_reason.replace(/_/g, " ")}.</p>}</div>}
          </div> : <div className="space-y-4 p-5">
            {entry.result_published && entry.total_marks !== undefined && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900">Published result: <strong>{entry.total_marks}/100</strong>{entry.feedback && <p className="mt-1 text-xs">{entry.feedback}</p>}</div>}
            {item.code === "digital_bhashan" && <label className="block max-w-xs text-xs font-semibold text-brown-mid">Speech language<select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isFinal} className="mt-1 block w-full rounded-lg border border-cream-dark bg-white px-3 py-2.5 text-sm"><option>Hindi</option><option>Sanskrit</option><option>English</option></select><span className="mt-1 block font-normal">Required duration: {ageLimit(candidate?.age_category ?? null).label}.</span></label>}
            {(item.code === "geeta_art" ? artFiles : [{ kind: "performance_video" as const, label: item.code === "shloka_uccharan" ? "Recitation video · maximum 3 minutes" : "Speech video", accept: item.accept, max: item.max }]).map((requirement) => <div key={requirement.kind} className="flex flex-col justify-between gap-3 rounded-xl border border-cream-dark p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-brown">{requirement.label}</p><p className="mt-1 text-xs text-brown-mid">{uploadedKinds.has(requirement.kind) ? "Uploaded securely" : "Not uploaded yet"}</p></div><label className={`cursor-pointer rounded-lg border px-4 py-2 text-center text-xs font-semibold ${uploadedKinds.has(requirement.kind) || isFinal ? "pointer-events-none border-cream-dark text-brown-light" : "border-maroon text-maroon hover:bg-maroon/5"}`}>{uploadedKinds.has(requirement.kind) ? "Uploaded" : "Choose file"}<input type="file" accept={requirement.accept} disabled={uploadedKinds.has(requirement.kind) || isFinal || busy || candidate?.status !== "Approved"} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(item.code, requirement.kind, file, requirement.max); event.target.value = ""; }} className="sr-only" /></label></div>)}
            {entry.status === "Draft" && item.code !== "geeta_art" && uploadedKinds.has("performance_video") && <button disabled={busy || candidate?.status !== "Approved"} onClick={() => void finalizeSubmission(entry, item.code)} className="rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-cream disabled:opacity-50">Submit video for judging</button>}
            {entry.status === "Draft" && item.code === "geeta_art" && artFiles.every((required) => uploadedKinds.has(required.kind)) && <button disabled={busy || candidate?.status !== "Approved"} onClick={() => void finalizeSubmission(entry, item.code)} className="rounded-lg bg-maroon px-4 py-2.5 text-sm font-semibold text-cream disabled:opacity-50">Submit artwork for judging</button>}
            {candidate?.status !== "Approved" && <p className="text-xs text-amber-800">Uploads unlock after your participant registration is approved.</p>}
          </div>}
        </section>;
      })}
      {!busy && candidate && entries.length === 0 && <p className="text-xs text-brown-light">Your category selection is locked after saving. To correct an error, contact the event organizer.</p>}
    </div>
  );
}
