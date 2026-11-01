import { useEffect, useState } from "react";
import EventContactLinks from "../components/EventContactLinks";
import SupportRequestForm from "../components/SupportRequestForm";
import { defaultEventContact, loadEventContact, type EventContact } from "../lib/eventContact";

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(true);
  const [contact, setContact] = useState<EventContact>(defaultEventContact);
  useEffect(() => { void loadEventContact().then(setContact); }, []);

  return (
    <div>
      <section className="bg-maroon-dark text-cream py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="text-gold text-xs font-semibold uppercase tracking-widest">Get In Touch</span>
          <h1 style={{ fontFamily: "var(--font-display)" }} className="text-4xl font-bold mt-2 mb-3">Contact Us</h1>
          <p className="text-cream/70">We are here to answer your questions about admissions, competitions, and Vedic education.</p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          {sent ? (
            <div className="bg-cream border-2 border-gold/30 rounded-2xl p-10 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 style={{ fontFamily: "var(--font-display)" }} className="text-xl font-bold text-brown mb-2">Message Sent!</h3>
              <p className="text-brown-mid text-sm mb-6">{confirmationSent ? "We have received your support request and sent a confirmation email." : "Our team received your request, but we could not send the confirmation email. You can call us using the numbers shown on this page."}</p>
              <button onClick={() => setSent(false)}
                className="bg-maroon text-cream px-6 py-2.5 rounded font-semibold text-sm hover:bg-maroon-dark transition-colors">
                Send Another
              </button>
            </div>
          ) : (
            <SupportRequestForm contact={contact} onSuccess={(confirmation) => { setConfirmationSent(confirmation); setSent(true); }} />
          )}
        </div>

        <div className="space-y-5">
          <div className="bg-cream-dark rounded-xl p-5 border border-gold/20 text-sm leading-relaxed text-brown-mid">
            <h2 className="mb-3 font-semibold text-brown">Official event support</h2>
            <EventContactLinks contact={contact} />
          </div>
        </div>
      </div>
    </div>
  );
}
