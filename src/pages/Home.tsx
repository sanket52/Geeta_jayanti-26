import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import EventContactLinks from "../components/EventContactLinks";
import { defaultEventContact, loadEventContact, type EventContact } from "../lib/eventContact";
import { defaultHomeSlides, loadHomeSlides, type HomeSlide } from "../lib/homeCarousel";
import { supabase } from "../lib/supabase";

const dates = [
  ["15 November 2026", "Online registration portal launch"],
  ["01 December 2026", "Final registration drive and submission / quiz window activation"],
  ["12 December 2026", "Final submission deadline · 11:59 PM"],
  ["13–16 December 2026", "Jury evaluation"],
  ["17 December 2026", "Final result declaration"],
  ["18–19 December 2026", "Final event preparations"],
  ["20 December 2026", "Grand celebration and award ceremony"],
];

export default function Home() {
  const [slides, setSlides] = useState<HomeSlide[]>(defaultHomeSlides);
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [slideError, setSlideError] = useState(false);
  const [contact, setContact] = useState<EventContact>(defaultEventContact);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationChecked, setRegistrationChecked] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<number | null>(null);
  const active = slides[activeSlide] ?? defaultHomeSlides[0];

  useEffect(() => {
    document.title = "Geeta Jayanti Mahotsav 2026 | Maharshi Panini Ved-Vedang Vidyapeeth Gurukul";
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", "Explore Geeta Jayanti Mahotsav 2026, the National Geeta Knowledge Quiz, competitions, registration and Gurukul learning.");
    void loadHomeSlides().then((loaded) => { setSlides(loaded); setActiveSlide(0); });
    void loadEventContact().then(setContact);
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => { setSlideError(false); setActiveSlide((slide) => (slide + 1) % slides.length); }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  useEffect(() => {
    let cancelled = false;
    const checkRegistration = async () => {
      try {
        if (sessionStorage.getItem("mpvvg_registration_popup_dismissed") || sessionStorage.getItem("mpvvg_registered")) { setRegistrationChecked(true); return; }
      } catch { setRegistrationChecked(true); return; }
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const { data: registration } = await supabase.from("candidate_registrations").select("registration_number").eq("user_id", data.user.id).maybeSingle();
          if (registration) { try { sessionStorage.setItem("mpvvg_registered", "true"); } catch { /* Storage can be disabled. */ } setRegistrationChecked(true); return; }
        }
      }
      setRegistrationChecked(true);
      window.setTimeout(() => { if (!cancelled) setShowRegistration(true); }, 4500);
    };
    void checkRegistration();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!showRegistration) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") dismissRegistration(); };
    window.addEventListener("keydown", dismissOnEscape);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener("keydown", dismissOnEscape); };
  }, [showRegistration]);

  const dismissRegistration = () => {
    try { sessionStorage.setItem("mpvvg_registration_popup_dismissed", "true"); } catch { /* Storage can be disabled. */ }
    setShowRegistration(false);
  };
  const goTo = (direction: number) => { setSlideError(false); setActiveSlide((index) => (index + direction + slides.length) % slides.length); };

  return <div className="overflow-hidden">
    <section className="relative bg-brown text-cream" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = touchStart.current; const end = event.changedTouches[0]?.clientX; if (start !== null && end !== undefined && Math.abs(end - start) > 45) goTo(end < start ? 1 : -1); touchStart.current = null; }} aria-roledescription="carousel" aria-label="Geeta Jayanti Mahotsav learning illustrations">
      <div className="absolute inset-0 bg-brown"><img key={`${active.image_url}-${slideError}`} src={slideError ? defaultHomeSlides[activeSlide % defaultHomeSlides.length].image_url : active.image_url} alt={slideError ? "" : active.alt_text} fetchPriority="high" decoding="async" className="h-full w-full object-cover opacity-45" onError={() => setSlideError(true)}/><div className="absolute inset-0 bg-gradient-to-r from-brown/95 via-maroon-dark/75 to-maroon/25"/></div>
      <div className="relative mx-auto grid min-h-[610px] max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div><p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-gold"><span className="h-px w-9 bg-gold"/> International Geeta Jayanti Mahotsav · 2026</p><h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">Learn the Gita.<br/><span className="text-gold">Reflect. Participate.</span></h1><p className="mt-5 max-w-2xl text-base leading-relaxed text-cream/75 sm:text-lg">Join students in exploring the teachings of Shrimad Bhagavad Gita through knowledge, creativity and reflection.</p><div className="mt-8 flex flex-wrap gap-3"><Link to="/register" className="rounded-xl bg-saffron px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-saffron-light">Register Now</Link><Link to="/exam" className="rounded-xl border border-white/35 px-5 py-3 text-sm font-bold text-cream transition hover:bg-white/10">Explore Exam</Link><Link to="/about-gurukul" className="rounded-xl px-4 py-3 text-sm font-semibold text-gold hover:underline">About Gurukul →</Link></div><p className="mt-8 text-xs text-cream/55">Organized by Maharshi Panini Ved-Vedang Vidyapeeth Gurukul · Greater Noida</p></div>
        <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-gold/30 bg-maroon/30 shadow-2xl"><img key={`hero-${active.image_url}-${slideError}`} src={slideError ? defaultHomeSlides[activeSlide % defaultHomeSlides.length].image_url : active.image_url} alt={slideError ? "" : active.alt_text} className="aspect-[8/5] w-full object-contain" loading="eager" decoding="async" onError={() => setSlideError(true)}/><div className="flex items-center justify-between gap-3 bg-maroon-dark/90 px-4 py-3"><p className="text-sm font-semibold text-cream">{active.caption}</p><div className="flex items-center gap-2"><button type="button" aria-label="Previous carousel image" onClick={() => goTo(-1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/30 text-xl hover:bg-white/10">‹</button><button type="button" aria-label="Next carousel image" onClick={() => goTo(1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/30 text-xl hover:bg-white/10">›</button></div></div><div className="absolute bottom-[3.55rem] left-1/2 flex -translate-x-1/2 gap-1.5">{slides.map((slide, index) => <button key={`${slide.image_url}-dot`} type="button" aria-label={`Show slide ${index + 1}: ${slide.caption}`} aria-current={index === activeSlide ? "true" : undefined} onClick={() => { setSlideError(false); setActiveSlide(index); }} className={`h-2 rounded-full transition-all ${index === activeSlide ? "w-6 bg-gold" : "w-2 bg-white/60"}`}/>)}</div></div>
      </div>
    </section>

    <section className="bg-cream px-5 py-16 sm:py-20"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center"><div><p className="text-xs font-bold uppercase tracking-widest text-saffron">About the Mahotsav</p><h2 className="mt-3 text-3xl font-bold text-maroon sm:text-4xl">A celebration of learning and reflection</h2><p className="mt-4 leading-relaxed text-brown-mid">Geeta Jayanti Mahotsav 2026 brings students together to learn about the Bhagavad Gita and its ideas through educational activities and competitions.</p><p className="mt-3 leading-relaxed text-brown-mid">The National Geeta Knowledge Quiz is an online MCQ examination with 50 questions and a 25-minute duration. The website also offers a separate sample practice test to help students prepare.</p><Link to="/about-gurukul" className="mt-5 inline-flex font-semibold text-maroon hover:underline">Meet the Gurukul →</Link></div><div className="grid gap-3 sm:grid-cols-2">{[{ n: "01", title: "Learn", body: "Explore the Gita’s chapters, characters and teachings." }, { n: "02", title: "Reflect", body: "Connect ideas like duty and equanimity with student life." }, { n: "03", title: "Participate", body: "Choose from the Mahotsav’s student competitions." }, { n: "04", title: "Prepare", body: "Practise with a clearly labeled non-official mock test." }].map((item) => <article key={item.n} className="rounded-2xl border border-cream-dark bg-white p-5 shadow-sm"><span className="text-xs font-bold text-gold">{item.n}</span><h3 className="mt-2 font-bold text-brown">{item.title}</h3><p className="mt-1 text-sm leading-relaxed text-brown-mid">{item.body}</p></article>)}</div></div></section>

    <section className="bg-cream-dark px-5 py-16 sm:py-20"><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-saffron">Mahotsav activities</p><h2 className="mt-3 text-3xl font-bold text-maroon">Explore the competitions</h2></div><Link to="/competitions" className="text-sm font-bold text-maroon hover:underline">All competition details →</Link></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ title: "Rashtriya Geeta Gyan Quiz", icon: "गीता", body: "50-question online knowledge quiz." }, { title: "Shloka Uccharan", icon: "श्लोक", body: "Share a recitation through the competition portal." }, { title: "Digital Bhashan", icon: "वाणी", body: "Present a speech inspired by the Gita." }, { title: "Geeta-Inspired Art", icon: "कला", body: "Create an original artwork inspired by its teachings." }].map((item) => <article key={item.title} className="rounded-2xl border border-white bg-cream p-5 shadow-sm"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-maroon text-sm font-bold text-gold">{item.icon}</span><h3 className="mt-4 font-bold text-brown">{item.title}</h3><p className="mt-2 text-sm text-brown-mid">{item.body}</p></article>)}</div></div></section>

    <section className="bg-white px-5 py-16 sm:py-20"><div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center"><div><p className="text-xs font-bold uppercase tracking-widest text-gold">National Geeta Knowledge Quiz</p><h2 className="mt-3 text-3xl font-bold text-maroon">Know the pattern. Prepare with confidence.</h2><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["50", "Questions"], ["25 min", "Duration"], ["4", "Options each"], ["1", "Official attempt"]].map(([value, label]) => <div key={label} className="rounded-xl bg-cream p-4 text-center"><p className="text-xl font-bold text-maroon">{value}</p><p className="mt-1 text-xs text-brown-mid">{label}</p></div>)}</div><p className="mt-4 text-sm leading-relaxed text-brown-mid">Study all 18 chapters, the Kurukshetra context, the Krishna–Arjuna dialogue, philosophical concepts and key teachings.</p><Link to="/exam" className="mt-5 inline-flex rounded-xl bg-maroon px-5 py-3 text-sm font-semibold text-cream hover:bg-maroon-dark">Explore Exam and Syllabus</Link></div><div className="rounded-3xl bg-maroon p-7 text-cream"><p className="text-xs font-bold uppercase tracking-widest text-gold">Practice before the official exam</p><h3 className="mt-3 text-2xl font-bold">Mock Test</h3><p className="mt-2 text-sm leading-relaxed text-cream/70">Try 50 practice questions with a 25-minute timer, answer review and topic-wise feedback. Mock results stay separate from official results.</p><Link to="/exam#mock-test" className="mt-5 inline-flex rounded-xl bg-gold px-5 py-3 text-sm font-bold text-brown hover:bg-gold-light">Start Mock Test</Link><p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-cream/50">Practice test · not official examination</p></div></div></section>

    <section className="bg-cream px-5 py-16 sm:py-20"><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-gold">Important dates</p><h2 className="mt-3 text-3xl font-bold text-maroon">Mahotsav timeline</h2></div><Link to="/competitions" className="text-sm font-bold text-maroon hover:underline">Event information →</Link></div><ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{dates.map(([date, activity], index) => <li key={date} className="rounded-2xl border border-cream-dark bg-white p-5 shadow-sm"><span className="text-xs font-bold text-saffron">{String(index + 1).padStart(2, "0")}</span><p className="mt-2 font-bold text-brown">{date}</p><p className="mt-1 text-sm leading-relaxed text-brown-mid">{activity}</p></li>)}</ol></div></section>

    <section className="bg-maroon-dark px-5 py-16 text-cream sm:py-20"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-widest text-gold">About Gurukul</p><h2 className="mt-3 text-3xl font-bold">Traditional knowledge with modern learning</h2><p className="mt-4 max-w-xl text-sm leading-relaxed text-cream/70">Maharshi Panini Ved-Vedang Vidyapeeth Gurukul connects Vedic education, Sanskrit, the Bhagavad Gita, values and modern computer learning.</p><Link to="/about-gurukul" className="mt-5 inline-flex rounded-xl border border-white/30 px-5 py-3 text-sm font-bold hover:bg-white/10">About the Gurukul →</Link></div><div className="rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-xs font-bold uppercase tracking-widest text-gold">Student and family support</p><h3 className="mt-2 text-xl font-bold">Questions about the event?</h3><p className="mt-2 text-sm text-cream/65">Contact the official event support team or send a request through the website chatbot.</p><div className="mt-4"><EventContactLinks contact={contact} className="text-sm"/></div><Link to="/contact" className="mt-5 inline-flex rounded-xl bg-gold px-5 py-3 text-sm font-bold text-brown">Contact Support</Link></div></div></section>

    {showRegistration && registrationChecked && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) dismissRegistration(); }}><section role="dialog" aria-modal="true" aria-labelledby="registration-title" className="relative w-full max-w-lg rounded-3xl bg-cream p-7 shadow-2xl sm:p-9"><button ref={closeButtonRef} type="button" aria-label="Close registration offer" onClick={dismissRegistration} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-brown-mid hover:bg-cream-dark">×</button><p className="text-xs font-bold uppercase tracking-widest text-gold">Join the celebration</p><h2 id="registration-title" className="mt-3 text-2xl font-bold text-maroon">Geeta Jayanti Mahotsav 2026</h2><p className="mt-3 text-sm leading-relaxed text-brown-mid">Register to participate in the Mahotsav activities and receive event updates.</p><div className="mt-6 flex flex-wrap gap-3"><Link to="/register" onClick={dismissRegistration} className="rounded-xl bg-maroon px-5 py-3 text-sm font-bold text-cream">Register Now</Link><button type="button" onClick={dismissRegistration} className="rounded-xl border border-cream-dark px-5 py-3 text-sm font-semibold text-brown">Maybe Later</button></div></section></div>}
  </div>;
}
