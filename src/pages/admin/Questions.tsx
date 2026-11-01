import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Question = {
  id: string;
  question_text: string;
  subject: string;
  options: string[];
  correct_option: "A" | "B" | "C" | "D";
  marks: number;
  negative_marks: number;
  is_published: boolean;
};

type Draft = Omit<Question, "id">;
const emptyDraft: Draft = { question_text: "", subject: "Bhagavad Gita", options: ["", "", "", ""], correct_option: "A", marks: 1, negative_marks: 0, is_published: false };

export default function AdminQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadQuestions = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    const { data, error: loadError } = await supabase.from("exam_questions").select("*").order("created_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else { setQuestions((data ?? []) as Question[]); setError(""); }
    setLoading(false);
  }, []);

  useEffect(() => { void loadQuestions(); }, [loadQuestions]);

  const filtered = useMemo(() => questions.filter((question) => {
    const matches = !search || question.question_text.toLowerCase().includes(search.toLowerCase());
    return matches && (statusFilter === "All" || (statusFilter === "Published" ? question.is_published : !question.is_published));
  }), [questions, search, statusFilter]);

  const startNew = () => { setEditingId(null); setDraft({ ...emptyDraft, options: [...emptyDraft.options] }); setFormOpen(true); setMessage(""); setError(""); };
  const startEdit = (question: Question) => {
    const { id: _id, ...values } = question;
    setEditingId(question.id);
    setDraft({ ...values, options: [...values.options] });
    setFormOpen(true);
    setMessage("");
    setError("");
  };

  const save = async () => {
    if (!supabase) return;
    if (!draft.question_text.trim() || draft.options.some((option) => !option.trim()) || draft.marks <= 0 || draft.negative_marks < 0) {
      setError("Add the question, all four options, and valid marks.");
      return;
    }
    setSaving(true);
    setError("");
    const query = editingId
      ? supabase.from("exam_questions").update({ ...draft, question_text: draft.question_text.trim(), options: draft.options.map((option) => option.trim()) }).eq("id", editingId)
      : supabase.from("exam_questions").insert({ ...draft, question_text: draft.question_text.trim(), options: draft.options.map((option) => option.trim()) });
    const { error: saveError } = await query;
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setMessage(editingId ? "Question updated." : "Question added.");
    setFormOpen(false);
    await loadQuestions();
  };

  const setPublished = async (question: Question, is_published: boolean) => {
    if (!supabase) return;
    const { error: updateError } = await supabase.from("exam_questions").update({ is_published }).eq("id", question.id);
    if (updateError) setError(updateError.message);
    else await loadQuestions();
  };

  const remove = async (question: Question) => {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("exam_questions").delete().eq("id", question.id);
    if (deleteError) setError(deleteError.message);
    else { setMessage("Question removed. Existing attempts keep their saved question copy."); await loadQuestions(); }
  };

  const totalMarks = questions.filter((question) => question.is_published).reduce((sum, question) => sum + Number(question.marks), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><span className="text-xs font-semibold uppercase tracking-widest text-gold">Exam Management</span><h1 style={{ fontFamily: "var(--font-display)" }} className="mt-1 text-2xl font-bold text-brown">Secure question bank</h1><p className="mt-1 text-sm text-brown-mid">Correct answers stay in the database and are never sent to candidates.</p></div>
        <button onClick={startNew} className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream hover:bg-maroon-dark">Add question</button>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[["Total", questions.length], ["Published", questions.filter((question) => question.is_published).length], ["Published marks", totalMarks]].map(([label, value]) => <div key={label} className="rounded-xl border border-cream-dark bg-cream p-4"><p className="text-xs text-brown-mid">{label}</p><p className="mt-1 text-2xl font-bold text-maroon">{value}</p></div>)}
      </div>

      {formOpen && <section className="space-y-4 rounded-2xl border-2 border-gold/30 bg-cream p-5 sm:p-6">
        <div className="flex items-start justify-between"><div><h2 className="font-semibold text-brown">{editingId ? "Edit question" : "New question"}</h2><p className="text-xs text-brown-mid">A running exam uses its own immutable question copy.</p></div><button onClick={() => setFormOpen(false)} className="text-sm text-brown-mid hover:text-maroon">Close</button></div>
        <label className="block"><span className="mb-1 block text-xs text-brown-mid">Question text</span><textarea rows={3} value={draft.question_text} onChange={(event) => setDraft({ ...draft, question_text: event.target.value })} className="w-full resize-y rounded-lg border border-cream-dark px-3 py-2 text-sm outline-none focus:border-gold" /></label>
        <div className="grid gap-3 sm:grid-cols-2">{draft.options.map((option, index) => <label key={index} className="block"><span className="mb-1 block text-xs text-brown-mid">Option {String.fromCharCode(65 + index)}</span><input value={option} onChange={(event) => setDraft({ ...draft, options: draft.options.map((value, optionIndex) => optionIndex === index ? event.target.value : value) })} className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm outline-none focus:border-gold" /></label>)}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label><span className="mb-1 block text-xs text-brown-mid">Subject</span><input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm" /></label>
          <label><span className="mb-1 block text-xs text-brown-mid">Correct option</span><select value={draft.correct_option} onChange={(event) => setDraft({ ...draft, correct_option: event.target.value as Draft["correct_option"] })} className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm"><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
          <label><span className="mb-1 block text-xs text-brown-mid">Marks</span><input type="number" min="0.01" step="0.01" value={draft.marks} onChange={(event) => setDraft({ ...draft, marks: Number(event.target.value) })} className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm" /></label>
          <label><span className="mb-1 block text-xs text-brown-mid">Negative marks</span><input type="number" min="0" step="0.01" value={draft.negative_marks} onChange={(event) => setDraft({ ...draft, negative_marks: Number(event.target.value) })} className="w-full rounded-lg border border-cream-dark px-3 py-2 text-sm" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm text-brown-mid"><input type="checkbox" checked={draft.is_published} onChange={(event) => setDraft({ ...draft, is_published: event.target.checked })} className="accent-maroon" /> Publish for future exam attempts</label>
        <button onClick={() => void save()} disabled={saving} className="rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-cream disabled:opacity-50">{saving ? "Saving…" : "Save question"}</button>
      </section>}

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      <div className="flex flex-col gap-3 rounded-xl border border-cream-dark bg-cream p-4 sm:flex-row">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search question text" className="min-w-0 flex-1 rounded-lg border border-cream-dark px-4 py-2 text-sm outline-none focus:border-gold" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-cream-dark px-3 py-2 text-sm"><option>All</option><option>Published</option><option>Draft</option></select>
      </div>
      {loading ? <div className="rounded-xl border border-cream-dark bg-cream p-10 text-center text-sm text-brown-mid">Loading secure question bank…</div> : <div className="space-y-3">
        {filtered.map((question) => <article key={question.id} className="rounded-xl border border-cream-dark bg-cream p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2"><span className="rounded bg-cream-dark px-2 py-0.5 text-xs text-brown-mid">{question.subject}</span><span className={`rounded px-2 py-0.5 text-xs font-semibold ${question.is_published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{question.is_published ? "Published" : "Draft"}</span></div>
            <p className="font-medium text-brown">{question.question_text}</p><ol className="mt-2 grid gap-x-5 gap-y-1 text-xs text-brown-mid sm:grid-cols-2">{question.options.map((option, index) => <li key={index}><strong>{String.fromCharCode(65 + index)}.</strong> {option}</li>)}</ol>
            <p className="mt-2 text-xs text-brown-mid">Correct: {question.correct_option} · {question.marks} marks · −{question.negative_marks} for a wrong answer</p>
          </div><div className="flex shrink-0 flex-wrap gap-3 sm:flex-col sm:items-end"><button onClick={() => startEdit(question)} className="text-xs font-semibold text-maroon hover:underline">Edit</button><button onClick={() => void setPublished(question, !question.is_published)} className="text-xs font-semibold text-gold hover:underline">{question.is_published ? "Unpublish" : "Publish"}</button><button onClick={() => void remove(question)} className="text-xs font-semibold text-red-700 hover:underline">Delete</button></div></div>
        </article>)}
        {!filtered.length && <div className="rounded-xl border border-cream-dark bg-cream p-10 text-center text-sm text-brown-mid">{questions.length ? "No questions match these filters." : "No questions yet. Add approved event content before opening the exam."}</div>}
      </div>}
    </div>
  );
}
