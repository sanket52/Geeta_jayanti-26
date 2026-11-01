import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const topics = ["Gita Chapters", "Kurukshetra and Characters", "Krishna–Arjuna Dialogue", "Philosophical Concepts", "Gita Teachings"] as const;
type Topic = (typeof topics)[number];
type Question = { id: string; topic: Topic; question_en: string; options: string[]; correct_index: number; explanation_en: string; published: boolean };
type Draft = Omit<Question, "id">;
type MockAttempt = { id: string; started_at: string; expires_at: string; submitted_at: string | null; correct_count: number | null; incorrect_count: number | null; unanswered_count: number | null; candidate_registrations: { registration_number: string; full_name: string; email: string } | null };
const blank: Draft = { topic: topics[0], question_en: "", options: ["", "", "", ""], correct_index: 0, explanation_en: "", published: false };

export default function AdminMockQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draft, setDraft] = useState<Draft>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempts, setAttempts] = useState<MockAttempt[]>([]);

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); return; }
    const [{ data, error: requestError }, { data: attemptData, error: attemptError }] = await Promise.all([
      supabase.from("gjm_mock_questions").select("*").order("created_at", { ascending: false }),
      supabase.from("gjm_mock_test_attempts").select("id,started_at,expires_at,submitted_at,correct_count,incorrect_count,unanswered_count,candidate_registrations(registration_number,full_name,email)").order("started_at", { ascending: false }).limit(200),
    ]);
    if (requestError) setError("Could not load the practice question bank. Apply supabase/geeta_jayanti_mock_test.sql and try again.");
    else { setQuestions((data ?? []) as Question[]); setError(""); }
    if (attemptError) setError((current) => current || `Practice attempts could not be loaded: ${attemptError.message}`);
    else setAttempts((attemptData ?? []) as unknown as MockAttempt[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const edit = (question?: Question) => {
    setEditing(question?.id ?? null);
    setDraft(question ? { topic: question.topic, question_en: question.question_en, options: [...question.options], correct_index: question.correct_index, explanation_en: question.explanation_en, published: question.published } : { ...blank, options: [...blank.options] });
    setShowForm(true); setError(""); setNotice("");
  };
  const save = async () => {
    if (!supabase) return;
    if (!draft.question_en.trim() || draft.options.length !== 4 || draft.options.some((option) => !option.trim()) || !draft.explanation_en.trim()) { setError("Provide a question, four answer options, and an explanation."); return; }
    setBusy(true); setError("");
    const values = { ...draft, question_en: draft.question_en.trim(), options: draft.options.map((option) => option.trim()), explanation_en: draft.explanation_en.trim() };
    const { error: saveError } = editing ? await supabase.from("gjm_mock_questions").update(values).eq("id", editing) : await supabase.from("gjm_mock_questions").insert(values);
    setBusy(false);
    if (saveError) { setError(saveError.message); return; }
    setShowForm(false); setNotice(editing ? "Practice question updated." : "Practice question added."); await load();
  };
  const remove = async (question: Question) => {
    if (!supabase || !window.confirm("Delete this practice question? It does not affect official exam questions or attempts.")) return;
    const { error: deleteError } = await supabase.from("gjm_mock_questions").delete().eq("id", question.id);
    if (deleteError) setError(deleteError.message); else { setNotice("Practice question deleted."); await load(); }
  };
  const importQuestions = async () => {
    if (!supabase) return;
    let parsed: unknown;
    try { parsed = JSON.parse(importText); } catch { setError("Import must be valid JSON containing an array of questions."); return; }
    if (!Array.isArray(parsed) || !parsed.length) { setError("Import must be a non-empty JSON array."); return; }
    const rows = parsed.map((item) => item as Partial<Draft>);
    if (rows.some((item) => !topics.includes(item.topic as Topic) || typeof item.question_en !== "string" || !item.question_en.trim() || !Array.isArray(item.options) || item.options.length !== 4 || item.options.some((option) => typeof option !== "string" || !option.trim()) || !Number.isInteger(item.correct_index) || Number(item.correct_index) < 0 || Number(item.correct_index) > 3 || typeof item.explanation_en !== "string" || !item.explanation_en.trim())) {
      setError("Each item needs a valid topic, question_en, four options, correct_index (0–3), and explanation_en."); return;
    }
    setBusy(true); setError("");
    const { error: importError } = await supabase.from("gjm_mock_questions").upsert(rows.map((item) => ({ ...item, question_en: item.question_en!.trim(), published: Boolean(item.published) })), { onConflict: "topic,question_en", ignoreDuplicates: true });
    setBusy(false);
    if (importError) { setError(importError.message); return; }
    setShowImport(false); setImportText(""); setNotice(`${rows.length} practice question(s) imported. Existing matches were left unchanged.`); await load();
  };

  return <div className="space-y-5">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><span className="text-xs font-semibold uppercase tracking-widest text-gold">Practice only · separate from the official exam</span><h1 className="mt-1 text-2xl font-bold text-brown">Mock question bank</h1><p className="mt-1 text-sm text-brown-mid">Manage sample questions served to the separate 25-minute mock test.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => { setShowImport((value) => !value); setShowForm(false); }} className="rounded-lg border border-maroon px-4 py-2 text-sm font-semibold text-maroon">Import JSON</button><button onClick={() => { setShowImport(false); edit(); }} className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream">Add mock question</button></div></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {showImport && <section className="space-y-3 rounded-2xl border border-gold/30 bg-cream p-5"><h2 className="font-bold text-brown">Import question JSON</h2><p className="text-xs text-brown-mid">Use an array of objects with topic, question_en, options (four strings), correct_index (0–3), explanation_en, and optional published.</p><textarea rows={8} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={'[{"topic":"Gita Chapters","question_en":"…","options":["…","…","…","…"],"correct_index":0,"explanation_en":"…","published":false}]'} className="w-full rounded-lg border border-cream-dark p-3 font-mono text-xs"/><button onClick={() => void importQuestions()} disabled={busy} className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50">{busy ? "Importing…" : "Import questions"}</button></section>}
    {showForm && <section className="space-y-4 rounded-2xl border-2 border-gold/30 bg-cream p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-brown">{editing ? "Edit mock question" : "New mock question"}</h2><button onClick={() => setShowForm(false)} className="text-sm text-brown-mid">Close</button></div><label className="block text-xs font-semibold text-brown-mid">Topic<select value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value as Topic })} className="mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm">{topics.map((topic) => <option key={topic}>{topic}</option>)}</select></label><label className="block text-xs font-semibold text-brown-mid">Question<textarea rows={2} value={draft.question_en} onChange={(event) => setDraft({ ...draft, question_en: event.target.value })} className="mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm"/></label><div className="grid gap-3 sm:grid-cols-2">{draft.options.map((option, index) => <label key={index} className="text-xs font-semibold text-brown-mid">Option {String.fromCharCode(65 + index)}<input value={option} onChange={(event) => setDraft({ ...draft, options: draft.options.map((value, i) => i === index ? event.target.value : value) })} className="mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm"/></label>)}</div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-brown-mid">Correct option<select value={draft.correct_index} onChange={(event) => setDraft({ ...draft, correct_index: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm">{draft.options.map((_, index) => <option value={index} key={index}>{String.fromCharCode(65 + index)}</option>)}</select></label><label className="flex items-center gap-2 pt-5 text-sm text-brown-mid"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })}/> Published in practice bank</label></div><label className="block text-xs font-semibold text-brown-mid">Answer explanation<textarea rows={3} value={draft.explanation_en} onChange={(event) => setDraft({ ...draft, explanation_en: event.target.value })} className="mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm"/></label><button onClick={() => void save()} disabled={busy} className="rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-50">{busy ? "Saving…" : "Save mock question"}</button></section>}
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-cream-dark bg-cream p-4"><span className="text-xs text-brown-mid">Total questions</span><p className="text-2xl font-bold text-maroon">{questions.length}</p></div><div className="rounded-xl border border-cream-dark bg-cream p-4"><span className="text-xs text-brown-mid">Published for practice</span><p className="text-2xl font-bold text-maroon">{questions.filter((question) => question.published).length}</p></div><div className="rounded-xl border border-cream-dark bg-cream p-4"><span className="text-xs text-brown-mid">Official exam attempts</span><p className="text-sm font-semibold text-green-800">Not connected to this bank</p></div></div>
    <section className="overflow-hidden rounded-2xl border border-cream-dark bg-white"><div className="border-b border-cream-dark px-5 py-4"><h2 className="font-bold text-brown">Student mock attempts</h2><p className="mt-1 text-xs text-brown-mid">Server-evaluated practice history. This data is separate from official results.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-cream text-xs uppercase text-brown-mid"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Started</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Answers</th></tr></thead><tbody>{attempts.map((attempt) => <tr key={attempt.id} className="border-t border-cream-dark"><td className="px-4 py-3">{attempt.candidate_registrations?.full_name ?? "Registered student"}</td><td className="px-4 py-3">{attempt.candidate_registrations?.registration_number ?? "—"}</td><td className="px-4 py-3">{attempt.candidate_registrations?.email ?? "—"}</td><td className="px-4 py-3 whitespace-nowrap">{new Date(attempt.started_at).toLocaleString()}</td><td className="px-4 py-3 whitespace-nowrap">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "In progress"}</td><td className="px-4 py-3">{attempt.correct_count === null ? "Pending" : `${attempt.correct_count}/50`}</td><td className="px-4 py-3">{attempt.submitted_at ? `${attempt.incorrect_count} incorrect · ${attempt.unanswered_count} blank` : "—"}</td></tr>)}</tbody></table>{attempts.length === 0 && <p className="px-5 py-6 text-sm text-brown-mid">No mock attempts have been recorded.</p>}</div></section>
    <div className="space-y-3">{questions.map((question) => <article key={question.id} className="rounded-xl border border-cream-dark bg-white p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap gap-2"><span className="rounded bg-cream-dark px-2 py-1 text-xs">{question.topic}</span><span className={`rounded px-2 py-1 text-xs ${question.published ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{question.published ? "Published" : "Draft"}</span></div><h3 className="mt-2 font-semibold text-brown">{question.question_en}</h3><ol className="mt-2 grid gap-1 text-sm text-brown-mid sm:grid-cols-2">{question.options.map((option, index) => <li key={index}>{String.fromCharCode(65 + index)}. {option}</li>)}</ol><p className="mt-2 text-xs text-brown-mid">Correct: {String.fromCharCode(65 + question.correct_index)} · {question.explanation_en}</p></div><div className="flex gap-3 sm:flex-col sm:items-end"><button onClick={() => edit(question)} className="text-xs font-semibold text-maroon">Edit</button><button onClick={() => void remove(question)} className="text-xs font-semibold text-red-700">Delete</button></div></div></article>)}{questions.length === 0 && <p className="rounded-xl border border-cream-dark bg-cream p-8 text-center text-sm text-brown-mid">No practice questions found yet. Apply the separate mock-test SQL setup to seed the sample bank.</p>}</div>
  </div>;
}
