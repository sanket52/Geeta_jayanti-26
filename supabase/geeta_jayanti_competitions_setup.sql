-- Geeta Jayanti Mahotsav 2026 competition foundation.
-- Apply geeta_jayanti_exam_setup.sql first. Never expose the service-role key.

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.gjm_event_settings (
  id boolean primary key default true check (id),
  event_date date not null default date '2026-12-20',
  registration_opens_at timestamptz not null default timestamptz '2026-11-15 00:00:00+05:30',
  registration_closes_at timestamptz not null default timestamptz '2026-12-01 23:59:59+05:30',
  submissions_close_at timestamptz not null default timestamptz '2026-12-12 23:59:00+05:30',
  judging_opens_at timestamptz not null default timestamptz '2026-12-13 00:00:00+05:30',
  judging_closes_at timestamptz not null default timestamptz '2026-12-16 23:59:59+05:30',
  results_at timestamptz not null default timestamptz '2026-12-17 00:00:00+05:30',
  preparations_start_at timestamptz not null default timestamptz '2026-12-18 00:00:00+05:30',
  preparations_end_at timestamptz not null default timestamptz '2026-12-19 23:59:59+05:30',
  registration_window_confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.gjm_event_settings (id) values (true) on conflict (id) do nothing;
alter table public.gjm_event_settings enable row level security;
create policy "Event schedule is public" on public.gjm_event_settings for select to anon, authenticated using (true);
create policy "Admins manage event schedule" on public.gjm_event_settings for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
revoke all on public.gjm_event_settings from anon, authenticated;
grant select on public.gjm_event_settings to anon, authenticated;
grant update on public.gjm_event_settings to authenticated;

create table if not exists public.gjm_competitions (
  code text primary key,
  title text not null,
  format text not null,
  is_open boolean not null default true,
  quiz_duration_minutes integer,
  max_video_seconds integer,
  max_upload_bytes bigint not null default 524288000,
  updated_at timestamptz not null default now(),
  check (quiz_duration_minutes is null or quiz_duration_minutes > 0),
  check (max_video_seconds is null or max_video_seconds > 0),
  check (max_upload_bytes > 0)
);
insert into public.gjm_competitions (code, title, format, quiz_duration_minutes, max_video_seconds) values
  ('shloka_uccharan', 'Shloka Uccharan', 'Video / oral', null, 180),
  ('geeta_quiz', 'Rashtriya Geeta Gyan Quiz', 'Online quiz', 25, null),
  ('digital_bhashan', 'Digital Bhashan Competition', 'Speech video', null, 300),
  ('geeta_art', 'Geeta-Inspired Drawing / Painting', 'Artwork and process video', null, 30)
on conflict (code) do update set title = excluded.title, format = excluded.format;
alter table public.gjm_competitions enable row level security;
create policy "Competition definitions are public" on public.gjm_competitions for select to anon, authenticated using (true);
create policy "Admins configure competitions" on public.gjm_competitions for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
revoke all on public.gjm_competitions from anon, authenticated;
grant select on public.gjm_competitions to anon, authenticated;
grant update on public.gjm_competitions to authenticated;

alter table public.candidate_registrations
  add column if not exists birth_date date,
  add column if not exists age_category text,
  add column if not exists parental_consent boolean not null default false,
  add column if not exists selected_competition_codes text[] not null default '{}',
  add column if not exists age_rule_review_required boolean not null default false;

create table if not exists public.gjm_age_category_rules (
  category text primary key,
  minimum_age integer not null check (minimum_age >= 0),
  maximum_age integer check (maximum_age is null or maximum_age >= minimum_age),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.gjm_age_category_rules (category, minimum_age, maximum_age) values
 ('Sub-Junior',0,12),('Junior',13,17),('Senior',19,29),('Open',31,null)
on conflict (category) do nothing;
alter table public.gjm_age_category_rules enable row level security;
create policy "Age category rules are public" on public.gjm_age_category_rules for select to anon, authenticated using (true);
create policy "Admins configure age categories" on public.gjm_age_category_rules for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
revoke all on public.gjm_age_category_rules from anon, authenticated;
grant select on public.gjm_age_category_rules to anon, authenticated;
grant update on public.gjm_age_category_rules to authenticated;
create or replace function private.prevent_gjm_age_range_overlap()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_active and exists (
    select 1 from public.gjm_age_category_rules other
    where other.category <> new.category and other.is_active
      and numrange(new.minimum_age::numeric, case when new.maximum_age is null then null else new.maximum_age::numeric + 1 end, '[)') &&
          numrange(other.minimum_age::numeric, case when other.maximum_age is null then null else other.maximum_age::numeric + 1 end, '[)')
  ) then raise exception 'Age category ranges cannot overlap'; end if;
  return new;
end;
$$;
drop trigger if exists prevent_gjm_age_range_overlap on public.gjm_age_category_rules;
create trigger prevent_gjm_age_range_overlap before insert or update on public.gjm_age_category_rules
for each row execute function private.prevent_gjm_age_range_overlap();

-- Keep the auth-backed student portal linked to the ID assigned by existing registration.
create or replace function private.assign_candidate_registration()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is distinct from (select auth.uid()) then raise exception 'Registration must belong to the signed-in user'; end if;
  new.email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if new.email = '' then raise exception 'A verified email address is required'; end if;
  new.registration_number := 'GJM26-' || lpad(nextval('private.candidate_registration_number_seq')::text, 6, '0');
  update public.profiles set registration_number = new.registration_number where id = new.user_id;
  return new;
end;
$$;

create or replace function private.guard_gjm_candidate_registration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_age integer; v_open timestamptz; v_close timestamptz; v_window_confirmed boolean;
begin
  select registration_opens_at, registration_closes_at, registration_window_confirmed into v_open, v_close, v_window_confirmed
  from public.gjm_event_settings where id = true;
  if new.birth_date is null then raise exception 'Date of birth is required'; end if;
  if not v_window_confirmed then raise exception 'The organizer must confirm the registration and quiz closing time before registration opens'; end if;
  if now() < v_open or now() > v_close then raise exception 'Participant registration is outside the configured registration window'; end if;
  if cardinality(new.selected_competition_codes) not between 1 and 2 then raise exception 'Choose one or two competition categories'; end if;
  if exists (select 1 from unnest(new.selected_competition_codes) c where not exists (select 1 from public.gjm_competitions g where g.code = c and g.is_open)) then raise exception 'A selected competition is unavailable'; end if;
  if (select count(distinct c) from unnest(new.selected_competition_codes) c) <> cardinality(new.selected_competition_codes) then raise exception 'Duplicate competition selection'; end if;
  v_age := extract(year from age(date '2026-12-20', new.birth_date))::integer;
  if v_age < 0 then raise exception 'Date of birth cannot be after the event date'; end if;
  if v_age < 18 and not new.parental_consent then raise exception 'Parental consent is required for participants under 18'; end if;
  select category into new.age_category from public.gjm_age_category_rules
  where is_active and v_age >= minimum_age and (maximum_age is null or v_age <= maximum_age);
  if new.age_category is null then raise exception 'Age % has no confirmed competition category. Contact the organizer.', v_age; end if;
  new.age_rule_review_required := false;
  return new;
end;
$$;
drop trigger if exists guard_gjm_candidate_registration_before_insert on public.candidate_registrations;
create trigger guard_gjm_candidate_registration_before_insert before insert on public.candidate_registrations
for each row execute function private.guard_gjm_candidate_registration();

create table if not exists public.gjm_participant_competitions (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.candidate_registrations(id) on delete cascade,
  competition_code text not null references public.gjm_competitions(code),
  created_at timestamptz not null default now(),
  unique (registration_id, competition_code)
);
alter table public.gjm_participant_competitions enable row level security;
create policy "Participants and staff read entries" on public.gjm_participant_competitions for select to authenticated using (
  exists (select 1 from public.candidate_registrations r where r.id = registration_id and r.user_id = (select auth.uid()))
  or public.current_user_role() = 'admin'
);
revoke all on public.gjm_participant_competitions from anon, authenticated;
grant select on public.gjm_participant_competitions to authenticated;

create or replace function private.create_gjm_participant_competitions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.gjm_participant_competitions (registration_id, competition_code)
  select new.id, c from unnest(new.selected_competition_codes) c;
  return new;
end;
$$;
drop trigger if exists create_gjm_participant_competitions_after_insert on public.candidate_registrations;
create trigger create_gjm_participant_competitions_after_insert after insert on public.candidate_registrations
for each row execute function private.create_gjm_participant_competitions();

create or replace function public.register_gjm_competitions(p_birth_date date, p_parental_consent boolean, p_codes text[])
returns text language plpgsql security definer set search_path = '' as $$
declare v_reg public.candidate_registrations%rowtype; v_age integer; v_category text; v_existing integer;
begin
  select * into v_reg from public.candidate_registrations where user_id = (select auth.uid()) for update;
  if not found then raise exception 'Complete participant registration first' using errcode = '42501'; end if;
  if exists (select 1 from public.gjm_participant_competitions where registration_id = v_reg.id) then raise exception 'Competition choices are already saved'; end if;
  if cardinality(p_codes) not between 1 and 2 or (select count(distinct c) from unnest(p_codes) c) <> cardinality(p_codes) then raise exception 'Choose one or two distinct categories'; end if;
  if exists (select 1 from unnest(p_codes) c where not exists (select 1 from public.gjm_competitions g where g.code = c and g.is_open)) then raise exception 'A selected competition is unavailable'; end if;
  if not (select registration_window_confirmed from public.gjm_event_settings where id = true) then raise exception 'The organizer has not confirmed the registration window'; end if;
  if now() < (select registration_opens_at from public.gjm_event_settings where id = true) or now() > (select registration_closes_at from public.gjm_event_settings where id = true) then raise exception 'Registration is outside the configured window'; end if;
  v_age := extract(year from age(date '2026-12-20', p_birth_date))::integer;
  if v_age < 0 then raise exception 'Date of birth cannot be after the event date'; end if;
  if v_age < 18 and not p_parental_consent then raise exception 'Parental consent is required for participants under 18'; end if;
  select category into v_category from public.gjm_age_category_rules where is_active and v_age >= minimum_age and (maximum_age is null or v_age <= maximum_age);
  if v_category is null then raise exception 'Age % has no confirmed competition category. Contact the organizer.', v_age; end if;
  select count(*) into v_existing from public.gjm_participant_competitions where registration_id = v_reg.id;
  if v_existing + cardinality(p_codes) > 2 then raise exception 'A participant may enter at most two competitions'; end if;
  update public.candidate_registrations set birth_date = p_birth_date, age_category = v_category, parental_consent = p_parental_consent,
    selected_competition_codes = p_codes, age_rule_review_required = false where id = v_reg.id;
  insert into public.gjm_participant_competitions (registration_id, competition_code) select v_reg.id, c from unnest(p_codes) c;
  return v_category;
end;
$$;
revoke all on function public.register_gjm_competitions(date, boolean, text[]) from public, anon;
grant execute on function public.register_gjm_competitions(date, boolean, text[]) to authenticated;

create table if not exists public.gjm_submissions (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.candidate_registrations(id) on delete cascade,
  competition_code text not null references public.gjm_competitions(code),
  language text,
  status text not null default 'Draft' check (status in ('Draft', 'Submitted', 'Evaluated')),
  submitted_at timestamptz,
  result_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (registration_id, competition_code),
  foreign key (registration_id, competition_code) references public.gjm_participant_competitions(registration_id, competition_code)
);
create table if not exists public.gjm_submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.gjm_submissions(id) on delete cascade,
  storage_path text not null unique,
  file_kind text not null check (file_kind in ('performance_video', 'artwork_photo', 'participant_photo', 'process_video')),
  content_type text not null,
  file_size bigint not null check (file_size > 0),
  duration_seconds integer,
  created_at timestamptz not null default now()
);
create unique index if not exists gjm_submission_one_file_per_kind on public.gjm_submission_files (submission_id, file_kind);
create table if not exists public.gjm_judge_assignments (
  submission_id uuid not null references public.gjm_submissions(id) on delete cascade,
  judge_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  primary key (submission_id, judge_user_id)
);
alter table public.gjm_judge_assignments enable row level security;
create policy "Judges see their assignments" on public.gjm_judge_assignments for select to authenticated using (judge_user_id = (select auth.uid()) or public.current_user_role() = 'admin');
create policy "Admins assign judges" on public.gjm_judge_assignments for insert to authenticated with check (
  public.current_user_role() = 'admin' and assigned_by = (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = judge_user_id and p.role = 'teacher')
);
revoke all on public.gjm_judge_assignments from anon, authenticated;
grant select, insert on public.gjm_judge_assignments to authenticated;

alter table public.gjm_submissions enable row level security;
alter table public.gjm_submission_files enable row level security;
create policy "Participants and authorized judges read submissions" on public.gjm_submissions for select to authenticated using (
  exists (select 1 from public.candidate_registrations r where r.id = registration_id and r.user_id = (select auth.uid()))
  or public.current_user_role() = 'admin'
  or exists (select 1 from public.gjm_judge_assignments ja where ja.submission_id = id and ja.judge_user_id = (select auth.uid()))
);
create policy "Participants read their file metadata" on public.gjm_submission_files for select to authenticated using (
  exists (select 1 from public.gjm_submissions s join public.candidate_registrations r on r.id = s.registration_id where s.id = submission_id and r.user_id = (select auth.uid()))
  or public.current_user_role() = 'admin'
  or exists (select 1 from public.gjm_judge_assignments ja where ja.submission_id = gjm_submission_files.submission_id and ja.judge_user_id = (select auth.uid()))
);
create policy "Participants create own submission drafts" on public.gjm_submissions for insert to authenticated with check (
  status = 'Draft' and exists (
    select 1 from public.candidate_registrations r join public.gjm_event_settings e on e.id = true
    where r.id = registration_id and r.user_id = (select auth.uid()) and r.status = 'Approved' and now() <= e.submissions_close_at
  )
);
create policy "Participants add own files to drafts" on public.gjm_submission_files for insert to authenticated with check (
  exists (select 1 from public.gjm_submissions s join public.candidate_registrations r on r.id = s.registration_id
    join public.gjm_competitions c on c.code = s.competition_code
    where s.id = submission_id and s.status = 'Draft' and r.user_id = (select auth.uid())
      and file_size <= c.max_upload_bytes
      and ((file_kind in ('artwork_photo','participant_photo') and content_type in ('image/jpeg','image/png','image/webp'))
        or (file_kind in ('performance_video','process_video') and content_type in ('video/webm','video/mp4','video/quicktime')))
      and (duration_seconds is null or duration_seconds between 1 and coalesce(c.max_video_seconds, 3600)))
  and (storage_path like (select auth.uid())::text || '/%')
);
create policy "Admins manage submissions" on public.gjm_submissions for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
revoke all on public.gjm_submissions, public.gjm_submission_files from anon, authenticated;
grant select, insert on public.gjm_submissions, public.gjm_submission_files to authenticated;

create or replace function public.submit_gjm_submission(p_submission_id uuid, p_language text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_submission public.gjm_submissions%rowtype; v_uid uuid := (select auth.uid()); v_close timestamptz; v_max_seconds integer; v_age_category text;
begin
  select * into v_submission from public.gjm_submissions where id = p_submission_id for update;
  if not found or v_submission.status <> 'Draft' then raise exception 'Submission is unavailable or already submitted'; end if;
  if not exists (select 1 from public.gjm_competitions where code = v_submission.competition_code and is_open) then raise exception 'This competition is closed'; end if;
  if not exists (select 1 from public.candidate_registrations where id = v_submission.registration_id and user_id = v_uid and status = 'Approved') then
    raise exception 'An approved participant registration is required' using errcode = '42501';
  end if;
  select submissions_close_at into v_close from public.gjm_event_settings where id = true;
  if now() > v_close then raise exception 'The submission deadline has passed'; end if;
  select max_video_seconds into v_max_seconds from public.gjm_competitions where code = v_submission.competition_code;
  select age_category into v_age_category from public.candidate_registrations where id = v_submission.registration_id;
  if v_submission.competition_code in ('shloka_uccharan','digital_bhashan') and not exists (
    select 1 from public.gjm_submission_files where submission_id = p_submission_id and file_kind = 'performance_video'
      and (v_max_seconds is null or duration_seconds <= v_max_seconds)
  ) then raise exception 'A performance video within the time limit is required'; end if;
  if v_submission.competition_code = 'digital_bhashan' and not exists (
    select 1 from public.gjm_submission_files where submission_id = p_submission_id and file_kind = 'performance_video' and
      ((v_age_category = 'Sub-Junior' and duration_seconds between 120 and 180) or
       (v_age_category = 'Junior' and duration_seconds between 180 and 240) or
       (v_age_category in ('Senior','Open') and duration_seconds between 240 and 300))
  ) then raise exception 'Speech video does not meet the time limit for this age category'; end if;
  if v_submission.competition_code = 'geeta_art' and (
    not exists (select 1 from public.gjm_submission_files where submission_id = p_submission_id and file_kind = 'artwork_photo') or
    not exists (select 1 from public.gjm_submission_files where submission_id = p_submission_id and file_kind = 'participant_photo') or
    not exists (select 1 from public.gjm_submission_files where submission_id = p_submission_id and file_kind = 'process_video' and duration_seconds between 20 and 30)
  ) then raise exception 'Artwork, participant, and 20–30 second process files are required'; end if;
  if v_submission.competition_code = 'digital_bhashan' and coalesce(p_language,'') not in ('Hindi','Sanskrit','English') then
    raise exception 'Choose Hindi, Sanskrit, or English';
  end if;
  update public.gjm_submissions set status = 'Submitted', submitted_at = now(), language = p_language where id = p_submission_id;
end;
$$;
revoke all on function public.submit_gjm_submission(uuid, text) from public, anon;
grant execute on function public.submit_gjm_submission(uuid, text) to authenticated;

create or replace function public.publish_gjm_result(p_submission_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_publish timestamptz;
begin
  if public.current_user_role() <> 'admin' then raise exception 'Only an administrator may publish results' using errcode = '42501'; end if;
  select results_at into v_publish from public.gjm_event_settings where id = true;
  if now() < v_publish then raise exception 'Results cannot be published before the configured results date'; end if;
  if not exists (select 1 from public.gjm_submissions s join public.gjm_evaluations e on e.submission_id = s.id and e.status = 'Final' where s.id = p_submission_id) then
    raise exception 'Only finalized evaluations can be published';
  end if;
  update public.gjm_submissions set result_published = true where id = p_submission_id;
end;
$$;
revoke all on function public.publish_gjm_result(uuid) from public, anon;
grant execute on function public.publish_gjm_result(uuid) to authenticated;

create table if not exists public.gjm_evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  competition_code text not null references public.gjm_competitions(code),
  criterion text not null,
  max_marks numeric(5,2) not null default 25 check (max_marks > 0),
  position integer not null,
  is_active boolean not null default true,
  unique (competition_code, position)
);
insert into public.gjm_evaluation_criteria (competition_code, criterion, position) values
 ('shloka_uccharan','Pronunciation and accuracy',1),('shloka_uccharan','Memorization',2),('shloka_uccharan','Meaning and expression',3),('shloka_uccharan','Confidence and presentation',4),
 ('digital_bhashan','Understanding of topic and Gita relevance',1),('digital_bhashan','Originality and quality of ideas',2),('digital_bhashan','Language, clarity, and expression',3),('digital_bhashan','Confidence, delivery, and overall impact',4),
 ('geeta_art','Relevance to the theme',1),('geeta_art','Creativity and originality',2),('geeta_art','Artistic quality and technique',3),('geeta_art','Expression and message',4)
on conflict (competition_code, position) do nothing;
alter table public.gjm_evaluation_criteria enable row level security;
create policy "Evaluation criteria are public" on public.gjm_evaluation_criteria for select to authenticated using (true);
create policy "Admins configure evaluation criteria" on public.gjm_evaluation_criteria for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
revoke all on public.gjm_evaluation_criteria from anon, authenticated;
grant select on public.gjm_evaluation_criteria to authenticated;
grant insert, update, delete on public.gjm_evaluation_criteria to authenticated;

create table if not exists public.gjm_evaluations (
  submission_id uuid primary key references public.gjm_submissions(id) on delete cascade,
  marks jsonb not null default '{}'::jsonb,
  total_marks numeric(6,2) not null default 0,
  feedback text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Final')),
  evaluated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.gjm_evaluations enable row level security;
create policy "Assigned judges and admins read evaluations" on public.gjm_evaluations for select to authenticated using (
  public.current_user_role() = 'admin' or exists (select 1 from public.gjm_judge_assignments ja where ja.submission_id = gjm_evaluations.submission_id and ja.judge_user_id = (select auth.uid()))
);
create policy "Participants read published evaluations" on public.gjm_evaluations for select to authenticated using (
  status = 'Final' and exists (select 1 from public.gjm_submissions s join public.gjm_participant_competitions pc
    on pc.registration_id = s.registration_id and pc.competition_code = s.competition_code
    join public.candidate_registrations r on r.id = pc.registration_id
    where s.id = gjm_evaluations.submission_id and r.user_id = (select auth.uid()) and s.result_published)
);
revoke all on public.gjm_evaluations from anon, authenticated;
grant select on public.gjm_evaluations to authenticated;

create or replace function public.save_gjm_evaluation(p_submission_id uuid, p_marks jsonb, p_feedback text, p_finalize boolean default false)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_code text; v_total numeric(6,2); v_count integer; v_judging_opens timestamptz; v_judging_closes timestamptz;
begin
  if not (public.current_user_role() = 'admin' or exists (select 1 from public.gjm_judge_assignments where submission_id = p_submission_id and judge_user_id = (select auth.uid()))) then
    raise exception 'You are not assigned to evaluate this submission' using errcode = '42501';
  end if;
  select competition_code into v_code from public.gjm_submissions where id = p_submission_id;
  if not found then raise exception 'Submission not found'; end if;
  select judging_opens_at, judging_closes_at into v_judging_opens, v_judging_closes from public.gjm_event_settings where id = true;
  if now() < v_judging_opens or now() > v_judging_closes then raise exception 'Evaluations are outside the configured judging window'; end if;
  select count(*), coalesce(sum((p_marks ->> c.id::text)::numeric), 0) into v_count, v_total
  from public.gjm_evaluation_criteria c where c.competition_code = v_code and c.is_active;
  if v_count <> 4 or jsonb_typeof(p_marks) <> 'object' or (select count(*) from jsonb_object_keys(p_marks)) <> 4 then
    raise exception 'Exactly four configured criteria must be scored';
  end if;
  if exists (select 1 from public.gjm_evaluation_criteria c where c.competition_code = v_code and c.is_active and
    ((p_marks ->> c.id::text) is null or (p_marks ->> c.id::text)::numeric < 0 or (p_marks ->> c.id::text)::numeric > c.max_marks)) then
    raise exception 'Each mark must be between zero and its configured maximum';
  end if;
  insert into public.gjm_evaluations (submission_id, marks, total_marks, feedback, status, evaluated_by, updated_at)
  values (p_submission_id, p_marks, v_total, coalesce(p_feedback,''), case when p_finalize then 'Final' else 'Draft' end, (select auth.uid()), now())
  on conflict (submission_id) do update set marks = excluded.marks, total_marks = excluded.total_marks, feedback = excluded.feedback,
    status = excluded.status, evaluated_by = excluded.evaluated_by, updated_at = now();
  if p_finalize then update public.gjm_submissions set status = 'Evaluated' where id = p_submission_id; end if;
  return v_total;
end;
$$;
revoke all on function public.save_gjm_evaluation(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.save_gjm_evaluation(uuid, jsonb, text, boolean) to authenticated;

create table if not exists public.gjm_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  chapter smallint not null check (chapter between 1 and 18),
  question_text text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_option text not null check (correct_option in ('A','B','C','D')),
  age_category text not null check (age_category in ('Sub-Junior','Junior','Senior','Open')),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists gjm_quiz_question_age_text_unique on public.gjm_quiz_questions (age_category, question_text);
with question_bank(chapter, question_text, options, correct_option) as (values
  (1, 'Why does Arjuna hesitate before the battle begins?', jsonb_build_array('He sees relatives and teachers among the opposing army','He has lost his bow','He wants to become king immediately','He has forgotten the battlefield'), 'A'),
  (1, 'Who guides Arjuna through the dialogue on the battlefield?', jsonb_build_array('Bhishma','Krishna','Drona','Vidura'), 'B'),
  (2, 'According to Krishna, what happens to the eternal self when the body dies?', jsonb_build_array('It is destroyed forever','It becomes a weapon','It is not destroyed with the body','It turns into the body again immediately'), 'C'),
  (2, 'Which comparison is used for the self taking a new body?', jsonb_build_array('A river changing direction','A person changing worn-out clothes','A lamp being put out','A tree losing its leaves'), 'B'),
  (3, 'What does Karma Yoga teach about action?', jsonb_build_array('Act responsibly without being attached to the result','Avoid every kind of work','Work only for praise','Let others do one’s duty'), 'A'),
  (3, 'What is Nishkama Karma?', jsonb_build_array('Action done without selfish attachment to its fruits','Action done only for a reward','Refusing to help anyone','Acting without thinking'), 'A'),
  (4, 'In the Gita, what can wise knowledge help a person do?', jsonb_build_array('Understand action and act with discernment','Avoid learning','Win every argument','Predict every event'), 'A'),
  (4, 'Krishna describes knowledge as being like what that burns away confusion?', jsonb_build_array('A river','A fire','A mountain','A flower'), 'B'),
  (5, 'What does Krishna explain about disciplined action and renunciation?', jsonb_build_array('Both can lead toward freedom when rightly understood','Only avoiding all work matters','Neither has any value','They mean collecting rewards'), 'A'),
  (5, 'Who is described as a true renouncer in the Gita?', jsonb_build_array('One who gives up selfish desire and aversion','One who abandons every responsibility','One who never speaks','One who refuses study'), 'A'),
  (6, 'Which practice is central to Dhyana Yoga?', jsonb_build_array('Steady meditation and self-discipline','Constant competition','Sleeping through the day','Seeking praise'), 'A'),
  (6, 'What does Krishna advise about the mind?', jsonb_build_array('It can be trained through practice and detachment','It cannot ever be guided','It should always follow every impulse','It is controlled by wealth'), 'A'),
  (7, 'Which path does Krishna describe as helping a person know the divine?', jsonb_build_array('Knowledge joined with realization','Avoiding all questions','Seeking only possessions','Ignoring nature'), 'A'),
  (7, 'The Gita describes the divine as the source of which pair?', jsonb_build_array('All existence and its changing forms','Only one battlefield','Only one family','Only human speech'), 'A'),
  (8, 'What does the Gita connect with a person’s final remembrance?', jsonb_build_array('The direction of one’s thought and devotion','The number of possessions','The place of birth alone','The loudness of speech'), 'A'),
  (8, 'Which word names the imperishable reality discussed in chapter eight?', jsonb_build_array('Akshara Brahman','Dhanush','Ratha','Gada'), 'A'),
  (9, 'How does chapter nine describe the knowledge Krishna shares?', jsonb_build_array('A profound and sacred knowledge of devotion','A lesson in building weapons','A list of kings','A map of cities'), 'A'),
  (9, 'According to the Gita, what matters in a sincere offering?', jsonb_build_array('Devotion and sincerity','Its expensive price','Its size alone','Who sees it'), 'A'),
  (10, 'What are Krishna’s Vibhutis?', jsonb_build_array('Examples of divine glories present in the world','Arjuna’s arrows','A set of battle rules','Names of the Pandava brothers'), 'A'),
  (10, 'Why does Krishna describe examples of his glories?', jsonb_build_array('To help Arjuna recognize the divine presence','To choose a new charioteer','To count the armies','To end the dialogue'), 'A'),
  (11, 'What does Arjuna see when Krishna reveals the Vishvarupa?', jsonb_build_array('A vast universal form','A new bow','A quiet forest','A group of teachers'), 'A'),
  (11, 'How does Arjuna respond to the universal form?', jsonb_build_array('With wonder, reverence, and awe','With indifference','By leaving the battlefield','By asking for a prize'), 'A'),
  (12, 'Which quality is valued in a devoted person in chapter twelve?', jsonb_build_array('Compassion and steadiness','Pride and anger','Jealousy and greed','Carelessness'), 'A'),
  (12, 'What is Bhakti Yoga?', jsonb_build_array('The path of loving devotion','A method of archery','A study of maps','A form of trade'), 'A'),
  (13, 'In chapter thirteen, what is called the field?', jsonb_build_array('The body and the changing world of experience','A sports ground only','The sky alone','A book of rules'), 'A'),
  (13, 'Who is the knower of the field?', jsonb_build_array('The one who is aware of the body and experience','The charioteer’s horse','A battlefield flag','A royal messenger'), 'A'),
  (14, 'Which three gunas are described in the Gita?', jsonb_build_array('Sattva, rajas, and tamas','Dharma, artha, and kama','Earth, water, and fire','Past, present, and future'), 'A'),
  (14, 'What is a goal of understanding the gunas?', jsonb_build_array('Recognizing their influence and becoming less bound by them','Increasing confusion','Avoiding all learning','Winning an argument'), 'A'),
  (15, 'What does the upside-down Ashvattha tree in chapter fifteen symbolize?', jsonb_build_array('The changing world and its roots in the eternal','A real forest map','A chariot wheel','A palace garden'), 'A'),
  (15, 'What does Purushottama refer to in chapter fifteen?', jsonb_build_array('The supreme person beyond the perishable and imperishable','A kind of bow','A place in Kurukshetra','A name for a river'), 'A'),
  (16, 'Which is an example of a divine quality?', jsonb_build_array('Truthfulness and self-control','Cruelty','Arrogance','Dishonesty'), 'A'),
  (16, 'Which qualities does chapter sixteen warn can lead people toward harmful conduct?', jsonb_build_array('Pride, anger, and greed','Compassion, patience, and truth','Study, courage, and kindness','Calmness, generosity, and humility'), 'A'),
  (17, 'What does chapter seventeen discuss?', jsonb_build_array('Different kinds of faith and disciplined practice','The names of all weapons','The geography of India','How to build a chariot'), 'A'),
  (17, 'According to the Gita, how can food, worship, and giving be understood?', jsonb_build_array('Through the qualities that shape intention and practice','Only by their cost','Only by the season','By their color alone'), 'A'),
  (18, 'What does Swadharma mean in the Gita?', jsonb_build_array('One’s own duty or path of responsibility','A kind of musical instrument','A royal title','A battle formation'), 'A'),
  (18, 'What does Arjuna decide after hearing Krishna’s teaching?', jsonb_build_array('To act with understanding and fulfill his duty','To abandon all thought','To become a merchant','To leave without speaking'), 'A'),
  (1, 'Where does the dialogue of the Bhagavad Gita take place?', jsonb_build_array('Kurukshetra','Ayodhya','Dwaraka','Hastinapura palace'), 'A'),
  (1, 'The Bhagavad Gita is part of which larger epic?', jsonb_build_array('Mahabharata','Ramayana','Arthashastra','Panchatantra'), 'A'),
  (2, 'Which teaching encourages steadiness in happiness and difficulty?', jsonb_build_array('Samatva Yoga','Only seeking comfort','Avoiding every choice','Acting from anger'), 'A'),
  (3, 'What does the Gita say about doing one’s work?', jsonb_build_array('Perform it with care and without selfish attachment','Do it only when praised','Avoid it when it is difficult','Demand a reward first'), 'A'),
  (4, 'Why is a wise teacher important in the Gita?', jsonb_build_array('A teacher can guide a sincere learner toward understanding','A teacher chooses all rewards','A teacher can stop time','A teacher replaces personal effort'), 'A'),
  (5, 'How should a person treat others while pursuing spiritual understanding?', jsonb_build_array('With equal regard and self-discipline','With contempt','Only as competitors','According to their wealth'), 'A'),
  (6, 'What does the Gita recommend when the mind wanders during meditation?', jsonb_build_array('Bring it back with patient practice','Give up immediately','Follow every distraction','Blame another person'), 'A'),
  (7, 'What is a common theme in Krishna’s dialogue with Arjuna?', jsonb_build_array('Knowledge, disciplined action, and devotion','Trade and farming only','Architecture and music only','Rules for royal ceremonies only'), 'A'),
  (9, 'Can a small offering made with devotion be meaningful in the Gita?', jsonb_build_array('Yes, sincerity and devotion matter','No, only costly gifts matter','Only kings may offer anything','Only food from a palace is accepted'), 'A'),
  (10, 'Which setting brings Krishna and Arjuna together for their dialogue?', jsonb_build_array('A chariot between two armies','A classroom in a city','A ship at sea','A forest hermitage'), 'A'),
  (11, 'Who asks Krishna to reveal the universal form?', jsonb_build_array('Arjuna','Bhima','Duryodhana','Karna'), 'A'),
  (12, 'Which statement best describes Bhakti Yoga?', jsonb_build_array('A path centered on devotion and trust','A path of collecting wealth','A method of avoiding duty','A form of physical exercise only'), 'A'),
  (14, 'What quality is associated with sattva?', jsonb_build_array('Clarity and understanding','Restlessness alone','Inertia alone','Confusion and harm'), 'A'),
  (18, 'What does the Gita teach about acting without attachment to results?', jsonb_build_array('It supports inner steadiness while doing one’s duty','It means actions never matter','It means avoiding responsibility','It guarantees a reward'), 'A'),
  (18, 'Which four broad paths are commonly associated with the Gita’s teaching?', jsonb_build_array('Karma, Jnana, Bhakti, and Dhyana','Trade, farming, music, and dance','Speech, painting, running, and cooking','Earth, water, fire, and air'), 'A')
), age_groups(age_category) as (values ('Sub-Junior'),('Junior'),('Senior'),('Open'))
insert into public.gjm_quiz_questions (chapter, question_text, options, correct_option, age_category, is_published)
select q.chapter, q.question_text,
  jsonb_agg(opt.value order by ((opt.ordinality - 1 + answer_shift.shift) % 4)),
  chr(ascii('A') + ((ascii(q.correct_option) - ascii('A') + answer_shift.shift) % 4)),
  a.age_category, true
from question_bank q cross join age_groups a
cross join lateral (select floor(random() * 4)::integer as shift where q.question_text is not null and a.age_category is not null) answer_shift
cross join lateral jsonb_array_elements_text(q.options) with ordinality as opt(value, ordinality)
group by q.chapter, q.question_text, q.correct_option, a.age_category, answer_shift.shift
on conflict (age_category, question_text) do nothing;
alter table public.gjm_quiz_questions enable row level security;
create policy "Admins manage quiz questions" on public.gjm_quiz_questions for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
revoke all on public.gjm_quiz_questions from anon, authenticated;
grant select, insert, update, delete on public.gjm_quiz_questions to authenticated;

create table if not exists public.gjm_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.candidate_registrations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '25 minutes',
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  visibility_flags integer not null default 0,
  submitted_at timestamptz,
  correct_count integer,
  raw_score numeric(5,2),
  normalized_score numeric(5,2),
  unique (registration_id)
);
create table if not exists public.gjm_quiz_attempt_questions (
  attempt_id uuid not null references public.gjm_quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.gjm_quiz_questions(id),
  position integer not null,
  question_text text not null,
  options jsonb not null,
  correct_option text not null,
  primary key (attempt_id, question_id), unique (attempt_id, position)
);
alter table public.gjm_quiz_attempts enable row level security;
alter table public.gjm_quiz_attempt_questions enable row level security;
create policy "Participants and admins view quiz results" on public.gjm_quiz_attempts for select to authenticated using (user_id = (select auth.uid()) or public.current_user_role() = 'admin');
revoke all on public.gjm_quiz_attempts, public.gjm_quiz_attempt_questions from anon, authenticated;
grant select on public.gjm_quiz_attempts to authenticated;

create or replace function public.start_gjm_quiz()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_reg public.candidate_registrations%rowtype; v_attempt public.gjm_quiz_attempts%rowtype; v_count integer;
begin
  if v_user is null then raise exception 'Sign in to start the quiz' using errcode = '42501'; end if;
  select * into v_reg from public.candidate_registrations where user_id = v_user;
  if not found or v_reg.status <> 'Approved' then raise exception 'An approved participant registration is required'; end if;
  if not exists (select 1 from public.gjm_participant_competitions where registration_id = v_reg.id and competition_code = 'geeta_quiz') then raise exception 'You are not registered for this quiz'; end if;
  if not exists (select 1 from public.gjm_competitions where code = 'geeta_quiz' and is_open) then raise exception 'The quiz is closed'; end if;
  if not (select registration_window_confirmed from public.gjm_event_settings where id = true) or now() < (select registration_opens_at from public.gjm_event_settings where id = true) or now() > (select registration_closes_at from public.gjm_event_settings where id = true) then raise exception 'The quiz window is closed or its dates have not been confirmed'; end if;
  select count(*) into v_count from public.gjm_quiz_questions where is_published and age_category = v_reg.age_category;
  if v_count < 50 then raise exception 'The quiz requires 50 published questions for your age category'; end if;
  insert into public.gjm_quiz_attempts (registration_id, user_id) values (v_reg.id, v_user) on conflict (registration_id) do nothing;
  select * into v_attempt from public.gjm_quiz_attempts where registration_id = v_reg.id for update;
  if not exists (select 1 from public.gjm_quiz_attempt_questions where attempt_id = v_attempt.id) then
    insert into public.gjm_quiz_attempt_questions (attempt_id, question_id, position, question_text, options, correct_option)
    select v_attempt.id, q.id, row_number() over (order by random())::integer, q.question_text, q.options, q.correct_option
    from (select * from public.gjm_quiz_questions where is_published and age_category = v_reg.age_category order by random() limit 50) q;
  end if;
  return jsonb_build_object('attempt_id', v_attempt.id, 'started_at', v_attempt.started_at, 'expires_at', v_attempt.expires_at,
    'submitted', v_attempt.submitted_at is not null, 'raw_score', v_attempt.raw_score, 'normalized_score', v_attempt.normalized_score,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.question_id, 'text', q.question_text, 'options', q.options, 'selected', v_attempt.answers ->> q.question_id::text) order by q.position), '[]'::jsonb)
      from public.gjm_quiz_attempt_questions q where q.attempt_id = v_attempt.id));
end;
$$;

create or replace function public.save_gjm_quiz_answers(p_attempt_id uuid, p_answers jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempt public.gjm_quiz_attempts%rowtype;
begin
  select * into v_attempt from public.gjm_quiz_attempts where id = p_attempt_id and user_id = (select auth.uid()) for update;
  if not found or v_attempt.submitted_at is not null or now() > v_attempt.expires_at then raise exception 'Quiz attempt is closed'; end if;
  if jsonb_typeof(p_answers) <> 'object' or exists (select 1 from jsonb_each_text(p_answers) a where a.value not in ('A','B','C','D') or not exists (select 1 from public.gjm_quiz_attempt_questions q where q.attempt_id = p_attempt_id and q.question_id::text = a.key)) then raise exception 'Invalid quiz answers'; end if;
  update public.gjm_quiz_attempts set answers = p_answers where id = p_attempt_id;
end;
$$;

create or replace function public.flag_gjm_quiz_visibility(p_attempt_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  update public.gjm_quiz_attempts set visibility_flags = visibility_flags + 1 where id = p_attempt_id and user_id = (select auth.uid()) and submitted_at is null returning visibility_flags into v_count;
  if v_count is null then raise exception 'Quiz attempt is closed'; end if;
  return v_count;
end;
$$;

create or replace function public.submit_gjm_quiz(p_attempt_id uuid, p_answers jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_attempt public.gjm_quiz_attempts%rowtype; v_correct integer; v_answers jsonb;
begin
  select * into v_attempt from public.gjm_quiz_attempts where id = p_attempt_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Quiz attempt not found' using errcode = '42501'; end if;
  if v_attempt.submitted_at is not null then return jsonb_build_object('correct_count', v_attempt.correct_count, 'raw_score', v_attempt.raw_score, 'normalized_score', v_attempt.normalized_score, 'submitted_at', v_attempt.submitted_at); end if;
  v_answers := case when now() > v_attempt.expires_at or p_answers is null then v_attempt.answers else p_answers end;
  if now() <= v_attempt.expires_at and p_answers is not null then
    if jsonb_typeof(p_answers) <> 'object' or exists (select 1 from jsonb_each_text(p_answers) a where a.value not in ('A','B','C','D') or not exists (select 1 from public.gjm_quiz_attempt_questions q where q.attempt_id = p_attempt_id and q.question_id::text = a.key)) then raise exception 'Invalid quiz answers'; end if;
  end if;
  select count(*) filter (where v_answers ->> q.question_id::text = q.correct_option) into v_correct from public.gjm_quiz_attempt_questions q where q.attempt_id = p_attempt_id;
  update public.gjm_quiz_attempts set answers = v_answers, submitted_at = now(), correct_count = v_correct, raw_score = v_correct * 0.5, normalized_score = v_correct * 2 where id = p_attempt_id;
  return jsonb_build_object('correct_count', v_correct, 'raw_score', v_correct * 0.5, 'normalized_score', v_correct * 2, 'submitted_at', now());
end;
$$;

revoke all on function public.start_gjm_quiz() from public, anon;
revoke all on function public.save_gjm_quiz_answers(uuid, jsonb) from public, anon;
revoke all on function public.flag_gjm_quiz_visibility(uuid) from public, anon;
revoke all on function public.submit_gjm_quiz(uuid, jsonb) from public, anon;
grant execute on function public.start_gjm_quiz() to authenticated;
grant execute on function public.save_gjm_quiz_answers(uuid, jsonb) to authenticated;
grant execute on function public.flag_gjm_quiz_visibility(uuid) to authenticated;
grant execute on function public.submit_gjm_quiz(uuid, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gjm-competition-submissions', 'gjm-competition-submissions', false, 524288000,
  array['video/webm','video/mp4','video/quicktime','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 524288000,
  allowed_mime_types = array['video/webm','video/mp4','video/quicktime','image/jpeg','image/png','image/webp'];
create policy "Participants upload to own GJM folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'gjm-competition-submissions' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.gjm_submissions s join public.candidate_registrations r on r.id = s.registration_id
    where s.id::text = (storage.foldername(name))[2] and s.status = 'Draft' and r.user_id = (select auth.uid()) and r.status = 'Approved')
);
create policy "Owners admins and assigned judges view GJM files" on storage.objects for select to authenticated using (
  bucket_id = 'gjm-competition-submissions' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.current_user_role() = 'admin'
    or exists (select 1 from public.gjm_submission_files f join public.gjm_submissions s on s.id = f.submission_id
      join public.gjm_judge_assignments j on j.submission_id = s.id
      where f.storage_path = name and j.judge_user_id = (select auth.uid()))
  )
);

create table if not exists public.gjm_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  entity text not null,
  entity_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.gjm_audit_logs enable row level security;
create policy "Admins view Mahotsav audit logs" on public.gjm_audit_logs for select to authenticated using (public.current_user_role() = 'admin');
revoke all on public.gjm_audit_logs from anon, authenticated;
grant select on public.gjm_audit_logs to authenticated;

create or replace function private.log_gjm_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb := to_jsonb(new); v_entity_id text;
begin
  v_entity_id := coalesce(v_row ->> 'id', v_row ->> 'submission_id', v_row ->> 'registration_id', v_row ->> 'code');
  insert into public.gjm_audit_logs (actor_user_id, entity, entity_id, action, details)
  values ((select auth.uid()), tg_table_name, v_entity_id, tg_op,
    jsonb_strip_nulls(jsonb_build_object('status', v_row ->> 'status', 'result_published', v_row ->> 'result_published',
      'competition_code', v_row ->> 'competition_code', 'raw_score', v_row ->> 'raw_score',
      'visibility_flags', v_row ->> 'visibility_flags', 'total_marks', v_row ->> 'total_marks')));
  return new;
end;
$$;
drop trigger if exists gjm_audit_submissions on public.gjm_submissions;
create trigger gjm_audit_submissions after insert or update on public.gjm_submissions for each row execute function private.log_gjm_change();
drop trigger if exists gjm_audit_evaluations on public.gjm_evaluations;
create trigger gjm_audit_evaluations after insert or update on public.gjm_evaluations for each row execute function private.log_gjm_change();
drop trigger if exists gjm_audit_quiz_attempts on public.gjm_quiz_attempts;
create trigger gjm_audit_quiz_attempts after insert or update on public.gjm_quiz_attempts for each row execute function private.log_gjm_change();
drop trigger if exists gjm_audit_event_settings on public.gjm_event_settings;
create trigger gjm_audit_event_settings after update on public.gjm_event_settings for each row execute function private.log_gjm_change();

