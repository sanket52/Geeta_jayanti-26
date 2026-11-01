import builtInFaqs from "../data/geetaJayantiFaqs.json";
import { supabase } from "./supabase";

export type ChatFaq = {
  id: number;
  category: string;
  question_en: string;
  answer_en: string;
  question_hi: string;
  answer_hi: string;
  keywords: string[];
  related_questions: number[];
  updated_at: string;
};

export const defaultFaqs = builtInFaqs as ChatFaq[];

export async function loadChatFaqs(): Promise<ChatFaq[]> {
  if (!supabase) return defaultFaqs;
  const { data, error } = await supabase.from("gjm_chatbot_faqs").select("*").eq("published", true).order("id");
  return error || !data?.length ? defaultFaqs : (data as ChatFaq[]);
}

export function findBestFaq(question: string, faqs: ChatFaq[]) {
  const clean = (value: string) => value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  const words = (value: string) => clean(value).split(/\s+/).filter((word) => word.length > 1 && !["the", "for", "and", "can", "how", "what", "when", "where", "is", "are", "hai", "ka", "ki", "ko", "kya", "kaise", "kab", "hai", "hoga", "mera", "meri", "mein"].includes(word));
  const input = words(question);
  if (!input.length) return { faq: null, score: 0 };
  let best: ChatFaq | null = null;
  let bestScore = 0;
  for (const faq of faqs) {
    const target = words([faq.question_en, faq.question_hi, ...faq.keywords].join(" "));
    const targetSet = new Set(target);
    let hits = 0;
    for (const token of input) {
      if (targetSet.has(token)) { hits += 1; continue; }
      if (token.length >= 5 && target.some((candidate) => candidate.length >= 5 && editDistanceAtMostOne(token, candidate))) hits += 0.65;
    }
    const score = hits / Math.max(1, Math.min(input.length, 5)) + (clean(question).includes(clean(faq.question_en)) || clean(question).includes(clean(faq.question_hi)) ? 1 : 0);
    if (score > bestScore) { bestScore = score; best = faq; }
  }
  return { faq: best, score: bestScore };
}

function editDistanceAtMostOne(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

export function logUnansweredQuestion(question: string) {
  try {
    const key = "gjm-chat-unanswered-v1";
    const prior = JSON.parse(localStorage.getItem(key) || "[]") as Array<{ question: string; created_at: string }>;
    const safeQuestion = question.slice(0, 500)
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
      .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[phone or number]")
      .replace(/\b(password|passcode|otp)\s*[:=]?\s*\S+/gi, "$1 [redacted]");
    prior.push({ question: safeQuestion, created_at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(prior.slice(-100)));
  } catch { /* Storage may be disabled; chat remains available. */ }
}
