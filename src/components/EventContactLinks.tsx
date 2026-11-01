import type { EventContact } from "../lib/eventContact";
import { mapsHref, phoneHref, whatsappHref } from "../lib/eventContact";

export default function EventContactLinks({ contact, className = "", language = "en" }: { contact: EventContact; className?: string; language?: "en" | "hi" }) {
  const labels = language === "hi"
    ? { numbers: "संपर्क नंबर:", address: "पता:", directions: "रास्ता देखें", email: "ईमेल:" }
    : { numbers: "Contact numbers:", address: "Address:", directions: "Get directions", email: "Email:" };
  const phones = [
    { number: contact.contact_phone_1, whatsapp: contact.phone_1_whatsapp_confirmed },
    { number: contact.contact_phone_2, whatsapp: contact.phone_2_whatsapp_confirmed },
  ];
  return <div className={`space-y-3 ${className}`}>
    <p className="font-semibold">{language === "hi" ? `संस्था: ${contact.organization_name_hi}` : `Organization: ${contact.organization_name}`}</p>
    <div><span className="font-medium">{labels.numbers}</span><ul className="mt-1 space-y-1">{phones.map(({ number, whatsapp }, index) => <li key={`${number}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1"><a href={phoneHref(number)} className="font-medium underline underline-offset-2">+91 {number}</a>{whatsapp && <a href={whatsappHref(number)} target="_blank" rel="noreferrer" className="text-xs font-semibold underline underline-offset-2">WhatsApp</a>}</li>)}</ul></div>
    <div><span className="font-medium">{labels.address}</span><br/><a href={mapsHref(contact.organization_address)} target="_blank" rel="noreferrer" className="underline underline-offset-2">{contact.organization_address} · {labels.directions}</a></div>
    {contact.support_email && <div><span className="font-medium">{labels.email}</span> <a href={`mailto:${contact.support_email}`} className="underline underline-offset-2">{contact.support_email}</a></div>}
  </div>;
}
