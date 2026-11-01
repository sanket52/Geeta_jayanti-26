import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";

const EXAM_SECONDS = 120 * 60;
type Phase = "instructions" | "exam" | "submitted";
type ExamQuestion = { id: string; section: string; text: string; options: string[]; marks: number; selected?: string | null };
type Result = { score: number; total_marks: number; answered: number };
type AnswerMap = Record<string, string>;

const optionLabels = ["A", "B", "C", "D"];
const formatTime = (seconds: number) => `${Math.floor(seconds / 3600)}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function ExamPortal() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("instructions");
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [current, setCurrent] = useState(0);
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(EXAM_SECONDS);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState("Answers save automatically");
  const [showConfirm, setShowConfirm] = useState(false);
  const submitLock = useRef(false);

  const submitExam = useCallback(async () => {
    if (!supabase || !attemptId || submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setError("");
    const { data, error: submitError } = await supabase.rpc("submit_candidate_exam", {
      p_attempt_id: attemptId,
      p_answers: answers,
    });
    if (submitError) {
      submitLock.current = false;
      setBusy(false);
      setError(submitError.message);
      return;
    }
    setResult(data as Result);
    setPhase("submitted");
    setShowConfirm(false);
    setBusy(false);
  }, [answers, attemptId]);

  const startExam = async () => {
    setError("");
    if (!supabase) {
      setError("The exam is not connected to Supabase. Please contact the event organizers.");
      return;
    }
    setBusy(true);
    const { data: attempt, error: startError } = await supabase.rpc("start_candidate_exam");
    if (startError) {
      setError(startError.message);
      setBusy(false);
      return;
    }
    const { data: questionData, error: questionError } = await supabase.rpc("get_candidate_exam_questions", {
      p_attempt_id: attempt.attempt_id,
    });
    if (questionError) {
      setError(questionError.message);
      setBusy(false);
      return;
    }
    const loaded = (questionData ?? []) as ExamQuestion[];
    if (!loaded.length) {
      setError("The exam question set is empty. Please contact the event organizers.");
      setBusy(false);
      return;
    }
    const saved: AnswerMap = Object.fromEntries(loaded.filter((q) => q.selected).map((q) => [q.id, q.selected as string]));
    const serverNow = Date.parse(attempt.server_now);
    const expiresAt = Date.parse(attempt.expires_at);
    const remaining = Math.max(0, Math.ceil((expiresAt - serverNow) / 1000));
    setAttemptId(attempt.attempt_id);
    setQuestions(loaded);
    setAnswers(saved);
    setCurrent(0);
    setTimeLeft(remaining);
    setPhase("exam");
    setBusy(false);
  };

  useEffect(() => {
    const client = supabase;
    if (phase !== "exam" || !attemptId || !client) return;
    const timeout = window.setTimeout(async () => {
      setSaveMessage("Saving answers…");
      const { error: saveError } = await client.rpc("save_candidate_exam_answers", {
        p_attempt_id: attemptId,
        p_answers: answers,
      });
      setSaveMessage(saveError ? "Could not save. Check your connection." : "All answers saved");
      if (saveError) setError(saveError.message);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [answers, attemptId, phase]);

  useEffect(() => {
    if (phase !== "exam") return;
    const timer = window.setInterval(() => {
      setTimeLeft((remaining) => {
        const next = Math.max(0, remaining - 1);
        if (next === 0) void submitExam();
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, submitExam]);

  const q = questions[current];
  const answered = Object.keys(answers).length;
  const totalMarks = questions.reduce((sum, item) => sum + Number(item.marks), 0);

  if (phase === "instructions") {
    return (
      <div className="flex h-full items-center justify-center overflow-y-auto bg-[#0f1117] px-4 py-8 sm:px-6">
        <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#1a1e28]">
          <header className="bg-maroon px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Geeta Jayanti Mahotsav · 20 December 2026</p>
            <h1 className="mt-1 text-xl font-bold text-white">Online Examination</h1>
            <p className="mt-1 text-sm text-white/70">Your registration must be approved before you can start.</p>
          </header>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[["Duration", "2 hours"], ["Questions", "Set by organizers"], ["Total marks", "Set by questions"]].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/5 p-3 text-center">
                  <p className="text-sm font-bold text-white">{value}</p><p className="mt-1 text-xs text-white/40">{label}</p>
                </div>
              ))}
            </div>
            <ul className="my-6 space-y-2 text-sm text-white/65">
              <li>• Your exam attempt is created and timed by the database.</li>
              <li>• Only one attempt is allowed for each approved registration.</li>
              <li>• Answers are saved securely while you work.</li>
              <li>• The correct answers are not sent to your browser.</li>
              <li>• If you leave and return, your active attempt and saved answers are restored.</li>
            </ul>
            {error && <p role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={startExam} disabled={busy} className="flex-1 rounded-xl bg-maroon py-3.5 text-sm font-bold text-white hover:bg-maroon-dark disabled:opacity-50">
                {busy ? "Checking approval…" : "Start / Continue Examination"}
              </button>
              <button onClick={() => navigate("/student/exam")} className="rounded-xl border border-white/20 px-5 py-3.5 text-sm text-white/70 hover:bg-white/5">Go back</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (phase === "submitted") {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f1117] px-4">
        <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1e28] p-8 text-center">
          <div className="mb-4 text-5xl text-green-400">✓</div>
          <h2 className="mb-2 text-2xl font-bold text-white">Examination submitted</h2>
          <p className="mb-6 text-sm text-white/50">Your answers and score were recorded by the exam system.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 p-4"><p className="text-2xl font-bold text-gold">{result?.score ?? "—"}/{result?.total_marks ?? totalMarks}</p><p className="text-xs text-white/40">Score</p></div>
            <div className="rounded-xl bg-white/5 p-4"><p className="text-2xl font-bold text-white">{result?.answered ?? answered}</p><p className="text-xs text-white/40">Answered</p></div>
          </div>
          <button onClick={() => navigate("/student")} className="mt-6 w-full rounded-xl bg-maroon py-3.5 text-sm font-bold text-white hover:bg-maroon-dark">Return to student portal</button>
        </section>
      </div>
    );
  }

  if (!q) return <div className="p-8 text-white">Loading exam…</div>;
  const currentAnswer = answers[q.id];
  const isLow = timeLeft < 600;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0f1117] md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#1a1e28] px-4 py-3 sm:px-6">
          <p className="text-xs text-white/60 sm:text-sm"><span className="font-semibold text-white">Q {current + 1}</span> / {questions.length}<span className="ml-2 hidden text-white/40 sm:inline">Section: <span className="text-gold">{q.section}</span></span></p>
          <p className={`rounded-lg px-3 py-1 font-mono text-lg font-bold ${isLow ? "animate-pulse bg-red-900/50 text-red-300" : "bg-white/5 text-white"}`}>{formatTime(timeLeft)}</p>
          <p className="hidden text-xs text-white/40 sm:block">{saveMessage}</p>
        </header>
        <div className="flex-1 overflow-y-auto p-5 sm:p-10">
          <div className="mx-auto max-w-2xl">
            <p className="mb-7 text-lg leading-relaxed text-white">{q.text}</p>
            <div className="mb-8 space-y-3">
              {q.options.map((option, index) => {
                const label = optionLabels[index];
                const selected = currentAnswer === label;
                return <button key={label} onClick={() => setAnswers((value) => ({ ...value, [q.id]: label }))} className={`flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left text-sm transition-colors sm:px-5 ${selected ? "border-maroon bg-maroon/40 text-white" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected ? "bg-maroon text-white" : "bg-white/10 text-white/50"}`}>{label}</span>{option}
                </button>;
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button onClick={() => setCurrent((value) => Math.max(0, value - 1))} disabled={current === 0} className="rounded-lg border border-white/20 px-4 py-2.5 text-sm text-white/70 disabled:opacity-40">Previous</button>
              <button onClick={() => setMarked((value) => ({ ...value, [q.id]: !value[q.id] }))} className="rounded-lg border border-amber-700/30 bg-amber-900/30 px-4 py-2.5 text-sm text-amber-300">{marked[q.id] ? "Unmark review" : "Mark for review"}</button>
              <button onClick={() => { setAnswers((value) => { const next = { ...value }; delete next[q.id]; return next; }); setMarked((value) => ({ ...value, [q.id]: false })); }} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/55">Clear answer</button>
              <button onClick={() => current === questions.length - 1 ? setShowConfirm(true) : setCurrent((value) => value + 1)} className="rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-white hover:bg-maroon-dark">{current === questions.length - 1 ? "Review & Submit" : "Next"}</button>
            </div>
          </div>
        </div>
        {error && <p role="alert" className="shrink-0 border-t border-red-400/20 bg-red-950/40 px-4 py-2 text-xs text-red-200">{error}</p>}
      </div>
      <aside className="max-h-36 shrink-0 border-t border-white/10 bg-[#1a1e28] p-3 md:max-h-none md:w-64 md:border-l md:border-t-0 md:p-4">
        <div className="mb-3 flex justify-between text-xs text-white/50"><span>{answered} answered</span><span>{questions.length - answered} remaining</span></div>
        <div className="grid max-h-24 grid-cols-8 gap-1.5 overflow-y-auto sm:grid-cols-12 md:max-h-none md:grid-cols-5">
          {questions.map((question, index) => <button key={question.id} onClick={() => setCurrent(index)} aria-label={`Question ${index + 1}${answers[question.id] ? ", answered" : ""}`} className={`aspect-square rounded text-xs font-semibold ${current === index ? "ring-2 ring-gold" : ""} ${marked[question.id] ? "bg-amber-600 text-white" : answers[question.id] ? "bg-maroon text-white" : "bg-white/10 text-white/45"}`}>{index + 1}</button>)}
        </div>
        <button onClick={() => setShowConfirm(true)} className="mt-3 w-full rounded-xl bg-maroon py-2.5 text-sm font-bold text-white hover:bg-maroon-dark">Submit exam</button>
      </aside>

      {showConfirm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div role="dialog" aria-modal="true" aria-labelledby="submit-title" className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1e28] p-6 text-center">
          <h2 id="submit-title" className="mb-2 text-lg font-bold text-white">Submit examination?</h2>
          <p className="mb-5 text-sm text-white/55">You have answered {answered} of {questions.length} questions. Submission is final and cannot be repeated.</p>
          <div className="flex gap-3"><button onClick={() => void submitExam()} disabled={busy} className="flex-1 rounded-xl bg-maroon py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit now"}</button><button onClick={() => setShowConfirm(false)} disabled={busy} className="flex-1 rounded-xl border border-white/20 py-3 text-sm text-white/65">Continue exam</button></div>
        </div>
      </div>}
    </div>
  );
}
