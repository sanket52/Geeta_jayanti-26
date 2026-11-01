import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { defaultFaqs, findBestFaq, loadChatFaqs, logUnansweredQuestion, type ChatFaq } from "../lib/chatbotFaqs";
import EventContactLinks from "./EventContactLinks";
import SupportRequestForm from "./SupportRequestForm";
import { defaultEventContact, loadEventContact, type EventContact } from "../lib/eventContact";

type Message = { role: "assistant" | "user"; text: string; support?: boolean; contactCard?: boolean; contactLanguage?: "en" | "hi" };
type Language = "auto" | "en" | "hi";
const welcome = "🙏 Namaste! Welcome to the Geeta Jayanti Mahotsav 2026 Helpdesk. I can help with event information, registration guidance, competitions, submissions and support. You can chat in English, Hindi, or Hinglish.";
const historyKey = "gjm-chat-history-v1";
const contactIntent = /contact|phone|telephone|support|help|contact number|address|email address|email id|human support|organizer|gurukul|assistance|सहायता|मदद|संपर्क|फोन|मोबाइल|पता|ईमेल|आयोजक|मानव सहायता/i;
const supportRequestIntent = /i need help|contact support|i have a problem|problem with|send an email|talk to a human|human support|registration problem|मुझे सहायता चाहिए|मुझे संपर्क करना है|मेरी समस्या है/i;

function preferredLanguage(question: string, setting: Language) {
  if (setting !== "auto") return setting;
  return /[\u0900-\u097f]/.test(question) || /\b(kya|kaise|kab|kahan|mera|meri|hai|hoga|chahiye|batao|karu|hume|kaun)\b/i.test(question) ? "hi" : "en";
}

function answerQuestion(question: string, language: "en" | "hi", faqs: ChatFaq[]) {
  const q = question.toLowerCase();
  if (/password|\botp\b|card number|payment details|पासवर्ड|ओटीपी/.test(q)) return language === "hi"
    ? "आपकी सुरक्षा के लिए कृपया पासवर्ड, OTP या भुगतान कार्ड की जानकारी यहाँ साझा न करें। संवेदनशील जानकारी बताए बिना समस्या का वर्णन करें।"
    : "For your safety, please do not share passwords, OTPs, or payment card details here. Describe the issue without including sensitive information.";
  const { faq, score } = findBestFaq(question, faqs);
  if (faq && score >= 0.34) return language === "hi" ? faq.answer_hi : faq.answer_en;
  const eventRelated = /geeta|gita|mahotsav|jayanti|event|competition|registration|shlok|quiz|drawing|bhashan|गीता|महोत्सव|जयंती|प्रतियोगिता|पंजीकरण|श्लोक|क्विज|चित्र|भाषण/.test(q);
  if (/\b(hi|hello|namaste|नमस्ते|नमस्कार)\b/.test(q)) return language === "hi" ? "नमस्ते! Geeta Jayanti Mahotsav के बारे में क्या जानना चाहेंगे?" : "Namaste! What would you like to know about Geeta Jayanti Mahotsav?";
  if (eventRelated) return language === "hi"
    ? "मैं इस प्रश्न का उत्तर उपलब्ध आधिकारिक जानकारी से भरोसे के साथ नहीं दे पा रहा हूँ। कृपया वेबसाइट के Contact Support विकल्प से आयोजक टीम से पूछें।"
    : "I can’t confirm this from the available official information. Please contact the organizers through the website’s Contact Support option.";
  return language === "hi"
    ? "मैं Geeta Jayanti Mahotsav 2026 से जुड़े प्रश्नों में मदद कर सकता हूँ। कृपया आयोजन, पंजीकरण या प्रतियोगिताओं के बारे में पूछें।"
    : "I can help with questions about Geeta Jayanti Mahotsav 2026. Please ask about the event, registration, or competitions.";
}

export default function EventHelpdesk() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [language, setLanguage] = useState<Language>("auto");
  const [faqs, setFaqs] = useState<ChatFaq[]>(defaultFaqs);
  const [contact, setContact] = useState<EventContact>(defaultEventContact);
  const [supportFormOpen, setSupportFormOpen] = useState(false);
  const [supportLanguage, setSupportLanguage] = useState<"en" | "hi">("en");
  const [messages, setMessages] = useState<Message[]>(() => {
    try { return JSON.parse(localStorage.getItem(historyKey) || "[]") as Message[]; } catch { return []; }
  });
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void loadChatFaqs().then(setFaqs); }, []);
  useEffect(() => { void loadEventContact().then(setContact); }, []);
  useEffect(() => { try { localStorage.setItem(historyKey, JSON.stringify(messages.slice(-40))); } catch { /* Ignore unavailable storage. */ } }, [messages]);
  useEffect(() => { if (open) { endRef.current?.scrollIntoView({ behavior: "smooth" }); inputRef.current?.focus(); } }, [open, messages, typing]);

  const showContact = async (selected: "en" | "hi", updates = false) => {
    setSupportFormOpen(!updates);
    setSupportLanguage(selected);
    const latest = await loadEventContact();
    setContact(latest);
    const text = updates
      ? selected === "hi"
        ? "आधिकारिक अपडेट के लिए गीता जयंती महोत्सव की वेबसाइट और घोषणा अनुभाग देखें। सहायता के लिए संपर्क विवरण नीचे दिए गए हैं।"
        : "For official updates, check the Geeta Jayanti Mahotsav website and announcements section. Contact details for assistance are below."
      : selected === "hi"
        ? "गीता जयंती महोत्सव 2026 से संपर्क करने के लिए धन्यवाद! पंजीकरण, प्रतियोगिताओं, परीक्षा, दस्तावेज़ अपलोड या अन्य आयोजन संबंधी सहायता के लिए हमारी सहायता टीम से संपर्क करें।"
        : "Thank you for contacting Geeta Jayanti Mahotsav 2026! For help with registration, competitions, examinations, document uploads, or other event questions, please contact our official support team.";
    setMessages((current) => [...current, { role: "assistant", text, contactCard: true, contactLanguage: selected }]);
  };

  const send = (text = draft) => {
    const question = text.trim();
    if (!question || typing) return;
    const selected = preferredLanguage(question, language);
    const answer = answerQuestion(question, selected, faqs);
    const match = findBestFaq(question, faqs);
    if (contactIntent.test(question) || supportRequestIntent.test(question) || (match.faq && match.score >= 0.34 && [10, 70, 78, 79, 80].includes(match.faq.id))) {
      setMessages((current) => [...current, { role: "user", text: question }]);
      setDraft("");
      void showContact(selected, match.faq?.id === 10 && match.score >= 0.34);
      return;
    }
    if (!match.faq || match.score < 0.34) logUnansweredQuestion(question);
    const support = (!match.faq || match.score < 0.34) && /geeta|gita|mahotsav|jayanti|event|competition|registration|shlok|quiz|drawing|bhashan|गीता|महोत्सव|जयंती|प्रतियोगिता|पंजीकरण|श्लोक|क्विज|चित्र|भाषण/i.test(question);
    setMessages((current) => [...current, { role: "user", text: question }]);
    setDraft(""); setTyping(true);
    window.setTimeout(() => { setMessages((current) => [...current, { role: "assistant", text: answer, support }]); setTyping(false); }, 520);
  };

  return <div className="fixed bottom-5 right-5 z-[70] flex flex-col items-end">
    {open && <section aria-label="Geeta Jayanti helpdesk chat" className="mb-3 flex h-[min(680px,calc(100dvh-110px))] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-gold/30 bg-cream shadow-2xl">
      <header className="flex items-center justify-between bg-maroon px-4 py-3.5 text-cream"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-lg text-maroon-dark">ॐ</div><div><p className="text-sm font-semibold">Mahotsav Helpdesk</p><p className="text-xs text-cream/75">Geeta Jayanti 2026 · 80 FAQs</p></div></div><div className="flex items-center gap-1"><button onClick={() => setMessages([])} aria-label="Clear chat history" title="Clear chat history" className="rounded-lg px-2 py-2 text-sm hover:bg-white/10">↻</button><button onClick={() => setOpen(false)} aria-label="Close helpdesk" className="rounded-lg p-2 text-xl leading-none hover:bg-white/10">×</button></div></header>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-dark bg-white px-4 py-2"><span className="text-xs text-brown-mid">Reply language</span><div className="flex items-center gap-2"><button onClick={() => void showContact(language === "hi" ? "hi" : "en")} className="rounded-lg bg-cream-dark px-2.5 py-1.5 text-xs font-semibold text-maroon">Contact Support</button><select aria-label="Reply language" value={language} onChange={(e) => { const selected = e.target.value as Language; setLanguage(selected); if (selected !== "auto") setSupportLanguage(selected); }} className="rounded-lg border border-cream-dark px-2 py-1 text-xs text-brown"><option value="auto">Match my message</option><option value="en">English</option><option value="hi">हिन्दी</option></select></div></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <div className="max-w-[90%] whitespace-pre-line rounded-2xl rounded-bl-md border border-cream-dark bg-white px-3.5 py-2.5 text-sm leading-relaxed text-brown">{welcome}</div>}
        {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${message.role === "user" ? "whitespace-pre-line rounded-br-md bg-maroon text-cream" : "rounded-bl-md border border-cream-dark bg-white text-brown"}`}><p className="whitespace-pre-line">{message.text}</p>{message.contactCard && <EventContactLinks contact={contact} language={message.contactLanguage} className="mt-3 text-xs leading-relaxed"/>}{message.support && <Link to="/contact" onClick={() => setOpen(false)} className="mt-2 inline-block font-semibold text-maroon underline">Contact event support →</Link>}</div></div>)}
        {supportFormOpen && <SupportRequestForm contact={contact} language={supportLanguage} onSuccess={(confirmationSent) => { const hi = supportLanguage === "hi"; setSupportFormOpen(false); setMessages((current) => [...current, { role: "assistant", text: hi ? "आपका सहायता अनुरोध सफलतापूर्वक भेज दिया गया है। हमारी टीम को आपकी समस्या प्राप्त हो गई है और वह आपकी सहायता करेगी." : "Your support request has been submitted successfully. Our team has received your query and will assist you." }, ...(!confirmationSent ? [{ role: "assistant" as const, text: hi ? "आपके ईमेल पर पुष्टि नहीं भेजी जा सकी। अतिरिक्त सहायता के लिए नीचे दिए गए नंबरों पर संपर्क करें।" : "We could not send the confirmation email. For additional assistance, contact the numbers below.", contactCard: true, contactLanguage: hi ? "hi" as const : "en" as const }] : [])]); }} />}
        {typing && <p className="w-fit animate-pulse rounded-2xl border border-cream-dark bg-white px-3.5 py-2.5 text-sm text-brown-mid">{language === "hi" ? "लिख रहा हूँ…" : "Typing…"}</p>}
        {messages.length === 0 && <div className="flex flex-wrap gap-2 pt-1">{["When is the Mahotsav?", "What are the competitions?", "Mera registration kaise hoga?"].map((prompt) => <button key={prompt} onClick={() => send(prompt)} className="rounded-full border border-gold/40 bg-white px-3 py-2 text-left text-xs text-maroon hover:bg-cream-dark">{prompt}</button>)}</div>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); send(); }} className="border-t border-cream-dark bg-white p-3"><p className="mb-2 px-1 text-[10px] leading-relaxed text-brown-mid">Please don’t share passwords, OTPs, or payment details.</p><div className="flex gap-2"><input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask in English, Hindi, or Hinglish…" aria-label="Type your question" className="min-w-0 flex-1 rounded-xl border border-cream-dark bg-cream px-3 py-2.5 text-sm text-brown outline-none placeholder:text-brown-light focus:border-gold" /><button type="submit" aria-label="Send message" disabled={!draft.trim() || typing} className="rounded-xl bg-maroon px-4 text-sm font-semibold text-cream hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-50">Send</button></div></form>
    </section>}
    <button onClick={() => setOpen((value) => !value)} aria-label={open ? "Close event helpdesk" : "Open event helpdesk"} aria-expanded={open} className="flex items-center gap-2 rounded-full bg-maroon px-5 py-3.5 font-semibold text-cream shadow-lg transition-transform hover:scale-[1.02] hover:bg-maroon-dark"><span className="text-lg" aria-hidden="true">{open ? "×" : "☏"}</span><span className="text-sm">{open ? "Close" : "Ask us"}</span></button>
  </div>;
}
