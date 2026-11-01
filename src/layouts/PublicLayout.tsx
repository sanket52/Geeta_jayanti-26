import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import EventHelpdesk from "../components/EventHelpdesk";
import { defaultEventContact, loadEventContact, phoneHref, type EventContact } from "../lib/eventContact";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/about-gurukul", label: "About Gurukul" },
  { to: "/competitions", label: "Competitions" },
  { to: "/exam", label: "Exam" },
  { to: "/register", label: "Registration" },
  { to: "/contact", label: "Contact Us" },
  { to: "/student", label: "Student Dashboard" },
  { to: "/admin/login", label: "Admin Login" },
];

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contact, setContact] = useState<EventContact>(defaultEventContact);
  useEffect(() => { void loadEventContact().then(setContact); }, []);

  return <div className="flex min-h-full flex-col bg-cream">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-maroon-dark px-4 py-2 text-xs text-cream">
      <span className="opacity-80">ॐ तत् सत् — Maharshi Panini Ved Vedang Vidhyapeeth Gurukul</span>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <a href={phoneHref(contact.contact_phone_1)} className="hover:text-gold">+91 {contact.contact_phone_1}</a>
        <a href={phoneHref(contact.contact_phone_2)} className="hover:text-gold">+91 {contact.contact_phone_2}</a>
        {contact.support_email && <a href={`mailto:${contact.support_email}`} className="hover:text-gold">{contact.support_email}</a>}
      </div>
    </div>
    <header className="sticky top-0 z-50 border-b-2 border-gold bg-cream shadow-sm">
      <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-3 px-4 py-2">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-maroon text-xl font-bold text-cream">ॐ</span>
          <span><span className="block text-sm font-bold leading-tight text-maroon">Maharshi Panini</span><span className="block text-[11px] leading-tight text-gold">Ved Vedang Vidhyapeeth Gurukul</span></span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-0.5 xl:flex">
          {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `rounded-lg px-2.5 py-2 text-xs font-semibold 2xl:text-sm ${isActive ? "bg-cream-dark text-maroon" : "text-brown hover:bg-cream-dark hover:text-maroon"}`}>{link.label}</NavLink>)}
        </nav>
        <button type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)} className="rounded-lg p-2 text-maroon hover:bg-cream-dark xl:hidden">
          <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">{menuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}</svg>
        </button>
      </div>
      {menuOpen && <nav aria-label="Mobile navigation" className="flex flex-col gap-1 border-t border-cream-dark bg-cream px-4 py-3 xl:hidden">
        {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? "bg-cream-dark text-maroon" : "text-brown hover:bg-cream-dark"}`}>{link.label}</NavLink>)}
      </nav>}
    </header>
    <main className="flex-1"><Outlet /></main>
    <footer className="bg-maroon-dark text-cream">
      <div className="mx-auto grid max-w-7xl gap-9 px-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div><Link to="/" className="font-semibold text-gold">Maharshi Panini Ved Vedang Vidhyapeeth Gurukul</Link><p className="mt-3 max-w-sm text-sm leading-relaxed text-cream/65">Geeta Jayanti Mahotsav 2026 — learning, reflection and student participation inspired by the Bhagavad Gita.</p></div>
        <div><h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gold">Explore</h2><ul className="grid grid-cols-2 gap-2 text-sm text-cream/75">{links.slice(1, 7).map((link) => <li key={link.to}><Link className="hover:text-gold" to={link.to}>{link.label}</Link></li>)}</ul></div>
        <div><h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gold">Contact Us</h2><address className="space-y-2 text-sm not-italic text-cream/75">
          <a className="block hover:text-gold" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(contact.organization_address)}`} target="_blank" rel="noreferrer">{contact.organization_address}</a>
          <a className="block hover:text-gold" href={phoneHref(contact.contact_phone_1)}>+91 {contact.contact_phone_1}</a>
          <a className="block hover:text-gold" href={phoneHref(contact.contact_phone_2)}>+91 {contact.contact_phone_2}</a>
          {contact.support_email && <a className="block hover:text-gold" href={`mailto:${contact.support_email}`}>{contact.support_email}</a>}
        </address></div>
      </div>
      <div className="border-t border-white/10 px-5 py-4 text-center text-xs text-cream/45">© 2026 Maharshi Panini Ved Vedang Vidhyapeeth Gurukul <Link className="ml-3 hover:text-gold" to="/privacy">Privacy</Link></div>
    </footer>
    <EventHelpdesk />
  </div>;
}
