-- Exam identity and mock-attempt reliability upgrade.
-- Apply after the student registration, oral exam, and GJM mock-test setup SQL.
-- Existing registrations and attempts are preserved.

-- Backfill profile registration numbers only from an already-authenticated
-- registration relationship. Never infer ownership from an unverified email.
update public.profiles p
set registration_number = r.registration_number
from public.candidate_registrations r
where r.user_id = p.id
  and p.role = 'student'
  and (p.registration_number is null or p.registration_number = r.registration_number)
  and not exists(select 1 from public.profiles other where other.registration_number = r.registration_number and other.id <> p.id);

-- Repair the early-return case in the existing secure account-link function.
create or replace function public.link_existing_student_registration(p_user_id uuid, p_verified_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_old_user_id uuid; v_registration_id uuid; v_registration_number text;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Student account linking requires the secure server'; end if;
  if p_user_id is null or nullif(trim(p_verified_email), '') is null then raise exception 'A verified Supabase identity is required'; end if;
  select r.user_id,r.id,r.registration_number into v_old_user_id,v_registration_id,v_registration_number
  from public.candidate_registrations r where lower(r.email) = lower(trim(p_verified_email)) for update;
  if not found then return false; end if;
  if exists (select 1 from public.candidate_registrations r where r.user_id = p_user_id and r.id <> v_registration_id) then
    raise exception 'This Supabase account already owns a different registration';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user_id and p.role in ('admin','teacher')) then
    raise exception 'A staff account cannot be linked as a student';
  end if;
  if v_old_user_id is distinct from p_user_id then
    update public.profiles set registration_number = null where id = v_old_user_id and id <> p_user_id;
    update public.candidate_registrations set user_id = p_user_id where id = v_registration_id;
    update public.exam_attempts set user_id = p_user_id where user_id = v_old_user_id;
    update public.gjm_registration_documents set user_id = p_user_id where user_id = v_old_user_id;
    update public.gjm_quiz_attempts set user_id = p_user_id where user_id = v_old_user_id;
    update public.oral_exam_submissions set student_id = p_user_id where student_id = v_old_user_id;
  end if;
  update public.profiles set registration_number = v_registration_number where id = p_user_id and role = 'student';
  return true;
end;
$$;
revoke all on function public.link_existing_student_registration(uuid,text) from public, anon, authenticated;
grant execute on function public.link_existing_student_registration(uuid,text) to service_role;

-- Oral submissions derive identity from the authenticated database relationship,
-- not client localStorage or a browser-supplied registration number/name.
drop function if exists public.submit_oral_exam_submission(text,text,bigint,text,text);
create or replace function public.submit_oral_exam_submission(
  p_storage_path text, p_content_type text, p_file_size bigint, p_subject text, p_question text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_registration public.candidate_registrations%rowtype; v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to submit your oral examination' using errcode = '42501'; end if;
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> v_user::text then raise exception 'Invalid submission file path'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id = 'oral-exam-videos' and o.name = p_storage_path) then raise exception 'The uploaded video could not be found'; end if;
  if p_file_size is null or p_file_size <= 0 then raise exception 'The video file is empty'; end if;
  if p_content_type not in ('video/webm','video/mp4','video/quicktime') then raise exception 'Unsupported video format'; end if;
  select * into v_registration from public.candidate_registrations r where r.user_id = v_user;
  if not found then raise exception 'No student registration is linked to this signed-in account'; end if;
  if not exists(select 1 from public.profiles p where p.id = v_user and p.role = 'student') then raise exception 'This account is not a student account' using errcode = '42501'; end if;
  update public.profiles set registration_number = v_registration.registration_number where id = v_user and role = 'student';
  insert into public.oral_exam_submissions(student_id,registration_number,student_name,subject,question,storage_path,content_type,file_size)
  values(v_user,v_registration.registration_number,v_registration.full_name,left(coalesce(p_subject,''),120),left(coalesce(p_question,''),1000),p_storage_path,p_content_type,p_file_size)
  returning id into v_id;
  return jsonb_build_object('id',v_id,'registration_number',v_registration.registration_number,'student_name',v_registration.full_name);
end;
$$;
revoke all on function public.submit_oral_exam_submission(text,text,bigint,text,text) from public, anon;
grant execute on function public.submit_oral_exam_submission(text,text,bigint,text,text) to authenticated;

-- Persist mock attempts independently from official exam attempts. Correct
-- answers stay on the server until submission; repeated submit calls return
-- the stored evaluation without awarding or changing anything a second time.
create table if not exists public.gjm_mock_test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  registration_id uuid references public.candidate_registrations(id) on delete set null,
  question_ids uuid[] not null check (cardinality(question_ids) = 50),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '25 minutes'),
  submitted_at timestamptz,
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  result jsonb,
  check ((submitted_at is null and result is null) or (submitted_at is not null and result is not null))
);
create index if not exists gjm_mock_test_attempts_user_idx on public.gjm_mock_test_attempts(user_id, started_at desc);
alter table public.gjm_mock_test_attempts enable row level security;
drop policy if exists "Students and admins read mock attempts" on public.gjm_mock_test_attempts;
create policy "Students and admins read mock attempts" on public.gjm_mock_test_attempts
  for select to authenticated using (user_id = (select auth.uid()) or public.current_user_role() = 'admin');
revoke all on public.gjm_mock_test_attempts from public, anon, authenticated;
grant select on public.gjm_mock_test_attempts to authenticated;

create or replace function public.start_gjm_mock_test()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_reg uuid; v_ids uuid[]; v_attempt public.gjm_mock_test_attempts%rowtype;
begin
  if v_user is null then raise exception 'Sign in to start a mock test' using errcode = '42501'; end if;
  if not exists(select 1 from public.profiles p where p.id = v_user and p.role = 'student') then raise exception 'A linked student account is required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0));
  select id into v_reg from public.candidate_registrations where user_id = v_user;
  if v_reg is null then raise exception 'No student registration is linked to this signed-in account' using errcode = '42501'; end if;
  select * into v_attempt from public.gjm_mock_test_attempts where user_id=v_user and submitted_at is null order by started_at desc limit 1 for update;
  if found then
    v_ids := v_attempt.question_ids;
  else
    select array_agg(id) into v_ids from (select id from public.gjm_mock_questions where published order by extensions.gen_random_uuid() limit 50) q;
    if coalesce(cardinality(v_ids),0) <> 50 then raise exception 'The practice bank must contain 50 published questions'; end if;
    insert into public.gjm_mock_test_attempts(user_id,registration_id,question_ids) values(v_user,v_reg,v_ids) returning * into v_attempt;
  end if;
  return jsonb_build_object('attempt_id',v_attempt.id,'started_at',v_attempt.started_at,'expires_at',v_attempt.expires_at,
    'server_now',now(),'answers',v_attempt.answers,'questions',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'topic',q.topic,'question_en',q.question_en,'options',q.options) order by array_position(v_ids,q.id)),'[]'::jsonb)
      from public.gjm_mock_questions q where q.id = any(v_ids)));
end;
$$;

create or replace function public.save_gjm_mock_answers(p_attempt_id uuid,p_answers jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_attempt public.gjm_mock_test_attempts%rowtype;
begin
  select * into v_attempt from public.gjm_mock_test_attempts where id=p_attempt_id and user_id=(select auth.uid()) for update;
  if not found or v_attempt.submitted_at is not null then raise exception 'Mock attempt is unavailable'; end if;
  if now() >= v_attempt.expires_at then raise exception 'Mock test time has expired'; end if;
  if jsonb_typeof(p_answers) <> 'object' or exists(select 1 from jsonb_each_text(p_answers) a
    where a.value !~ '^[0-3]$' or not (a.key::uuid = any(v_attempt.question_ids))) then raise exception 'Invalid mock answers'; end if;
  update public.gjm_mock_test_attempts set answers=p_answers where id=p_attempt_id;
end;
$$;

create or replace function public.submit_gjm_mock_attempt(p_attempt_id uuid,p_answers jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_attempt public.gjm_mock_test_attempts%rowtype; v_answers jsonb; v_correct int; v_answered int; v_review jsonb; v_topics jsonb; v_result jsonb;
begin
  select * into v_attempt from public.gjm_mock_test_attempts where id=p_attempt_id and user_id=(select auth.uid()) for update;
  if not found then raise exception 'Mock attempt not found' using errcode='42501'; end if;
  if v_attempt.submitted_at is not null then return v_attempt.result; end if;
  v_answers := case when now() >= v_attempt.expires_at or p_answers is null then v_attempt.answers else p_answers end;
  if jsonb_typeof(v_answers) <> 'object' or exists(select 1 from jsonb_each_text(v_answers) a
    where a.value !~ '^[0-3]$' or not (a.key::uuid = any(v_attempt.question_ids))) then raise exception 'Invalid mock answers'; end if;
  select count(*) filter(where (v_answers->>q.id::text)::int=q.correct_index),count(*) filter(where v_answers ? q.id::text)
    into v_correct,v_answered from public.gjm_mock_questions q where q.id=any(v_attempt.question_ids);
  select jsonb_agg(jsonb_build_object('id',q.id,'topic',q.topic,'question',q.question_en,'options',q.options,
    'correctIndex',q.correct_index,'selectedIndex',case when v_answers ? q.id::text then (v_answers->>q.id::text)::int else null end,
    'explanation',q.explanation_en) order by array_position(v_attempt.question_ids,q.id)) into v_review
    from public.gjm_mock_questions q where q.id=any(v_attempt.question_ids);
  select jsonb_agg(jsonb_build_object('topic',t.topic,'correct',t.correct,'total',t.total)) into v_topics from (
    select q.topic,count(*) filter(where (v_answers->>q.id::text)::int=q.correct_index)::int correct,count(*)::int total
    from public.gjm_mock_questions q where q.id=any(v_attempt.question_ids) group by q.topic) t;
  v_result:=jsonb_build_object('score',v_correct,'total',50,'answered',v_answered,'incorrect',v_answered-v_correct,
    'unanswered',50-v_answered,'percentage',v_correct*2,'review',coalesce(v_review,'[]'::jsonb),'topics',coalesce(v_topics,'[]'::jsonb));
  update public.gjm_mock_test_attempts set answers=v_answers,submitted_at=now(),correct_count=v_correct,
    incorrect_count=v_answered-v_correct,unanswered_count=50-v_answered,result=v_result where id=p_attempt_id;
  return v_result;
end;
$$;
revoke all on function public.start_gjm_mock_test() from public,anon;
revoke all on function public.save_gjm_mock_answers(uuid,jsonb) from public,anon;
revoke all on function public.submit_gjm_mock_attempt(uuid,jsonb) from public,anon;
grant execute on function public.start_gjm_mock_test() to authenticated;
grant execute on function public.save_gjm_mock_answers(uuid,jsonb) to authenticated;
grant execute on function public.submit_gjm_mock_attempt(uuid,jsonb) to authenticated;
drop function if exists public.submit_gjm_mock_test(uuid[],jsonb);

-- Submission is idempotent; at expiry, grade only answers last saved by the server.
create or replace function public.submit_candidate_exam(p_attempt_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_attempt public.exam_attempts%rowtype; v_score numeric(9,2); v_total numeric(9,2); v_answered integer; v_result jsonb;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id and user_id=(select auth.uid()) for update;
  if not found then raise exception 'Exam attempt not found' using errcode='42501'; end if;
  if v_attempt.submitted_at is not null then
    return jsonb_build_object('score',v_attempt.score,'total_marks',v_attempt.total_marks,
      'answered',(select count(*) from jsonb_object_keys(v_attempt.answers)),'submitted_at',v_attempt.submitted_at);
  end if;
  if now() >= v_attempt.expires_at then p_answers:=v_attempt.answers; end if;
  if jsonb_typeof(p_answers) <> 'object' or exists(select 1 from jsonb_each_text(p_answers) a
    where a.key !~ '^[0-9a-fA-F-]{36}$' or a.value not in ('A','B','C','D')
      or not exists(select 1 from public.exam_attempt_questions q where q.attempt_id=p_attempt_id and q.question_id::text=a.key)) then
    raise exception 'One or more answers are invalid';
  end if;
  select coalesce(sum(case when p_answers->>q.question_id::text=q.correct_option then q.marks
    when p_answers ? q.question_id::text then -q.negative_marks else 0 end),0),coalesce(sum(q.marks),0),
    count(*) filter(where p_answers ? q.question_id::text) into v_score,v_total,v_answered
    from public.exam_attempt_questions q where q.attempt_id=p_attempt_id;
  update public.exam_attempts set answers=p_answers,submitted_at=now(),score=v_score,total_marks=v_total where id=p_attempt_id;
  return jsonb_build_object('score',v_score,'total_marks',v_total,'answered',v_answered,'submitted_at',now());
end;
$$;
revoke all on function public.submit_candidate_exam(uuid,jsonb) from public,anon;
grant execute on function public.submit_candidate_exam(uuid,jsonb) to authenticated;
