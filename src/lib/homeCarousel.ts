import { supabase } from "./supabase";

export type HomeSlide = { image_url: string; alt_text: string; caption: string; sort_order: number };
export const defaultHomeSlides: HomeSlide[] = [
  { image_url: "/images/kurukshetra-dialogue.svg", alt_text: "Symbolic illustration of the dialogue at Kurukshetra", caption: "The dialogue at Kurukshetra", sort_order: 1 },
  { image_url: "/images/gita-study.svg", alt_text: "Original illustration of an open book representing Bhagavad Gita study", caption: "Study and reflection", sort_order: 2 },
  { image_url: "/images/vedic-learning.svg", alt_text: "Original illustration representing Vedic learning traditions", caption: "Vedic knowledge traditions", sort_order: 3 },
  { image_url: "/images/modern-learning.svg", alt_text: "Original illustration of a computer and an open book", caption: "Tradition meets technology", sort_order: 4 },
];

export async function loadHomeSlides(): Promise<HomeSlide[]> {
  if (!supabase) return defaultHomeSlides;
  const { data, error } = await supabase.from("gjm_home_carousel_images").select("image_url,alt_text,caption,sort_order").eq("active", true).order("sort_order");
  return error || !data?.length ? defaultHomeSlides : data as HomeSlide[];
}
