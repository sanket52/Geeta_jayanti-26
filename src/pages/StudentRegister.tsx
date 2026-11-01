import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import OTPVerification from "../components/OTPVerification"
import { indiaDistricts, indianStates } from "../data/indiaDistricts"
import { supabase } from "../lib/supabase"

type Personal = {
  fullName: string
  fatherName: string
  motherName: string
  birthDate: string
  gender: string
  email: string
  mobile: string
  alternateMobile: string
  schoolName: string
  educationLevel: string
  house: string
  street: string
  country: string
  state: string
  district: string
  city: string
  pin: string
  selectedCompetitions: string[]
  parentalConsent: boolean
}
type Bank = {
  accountHolder: string
  bankName: string
  account: string
  confirmAccount: string
  ifsc: string
  branch: string
}
const blankPersonal: Personal = {
  fullName: "",
  fatherName: "",
  motherName: "",
  birthDate: "",
  gender: "",
  email: "",
  mobile: "",
  alternateMobile: "",
  schoolName: "",
  educationLevel: "",
  house: "",
  street: "",
  country: "India",
  state: "",
  district: "",
  city: "",
  pin: "",
  selectedCompetitions: [],
  parentalConsent: false,
}
const blankBank: Bank = {
  accountHolder: "",
  bankName: "",
  account: "",
  confirmAccount: "",
  ifsc: "",
  branch: "",
}
const competitionOptions = [
  ["shloka_uccharan", "Shloka Uccharan · Video / oral"],
  ["geeta_quiz", "Rashtriya Geeta Gyan Quiz"],
  ["digital_bhashan", "Digital Bhashan · Speech video"],
  ["geeta_art", "Geeta-Inspired Drawing / Painting"],
] as const
const fieldClass =
  "w-full rounded-xl border border-cream-dark/90 bg-white px-3.5 py-3 text-sm text-brown shadow-sm outline-none transition duration-200 placeholder:text-brown-light/70 hover:border-gold/60 focus:border-gold focus:ring-4 focus:ring-gold/15 disabled:cursor-not-allowed disabled:bg-cream-dark/60"
const labelClass = "mb-2 block text-xs font-bold tracking-wide text-brown-mid"
function ageAtEvent(date: string) {
  if (!date) return null
  const born = new Date(`${date}T00:00:00`)
  if (Number.isNaN(born.getTime()) || born > new Date("2026-12-20T00:00:00"))
    return null
  let age = 2026 - born.getFullYear()
  if (born.getMonth() > 11 || (born.getMonth() === 11 && born.getDate() > 20))
    age--
  return age
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
  autoComplete = "off",
  ...props
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
  autoComplete?: string
  [key: string]: unknown
}) {
  return (
    <label>
      <span className={labelClass}>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        className={fieldClass}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...props}
      />
    </label>
  )
}
function Progress({ step }: { step: number }) {
  const steps = ["Personal details", "Documents & bank", "Review & verify"]
  return (
    <div className="mb-6 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-maroon">
          Application progress
        </p>
        <p className="text-xs font-semibold text-brown-mid">
          Step {step} of {steps.length}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Registration progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={step}
        className="mb-4 h-1.5 overflow-hidden rounded-full bg-cream-dark"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-maroon via-maroon to-gold transition-[width] duration-500 ease-out"
          style={{ width: `${(step / steps.length) * 100}%` }}
        />
      </div>
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((title, i) => {
          const number = i + 1
          const completed = step > number
          const current = step === number
          return (
            <li
              key={title}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-2 rounded-xl px-2 py-2 text-[10px] font-semibold transition-all sm:gap-2.5 sm:px-3 sm:text-xs ${
                current
                  ? "bg-maroon text-white shadow-md shadow-maroon/15"
                  : completed
                    ? "bg-green-50 text-green-800"
                    : "bg-cream-dark/70 text-brown-mid"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  current
                    ? "bg-white/15 text-white"
                    : completed
                      ? "bg-green-100 text-green-800"
                      : "bg-white text-brown-mid"
                }`}
              >
                {completed ? "✓" : number}
              </span>
              <span className="leading-tight">{title}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function StudentRegisterForm() {
  const [otpSent, setOtpSent] = useState(false)
  const [personal, setPersonal] = useState(blankPersonal)
  const [bank, setBank] = useState(blankBank)
  const [step, setStep] = useState(1)
  const [photo, setPhoto] = useState<File | null>(null)
  const [aadhaar, setAadhaar] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [registration, setRegistration] = useState<{
    number: string
    status: string
  } | null>(null)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const photoUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : ""),
    [photo],
  )
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl)
    },
    [photoUrl],
  )
  const updatePersonal = <K extends keyof Personal,>(
    key: K,
    value: Personal[K],
  ) => {
    setPersonal((c) => ({ ...c, [key]: value }))
    setError("")
  }
  const updateBank = <K extends keyof Bank>(key: K, value: Bank[K]) => {
    setBank((c) => ({ ...c, [key]: value }))
    setError("")
  }
  const signInWithGoogle = async () => {
    if (!supabase) {
      setError("Supabase is not configured.")
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/register` },
    })
    if (error)
      setError("Google sign-in could not be started. Please try again.")
  }
  const age = ageAtEvent(personal.birthDate)
  const validatePersonal = () => {
    if (
      !personal.fullName.trim() ||
      !personal.fatherName.trim() ||
      !personal.birthDate ||
      !personal.gender ||
      !personal.email.trim() ||
      !personal.mobile.trim() ||
      !personal.schoolName.trim() ||
      !personal.educationLevel.trim() ||
      !personal.house.trim() ||
      !personal.street.trim() ||
      !personal.state ||
      !personal.district ||
      !personal.city.trim() ||
      !/^\d{6}$/.test(personal.pin)
    ) {
      setError(
        "Complete all required fields. PIN code must contain six digits.",
      )
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email.trim())) {
      setError("Enter a valid email address.")
      return false
    }
    if (
      !/^\+?[0-9 ()-]{7,20}$/.test(personal.mobile) ||
      (personal.alternateMobile &&
        !/^\+?[0-9 ()-]{7,20}$/.test(personal.alternateMobile))
    ) {
      setError("Enter a valid mobile number.")
      return false
    }
    if (age === null || age < 0) {
      setError("Enter a valid date of birth on or before 20 December 2026.")
      return false
    }
    if (
      personal.selectedCompetitions.length < 1 ||
      personal.selectedCompetitions.length > 2
    ) {
      setError("Choose one or two competition categories.")
      return false
    }
    if (age < 18 && !personal.parentalConsent) {
      setError(
        "A parent or guardian must provide consent for participants under 18.",
      )
      return false
    }
    setError("")
    return true
  }
  const validImage = (file: File) =>
    file.size <= 2 * 1024 * 1024 &&
    ["image/jpeg", "image/png"].includes(file.type)
  const validateStepTwo = () => {
    if (
      !bank.accountHolder.trim() ||
      !bank.bankName.trim() ||
      !bank.account ||
      !bank.confirmAccount ||
      !bank.ifsc.trim()
    ) {
      setError("Complete the required bank details.")
      return false
    }
    if (!/^\d{9,18}$/.test(bank.account)) {
      setError("Bank account number must contain 9–18 digits.")
      return false
    }
    if (bank.account !== bank.confirmAccount) {
      setError("Bank account numbers do not match.")
      return false
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(bank.ifsc.trim())) {
      setError("Enter a valid IFSC code.")
      return false
    }
    if (!photo || !validImage(photo)) {
      setError("Choose a JPG or PNG photo no larger than 2 MB.")
      return false
    }
    if (
      !aadhaar ||
      aadhaar.type !== "application/pdf" ||
      aadhaar.size > 5 * 1024 * 1024
    ) {
      setError("Choose an Aadhaar PDF no larger than 5 MB.")
      return false
    }
    setError("")
    return true
  }
  const requestCode = async () => {
    setError("")
    if (!supabase) {
      setError(
        "Registration is not connected. Please contact the event organizers.",
      )
      return
    }
    const { data: window, error: windowError } = await supabase
      .from("gjm_event_settings")
      .select(
        "registration_opens_at,registration_closes_at,registration_window_confirmed",
      )
      .eq("id", true)
      .maybeSingle()
    if (windowError || !window) {
      setError(
        "Mahotsav registration is not configured yet. Please contact the organizers.",
      )
      return
    }
    const now = Date.now()
    if (!window.registration_window_confirmed) {
      setError("Registration is not open yet.")
      return
    }
    if (now < new Date(window.registration_opens_at).getTime()) {
      setError(
        `Registration opens ${new Date(window.registration_opens_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.`,
      )
      return
    }
    if (now > new Date(window.registration_closes_at).getTime()) {
      setError("The participant registration window has closed.")
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (
      user?.email_confirmed_at &&
      user.email?.toLowerCase() === personal.email.trim().toLowerCase()
    ) {
      setSending(true)
      try {
        await finish()
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Could not securely submit registration.",
        )
      } finally {
        setSending(false)
      }
      return
    }
    setSending(true)
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: personal.email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    })
    setSending(false)
    if (sendError) {
      setError(
        "We could not send a verification code. Check your email and try again shortly.",
      )
      return
    }
    setOtpSent(true)
  }
  const finish = async () => {
    if (!supabase || !photo || !aadhaar)
      throw new Error("Registration files or Supabase session are unavailable.")
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (
      userError ||
      !user?.email_confirmed_at ||
      user.email?.toLowerCase() !== personal.email.trim().toLowerCase()
    )
      throw new Error(
        "Verify the same email address used in this registration.",
      )
    const { error: syncError } = await supabase.functions.invoke(
      "sync-supabase-profile",
    )
    if (syncError)
      throw new Error(
        "Your Supabase account could not be linked to the student service. Please try again.",
      )
    const { data: existing, error: lookupError } = await supabase
      .from("candidate_registrations")
      .select("registration_number,status")
      .eq("user_id", user.id)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (existing) {
      setRegistration({
        number: existing.registration_number,
        status: existing.status,
      })
      return
    }
    setSubmitting(true)
    try {
      const form = new FormData()
      if (!privacyConsent)
        throw new Error(
          "Please confirm the privacy and registration consent to continue.",
        )
      form.set(
        "registration",
        JSON.stringify({
          fullName: personal.fullName.trim(),
          fatherName: personal.fatherName.trim(),
          motherName: personal.motherName.trim() || null,
          birthDate: personal.birthDate,
          gender: personal.gender,
          email: personal.email.trim().toLowerCase(),
          mobile: personal.mobile.trim(),
          alternateMobile: personal.alternateMobile.trim() || null,
          schoolName: personal.schoolName.trim(),
          educationLevel: personal.educationLevel.trim(),
          house: personal.house.trim(),
          street: personal.street.trim(),
          country: personal.country,
          state: personal.state,
          district: personal.district,
          city: personal.city.trim(),
          pin: personal.pin,
          selectedCompetitions: personal.selectedCompetitions,
          parentalConsent: age! < 18 ? personal.parentalConsent : false,
          privacyConsent,
          accountHolder: bank.accountHolder.trim(),
          bankName: bank.bankName.trim(),
          accountNumber: bank.account,
          confirmAccount: bank.confirmAccount,
          ifsc: bank.ifsc.trim().toUpperCase(),
          branch: bank.branch.trim() || null,
        }),
      )
      form.set("photo", photo)
      form.set("aadhaar", aadhaar)
      const baseUrl = import.meta.env.VITE_SUPABASE_URL,
        publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      if (!accessToken || !baseUrl || !publicKey)
        throw new Error("Your Supabase session expired. Please sign in again.")
      const response = await fetch(
        `${baseUrl.replace(/\/$/, "")}/functions/v1/complete-student-registration`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: publicKey,
          },
          body: form,
        },
      )
      const data = await response.json()
      if (!response.ok || data?.error)
        throw new Error(data?.error || "Secure registration submission failed.")
      setRegistration({
        number: data.registration_number,
        status: data.status || "Pending",
      })
      sessionStorage.setItem("mpvvg_registered", "true")
    } finally {
      setSubmitting(false)
    }
  }

  if (otpSent)
    return (
      <OTPVerification
        email={personal.email.trim().toLowerCase()}
        purpose="registration"
        onVerified={async () => {
          await finish()
          setOtpSent(false)
        }}
        onBack={() => setOtpSent(false)}
      />
    )

  if (registration)
    return (
      <div className="min-h-screen bg-cream-dark px-4 py-12 flex items-center justify-center">
        <section className="w-full max-w-lg rounded-2xl border border-gold/30 bg-cream p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
            ✓
          </div>
          <h1
            style={{ fontFamily: "var(--font-display)" }}
            className="text-2xl font-bold text-maroon"
          >
            Registration received
          </h1>
          <p className="mt-2 text-sm text-brown-mid">
            Your email is verified. Organizers must approve your application
            before the exam.
          </p>
          <div className="mt-6 rounded-xl bg-cream-dark p-4 text-left">
            <p className="text-xs text-brown-mid">Registration number</p>
            <p className="mt-1 font-semibold text-brown">
              {registration.number}
            </p>
            <p className="mt-4 text-xs text-brown-mid">Review status</p>
            <p className="mt-1 font-semibold text-amber-700">
              {registration.status}
            </p>
          </div>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-xl bg-maroon px-5 py-3 text-sm font-semibold text-cream"
          >
            Continue to sign in
          </Link>
        </section>
      </div>
    )

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-cream-dark to-[#eee3d0] px-4 py-8 sm:py-12">
      <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-maroon/5 blur-3xl" />
      <div className="relative mx-auto max-w-4xl">
        <header className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-maroon to-[#76252a] text-2xl font-bold text-cream shadow-lg shadow-maroon/20 ring-4 ring-white/70">
            ॐ
          </div>
          <h1
            style={{ fontFamily: "var(--font-display)" }}
            className="text-2xl font-bold text-brown sm:text-3xl"
          >
            Geeta Jayanti Mahotsav 2026
          </h1>
          <p className="mt-2 text-sm text-brown-mid">
            Candidate registration · 20 December 2026
          </p>
        </header>
        <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-sm leading-relaxed text-brown-mid">
            You can verify by email OTP when you submit, or use Google to sign
            in first.
          </p>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="w-full shrink-0 rounded-xl border border-maroon/20 bg-white px-5 py-3 text-sm font-bold text-maroon shadow-sm transition hover:-translate-y-0.5 hover:border-maroon/40 hover:bg-maroon/[0.03] hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-maroon/15 sm:w-auto"
          >
            Continue with Google
          </button>
        </div>
        <Progress step={step} />
        <main className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-brown/5 ring-1 ring-brown/[0.03] backdrop-blur sm:p-8">
          {step === 1 && (
            <section>
              <h2 className="text-xl font-bold tracking-tight text-brown">
                1. Personal details and address
              </h2>
              <p className="mb-5 mt-1 text-xs text-brown-mid">
                Complete your candidate profile. Age is calculated for the event
                date.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={personal.fullName}
                  onChange={(v) => updatePersonal("fullName", v)}
                  required
                  autoComplete="name"
                />
                <Field
                  label="Father's name"
                  value={personal.fatherName}
                  onChange={(v) => updatePersonal("fatherName", v)}
                  required
                />
                <Field
                  label="Mother's name"
                  value={personal.motherName}
                  onChange={(v) => updatePersonal("motherName", v)}
                />
                <Field
                  label="Date of birth"
                  type="date"
                  value={personal.birthDate}
                  onChange={(v) => updatePersonal("birthDate", v)}
                  required
                  max="2026-12-20"
                />
                <label>
                  <span className={labelClass}>Gender *</span>
                  <select
                    className={fieldClass}
                    required
                    value={personal.gender}
                    onChange={(e) => updatePersonal("gender", e.target.value)}
                  >
                    <option value="">Select</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </select>
                </label>
                <Field
                  label="Student email"
                  type="email"
                  value={personal.email}
                  onChange={(v) => updatePersonal("email", v)}
                  required
                  autoComplete="email"
                />
                <Field
                  label="Mobile number"
                  type="tel"
                  value={personal.mobile}
                  onChange={(v) => updatePersonal("mobile", v)}
                  required
                  autoComplete="tel"
                />
                <Field
                  label="Alternate mobile"
                  type="tel"
                  value={personal.alternateMobile}
                  onChange={(v) => updatePersonal("alternateMobile", v)}
                />
                <Field
                  label="School / college"
                  value={personal.schoolName}
                  onChange={(v) => updatePersonal("schoolName", v)}
                  required
                />
                <Field
                  label="Class / course"
                  value={personal.educationLevel}
                  onChange={(v) => updatePersonal("educationLevel", v)}
                  required
                />
                <Field
                  label="House / building"
                  value={personal.house}
                  onChange={(v) => updatePersonal("house", v)}
                  required
                />
                <Field
                  label="Street / locality"
                  value={personal.street}
                  onChange={(v) => updatePersonal("street", v)}
                  required
                />
                <Field
                  label="Country"
                  value={personal.country}
                  onChange={(v) => updatePersonal("country", v)}
                  required
                />
                <label>
                  <span className={labelClass}>State / Union Territory *</span>
                  <select
                    className={fieldClass}
                    value={personal.state}
                    required
                    onChange={(e) =>
                      setPersonal((c) => ({
                        ...c,
                        state: e.target.value,
                        district: "",
                      }))
                    }
                  >
                    <option value="">Select state</option>
                    {indianStates.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={labelClass}>District *</span>
                  <select
                    className={fieldClass}
                    value={personal.district}
                    required
                    disabled={!personal.state}
                    onChange={(e) => updatePersonal("district", e.target.value)}
                  >
                    <option value="">
                      {personal.state
                        ? "Select district"
                        : "Select state first"}
                    </option>
                    {(indiaDistricts[personal.state] || []).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <Field
                  label="City / village"
                  value={personal.city}
                  onChange={(v) => updatePersonal("city", v)}
                  required
                />
                <Field
                  label="PIN code"
                  value={personal.pin}
                  onChange={(v) =>
                    updatePersonal("pin", v.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
              {age !== null && (
                <div className="mt-5 flex items-center gap-3 rounded-2xl border border-gold/20 bg-gradient-to-r from-amber-50 to-white px-4 py-3 shadow-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-lg text-maroon">
                    ✦
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brown-light">
                      Your age on event day
                    </p>
                    <p className="text-sm font-bold text-brown">
                      {age} years old
                      {age < 18 ? " · Parent/guardian consent required" : ""}
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-6 rounded-2xl border border-gold/20 bg-cream-dark/20 p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-brown">
                  Competition categories *
                </h3>
                <p className="mt-1 text-xs text-brown-mid">
                  Choose one or two existing categories.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {competitionOptions.map(([code, title]) => (
                    <label
                      key={code}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition duration-200 ${
                        personal.selectedCompetitions.includes(code)
                          ? "border-maroon/30 bg-maroon/[0.05] text-brown shadow-sm ring-1 ring-maroon/10"
                          : "border-transparent bg-white text-brown-mid hover:border-gold/40 hover:bg-amber-50/60"
                      } ${
                        !personal.selectedCompetitions.includes(code) &&
                        personal.selectedCompetitions.length >= 2
                          ? "cursor-not-allowed opacity-50"
                          : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={personal.selectedCompetitions.includes(code)}
                        disabled={
                          !personal.selectedCompetitions.includes(code) &&
                          personal.selectedCompetitions.length >= 2
                        }
                        onChange={(e) =>
                          updatePersonal(
                            "selectedCompetitions",
                            e.target.checked
                              ? [...personal.selectedCompetitions, code]
                              : personal.selectedCompetitions.filter(
                                  (x) => x !== code,
                                ),
                          )
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-maroon"
                      />
                      <span>{title}</span>
                    </label>
                  ))}
                </div>
                {age !== null && age < 18 && (
                  <label className="mt-4 flex gap-2 text-xs text-brown-mid">
                    <input
                      type="checkbox"
                      checked={personal.parentalConsent}
                      onChange={(e) =>
                        updatePersonal("parentalConsent", e.target.checked)
                      }
                    />
                    <span>Parent or guardian consent is provided. *</span>
                  </label>
                )}
              </div>
              <p className="mt-5 text-xs text-brown-light">
                State and district choices use the bundled reference list. The
                server validates the state/district pair when saving.
              </p>
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (validatePersonal()) setStep(2)
                  }}
                  className="rounded-xl bg-maroon px-6 py-3 text-sm font-semibold text-cream hover:bg-maroon-dark"
                >
                  Next: bank and documents →
                </button>
              </div>
            </section>
          )}
          {step === 2 && (
            <section>
              <h2 className="text-xl font-bold tracking-tight text-brown">
                2. Bank details and documents
              </h2>
              <p className="mb-5 mt-1 text-xs text-brown-mid">
                Account details are encrypted on the server. They are not stored
                in browser storage.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Account holder name"
                  value={bank.accountHolder}
                  onChange={(v) => updateBank("accountHolder", v)}
                  required
                />
                <Field
                  label="Bank name"
                  value={bank.bankName}
                  onChange={(v) => updateBank("bankName", v)}
                  required
                />
                <Field
                  label="Bank account number"
                  type="password"
                  value={bank.account}
                  onChange={(v) =>
                    updateBank("account", v.replace(/\D/g, "").slice(0, 18))
                  }
                  required
                  autoComplete="new-password"
                  inputMode="numeric"
                />
                <Field
                  label="Confirm account number"
                  type="password"
                  value={bank.confirmAccount}
                  onChange={(v) =>
                    updateBank(
                      "confirmAccount",
                      v.replace(/\D/g, "").slice(0, 18),
                    )
                  }
                  required
                  autoComplete="new-password"
                  inputMode="numeric"
                />
                <Field
                  label="IFSC code"
                  value={bank.ifsc}
                  onChange={(v) =>
                    updateBank("ifsc", v.toUpperCase().slice(0, 11))
                  }
                  required
                />
                <Field
                  label="Branch name (optional)"
                  value={bank.branch}
                  onChange={(v) => updateBank("branch", v)}
                />
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-dashed border-gold/40 bg-cream-dark/20 p-4 transition hover:border-gold/70 hover:bg-amber-50/50">
                  <label className={labelClass}>
                    Student photograph · JPG/PNG, max 2 MB *
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      if (f && !validImage(f)) {
                        setError(
                          "Photo must be JPG or PNG and no larger than 2 MB.",
                        )
                        e.target.value = ""
                        return
                      }
                      setError("")
                      setPhoto(f)
                    }}
                    className="block w-full text-xs text-brown-mid file:mr-3 file:rounded-lg file:border-0 file:bg-cream-dark file:px-3 file:py-2"
                  />
                  {photo && (
                    <div className="mt-3 flex items-center gap-3">
                      <img
                        src={photoUrl}
                        alt="Selected student photo preview"
                        className="h-20 w-20 rounded-lg object-cover"
                      />
                      <span className="break-all text-xs text-brown-mid">
                        {photo.name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-dashed border-gold/40 bg-cream-dark/20 p-4 transition hover:border-gold/70 hover:bg-amber-50/50">
                  <label className={labelClass}>
                    Aadhaar card PDF · max 5 MB *
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      if (
                        f &&
                        (f.type !== "application/pdf" ||
                          f.size > 5 * 1024 * 1024)
                      ) {
                        setError(
                          "Aadhaar file must be a PDF no larger than 5 MB.",
                        )
                        e.target.value = ""
                        return
                      }
                      setError("")
                      setAadhaar(f)
                    }}
                    className="block w-full text-xs text-brown-mid file:mr-3 file:rounded-lg file:border-0 file:bg-cream-dark file:px-3 file:py-2"
                  />
                  {aadhaar && (
                    <p className="mt-3 break-all text-xs text-brown-mid">
                      Selected: {aadhaar.name}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-brown-light">
                    Stored privately; no public document links are created.
                  </p>
                </div>
              </div>
              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <div className="mt-5 flex justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setError("")
                    setStep(1)
                  }}
                  className="rounded-xl border border-maroon px-5 py-3 text-sm font-semibold text-maroon"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (validateStepTwo()) setStep(3)
                  }}
                  className="rounded-xl bg-maroon px-6 py-3 text-sm font-semibold text-cream hover:bg-maroon-dark"
                >
                  Review details →
                </button>
              </div>
            </section>
          )}
          {step === 3 && (
            <section>
              <h2 className="text-xl font-bold tracking-tight text-brown">
                3. Review and continue
              </h2>
              <p className="mb-5 mt-1 text-xs text-brown-mid">
                Review your details. Supabase verifies your email during sign in
                with Google or email OTP.
              </p>
              <div className="grid gap-3 rounded-2xl border border-gold/15 bg-cream-dark/35 p-4 text-sm sm:grid-cols-2 sm:p-5">
                {[
                  ["Name", personal.fullName],
                  ["Email", personal.email],
                  ["Father", personal.fatherName],
                  ["Date of birth", personal.birthDate],
                  ["Mobile", personal.mobile],
                  [
                    "School / course",
                    `${personal.schoolName} · ${personal.educationLevel}`,
                  ],
                  [
                    "Address",
                    `${personal.house}, ${personal.street}, ${personal.city}, ${personal.district}, ${personal.state} ${personal.pin}`,
                  ],
                  [
                    "Categories",
                    competitionOptions
                      .filter(([c]) =>
                        personal.selectedCompetitions.includes(c),
                      )
                      .map(([, t]) => t)
                      .join(", "),
                  ],
                  [
                    "Bank",
                    `${bank.bankName} · ••••${bank.account.slice(-4)} · ${bank.ifsc.toUpperCase()}`,
                  ],
                  ["Photograph", photo?.name || "Missing"],
                  ["Aadhaar PDF", aadhaar?.name || "Missing"],
                ].map(([k, v]) => (
                  <p key={k} className="break-words text-xs text-brown-mid">
                    <strong className="text-brown">{k}:</strong> {v}
                  </p>
                ))}
              </div>
              <p className="mt-4 text-xs text-brown-mid">
                Submitting confirms that these details are accurate and
                authorizes their use for event registration and administration.
                Aadhaar and bank data are sensitive; bank account values are
                encrypted and Aadhaar is private to authorized administrators.
              </p>
              <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-brown-mid">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="mt-0.5 accent-maroon"
                />
                <span>
                  I confirm these details are accurate and consent to the use of
                  my information and documents for Geeta Jayanti Mahotsav
                  registration and administration. Bank account numbers are
                  encrypted; Aadhaar is stored privately. *
                </span>
              </label>
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setError("")
                    setStep(2)
                  }}
                  className="rounded-xl border border-maroon px-5 py-3 text-sm font-semibold text-maroon"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  disabled={sending || submitting || !privacyConsent}
                  onClick={() => void requestCode()}
                  className="rounded-xl bg-maroon px-6 py-3 text-sm font-semibold text-cream hover:bg-maroon-dark disabled:opacity-60"
                >
                  {sending
                    ? "Sending verification code…"
                    : submitting
                      ? "Securely submitting…"
                      : "Submit registration"}
                </button>
              </div>
              <p className="mt-4 text-center text-xs text-brown-mid">
                Already registered?{" "}
                <Link to="/login" className="font-semibold text-maroon">
                  Sign in
                </Link>
              </p>
            </section>
          )}
        </main>
        <footer className="mt-4 text-center text-[11px] text-brown-light">
          Account verification and recovery are handled securely by Supabase.
          This website never collects a password.
        </footer>
      </div>
    </div>
  )
}

export default function StudentRegister() {
  if (!supabase)
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-dark px-4">
        <p
          role="alert"
          className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          Student registration is not configured yet. Set the Supabase project
          URL and publishable key to continue.
        </p>
      </div>
    )
  return <StudentRegisterForm />
}
