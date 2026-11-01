import { useState } from "react";
import { Link, useNavigate } from "react-router";
import OTPVerification from "../components/OTPVerification";
import { supabase } from "../lib/supabase";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const finishStaffSignIn = async () => {
    if (!supabase) throw new Error("Supabase Auth is not configured.");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("The verified session could not be loaded. Please sign in again.");
    const { data: role, error: profileError } = await supabase.rpc("current_user_role");
    if (profileError) {
      await supabase.auth.signOut();
      throw new Error(`The staff role check failed: ${profileError.message}. Apply the Supabase schema and staff security SQL, then try again.`);
    }
    if (!["admin", "teacher"].includes(role ?? "")) {
      await supabase.auth.signOut();
      throw new Error(role === "pending_teacher"
        ? "Your teacher account is waiting for administrator approval."
        : "This account is not assigned an admin or approved teacher role. Ask your administrator to configure the account in Supabase.");
    }
    navigate("/admin", { replace: true });
  };

  const signInWithPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!supabase) { setError("Supabase Auth is not configured."); return; }
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (signInError) {
      setSubmitting(false);
      setError(signInError.message);
      return;
    }
    try {
      await finishStaffSignIn();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify staff access.");
    } finally {
      setSubmitting(false);
    }
  };

  const sendCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!supabase) { setError("Supabase Auth is not configured."); return; }
    setSubmitting(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    setSubmitting(false);
    if (sendError) { setError(sendError.message); return; }
    setOtpSent(true);
  };

  if (otpSent) {
    return <OTPVerification email={email.trim().toLowerCase()} purpose="login" onVerified={finishStaffSignIn} onBack={() => setOtpSent(false)} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brown px-4 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gold text-2xl font-bold text-brown">ॐ</div>
          <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-cream">Admin ERP Login</h1>
          <p className="mt-1 text-sm text-cream/55">Authorized admin and staff access</p>
        </header>
        <div className="rounded-2xl border border-white/10 bg-cream/10 p-8 shadow-2xl">
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-white/5 p-1">
            <button type="button" onClick={() => { setMode("password"); setError(""); }} className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${mode === "password" ? "bg-gold text-brown" : "text-cream/60 hover:text-cream"}`}>Password Login</button>
            <button type="button" onClick={() => { setMode("otp"); setError(""); }} className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${mode === "otp" ? "bg-gold text-brown" : "text-cream/60 hover:text-cream"}`}>Email OTP</button>
          </div>
          <form onSubmit={mode === "password" ? signInWithPassword : sendCode}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-cream/70">Admin Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.org" className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-cream outline-none placeholder:text-white/30 focus:border-gold" />
          </label>
          {mode === "password" && <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-cream/70">Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-cream outline-none placeholder:text-white/30 focus:border-gold" />
          </label>}
          {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-950/30 p-3 text-xs text-red-200">{error}</p>}
          <button type="submit" disabled={submitting} className="mt-5 w-full rounded-xl bg-gold py-3.5 text-sm font-bold text-brown hover:bg-gold-light disabled:opacity-50">{submitting ? (mode === "password" ? "Signing in…" : "Sending code…") : (mode === "password" ? "Login with Password" : "Send secure email code")}</button>
          </form>
          <p className="mt-4 text-center text-xs text-cream/45">Staff access is assigned by a project administrator. New accounts cannot grant themselves staff roles.</p>
        </div>
        <div className="mt-6 text-center"><Link to="/login" className="text-sm text-cream/55 hover:text-cream">← Student Portal Login</Link></div>
      </div>
    </div>
  );
}
