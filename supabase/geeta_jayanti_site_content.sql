-- Public carousel content, managed by administrators. Store images in a public
-- Supabase Storage bucket or use an approved HTTPS image URL.
create table if not exists public.gjm_home_carousel_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null unique,
  alt_text text not null,
  caption text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gjm_home_carousel_images enable row level security;
drop policy if exists "Public reads active homepage carousel images" on public.gjm_home_carousel_images;
create policy "Public reads active homepage carousel images" on public.gjm_home_carousel_images for select to anon, authenticated using (active or public.current_user_role() = 'admin');
drop policy if exists "Admins manage homepage carousel images" on public.gjm_home_carousel_images;
create policy "Admins manage homepage carousel images" on public.gjm_home_carousel_images for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
revoke all on public.gjm_home_carousel_images from anon, authenticated;
grant select on public.gjm_home_carousel_images to anon, authenticated;
grant insert, update, delete on public.gjm_home_carousel_images to authenticated;

insert into public.gjm_home_carousel_images(image_url, alt_text, caption, sort_order, active) values
('/images/kurukshetra-dialogue.svg', 'Symbolic illustration of the dialogue at Kurukshetra', 'The dialogue at Kurukshetra', 1, true),
('/images/gita-study.svg', 'Original illustration of an open book representing Bhagavad Gita study', 'Study and reflection', 2, true),
('/images/vedic-learning.svg', 'Original illustration representing Vedic learning traditions', 'Vedic knowledge traditions', 3, true),
('/images/modern-learning.svg', 'Original illustration of a computer and an open book', 'Tradition meets technology', 4, true)
on conflict do nothing;
