-- Strict exam behavior upgrade for the existing GJM quiz migration.
-- Apply after geeta_jayanti_competitions_setup.sql.

alter table public.gjm_event_settings
  add column if not exists submit_on_tab_switch boolean not null default true,
  add column if not exists submit_on_window_blur boolean not null default false,
  add column if not exists submit_on_fullscreen_exit boolean not null default true;

alter table public.gjm_quiz_attempts
  add column if not exists submission_reason text,
  add column if not exists network_interruptions integer not null default 0,
  add column if not exists fullscreen_exits integer not null default 0;

create table if not exists public.gjm_quiz_attempt_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.gjm_quiz_attempts(id) on delete cascade,
  event_type text not null check (event_type in (
    'TAB_SWITCH','WINDOW_HIDDEN','WINDOW_BLUR','WINDOW_FOCUS','FULLSCREEN_EXIT',
    'NETWORK_INTERRUPTION','NETWORK_RESTORED','MANUAL_SUBMIT','TIME_EXPIRED',
    'AUTO_SUBMIT_FAILED','SUBMISSION_RETRY'
  )),
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);
create index if not exists gjm_quiz_attempt_events_attempt_time_idx
  on public.gjm_quiz_attempt_events (attempt_id, occurred_at);
alter table public.gjm_quiz_attempt_events enable row level security;
drop policy if exists "Admins view exam events" on public.gjm_quiz_attempt_events;
create policy "Admins view exam events" on public.gjm_quiz_attempt_events
  for select to authenticated using (public.current_user_role() = 'admin');
revoke all on public.gjm_quiz_attempt_events from anon, authenticated;
grant select on public.gjm_quiz_attempt_events to authenticated;

create or replace function public.start_gjm_quiz()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_reg public.candidate_registrations%rowtype;
  v_attempt public.gjm_quiz_attempts%rowtype;
  v_count integer;
  v_tab_policy boolean;
  v_blur_policy boolean;
  v_fullscreen_policy boolean;
begin
  if v_user is null then raise exception 'Sign in to start the quiz' using errcode = '42501'; end if;
  select * into v_reg from public.candidate_registrations where user_id = v_user;
  if not found or v_reg.status <> 'Approved' then raise exception 'An approved participant registration is required'; end if;
  if not exists (select 1 from public.gjm_participant_competitions where registration_id = v_reg.id and competition_code = 'geeta_quiz') then raise exception 'You are not registered for this quiz'; end if;
  select submit_on_tab_switch, submit_on_window_blur, submit_on_fullscreen_exit
    into v_tab_policy, v_blur_policy, v_fullscreen_policy from public.gjm_event_settings where id = true;

  -- Resume an existing attempt even if the registration window has since closed.
  select * into v_attempt from public.gjm_quiz_attempts where registration_id = v_reg.id for update;
  if not found then
    if not exists (select 1 from public.gjm_competitions where code = 'geeta_quiz' and is_open) then raise exception 'The quiz is closed'; end if;
    if not (select registration_window_confirmed from public.gjm_event_settings where id = true)
      or now() < (select registration_opens_at from public.gjm_event_settings where id = true)
      or now() > (select registration_closes_at from public.gjm_event_settings where id = true) then
      raise exception 'The quiz window is closed or its dates have not been confirmed';
    end if;
    select count(*) into v_count from public.gjm_quiz_questions where is_published and age_category = v_reg.age_category;
    if v_count < 50 then raise exception 'The quiz requires 50 published questions for your age category'; end if;
    insert into public.gjm_quiz_attempts (registration_id, user_id) values (v_reg.id, v_user)
      on conflict (registration_id) do nothing;
    select * into v_attempt from public.gjm_quiz_attempts where registration_id = v_reg.id for update;
  end if;
  if not exists (select 1 from public.gjm_quiz_attempt_questions where attempt_id = v_attempt.id) then
    insert into public.gjm_quiz_attempt_questions (attempt_id, question_id, position, question_text, options, correct_option)
    select v_attempt.id, q.id, row_number() over (order by random())::integer, q.question_text, q.options, q.correct_option
      from (select * from public.gjm_quiz_questions where is_published and age_category = v_reg.age_category order by random() limit 50) q;
  end if;
  return jsonb_build_object(
    'attempt_id',v_attempt.id,'started_at',v_attempt.started_at,'expires_at',v_attempt.expires_at,'server_now',now(),
    'submitted',v_attempt.submitted_at is not null,'submission_reason',v_attempt.submission_reason,
    'raw_score',v_attempt.raw_score,'normalized_score',v_attempt.normalized_score,
    'submit_on_tab_switch',v_tab_policy,'submit_on_window_blur',v_blur_policy,
    'submit_on_fullscreen_exit',v_fullscreen_policy,
    'questions',(select coalesce(jsonb_agg(jsonb_build_object('id',q.question_id,'text',q.question_text,'options',q.options,
      'selected',v_attempt.answers ->> q.question_id::text) order by q.position),'[]'::jsonb)
      from public.gjm_quiz_attempt_questions q where q.attempt_id = v_attempt.id)
  );
end;
$$;

create or replace function public.record_gjm_quiz_event(p_attempt_id uuid, p_event_type text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempt public.gjm_quiz_attempts%rowtype;
begin
  select * into v_attempt from public.gjm_quiz_attempts
    where id = p_attempt_id and user_id = (select auth.uid()) for update;
  if not found or v_attempt.submitted_at is not null then raise exception 'Quiz attempt is closed'; end if;
  if p_event_type not in ('TAB_SWITCH','WINDOW_HIDDEN','WINDOW_BLUR','WINDOW_FOCUS','FULLSCREEN_EXIT',
      'NETWORK_INTERRUPTION','NETWORK_RESTORED','AUTO_SUBMIT_FAILED','SUBMISSION_RETRY') then
    raise exception 'Invalid exam event';
  end if;
  insert into public.gjm_quiz_attempt_events (attempt_id,event_type,details)
    values (p_attempt_id,p_event_type,coalesce(p_details,'{}'::jsonb));
  update public.gjm_quiz_attempts set
    visibility_flags = visibility_flags + case when p_event_type in ('TAB_SWITCH','WINDOW_HIDDEN') then 1 else 0 end,
    fullscreen_exits = fullscreen_exits + case when p_event_type = 'FULLSCREEN_EXIT' then 1 else 0 end,
    network_interruptions = network_interruptions + case when p_event_type = 'NETWORK_INTERRUPTION' then 1 else 0 end
    where id = p_attempt_id;
end;
$$;
revoke all on function public.start_gjm_quiz() from public, anon;
grant execute on function public.start_gjm_quiz() to authenticated;

drop function if exists public.submit_gjm_quiz(uuid,jsonb);
drop function if exists public.submit_gjm_quiz(uuid,jsonb,text);
create or replace function public.submit_gjm_quiz(p_attempt_id uuid, p_answers jsonb default null, p_reason text default 'MANUAL_SUBMIT', p_detected_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_attempt public.gjm_quiz_attempts%rowtype;
  v_correct integer;
  v_answers jsonb;
  v_allowed boolean := false;
  v_submission_reason text;
begin
  select * into v_attempt from public.gjm_quiz_attempts
    where id = p_attempt_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Quiz attempt not found' using errcode = '42501'; end if;
  if v_attempt.submitted_at is not null then
    return jsonb_build_object('correct_count',v_attempt.correct_count,'raw_score',v_attempt.raw_score,
      'normalized_score',v_attempt.normalized_score,'submitted_at',v_attempt.submitted_at,
      'submission_reason',v_attempt.submission_reason);
  end if;

  if now() >= v_attempt.expires_at then
    v_allowed := true;
  elsif p_reason = 'TIME_EXPIRED' then
    v_allowed := false;
  elsif p_reason in ('TAB_SWITCH','WINDOW_HIDDEN') then
    select coalesce(submit_on_tab_switch,false) into v_allowed from public.gjm_event_settings where id = true;
  elsif p_reason = 'WINDOW_BLUR' then
    select coalesce(submit_on_window_blur,false) into v_allowed from public.gjm_event_settings where id = true;
  elsif p_reason = 'FULLSCREEN_EXIT' then
    select coalesce(submit_on_fullscreen_exit,false) into v_allowed from public.gjm_event_settings where id = true;
  elsif p_reason = 'MANUAL_SUBMIT' then
    v_allowed := now() <= v_attempt.expires_at;
  end if;
  if not v_allowed then raise exception 'This submission reason is not allowed by the current exam policy'; end if;

  -- At/after the deadline, the server uses the latest previously saved answers.
  v_answers := case when now() >= v_attempt.expires_at or p_answers is null then v_attempt.answers else p_answers end;
  if now() < v_attempt.expires_at and p_answers is not null then
    if jsonb_typeof(p_answers) <> 'object' or exists (
      select 1 from jsonb_each_text(p_answers) a
      where a.value not in ('A','B','C','D') or not exists (
        select 1 from public.gjm_quiz_attempt_questions q where q.attempt_id = p_attempt_id and q.question_id::text = a.key
      )
    ) then raise exception 'Invalid quiz answers'; end if;
  end if;
  select count(*) filter (where v_answers ->> q.question_id::text = q.correct_option)
    into v_correct from public.gjm_quiz_attempt_questions q where q.attempt_id = p_attempt_id;
  v_submission_reason := case when now() >= v_attempt.expires_at then 'TIME_EXPIRED' else p_reason end;
  update public.gjm_quiz_attempts set answers = v_answers, submitted_at = now(), submission_reason = v_submission_reason,
    correct_count = v_correct, raw_score = v_correct * 0.5, normalized_score = v_correct * 2,
    visibility_flags = visibility_flags + case when v_submission_reason in ('TAB_SWITCH','WINDOW_HIDDEN') then 1 else 0 end,
    fullscreen_exits = fullscreen_exits + case when v_submission_reason = 'FULLSCREEN_EXIT' then 1 else 0 end
    where id = p_attempt_id;
  insert into public.gjm_quiz_attempt_events (attempt_id,event_type,details)
    values (p_attempt_id,case when v_submission_reason = 'MANUAL_SUBMIT' then 'MANUAL_SUBMIT' else v_submission_reason end,
      jsonb_build_object('submitted',true,'client_detected_at',p_detected_at));
  return jsonb_build_object('correct_count',v_correct,'raw_score',v_correct * 0.5,
    'normalized_score',v_correct * 2,'submitted_at',now(),'submission_reason',v_submission_reason);
end;
$$;

revoke all on function public.record_gjm_quiz_event(uuid,text,jsonb) from public, anon;
revoke all on function public.submit_gjm_quiz(uuid,jsonb,text,timestamptz) from public, anon;
grant execute on function public.record_gjm_quiz_event(uuid,text,jsonb) to authenticated;
grant execute on function public.submit_gjm_quiz(uuid,jsonb,text,timestamptz) to authenticated;
