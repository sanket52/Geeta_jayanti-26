import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../lib/supabase";

const competitions = [
  {
    title: "Shloka Uccharan",
    subtitle: "Video / oral competition",
    body: "Recite any five Bhagavad Gita shlokas from memory in a clear, unedited video of up to 3 minutes.",
    details: ["Recite any five Bhagavad Gita shlokas from memory", "One clear, unedited video, maximum 3 minutes", "No background music or reading from a book"],
    icon: "🎙️",
  },
  {
    title: "Rashtriya Geeta Gyan Quiz",
    subtitle: "Timed online quiz",
    body: "Answer 50 multiple-choice questions about the Bhagavad Gita, its teachings, and the Mahabharata context.",
    details: ["Exactly 50 questions, 25 minutes, one attempt", "All 18 chapters, the dialogue, Karma, Jnana, Bhakti, and Sankhya Yoga", "0.5 marks per correct answer, raw /25 and normalized /100"],
    icon: "📖",
  },
  {
    title: "Digital Bhashan Competition",
    subtitle: "Speech video",
    body: "Speak on stress-free living, nation-building, and the teachings of the Shrimad Bhagavad Gita.",
    details: ["Hindi, Sanskrit, or English", "Sub-Junior 2-3 min, Junior 3-4 min, Senior and Open 4-5 min", "Suggested themes: Gita today, stress, youth, Gurukul, duty and nation-building"],
    icon: "🎥",
  },
  {
    title: "Geeta-Inspired Drawing / Painting",
    subtitle: "Original artwork",
    body: "Create handmade artwork inspired by karma, dharma, knowledge, and devotion in the Bhagavad Gita.",
    details: ["Handmade artwork only; no digital or AI art", "Themes include Kurukshetra, Nishkama Karma, Vishvarupa, and Gurukul values", "Upload artwork photo, participant photo, and a 20-30 sec process video"],
    icon: "🎨",
  },
];

const defaultSchedule = [
  ["Registration opens", "15 November 2026"],
  ["Registration / quiz window", "1 December 2026 · exact closing time to be confirmed"],
  ["Submission deadline", "12 December 2026 · 11:59 PM"],
  ["Judging", "13–16 December 2026"],
  ["Results", "17 December 2026"],
  ["Final preparations", "18–19 December 2026"],
  ["Mahotsav", "20 December 2026"],
];

function displayDate(value: string, includeTime = false) {
  const date = new Date(value);
  return date.toLocaleString("en-IN", includeTime ? { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" } : { dateStyle: "medium", timeZone: "Asia/Kolkata" });
}

export default function Competitions() {
  const [schedule, setSchedule] = useState(defaultSchedule);
  useEffect(() => {
    if (!supabase) return;
    void supabase.from("gjm_event_settings").select("event_date,registration_opens_at,registration_closes_at,submissions_close_at,judging_opens_at,judging_closes_at,results_at,preparations_start_at,preparations_end_at,registration_window_confirmed").eq("id", true).maybeSingle().then(({ data }) => {
      if (!data) return;
      setSchedule([
        ["Registration opens", displayDate(data.registration_opens_at, true)],
        ["Registration / quiz window", `${displayDate(data.registration_closes_at, true)}${data.registration_window_confirmed ? "" : " · exact closing time needs confirmation"}`],
        ["Submission deadline", displayDate(data.submissions_close_at, true)],
        ["Judging", `${displayDate(data.judging_opens_at)} – ${displayDate(data.judging_closes_at)}`],
        ["Results", displayDate(data.results_at, true)],
        ["Final preparations", `${displayDate(data.preparations_start_at)} – ${displayDate(data.preparations_end_at)}`],
        ["Mahotsav", displayDate(data.event_date)],
      ]);
    });
  }, []);

  return (
    <div>
      <section className="bg-maroon-dark px-6 py-16 text-cream sm:py-20">
        <div className="mx-auto max-w-5xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold">Geeta Jayanti Mahotsav · 2026</span>
          <h1 style={{ fontFamily: "var(--font-display)" }} className="mt-3 mb-5 max-w-3xl text-4xl font-bold lg:text-5xl">Four ways to share what the Gita inspires</h1>
          <p className="max-w-2xl leading-relaxed text-cream/70">Choose up to two categories when completing your participant registration. Video submissions, quiz attempts, and judging will be available through the participant portal once the competition setup is enabled.</p>
          <Link to="/register" className="mt-7 inline-flex rounded-lg bg-gold px-6 py-3 text-sm font-semibold text-brown transition-colors hover:bg-gold-light">Participant registration →</Link>
        </div>
      </section>

      <section className="bg-cream px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2">
          {competitions.map((competition, index) => (
            <article key={competition.title} className="overflow-hidden rounded-2xl border border-cream-dark bg-cream shadow-sm transition hover:border-gold/50 hover:shadow-lg">
              <div className={`h-2 ${index === 0 ? "bg-maroon" : index === 1 ? "bg-gold" : index === 2 ? "bg-saffron" : "bg-green-vedic"}`} />
              <div className="p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cream-dark text-2xl">{competition.icon}</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gold">{competition.subtitle}</p>
                    <h2 style={{ fontFamily: "var(--font-display)" }} className="mt-1 text-xl font-bold text-brown">{competition.title}</h2>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-brown-mid">{competition.body}</p>
                <ul className="mt-5 space-y-2 border-t border-cream-dark pt-4 text-sm text-brown-mid">
                  {competition.details.map((detail) => <li key={detail} className="flex gap-2"><span className="font-bold text-gold">✓</span><span>{detail}</span></li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-cream-dark px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-widest text-gold">Plan ahead</span>
            <h2 style={{ fontFamily: "var(--font-display)" }} className="mt-2 text-3xl font-bold text-brown">Mahotsav schedule</h2>
          </div>
          <dl className="grid gap-px overflow-hidden rounded-xl border border-cream-dark bg-cream-dark sm:grid-cols-2">
            {schedule.map(([event, date]) => <div key={event} className="flex flex-col gap-1 bg-cream p-4 sm:flex-row sm:items-center sm:justify-between"><dt className="text-sm text-brown-mid">{event}</dt><dd className="text-sm font-semibold text-brown sm:text-right">{date}</dd></div>)}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-brown-mid">Age is calculated on 20 December 2026. The supplied brief leaves ages 18 and 30 unresolved; category assignment for those ages must be confirmed by the organizer. No rulebook was found in the project files, so these dates and rules reflect the supplied brief and should be reviewed before opening registrations.</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Sub-Junior", "12 years and under"], ["Junior", "13-17 years"], ["Senior", "19-29 years"], ["Open", "31 years and above"]].map(([category, ages]) => <div key={category} className="rounded-xl border border-gold/20 bg-cream p-4"><p className="text-sm font-semibold text-maroon">{category}</p><p className="mt-1 text-xs text-brown-mid">{ages}</p></div>)}</div>
          <p className="mt-3 text-xs text-amber-900">Age 18 and age 30 are intentionally unassigned until the organizer confirms the rulebook boundary.</p>
        </div>
      </section>
    </div>
  );
}
