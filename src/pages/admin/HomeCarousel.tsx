import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Slide = { id: string; image_url: string; alt_text: string; caption: string; sort_order: number; active: boolean };
type Draft = Omit<Slide, "id">;
const empty: Draft = { image_url: "", alt_text: "", caption: "", sort_order: 1, active: true };

export default function AdminHomeCarousel() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase is not configured."); return; }
    const { data, error: queryError } = await supabase.from("gjm_home_carousel_images").select("*").order("sort_order");
    if (queryError) setError("Could not load carousel content. Apply supabase/geeta_jayanti_site_content.sql first.");
    else { setSlides((data ?? []) as Slide[]); setError(""); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const edit = (slide?: Slide) => { setEditing(slide?.id ?? null); setDraft(slide ? { image_url: slide.image_url, alt_text: slide.alt_text, caption: slide.caption, sort_order: slide.sort_order, active: slide.active } : { ...empty, sort_order: slides.length + 1 }); setOpen(true); setError(""); setNotice(""); };
  const save = async () => {
    if (!supabase) return;
    const url = draft.image_url.trim();
    if (!url || !draft.alt_text.trim() || !draft.caption.trim() || !Number.isInteger(draft.sort_order) || draft.sort_order < 0 || (!url.startsWith("/") && !/^https:\/\//i.test(url))) { setError("Use a local image path or HTTPS image URL, and provide alt text, caption, and a valid order."); return; }
    setBusy(true); setError("");
    const values = { ...draft, image_url: url, alt_text: draft.alt_text.trim(), caption: draft.caption.trim(), updated_at: new Date().toISOString() };
    const { error: saveError } = editing ? await supabase.from("gjm_home_carousel_images").update(values).eq("id", editing) : await supabase.from("gjm_home_carousel_images").insert(values);
    setBusy(false);
    if (saveError) { setError(saveError.message); return; }
    setOpen(false); setNotice("Homepage carousel updated."); await load();
  };
  const remove = async (slide: Slide) => {
    if (!supabase || !window.confirm(`Remove “${slide.caption}” from the homepage carousel?`)) return;
    const { error: deleteError } = await supabase.from("gjm_home_carousel_images").delete().eq("id", slide.id);
    if (deleteError) setError(deleteError.message); else { setNotice("Carousel image removed."); await load(); }
  };
  return <div className="space-y-5"><header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><span className="text-xs font-bold uppercase tracking-widest text-gold">Website content</span><h1 className="mt-1 text-2xl font-bold text-brown">Homepage carousel</h1><p className="mt-1 text-sm text-brown-mid">Use an image stored in public Supabase Storage or an HTTPS image URL. Add descriptive alt text.</p></div><button onClick={() => edit()} className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream">Add image</button></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {open && <section className="grid gap-3 rounded-2xl border border-gold/30 bg-cream p-5 sm:grid-cols-2"><label className="text-xs font-semibold text-brown-mid sm:col-span-2">Image URL or local path<input value={draft.image_url} onChange={(event) => setDraft({ ...draft, image_url: event.target.value })} placeholder="/images/your-image.svg or https://…" className="mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm"/></label><label className="text-xs font-semibold text-brown-mid">Alternative text<input value={draft.alt_text} onChange={(event) => setDraft({ ...draft, alt_text: event.target.value })} className="mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm"/></label><label className="text-xs font-semibold text-brown-mid">Caption<input value={draft.caption} onChange={(event) => setDraft({ ...draft, caption: event.target.value })} className="mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm"/></label><label className="text-xs font-semibold text-brown-mid">Order<input type="number" min="0" value={draft.sort_order} onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-cream-dark bg-white px-3 py-2 text-sm"/></label><label className="flex items-center gap-2 pt-5 text-sm text-brown-mid"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })}/> Show on homepage</label><div className="flex gap-2 sm:col-span-2"><button onClick={() => void save()} disabled={busy} className="rounded-lg bg-maroon px-4 py-2 text-sm font-semibold text-cream disabled:opacity-50">{busy ? "Saving…" : "Save image"}</button><button onClick={() => setOpen(false)} className="rounded-lg border border-cream-dark px-4 py-2 text-sm text-brown">Cancel</button></div></section>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{slides.map((slide) => <article key={slide.id} className="overflow-hidden rounded-2xl border border-cream-dark bg-white"><img src={slide.image_url} alt={slide.alt_text} loading="lazy" className="aspect-[16/9] w-full bg-cream object-contain"/><div className="p-4"><div className="flex justify-between gap-2"><h2 className="font-bold text-brown">{slide.caption}</h2><span className="text-xs text-brown-mid">Order {slide.sort_order}</span></div><p className="mt-1 text-xs text-brown-mid">{slide.active ? "Visible" : "Hidden"} · {slide.alt_text}</p><div className="mt-3 flex gap-4 text-xs font-semibold"><button onClick={() => edit(slide)} className="text-maroon">Edit</button><button onClick={() => void remove(slide)} className="text-red-700">Delete</button></div></div></article>)}</div>
  </div>;
}
