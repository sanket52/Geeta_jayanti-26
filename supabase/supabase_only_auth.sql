-- Switch the existing student data policies to Supabase Auth without deleting
-- registrations or submissions. Apply after the existing project SQL files.

create or replace function public.current_user_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;
revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

drop index if exists public.profiles_asgardeo_identity_unique;
drop index if exists public.profiles_asgardeo_sub_unique;

-- The prior third-party-auth migration added a restrictive identity gate to
-- each RLS-enabled public table. Replace that gate with Supabase session
-- validation; each table's existing owner/admin policies still decide which
-- rows the signed-in user can access.
do $$
declare item record;
begin
  for item in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists %I on %I.%I', 'asgardeo_student_identity_required', item.schema_name, item.table_name);
    execute format('drop policy if exists %I on %I.%I', 'supabase_authenticated_session_required', item.schema_name, item.table_name);
    execute format('create policy %I on %I.%I as restrictive for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)', 'supabase_authenticated_session_required', item.schema_name, item.table_name);
  end loop;
end $$;

drop policy if exists asgardeo_student_identity_required on storage.objects;
drop function if exists public.has_asgardeo_student_identity();
drop policy if exists supabase_authenticated_session_required on storage.objects;
create policy supabase_authenticated_session_required on storage.objects as restrictive for all to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- Link a previously registered row to a new Supabase Auth UUID only after the
-- caller's Supabase access token and verified email were checked server-side.
create or replace function public.link_existing_student_registration(p_user_id uuid, p_verified_email text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare v_old_user_id uuid; v_registration_id uuid; v_registration_number text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Student account linking requires the secure server';
  end if;
  if p_user_id is null or nullif(trim(p_verified_email), '') is null then
    raise exception 'A verified Supabase identity is required';
  end if;
  select r.user_id, r.id, r.registration_number
    into v_old_user_id, v_registration_id, v_registration_number
    from public.candidate_registrations r
    where lower(r.email) = lower(trim(p_verified_email))
    for update;
  if not found then return false; end if;
  if v_old_user_id = p_user_id then return true; end if;
  if exists (select 1 from public.candidate_registrations r where r.user_id = p_user_id and r.id <> v_registration_id) then
    raise exception 'This Supabase account already owns a different registration';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user_id and p.role in ('admin','teacher')) then
    raise exception 'A staff account cannot be linked as a student';
  end if;

  -- Clear the legacy profile's unique registration number but keep that row.
  update public.profiles set registration_number = null where id = v_old_user_id and id <> p_user_id;
  update public.candidate_registrations set user_id = p_user_id where id = v_registration_id;
  update public.profiles set registration_number = v_registration_number where id = p_user_id and role = 'student';
  update public.exam_attempts set user_id = p_user_id where user_id = v_old_user_id;
  update public.gjm_registration_documents set user_id = p_user_id where user_id = v_old_user_id;
  update public.gjm_quiz_attempts set user_id = p_user_id where user_id = v_old_user_id;
  update public.oral_exam_submissions set student_id = p_user_id where student_id = v_old_user_id;
  return true;
end;
$$;
revoke all on function public.link_existing_student_registration(uuid,text) from public, anon, authenticated;
grant execute on function public.link_existing_student_registration(uuid,text) to service_role;

-- Keep existing private objects in place; their metadata now identifies the
-- verified owner after the account-link RPC updates its row ownership.
drop policy if exists "Students and staff can read permitted video files" on storage.objects;
create policy "Students and staff can read permitted video files" on storage.objects
  for select to authenticated using (
    bucket_id = 'oral-exam-videos' and (
      exists (select 1 from public.oral_exam_submissions s where s.storage_path = name and s.student_id = (select auth.uid()))
      or public.current_user_role() in ('teacher','admin')
    )
  );

drop policy if exists "Owners admins and assigned judges view GJM files" on storage.objects;
create policy "Owners admins and assigned judges view GJM files" on storage.objects
  for select to authenticated using (
    bucket_id = 'gjm-competition-submissions' and (
      exists (select 1 from public.gjm_submission_files f join public.gjm_submissions s on s.id = f.submission_id
        join public.candidate_registrations r on r.id = s.registration_id
        where f.storage_path = name and r.user_id = (select auth.uid()))
      or public.current_user_role() = 'admin'
      or exists (select 1 from public.gjm_submission_files f join public.gjm_judge_assignments j on j.submission_id = f.submission_id
        where f.storage_path = name and j.judge_user_id = (select auth.uid()))
    )
  );
