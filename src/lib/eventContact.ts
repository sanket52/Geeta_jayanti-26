import { supabase } from "./supabase";

export type EventContact = {
  organization_name: string;
  organization_name_hi: string;
  contact_phone_1: string;
  contact_phone_2: string;
  support_email: string;
  support_email_verified: boolean;
  organization_address: string;
  phone_1_whatsapp_confirmed: boolean;
  phone_2_whatsapp_confirmed: boolean;
};

export const defaultEventContact: EventContact = {
  organization_name: "Maharshi Panini Ved Vedang Vidhyapeeth Gurukul",
  organization_name_hi: "महर्षि पाणिनि वेद वेदांग विद्यापीठ गुरुकुल",
  contact_phone_1: "9456984723",
  contact_phone_2: "7500790387",
  support_email: "",
  support_email_verified: false,
  organization_address: "RB-22, Sector 36, Greater Noida, Uttar Pradesh, India.",
  phone_1_whatsapp_confirmed: false,
  phone_2_whatsapp_confirmed: false,
};

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function loadEventContact(): Promise<EventContact> {
  if (!supabase) return defaultEventContact;
  const { data, error } = await supabase.from("gjm_event_settings").select("organization_name, organization_name_hi, contact_phone_1, contact_phone_2, support_email, support_email_verified, organization_address, phone_1_whatsapp_confirmed, phone_2_whatsapp_confirmed").eq("id", true).maybeSingle();
  if (error || !data) return defaultEventContact;
  return {
    organization_name: data.organization_name || defaultEventContact.organization_name,
    organization_name_hi: data.organization_name_hi || defaultEventContact.organization_name_hi,
    contact_phone_1: data.contact_phone_1 || defaultEventContact.contact_phone_1,
    contact_phone_2: data.contact_phone_2 || defaultEventContact.contact_phone_2,
    support_email: data.support_email_verified && isValidEmail(data.support_email || "") ? data.support_email.trim() : "",
    support_email_verified: Boolean(data.support_email_verified),
    organization_address: data.organization_address || defaultEventContact.organization_address,
    phone_1_whatsapp_confirmed: Boolean(data.phone_1_whatsapp_confirmed),
    phone_2_whatsapp_confirmed: Boolean(data.phone_2_whatsapp_confirmed),
  };
}

export function phoneHref(phone: string) {
  return `tel:+91${phone.replace(/\D/g, "")}`;
}

export function whatsappHref(phone: string) {
  return `https://wa.me/91${phone.replace(/\D/g, "")}`;
}

export function mapsHref(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
