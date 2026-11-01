import { useState } from "react";

const AMOUNTS = [500, 1100, 2100, 5100, 11000, 21000];

export default function Donate() {
  const [amount, setAmount] = useState<number | "">(1100);
  const [custom, setCustom] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", mobile: "", address: "", pan: "", purpose: "General", paymentMode: "UPI",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-6">
        <div className="bg-cream border-2 border-gold/40 rounded-2xl p-10 max-w-md w-full text-center shadow-xl">
          <div className="text-6xl mb-4">🙏</div>
          <h2 style={{ fontFamily: "var(--font-display)" }} className="text-2xl font-bold text-maroon mb-2">
            Donation Received!
          </h2>
          <p className="text-brown-mid mb-4 text-sm">
            Thank you, <span className="font-semibold text-brown">{form.name}</span>, for your generous contribution.
          </p>
          <div className="bg-cream-dark rounded-xl p-4 text-left text-sm space-y-2 mb-6">
            <div className="flex justify-between"><span className="text-brown-mid">Receipt No.</span><span className="font-semibold text-brown">GURUKUL-2026-000042</span></div>
            <div className="flex justify-between"><span className="text-brown-mid">Amount</span><span className="font-semibold text-maroon">₹{Number(amount).toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-brown-mid">Date</span><span className="font-semibold text-brown">07 September 2026</span></div>
            <div className="flex justify-between"><span className="text-brown-mid">Purpose</span><span className="font-semibold text-brown">{form.purpose}</span></div>
          </div>
          <p className="text-xs text-brown-mid mb-6">A confirmation email with your receipt has been sent to {form.email}</p>
          <div className="flex gap-3">
            <button className="flex-1 bg-maroon text-cream py-3 rounded font-semibold text-sm hover:bg-maroon-dark transition-colors">
              ⬇ Download Receipt
            </button>
            <button onClick={() => setSubmitted(false)} className="flex-1 border border-maroon text-maroon py-3 rounded font-semibold text-sm hover:bg-maroon/5 transition-colors">
              Donate Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-maroon-dark text-cream py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="text-gold text-xs font-semibold uppercase tracking-widest">Support Our Mission</span>
          <h1 style={{ fontFamily: "var(--font-display)" }} className="text-4xl font-bold mt-2 mb-3">Donate to the Gurukul</h1>
          <p className="text-cream/70">Your contribution helps preserve Vedic knowledge and support deserving students from rural India.</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Donation form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-cream border border-cream-dark rounded-2xl p-8 shadow-sm">
            <h2 style={{ fontFamily: "var(--font-display)" }} className="text-xl font-bold text-brown mb-6">Donation Details</h2>

            {/* Purpose */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-brown mb-2">Donation Purpose</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {["General", "Student Scholarship", "Sanskrit Education", "Library Development", "Competition", "Infrastructure"].map((p) => (
                  <label key={p} className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-all text-sm ${form.purpose === p ? "border-maroon bg-maroon/5 text-maroon" : "border-cream-dark text-brown-mid hover:border-gold/40"}`}>
                    <input type="radio" name="purpose" value={p} checked={form.purpose === p} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className="accent-maroon" />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-brown mb-2">Select Amount (₹)</label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3">
                {AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setAmount(a); setCustom(false); }}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${amount === a && !custom ? "bg-maroon text-cream border-maroon" : "border-cream-dark text-brown hover:border-gold/40"}`}
                  >
                    ₹{a.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={custom}
                  onChange={(e) => setCustom(e.target.checked)}
                  className="accent-maroon"
                  id="custom-amount"
                />
                <label htmlFor="custom-amount" className="text-sm text-brown-mid">Enter custom amount</label>
              </div>
              {custom && (
                <input
                  type="number"
                  placeholder="Enter amount in ₹"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                  className="mt-2 w-full border border-cream-dark rounded-lg px-4 py-3 text-sm text-brown focus:border-gold focus:outline-none"
                />
              )}
            </div>

            {/* Personal info */}
            <h3 className="text-sm font-semibold text-brown mb-4 border-t border-cream-dark pt-6">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {[
                { key: "name", label: "Full Name *", placeholder: "Your full name" },
                { key: "email", label: "Email Address *", placeholder: "you@example.com", type: "email" },
                { key: "mobile", label: "Mobile Number *", placeholder: "Your phone number", type: "tel" },
                { key: "pan", label: "PAN Number (optional)", placeholder: "ABCDE1234F" },
              ].map(({ key, label, placeholder, type = "text" }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-brown-mid mb-1">{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="w-full border border-cream-dark rounded-lg px-4 py-2.5 text-sm text-brown focus:border-gold focus:outline-none placeholder:text-brown-light"
                    required={!label.includes("optional")}
                  />
                </div>
              ))}
            </div>
            <div className="mb-6">
              <label className="block text-xs font-medium text-brown-mid mb-1">Address</label>
              <textarea
                placeholder="Your address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                className="w-full border border-cream-dark rounded-lg px-4 py-2.5 text-sm text-brown focus:border-gold focus:outline-none placeholder:text-brown-light resize-none"
              />
            </div>

            {/* Payment */}
            <h3 className="text-sm font-semibold text-brown mb-4 border-t border-cream-dark pt-4">Payment Method</h3>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {["UPI", "Net Banking", "Card"].map((mode) => (
                <label key={mode} className={`flex flex-col items-center gap-1 border rounded-xl p-4 cursor-pointer transition-all ${form.paymentMode === mode ? "border-maroon bg-maroon/5" : "border-cream-dark hover:border-gold/40"}`}>
                  <input type="radio" name="paymentMode" value={mode} checked={form.paymentMode === mode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })} className="sr-only" />
                  <span className="text-2xl">{mode === "UPI" ? "📱" : mode === "Net Banking" ? "🏦" : "💳"}</span>
                  <span className="text-xs font-medium text-brown">{mode}</span>
                </label>
              ))}
            </div>

            <button
              type="submit"
              className="w-full bg-maroon hover:bg-maroon-dark text-cream py-4 rounded-xl font-semibold text-base transition-colors shadow-lg"
            >
              Donate ₹{amount ? Number(amount).toLocaleString("en-IN") : "—"} Now 🙏
            </button>
            <p className="text-xs text-brown-mid text-center mt-3">
              Your donation is eligible for 80G tax exemption. Receipt will be emailed immediately.
            </p>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-cream-dark rounded-2xl p-6 border border-gold/20">
            <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold text-brown mb-4">Bank Transfer Details</h3>
            <div className="space-y-3 text-sm">
              {[
                ["Account Name", "Maharshi Panini Ved Vedang Vidhyapeeth Gurukul Trust"],
                ["Bank", "State Bank of India"],
                ["Account No.", "XXXXXXXX8472"],
                ["IFSC Code", "SBIN0001234"],
                ["Branch", "Greater Noida Branch"],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <span className="text-brown-mid text-xs">{k}</span>
                  <span className="font-medium text-brown">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-maroon text-cream rounded-2xl p-6">
            <h3 style={{ fontFamily: "var(--font-display)" }} className="font-bold mb-4">Impact of Your Donation</h3>
            <ul className="space-y-3 text-sm">
              {[
                ["₹500", "Study materials for one student"],
                ["₹1,100", "One month's scholarship"],
                ["₹5,100", "Sanskrit manuscript digitization"],
                ["₹11,000", "Full year scholarship"],
                ["₹21,000+", "Sponsor a student's education"],
              ].map(([amt, impact]) => (
                <li key={amt} className="flex gap-3">
                  <span className="text-gold font-semibold shrink-0">{amt}</span>
                  <span className="text-cream/80">{impact}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-cream-dark rounded-2xl p-6 border border-gold/20 text-sm">
            <h4 className="font-semibold text-brown mb-2">📋 Recent Donors</h4>
            {[
              { name: "Smt. Anita Verma", amt: "₹5,100", time: "2 hours ago" },
              { name: "Anonymous", amt: "₹21,000", time: "Yesterday" },
              { name: "Sh. Rajesh Agarwal", amt: "₹1,100", time: "2 days ago" },
            ].map((d) => (
              <div key={d.name} className="flex justify-between py-2 border-b border-cream-dark last:border-0">
                <div>
                  <div className="font-medium text-brown text-xs">{d.name}</div>
                  <div className="text-brown-light text-[10px]">{d.time}</div>
                </div>
                <span className="text-maroon font-semibold text-sm">{d.amt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
