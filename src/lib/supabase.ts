import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// One browser client owns the Supabase Auth session and all data requests.
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null;
export const ORAL_VIDEO_BUCKET = "oral-exam-videos";

export async function getSupabaseAccessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getSupabaseUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user?.id ?? null;
}

export function getSupabaseSetupError() {
  return "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";
}
