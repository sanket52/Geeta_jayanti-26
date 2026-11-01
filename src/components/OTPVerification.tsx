import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

interface OTPVerificationProps {
  email: string;
  purpose?: "registration" | "login" | "reset";
  onVerified: () => void | Promise<void>;
  onBack?: () => void;
}

export default function OTPVerification({ email, purpose = "registration", onVerified, onBack }: OTPVerificationProps) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(60);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "sent" | "error">("sent");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifyingRef = useRef(false);

  /* Countdown */
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + "*".repeat(Math.min(b.length, 5)) + c)
    : "your email";

  const handleDigit = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError("");
    if (char && index < 5) inputRefs.current[index + 1]?.focus();
    if (!char && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...digits];
    text.split("").forEach((ch, i) => { if (i < 6) next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(text.length, 5)]?.focus();
  };

  const resend = async () => {
    if (sending || cooldown > 0) return;
    if (!supabase) {
      setError("Email verification is not configured. Please contact the event team.");
      setSendStatus("error");
      return;
    }
    setSending(true);
    setSendStatus("idle");
    setError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error: sendError } = purpose === "reset"
        ? await supabase.auth.resetPasswordForEmail(normalizedEmail)
        : await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: purpose === "registration" },
        });
      if (sendError) {
        setError(sendError.message);
        setSendStatus("error");
        return;
      }
      setSendStatus("sent");
      setCooldown(60);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      setError("The verification email could not be sent. Please try again later.");
      setSendStatus("error");
    } finally {
      setSending(false);
    }
  };

  const verify = useCallback(async () => {
    const code = digits.join("");
    if (code.length < 6) { setError("Please enter all 6 digits."); return; }
    if (verifyingRef.current) return;
    if (!supabase) { setError("Email verification is not configured."); return; }
    verifyingRef.current = true;
    setVerifying(true);
    setError("");
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: purpose === "reset" ? "recovery" : "email",
      });
      if (verifyError) {
        setError(/expired/i.test(verifyError.message)
          ? "This code has expired. Request a new code and try again."
          : "That code is invalid. Check it and try again.");
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }
      await onVerified();
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Verification failed. Please try again.");
    } finally {
      setVerifying(false);
      verifyingRef.current = false;
    }
  }, [digits, email, onVerified, purpose]);

  /* Auto-submit when all 6 digits filled */
  useEffect(() => {
    if (digits.every((d) => d !== "")) verify();
  }, [digits, verify]);

  const purposeLabel = { registration: "Registration", login: "Login", reset: "Password Reset" }[purpose];

  return (
    <div className="min-h-screen bg-cream-dark flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-maroon text-cream flex items-center justify-center text-2xl font-bold mx-auto mb-3">ॐ</div>
          <h1 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-brown">Email Verification</h1>
          <p className="text-sm text-brown-mid mt-1">Maharshi Panini Ved Vedang Vidhyapeeth Gurukul</p>
        </div>

        <div className="bg-cream rounded-2xl shadow-xl border border-gold/20 p-8">
          {/* Email sent banner */}
          {sendStatus === "sent" && (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <span className="text-green-600 text-lg shrink-0 mt-0.5">✉</span>
              <div className="text-sm">
                <div className="font-semibold text-green-800">OTP Sent Successfully</div>
                <div className="text-green-700 mt-0.5">
                  A 6-digit verification code was sent to{" "}
                  <span className="font-semibold">{maskedEmail}</span>.
                  Check your inbox and spam folder.
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <p className="text-sm text-brown-mid leading-relaxed">
              Enter the 6-digit OTP to complete your{" "}
              <span className="font-semibold text-brown">{purposeLabel}</span>.
            </p>
          </div>

          {/* OTP Inputs */}
          <div className="flex gap-2 justify-center mb-2" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
                className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 text-brown transition-all focus:outline-none ${
                  error
                    ? "border-red-400 bg-red-50"
                    : d
                    ? "border-maroon bg-maroon/5 text-maroon"
                    : "border-cream-dark bg-cream focus:border-gold"
                }`}
              />
            ))}
          </div>

          {/* Separator after 3 */}
          <div className="flex justify-center gap-2 mb-6">
            <div className="w-[5.5rem]" />
            <div className="flex items-center px-1 text-brown-light text-lg">—</div>
            <div className="w-[5.5rem]" />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4 text-center">
              {error}
            </div>
          )}

          {/* Verify button */}
          <button
            onClick={verify}
            disabled={verifying || digits.some((d) => !d)}
            className="w-full bg-maroon text-cream py-3.5 rounded-xl font-semibold text-sm hover:bg-maroon-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden mb-4"
          >
            {verifying ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="15" />
                </svg>
                Verifying…
              </span>
            ) : (
              "Verify OTP →"
            )}
          </button>

          {/* Resend */}
          <div className="text-center text-sm">
            {cooldown > 0 ? (
              <p className="text-brown-mid">
                Resend OTP in{" "}
                <span className="font-semibold text-maroon tabular-nums">{cooldown}s</span>
              </p>
            ) : (
              <button
                onClick={resend}
                disabled={sending}
                className="text-maroon font-semibold hover:underline disabled:opacity-60"
              >
                {sending ? "Sending…" : "Resend OTP"}
              </button>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-cream-dark flex flex-col gap-2 text-center text-xs text-brown-mid">
            <p>Your OTP expires according to the event's authentication settings. For security, never share this code with anyone.</p>
            {onBack && (
              <button onClick={onBack} className="text-maroon font-semibold hover:underline text-sm mt-1">
                ← Change Email / Go Back
              </button>
            )}
          </div>
        </div>

        {/* Help */}
        <div className="mt-4 bg-cream border border-cream-dark rounded-xl p-4 text-xs text-brown-mid text-center space-y-1">
          <p>Didn't receive the email? Check your <strong>Spam / Junk</strong> folder.</p>
          <p>
            Still having trouble?{" "}
            <a href="/contact" className="text-maroon font-semibold hover:underline">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}
