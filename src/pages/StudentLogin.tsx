import { useState } from "react";
import { Link, useNavigate } from "react-router";
import OTPVerification from "../components/OTPVerification";
import { supabase } from "../lib/supabase";

export default function StudentLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [debugError, setDebugError] = useState("");

  const sendOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) { setError("Supabase is not configured."); return; }
    setBusy(true);
    setError("");
    setDebugError("");
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });
      if (sendError) {
        setError("We could not send a code. Check your email and try again shortly.");
        if (import.meta.env.DEV) setDebugError(`${sendError.code ?? sendError.status ?? "Supabase Auth"}: ${sendError.message}`);
        return;
      }
      setOtpSent(true);
    } catch (sendError) {
      setError("We could not connect to Supabase Auth. Check your connection and try again.");
      if (import.meta.env.DEV) setDebugError(sendError instanceof Error ? sendError.message : String(sendError));
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) { setError("Supabase is not configured."); return; }
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/student` },
    });
    if (oauthError) setError("Google sign-in could not be started. Please try again.");
  };

  if (otpSent) return <OTPVerification email={email.trim().toLowerCase()} purpose="login" onVerified={() => navigate("/student", { replace: true })} onBack={() => setOtpSent(false)} />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-dark px-4 py-12">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-maroon text-2xl font-bold text-cream">ॐ</div>
          <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown">Student sign in</h1>
          <p className="mt-1 text-sm text-brown-mid">Sign in with your registered email or Google account.</p>
        </header>
        <section className="rounded-2xl border border-gold/20 bg-cream p-8 shadow-xl">
          <button type="button" onClick={() => void signInWithGoogle()} className="w-full rounded-xl border-2 border-maroon py-3 text-sm font-semibold text-maroon hover:bg-maroon/5">Continue with Google</button>
          <div className="my-5 flex items-center gap-3 text-xs text-brown-light"><span className="h-px flex-1 bg-cream-dark" />or email OTP<span className="h-px flex-1 bg-cream-dark" /></div>
          <form onSubmit={(event) => void sendOtp(event)} className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-brown-mid">Registered email</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-cream-dark px-4 py-3 text-sm focus:border-gold focus:outline-none" placeholder="you@example.com" /></label>
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {debugError && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Development detail: {debugError}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-maroon py-3.5 text-sm font-semibold text-cream hover:bg-maroon-dark disabled:opacity-60">{busy ? "Sending code…" : "Continue with email OTP"}</button>
          </form>
          <p className="mt-5 text-center text-xs text-brown-mid">New candidate? <Link to="/register" className="font-semibold text-maroon hover:underline">Register for the Mahotsav</Link></p>
        </section>
        <p className="mt-6 text-center"><Link to="/" className="text-sm text-brown-mid hover:text-maroon">← Public website</Link></p>
      </div>
    </div>
  );
}
