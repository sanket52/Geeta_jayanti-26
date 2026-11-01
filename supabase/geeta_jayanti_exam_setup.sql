-- Secure candidate registration and single-attempt exam foundation.
-- Run in Supabase SQL Editor after enabling Email OTP in Auth.
-- Never place a service-role key in the browser.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  registration_number text unique,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

drop policy if exists "Profiles readable by owner and staff" on public.profiles;
create policy "Profiles readable by owner and staff" on public.profiles
  for select to authenticated using (
    id = (select auth.uid()) or public.current_user_role() in ('teacher', 'admin')
  );

create or replace function private.create_student_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_student_profile_after_signup on auth.users;
create trigger create_student_profile_after_signup
  after insert on auth.users
  for each row execute function private.create_student_profile();

create sequence if not exists private.candidate_registration_number_seq;

create table if not exists public.candidate_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  registration_number text not null unique,
  email text not null,
  full_name text not null check (length(trim(full_name)) between 2 and 160),
  mobile text not null check (length(trim(mobile)) between 7 and 30),
  school_name text not null check (length(trim(school_name)) between 2 and 200),
  education_level text not null check (length(trim(education_level)) between 1 and 80),
  city text not null check (length(trim(city)) between 1 and 120),
  state text not null check (length(trim(state)) between 1 and 120),
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create unique index if not exists candidate_registrations_email_unique
  on public.candidate_registrations (lower(email));
alter table public.candidate_registrations enable row level security;

create or replace function private.assign_candidate_registration()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'Registration must belong to the signed-in user';
  end if;
  new.email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if new.email = '' then
    raise exception 'A verified email address is required';
  end if;
  new.registration_number := 'GJM26-' || lpad(nextval('private.candidate_registration_number_seq')::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists assign_candidate_registration_before_insert on public.candidate_registrations;
create trigger assign_candidate_registration_before_insert
  before insert on public.candidate_registrations
  for each row execute function private.assign_candidate_registration();

drop policy if exists "Candidates submit their verified registration" on public.candidate_registrations;
create policy "Candidates submit their verified registration" on public.candidate_registrations
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and status = 'Pending'
  );

drop policy if exists "Candidates and staff read permitted registrations" on public.candidate_registrations;
create policy "Candidates and staff read permitted registrations" on public.candidate_registrations
  for select to authenticated using (
    user_id = (select auth.uid()) or public.current_user_role() in ('teacher', 'admin')
  );

revoke all on public.candidate_registrations from anon, authenticated;
grant select, insert on public.candidate_registrations to authenticated;

create or replace function public.review_candidate_registration(p_registration_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.current_user_role() not in ('admin', 'teacher') then
    raise exception 'Not authorized to review registrations' using errcode = '42501';
  end if;
  if p_status not in ('Approved', 'Rejected', 'Pending') then
    raise exception 'Invalid registration status';
  end if;
  update public.candidate_registrations
  set status = p_status, reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = p_registration_id;
  if not found then raise exception 'Registration not found'; end if;
end;
$$;

revoke all on function public.review_candidate_registration(uuid, text) from public, anon;
grant execute on function public.review_candidate_registration(uuid, text) to authenticated;

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null,
  subject text not null default 'General',
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  marks numeric(7,2) not null default 1 check (marks > 0),
  negative_marks numeric(7,2) not null default 0 check (negative_marks >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.exam_questions enable row level security;
drop policy if exists "Staff manage exam questions" on public.exam_questions;
create policy "Staff manage exam questions" on public.exam_questions
  for all to authenticated using (public.current_user_role() in ('admin', 'teacher'))
  with check (public.current_user_role() in ('admin', 'teacher'));
revoke all on public.exam_questions from anon, authenticated;
grant select, insert, update, delete on public.exam_questions to authenticated;

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.candidate_registrations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '120 minutes'),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz,
  score numeric(9,2),
  total_marks numeric(9,2),
  check ((submitted_at is null and score is null) or (submitted_at is not null and score is not null))
);
alter table public.exam_attempts enable row level security;
drop policy if exists "Candidates and staff read permitted attempts" on public.exam_attempts;
create policy "Candidates and staff read permitted attempts" on public.exam_attempts
  for select to authenticated using (
    user_id = (select auth.uid()) or public.current_user_role() in ('admin', 'teacher')
  );
revoke all on public.exam_attempts from anon, authenticated;
grant select on public.exam_attempts to authenticated;

create table if not exists public.exam_attempt_questions (
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null,
  position integer not null,
  question_text text not null,
  subject text not null,
  options jsonb not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  marks numeric(7,2) not null,
  negative_marks numeric(7,2) not null,
  primary key (attempt_id, question_id),
  unique (attempt_id, position)
);
alter table public.exam_attempt_questions enable row level security;
revoke all on public.exam_attempt_questions from anon, authenticated;

create or replace function public.start_candidate_exam()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_registration public.candidate_registrations%rowtype;
  v_attempt public.exam_attempts%rowtype;
  v_inserted integer;
begin
  if v_user_id is null then raise exception 'Sign in with your verified email first' using errcode = '42501'; end if;
  select * into v_registration from public.candidate_registrations where user_id = v_user_id;
  if not found then raise exception 'No candidate registration was found'; end if;
  if v_registration.status <> 'Approved' then raise exception 'Your registration must be approved before you can start the exam'; end if;

  insert into public.exam_attempts (registration_id, user_id)
  values (v_registration.id, v_user_id)
  on conflict (registration_id) do nothing;
  get diagnostics v_inserted = row_count;
  select * into v_attempt from public.exam_attempts where registration_id = v_registration.id;
  if v_attempt.submitted_at is not null then raise exception 'This exam attempt has already been submitted'; end if;

  if v_inserted = 1 then
    insert into public.exam_attempt_questions (attempt_id, question_id, position, question_text, subject, options, correct_option, marks, negative_marks)
    select v_attempt.id, q.id, row_number() over (order by random())::integer, q.question_text, q.subject, q.options, q.correct_option, q.marks, q.negative_marks
    from public.exam_questions q where q.is_published;
    if not exists (select 1 from public.exam_attempt_questions aq where aq.attempt_id = v_attempt.id) then
      raise exception 'The exam is not available yet';
    end if;
  end if;

  return jsonb_build_object('attempt_id', v_attempt.id, 'started_at', v_attempt.started_at, 'expires_at', v_attempt.expires_at, 'server_now', now());
end;
$$;

create or replace function public.get_candidate_exam_questions(p_attempt_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if not exists (
    select 1 from public.exam_attempts a where a.id = p_attempt_id
      and a.user_id = (select auth.uid()) and a.submitted_at is null
  ) then raise exception 'Exam attempt is unavailable or expired' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', aq.question_id, 'section', aq.subject, 'text', aq.question_text,
    'options', aq.options, 'marks', aq.marks, 'selected', a.answers ->> aq.question_id::text
  ) order by aq.position), '[]'::jsonb)
  into v_result
  from public.exam_attempt_questions aq
  join public.exam_attempts a on a.id = aq.attempt_id
  where aq.attempt_id = p_attempt_id;
  return v_result;
end;
$$;

create or replace function public.save_candidate_exam_answers(p_attempt_id uuid, p_answers jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_attempt public.exam_attempts%rowtype;
begin
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be an object'; end if;
  select * into v_attempt from public.exam_attempts
  where id = p_attempt_id and user_id = (select auth.uid()) for update;
  if not found or v_attempt.submitted_at is not null then raise exception 'Exam attempt is unavailable' using errcode = '42501'; end if;
  if now() > v_attempt.expires_at then raise exception 'Exam time has expired'; end if;
  if exists (
    select 1 from jsonb_each_text(p_answers) a
    where a.key !~ '^[0-9a-fA-F-]{36}$' or a.value not in ('A', 'B', 'C', 'D')
      or not exists (select 1 from public.exam_attempt_questions aq where aq.attempt_id = p_attempt_id and aq.question_id::text = a.key)
  ) then raise exception 'One or more answers are invalid'; end if;
  update public.exam_attempts set answers = p_answers where id = p_attempt_id;
end;
$$;

create or replace function public.submit_candidate_exam(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_score numeric(9,2);
  v_total numeric(9,2);
  v_answered integer;
begin
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be an object'; end if;
  select * into v_attempt from public.exam_attempts
  where id = p_attempt_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Exam attempt not found' using errcode = '42501'; end if;
  if v_attempt.submitted_at is not null then raise exception 'This exam attempt has already been submitted'; end if;
  if now() > v_attempt.expires_at then
    -- After expiry, score only the last server-saved answers; ignore late client changes.
    p_answers := v_attempt.answers;
  end if;
  if exists (
    select 1 from jsonb_each_text(p_answers) a
    where a.key !~ '^[0-9a-fA-F-]{36}$' or a.value not in ('A', 'B', 'C', 'D')
      or not exists (select 1 from public.exam_attempt_questions aq where aq.attempt_id = p_attempt_id and aq.question_id::text = a.key)
  ) then raise exception 'One or more answers are invalid'; end if;

  select coalesce(sum(case
    when p_answers ->> aq.question_id::text = aq.correct_option then aq.marks
    when p_answers ? aq.question_id::text then -aq.negative_marks
    else 0 end), 0), coalesce(sum(aq.marks), 0), count(*) filter (where p_answers ? aq.question_id::text)
  into v_score, v_total, v_answered
  from public.exam_attempt_questions aq
  where aq.attempt_id = p_attempt_id;

  update public.exam_attempts set answers = p_answers, submitted_at = now(), score = v_score, total_marks = v_total
  where id = p_attempt_id;
  return jsonb_build_object('score', v_score, 'total_marks', v_total, 'answered', v_answered, 'submitted_at', now());
end;
$$;

revoke all on function public.start_candidate_exam() from public, anon;
revoke all on function public.get_candidate_exam_questions(uuid) from public, anon;
revoke all on function public.save_candidate_exam_answers(uuid, jsonb) from public, anon;
revoke all on function public.submit_candidate_exam(uuid, jsonb) from public, anon;
grant execute on function public.start_candidate_exam() to authenticated;
grant execute on function public.get_candidate_exam_questions(uuid) to authenticated;
grant execute on function public.save_candidate_exam_answers(uuid, jsonb) to authenticated;
grant execute on function public.submit_candidate_exam(uuid, jsonb) to authenticated;
