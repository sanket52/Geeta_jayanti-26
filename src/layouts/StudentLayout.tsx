import { useEffect, useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router";
import { getStudentRecord, subscribeToStudentRecord } from "../lib/studentRecord";
import { supabase } from "../lib/supabase";

const sidebarLinks = [
  { to: "/student/competitions", label: "Mahotsav Categories", icon: "🏆" },
  { to: "/student", label: "Dashboard", icon: "⊞", end: true },
  { to: "/student/profile", label: "My Profile", icon: "👤" },
  { to: "/student/profile", label: "My Registration", icon: "📋" },
  { to: "/student/documents", label: "Documents", icon: "📁" },
  { to: "/student/admit-card", label: "Admit Card", icon: "🪪" },
  { to: "/student/exam", label: "Examination", icon: "✍" },
  { to: "/student/oral-exam", label: "Oral Examination", icon: "🎥" },
  { to: "/student/results", label: "Result", icon: "📊" },
  { to: "/student/certificate", label: "Certificate", icon: "🏅" },
  { to: "/student/documents", label: "Receipts", icon: "🧾" },
  { to: "/student/documents", label: "Library", icon: "📚" },
  { to: "/student/profile", label: "Notifications", icon: "🔔" },
  { to: "/student/profile", label: "Help", icon: "❓" },
];

export default function StudentLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [record, setRecord] = useState(getStudentRecord);
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessError, setAccessError] = useState("");
  const navigate = useNavigate();

  useEffect(() => subscribeToStudentRecord(() => setRecord(getStudentRecord())), []);

  useEffect(() => {
    let active = true;
    const denyAccess = () => {
      if (!active) return;
      setAuthorized(false);
      setCheckingAccess(false);
      navigate("/login", { replace: true });
    };

    const checkStudentAccess = async () => {
      if (!supabase) {
        denyAccess();
        return;
      }
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        denyAccess();
        return;
      }
      const { error: syncError } = await supabase.functions.invoke("sync-supabase-profile");
      if (syncError) {
        if (active) {
          setAccessError(`Student profile setup failed: ${syncError.message}. Confirm the sync-supabase-profile function is deployed and its SQL migration has been applied.`);
          setCheckingAccess(false);
        }
        return;
      }
      const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (error || profile?.role !== "student") {
        if (active) {
          setAccessError(error
            ? `Could not load your Supabase profile: ${error.message}. Check that the database setup SQL has been applied.`
            : "This Supabase account is not assigned the student role. Ask an administrator to check its profile role.");
          setCheckingAccess(false);
        }
        return;
      }
      if (active) {
        setAuthorized(true);
        setCheckingAccess(false);
      }
    };

    void checkStudentAccess();
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") denyAccess();
    }) ?? { data: { subscription: null } };
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [navigate]);

  if (checkingAccess) {
    return <div className="min-h-screen bg-cream flex items-center justify-center text-brown-mid">Checking student account…</div>;
  }
  if (accessError) {
    return <div className="flex min-h-screen items-center justify-center bg-cream px-4"><section className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-bold text-brown">Your account signed in, but the student portal could not load</h1><p role="alert" className="mt-3 break-words text-sm text-brown-mid">{accessError}</p><div className="mt-5 flex gap-3"><button onClick={() => window.location.reload()} className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream">Try again</button><button onClick={async () => { await supabase?.auth.signOut(); navigate("/login", { replace: true }); }} className="rounded-lg border border-cream-dark px-4 py-2 text-sm font-semibold text-brown">Sign out</button></div></section></div>;
  }
  if (!authorized) return null;

  return (
    <div className="min-h-full flex bg-cream">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} transition-all duration-200 bg-maroon-dark text-cream flex flex-col shrink-0`}>
        <div className="h-16 flex items-center gap-3 px-4 border-b border-white/10">
          <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center text-maroon-dark font-bold text-sm shrink-0">ॐ</div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div style={{ fontFamily: "var(--font-display)" }} className="text-sm font-bold leading-tight truncate">Student Portal</div>
              <div className="text-gold text-xs leading-tight opacity-80">MPG Gurukul</div>
            </div>
          )}
          <button
            className="ml-auto text-white/50 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Student info */}
        {sidebarOpen && (
          <div className="px-4 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold font-bold overflow-hidden">
                {record.photo ? (
                  <img src={record.photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  record.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("")
                )}
              </div>
              <div>
                <div className="text-sm font-semibold">{record.fullName}</div>
                <div className="text-xs text-gold opacity-80">{record.registrationNumber}</div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 py-4 overflow-y-auto">
          {sidebarLinks.map((link, i) => (
            <NavLink
              key={i}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${
                  isActive
                    ? "bg-gold/20 text-gold border-r-2 border-gold"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <span className="text-base shrink-0">{link.icon}</span>
              {sidebarOpen && <span className="truncate">{link.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={async () => { await supabase?.auth.signOut(); navigate("/", { replace: true }); }}
            className={`flex items-center gap-3 text-sm text-white/60 hover:text-red-300 transition-colors w-full`}
          >
            <span>🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-cream border-b-2 border-gold flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 style={{ fontFamily: "var(--font-display)" }} className="text-maroon font-semibold text-lg">Student Portal</h1>
            <p className="text-xs text-brown-light">Maharshi Panini Ved Vedang Vidhyapeeth Gurukul</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-brown-mid hover:text-maroon transition-colors">
              🔔
              <span className="absolute top-1 right-1 w-2 h-2 bg-saffron rounded-full"></span>
            </button>
            <Link to="/" className="text-sm text-brown-mid hover:text-maroon transition-colors">← Public Site</Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
