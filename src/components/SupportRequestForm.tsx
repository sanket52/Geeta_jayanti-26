import { useState, type FormEvent } from "react";
import { defaultEventContact, phoneHref, type EventContact } from "../lib/eventContact";
import { submitSupportRequest, supportCategories, type SupportRequest } from "../lib/supportRequests";

const newRequestId = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); });

const hindiCategory: Record<(typeof supportCategories)[number], string> = {
  "Registration": "पंजीकरण", "Login / OTP Problem": "लॉगिन / OTP समस्या", "Competition": "प्रतियोगिता", "Examination": "परीक्षा",
  "Document Upload": "दस्तावेज़ अपलोड", "Result / Certificate": "परिणाम / प्रमाणपत्र", "Technical Issue": "तकनीकी समस्या", "Other": "अन्य",
};

export default function SupportRequestForm({ contact = defaultEventContact, language = "en", onSuccess }: { contact?: EventContact; language?: "en" | "hi"; onSuccess: (confirmationSent: boolean) => void }) {
  const [requestId, setRequestId] = useState(newRequestId);
  const [formStartedAt] = useState(() => Date.now());
  const [fields, setFields] = useState({ name: "", email: "", mobile: "", subject: "", message: "", category: "Registration" as (typeof supportCategories)[number], website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hi = language === "hi";
  const labels = hi
    ? { title: "सहायता अनुरोध भेजें", name: "विद्यार्थी का नाम", email: "ईमेल पता", mobile: "मोबाइल नंबर (वैकल्पिक)", subject: "विषय", message: "प्रश्न / संदेश", category: "श्रेणी", submit: "अनुरोध भेजें", sending: "भेजा जा रहा है…", required: "कृपया आवश्यक जानकारी भरें।", emailError: "कृपया सही ईमेल पता दर्ज करें।", failed: "ईमेल नहीं भेजा जा सका। कृपया फोन पर सहायता टीम से संपर्क करें।", call: "कॉल करें" }
    : { title: "Send a support request", name: "Student Name", email: "Student Email Address", mobile: "Mobile Number (optional)", subject: "Subject", message: "Query / Message", category: "Category", submit: "Submit Request", sending: "Sending…", required: "Please complete all required fields.", emailError: "Enter a valid email address.", failed: "We could not send your email. Please call the support team.", call: "Call" };
  const inputClass = "mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-xs text-brown outline-none focus:border-gold";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const email = fields.email.trim();
    if (!fields.name.trim() || !email || !fields.subject.trim() || !fields.message.trim()) { setError(labels.required); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError(labels.emailError); return; }
    setBusy(true); setError("");
    const request: SupportRequest = { ...fields, requestId, formStartedAt, name: fields.name.trim(), email, mobile: fields.mobile.trim(), subject: fields.subject.trim(), message: fields.message.trim() };
    const result = await submitSupportRequest(request);
    setBusy(false);
    if (result.accepted) { onSuccess(result.confirmationSent); return; }
    setError(result.error || labels.failed);
  };

  return <form onSubmit={(event) => void submit(event)} className="rounded-xl border border-gold/30 bg-white p-3 text-brown shadow-sm">
    <h3 className="mb-3 text-sm font-semibold text-maroon">{labels.title}</h3>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-[11px] font-medium">{labels.name}<input required maxLength={120} autoComplete="name" value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} className={inputClass}/></label>
      <label className="text-[11px] font-medium">{labels.email}<input required type="email" maxLength={254} autoComplete="email" value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} className={inputClass}/></label>
      <label className="text-[11px] font-medium">{labels.mobile}<input type="tel" maxLength={30} autoComplete="tel" value={fields.mobile} onChange={(e) => setFields({ ...fields, mobile: e.target.value })} className={inputClass}/></label>
      <label className="text-[11px] font-medium">{labels.category}<select value={fields.category} onChange={(e) => setFields({ ...fields, category: e.target.value as SupportRequest["category"] })} className={inputClass}>{supportCategories.map((category) => <option key={category} value={category}>{hi ? hindiCategory[category] : category}</option>)}</select></label>
      <label className="text-[11px] font-medium sm:col-span-2">{labels.subject}<input required maxLength={180} value={fields.subject} onChange={(e) => setFields({ ...fields, subject: e.target.value })} className={inputClass}/></label>
      <label className="text-[11px] font-medium sm:col-span-2">{labels.message}<textarea required maxLength={5000} rows={4} value={fields.message} onChange={(e) => setFields({ ...fields, message: e.target.value })} className={inputClass}/></label>
    </div>
    <label aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-auto h-px w-px overflow-hidden">Website<input tabIndex={-1} autoComplete="off" value={fields.website} onChange={(e) => setFields({ ...fields, website: e.target.value })}/></label>
    {error && <div role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-900"><p>{error}</p><p className="mt-2 flex flex-wrap gap-3">{[contact.contact_phone_1, contact.contact_phone_2].map((number) => <a key={number} href={phoneHref(number)} className="font-semibold underline">{labels.call} +91 {number}</a>)}</p></div>}
    <button type="submit" disabled={busy} className="mt-3 w-full rounded-lg bg-maroon px-4 py-2.5 text-xs font-semibold text-cream hover:bg-maroon-dark disabled:opacity-50">{busy ? labels.sending : labels.submit}</button>
  </form>;
}
