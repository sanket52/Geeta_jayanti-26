import { useState } from "react";
import { Link } from "react-router";
import { getStudentRecord } from "../../lib/studentRecord";

const statusSteps = [
  { label: "Registration Submitted", done: true },
  { label: "Documents Verification", done: true },
  { label: "Approved", done: true },
  { label: "Admit Card Generated", done: false, current: true },
  { label: "Result Published", done: false },
  { label: "Certificate Generated", done: false },
];

const notifications = [
  { icon: "🪪", text: "Admit card is now available for download.", time: "2 hours ago", unread: true },
  { icon: "✅", text: "Your registration has been approved by admin.", time: "Yesterday", unread: true },
  { icon: "📢", text: "Vedic Knowledge Competition 2026 — Examination scheduled for 15 Oct.", time: "3 days ago", unread: false },
  { icon: "📧", text: "Email verification completed successfully.", time: "5 days ago", unread: false },
];

export default function StudentDashboard() {
  const [record] = useState(getStudentRecord);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-maroon to-maroon-dark text-cream rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-gold text-xs font-semibold uppercase tracking-widest mb-1">Welcome back</p>
          <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold">{record.fullName}</h1>
          <p className="text-cream/70 text-sm mt-1">Registration No: <span className="font-semibold text-gold">{record.registrationNumber}</span></p>
        </div>
        <div className="flex gap-3">
          <Link to="/student/admit-card" className="px-4 py-2 bg-gold text-brown rounded-lg font-semibold text-sm hover:bg-gold-light transition-colors">
            🪪 Download Admit Card
          </Link>
          <Link to="/student/exam" className="px-4 py-2 bg-white/15 text-cream rounded-lg font-semibold text-sm hover:bg-white/25 transition-colors">
            Exam Portal →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Competition", value: "VKC 2026", icon: "🏆", color: "bg-maroon/10 text-maroon" },
              { label: "Category", value: record.category.split(" ")[0], icon: "🎯", color: "bg-gold/10 text-gold" },
              { label: "Exam Date", value: "15 Oct", icon: "📅", color: "bg-saffron/10 text-saffron" },
              { label: "Profile %", value: "85%", icon: "👤", color: "bg-green-50 text-green-700" },
            ].map((s) => (
              <div key={s.label} className="bg-cream border border-cream-dark rounded-xl p-4">
                <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
                <div className="text-lg font-bold text-brown">{s.value}</div>
                <div className="text-xs text-brown-mid">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Registration Status */}
          <div className="bg-cream border border-cream-dark rounded-2xl p-6">
            <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold text-brown mb-6">Registration Status</h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-cream-dark" />
              <div className="space-y-4">
                {statusSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-4 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 z-10 ${
                      s.done ? "bg-green-500 text-white" :
                      s.current ? "bg-saffron text-white ring-4 ring-saffron/20" :
                      "bg-cream-dark text-brown-light"
                    }`}>
                      {s.done ? "✓" : s.current ? "●" : i + 1}
                    </div>
                    <div className={`text-sm font-medium ${s.done ? "text-green-700" : s.current ? "text-saffron" : "text-brown-light"}`}>
                      {s.label}
                      {s.current && <span className="ml-2 text-xs bg-saffron/10 text-saffron px-2 py-0.5 rounded-full">Current</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Important Dates */}
          <div className="bg-cream border border-cream-dark rounded-2xl p-6">
            <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold text-brown mb-4">Important Dates</h3>
            <div className="space-y-3">
              {[
                { event: "Registration Approved", date: "05 Sep 2026", status: "done", icon: "✅" },
                { event: "Admit Card Download", date: "10–14 Oct 2026", status: "active", icon: "🪪" },
                { event: "MCQ Examination", date: "15 Oct 2026, 10:00 AM", status: "upcoming", icon: "✍" },
                { event: "Oral Examination", date: "18–20 Oct 2026", status: "upcoming", icon: "🎥" },
                { event: "Result Declaration", date: "25 Oct 2026", status: "upcoming", icon: "📊" },
              ].map((d) => (
                <div key={d.event} className={`flex items-center gap-4 p-3 rounded-xl border ${
                  d.status === "done" ? "bg-green-50 border-green-100" :
                  d.status === "active" ? "bg-saffron/5 border-saffron/20" :
                  "bg-cream-dark border-transparent"
                }`}>
                  <span className="text-xl shrink-0">{d.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-brown">{d.event}</div>
                  </div>
                  <div className="text-xs font-semibold text-brown-mid shrink-0">{d.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile completion */}
          <div className="bg-cream border border-cream-dark rounded-2xl p-5">
            <h3 className="font-semibold text-brown text-sm mb-4">Profile Completion</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F2E4CC" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#C8902B" strokeWidth="3"
                    strokeDasharray="85 15" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brown">85%</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-brown">Good Progress!</div>
                <div className="text-xs text-brown-mid">2 items pending</div>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { item: "Basic Information", done: true },
                { item: "Educational Details", done: true },
                { item: "Photograph Upload", done: true },
                { item: "ID Document", done: true },
                { item: "Bank Details", done: false },
                { item: "Email Verification", done: false },
              ].map(({ item, done }) => (
                <div key={item} className="flex items-center gap-2">
                  <span className={done ? "text-green-500" : "text-cream-dark"}>
                    {done ? "✓" : "○"}
                  </span>
                  <span className={done ? "text-brown-mid" : "text-maroon font-medium"}>{item}</span>
                </div>
              ))}
            </div>
            <Link to="/student/profile" className="block mt-4 text-center text-xs font-semibold text-maroon hover:underline">
              Complete Profile →
            </Link>
          </div>

          {/* Notifications */}
          <div className="bg-cream border border-cream-dark rounded-2xl p-5">
            <h3 className="font-semibold text-brown text-sm mb-4">Notifications
              <span className="ml-2 bg-maroon text-cream text-xs px-1.5 py-0.5 rounded-full">2</span>
            </h3>
            <div className="space-y-3">
              {notifications.map((n, i) => (
                <div key={i} className={`flex gap-3 text-xs p-2.5 rounded-lg ${n.unread ? "bg-maroon/5 border border-maroon/10" : ""}`}>
                  <span className="text-lg shrink-0">{n.icon}</span>
                  <div>
                    <p className={`leading-snug ${n.unread ? "text-brown font-medium" : "text-brown-mid"}`}>{n.text}</p>
                    <p className="text-brown-light mt-0.5">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-maroon text-cream rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-4 text-gold">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: "Download Admit Card", to: "/student/admit-card", icon: "🪪" },
                { label: "View My Registration", to: "/student/profile", icon: "📋" },
                { label: "Go to Exam Portal", to: "/competition/exam", icon: "✍" },
                { label: "Download Certificate", to: "/student/certificate", icon: "🏅" },
              ].map((link) => (
                <Link key={link.label} to={link.to}
                  className="flex items-center gap-3 text-sm text-cream/80 hover:text-cream hover:bg-white/10 rounded-lg px-3 py-2 transition-colors">
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                  <span className="ml-auto">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
