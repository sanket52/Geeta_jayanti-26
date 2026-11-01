import { supabase } from "./supabase";

export const supportCategories = [
  "Registration", "Login / OTP Problem", "Competition", "Examination",
  "Document Upload", "Result / Certificate", "Technical Issue", "Other",
] as const;

export type SupportRequest = {
  requestId: string;
  name: string;
  email: string;
  mobile: string;
  subject: string;
  message: string;
  category: (typeof supportCategories)[number];
  website: string;
  formStartedAt: number;
};

export async function submitSupportRequest(request: SupportRequest) {
  if (!supabase) return { accepted: false, confirmationSent: false, error: "Email support is not configured. Please call the event support numbers." };
  const { data, error } = await supabase.functions.invoke("student-support-request", { body: request });
  if (error) {
    let providerMessage = "";
    try { providerMessage = (await error.context?.json())?.error || ""; } catch { /* The function may be unreachable. */ }
    return { accepted: false, confirmationSent: false, error: providerMessage || "We could not send your request. Please call the event support numbers." };
  }
  return {
    accepted: Boolean(data?.accepted),
    confirmationSent: Boolean(data?.confirmationSent),
    error: typeof data?.error === "string" ? data.error : "We could not send your request. Please call the event support numbers.",
  };
}
