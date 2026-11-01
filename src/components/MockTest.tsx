import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const DURATION = 25 * 60;
type MockQuestion = { id: string; topic: string; question_en: string; options: string[] };
type ReviewItem = { id: string; topic: string; question: string; options: string[]; correctIndex: number; selectedIndex: number | null; explanation: string };
type Result = { score: number; total: number; answered: number; incorrect: number; unanswered: number; percentage: number; review: ReviewItem[]; topics: { topic: string; correct: number; total: number }[] };
const timeText = (time: number) => `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;

export default function MockTest() {
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [seconds, setSeconds] = useState(DURATION);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const submitLock = useRef(false);

  const load = useCallback(async () => {
    setError(""); setResult(null); setAnswers({}); setCurrent(0); setSeconds(DURATION); setStarted(false); setAttemptId(null); setQuestions([]); submitLock.current = false;
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startAttempt = async () => {
    if (!supabase) return;
    setLoading(true); setError("");
    const { data, error: startError } = await supabase.rpc("start_gjm_mock_test");
    setLoading(false);
    if (startError || !data) { setError(startError?.message ?? "The practice test could not be started. Sign in and try again."); return; }
    const attempt = data as { attempt_id: string; questions: MockQuestion[]; expires_at: string; server_now: string; answers: Record<string, string> };
    if (!attempt.attempt_id || attempt.questions?.length !== 50) { setError("The practice test did not return a complete question set."); return; }
    setAttemptId(attempt.attempt_id); setQuestions(attempt.questions);
    setAnswers(Object.fromEntries(Object.entries(attempt.answers ?? {}).map(([id, selected]) => [id, Number(selected)])));
    setCurrent(0);
    setSeconds(Math.max(0, Math.ceil((Date.parse(attempt.expires_at) - Date.parse(attempt.server_now)) / 1000)));
    submitLock.current = false; setStarted(true);
  };

  const submit = useCallback(async () => {
    if (!supabase || !started || !attemptId || submitLock.current || questions.length !== 50) return;
    submitLock.current = true; setSubmitting(true); setError("");
    const { data, error: submitError } = await supabase.rpc("submit_gjm_mock_attempt", {
      p_attempt_id: attemptId,
      p_answers: Object.fromEntries(Object.entries(answers).map(([id, selected]) => [id, String(selected)])),
    });
    setSubmitting(false);
    if (submitError || !data) { submitLock.current = false; setError(submitError?.message ?? "We could not score this practice test. Your official exam attempt has not been affected. Please try again."); return; }
    setStarted(false);
    setResult(data as Result);
  }, [answers, attemptId, questions, started]);

  useEffect(() => {
    if (!started || !attemptId || !supabase || result) return;
    const timeout = window.setTimeout(() => {
      void supabase!.rpc("save_gjm_mock_answers", {
        p_attempt_id: attemptId,
        p_answers: Object.fromEntries(Object.entries(answers).map(([id, selected]) => [id, String(selected)])),
      }).then(({ error: saveError }) => {
        if (saveError) setError(`Your latest practice answer could not be saved: ${saveError.message}`);
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [answers, attemptId, result, started]);

  useEffect(() => {
    if (!started || result || submitting) return;
    const timer = window.setInterval(() => setSeconds((left) => {
      if (left <= 1) { window.clearInterval(timer); void submit(); return 0; }
      return left - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [started, result, submitting, submit]);

  const question = questions[current];
  return <section id="mock-test" className="scroll-mt-24 rounded-3xl border border-gold/25 bg-white p-5 shadow-lg sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><span className="rounded-full bg-saffron/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-saffron">Practice test — not official examination</span><h2 className="mt-4 text-2xl font-bold text-maroon sm:text-3xl">Try a 50-question mock test</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-brown-mid">Practise with a separate sample question bank. Your score is for learning only and will never use or change your official examination attempt.</p></div>
      {started && <div className={`rounded-xl px-4 py-2 text-center font-mono text-lg font-bold ${seconds < 120 ? "bg-red-50 text-red-700" : "bg-cream-dark text-maroon"}`} aria-live="off"><span className="block text-[10px] font-sans font-semibold uppercase tracking-wider">Time left</span>{timeText(seconds)}</div>}
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading && <p className="py-12 text-center text-sm text-brown-mid">Loading practice questions…</p>}
    {!loading && !started && !result && <div className="mt-6 rounded-2xl bg-cream p-5 sm:p-7"><ul className="grid gap-2 text-sm text-brown-mid sm:grid-cols-2"><li>• 50 multiple-choice questions</li><li>• Four answer options each</li><li>• 25-minute practice timer</li><li>• Review answers and topic scores</li></ul><button onClick={() => void startAttempt()} className="mt-6 rounded-xl bg-maroon px-6 py-3 text-sm font-bold text-cream hover:bg-maroon-dark">Start Practice Mock Test</button></div>}
    {started && question && <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="rounded-2xl bg-cream p-5 sm:p-7"><div className="flex flex-wrap justify-between gap-2 text-xs text-brown-mid"><span>Question {current + 1} of 50</span><span>{question.topic}</span></div><h3 className="mt-4 text-lg font-semibold leading-relaxed text-brown">{question.question_en}</h3><div className="mt-5 space-y-2">{question.options.map((option, index) => <button key={`${question.id}-${index}`} onClick={() => setAnswers((previous) => ({ ...previous, [question.id]: index }))} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${answers[question.id] === index ? "border-maroon bg-maroon text-cream" : "border-cream-dark bg-white text-brown hover:border-gold"}`}><span className="font-bold">{String.fromCharCode(65 + index)}.</span><span>{option}</span></button>)}</div><div className="mt-6 flex flex-wrap justify-between gap-3"><button disabled={current === 0} onClick={() => setCurrent((value) => value - 1)} className="rounded-lg border border-cream-dark px-4 py-2 text-sm font-semibold text-brown disabled:opacity-40">Previous</button><button onClick={() => setCurrent((value) => Math.min(49, value + 1))} disabled={current === 49} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown disabled:opacity-40">Next</button><button onClick={() => { if (window.confirm("Submit your practice test now? You can review all answers before confirming.")) void submit(); }} disabled={submitting} className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50">{submitting ? "Submitting…" : "Submit practice test"}</button></div></div>
      <aside className="rounded-2xl border border-cream-dark bg-white p-4"><h3 className="text-sm font-bold text-brown">Question overview</h3><p className="mt-1 text-xs text-brown-mid">Answered {Object.keys(answers).length} / 50</p><div className="mt-4 grid grid-cols-5 gap-2">{questions.map((item, index) => <button key={item.id} onClick={() => setCurrent(index)} aria-label={`Go to question ${index + 1}${answers[item.id] !== undefined ? ", answered" : ", unanswered"}`} aria-current={index === current ? "step" : undefined} className={`h-9 rounded-lg text-xs font-bold ${index === current ? "bg-maroon text-cream" : answers[item.id] !== undefined ? "bg-green-100 text-green-800" : "bg-cream-dark text-brown-mid"}`}>{index + 1}</button>)}</div><p className="mt-4 text-[11px] text-brown-mid">Green = answered · cream = unanswered</p></aside>
    </div>}
    {result && <div className="mt-6 space-y-6"><div className="rounded-2xl bg-maroon p-6 text-center text-cream"><p className="text-xs font-semibold uppercase tracking-widest text-gold">Practice score</p><p className="mt-2 text-5xl font-bold">{result.score}<span className="text-2xl text-cream/60"> / {result.total}</span></p><p className="mt-2 text-sm text-cream/70">This is practice feedback, separate from official event results.</p></div><div><h3 className="text-lg font-bold text-brown">Topic-wise performance</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{result.topics.map((topic) => <div key={topic.topic} className="rounded-xl border border-cream-dark bg-cream p-4"><p className="font-semibold text-brown">{topic.topic}</p><p className="mt-1 text-sm text-brown-mid">{topic.correct} correct of {topic.total}</p></div>)}</div></div><div><h3 className="text-lg font-bold text-brown">Answer review</h3><div className="mt-3 space-y-3">{result.review.map((item, index) => <article key={item.id} className="rounded-xl border border-cream-dark bg-white p-4"><p className="text-xs font-semibold text-gold">{index + 1}. {item.topic}</p><h4 className="mt-1 font-semibold text-brown">{item.question}</h4><p className="mt-2 text-sm text-brown-mid">Your answer: {item.selectedIndex === null ? "Not answered" : item.options[item.selectedIndex]}</p><p className="text-sm font-medium text-green-800">Correct answer: {item.options[item.correctIndex]}</p><p className="mt-2 text-sm leading-relaxed text-brown-mid">{item.explanation}</p></article>)}</div></div><button onClick={() => void load()} disabled={loading} className="rounded-xl bg-maroon px-6 py-3 text-sm font-bold text-cream hover:bg-maroon-dark disabled:opacity-50">Retake Mock Test</button></div>}
  </section>;
}
