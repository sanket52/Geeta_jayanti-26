import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { defaultFaqs, type ChatFaq } from "../../lib/chatbotFaqs";

export default function ChatbotFaqs() {
  const [faqs, setFaqs] = useState<ChatFaq[]>(defaultFaqs);
  const [selected, setSelected] = useState<ChatFaq>(defaultFaqs[0]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!supabase) { if (active) { setNotice("Supabase is not configured."); setLoading(false); } return; }
      const { data: role } = await supabase.rpc("current_user_role");
      if (active && role === "admin") setAllowed(true);
      if (role !== "admin") { if (active) { setNotice("Administrator access is required to edit chatbot FAQs."); setLoading(false); } return; }
      const { data, error } = await supabase.from("gjm_chatbot_faqs").select("*").order("id");
      if (active) {
        if (error) setNotice("Apply supabase/geeta_jayanti_chatbot_faqs.sql to enable persistent FAQ editing.");
        else if (data?.length) { setFaqs(data as ChatFaq[]); setSelected(data[0] as ChatFaq); }
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const visible = faqs.filter((faq) => `${faq.id} ${faq.question_en} ${faq.answer_en}`.toLowerCase().includes(query.toLowerCase()));
  const save = async () => {
    if (!allowed || !supabase) return;
    const { error } = await supabase.from("gjm_chatbot_faqs").update({ category: selected.category, question_en: selected.question_en, answer_en: selected.answer_en, question_hi: selected.question_hi, answer_hi: selected.answer_hi, keywords: selected.keywords, related_questions: selected.related_questions, updated_at: new Date().toISOString().slice(0, 10) }).eq("id", selected.id);
    setNotice(error ? `Could not save: ${error.message}` : "FAQ saved. The public chatbot will use this answer.");
    if (!error) setFaqs((current) => current.map((faq) => faq.id === selected.id ? selected : faq));
  };

  if (loading) return <p className="text-sm text-brown-mid">Loading FAQ knowledge base…</p>;
  if (!allowed) return <p className="rounded-xl border border-cream-dark bg-white p-5 text-sm text-brown-mid">{notice}</p>;
  return <section className="space-y-5"><div><span className="text-xs font-semibold uppercase tracking-widest text-gold">Helpdesk content</span><h1 className="mt-1 text-2xl font-bold text-maroon">Chatbot FAQs</h1><p className="mt-1 text-sm text-brown-mid">Edit bilingual answers used by the event helpdesk.</p></div>
    {notice && <p role="status" className="rounded-lg bg-white px-4 py-3 text-sm text-brown-mid">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(230px,0.7fr)_1.3fr]"><aside className="max-h-[70vh] overflow-auto rounded-xl border border-cream-dark bg-white p-3"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search FAQs" className="mb-3 w-full rounded-lg border border-cream-dark px-3 py-2 text-sm"/>{visible.map((faq) => <button key={faq.id} onClick={() => setSelected(faq)} className={`mb-1 block w-full rounded-lg p-3 text-left text-xs ${selected.id === faq.id ? "bg-cream-dark text-maroon" : "text-brown hover:bg-cream"}`}><span className="font-semibold">FAQ {faq.id}</span><span className="ml-2">{faq.question_en}</span></button>)}</aside>
      <div className="space-y-4 rounded-xl border border-cream-dark bg-white p-5"><label className="block text-sm font-medium text-brown">Category<input value={selected.category} onChange={(e) => setSelected({ ...selected, category: e.target.value })} className="mt-1 w-full rounded-lg border border-cream-dark px-3 py-2"/></label><label className="block text-sm font-medium text-brown">Question · English<input value={selected.question_en} onChange={(e) => setSelected({ ...selected, question_en: e.target.value })} className="mt-1 w-full rounded-lg border border-cream-dark px-3 py-2"/></label><label className="block text-sm font-medium text-brown">Question · Hindi<input value={selected.question_hi} onChange={(e) => setSelected({ ...selected, question_hi: e.target.value })} className="mt-1 w-full rounded-lg border border-cream-dark px-3 py-2"/></label><label className="block text-sm font-medium text-brown">Answer · English<textarea rows={5} value={selected.answer_en} onChange={(e) => setSelected({ ...selected, answer_en: e.target.value })} className="mt-1 w-full rounded-lg border border-cream-dark px-3 py-2"/></label><label className="block text-sm font-medium text-brown">Answer · Hindi<textarea rows={5} value={selected.answer_hi} onChange={(e) => setSelected({ ...selected, answer_hi: e.target.value })} className="mt-1 w-full rounded-lg border border-cream-dark px-3 py-2"/></label><label className="block text-sm font-medium text-brown">Search keywords<input value={selected.keywords.join(", ")} onChange={(e) => setSelected({ ...selected, keywords: e.target.value.split(",").map((word) => word.trim()).filter(Boolean) })} className="mt-1 w-full rounded-lg border border-cream-dark px-3 py-2"/></label><button onClick={() => void save()} className="rounded-lg bg-maroon px-5 py-2.5 text-sm font-semibold text-cream">Save FAQ {selected.id}</button></div>
    </div></section>;
}
