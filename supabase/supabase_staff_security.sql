-- Staff account foundation. Apply after supabase_only_auth.sql.
-- This migration adds rows and policies; it does not delete existing records.

create table if not exists public.teacher_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(trim(email))),
  full_name text not null check (length(trim(full_name)) between 2 and 160),
  mobile text,
  duties text[] not null default '{}',
  access_modules text[] not null default '{}',
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','suspended')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.teacher_profiles enable row level security;
revoke all on public.teacher_profiles from anon, authenticated;
grant select on public.teacher_profiles to authenticated;
drop policy if exists "Teachers read own staff profile" on public.teacher_profiles;
create policy "Teachers read own staff profile" on public.teacher_profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_role() = 'admin');

create table if not exists public.security_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.security_audit_log enable row level security;
revoke all on public.security_audit_log from anon, authenticated;
grant select on public.security_audit_log to authenticated;
drop policy if exists "Admins read security audit log" on public.security_audit_log;
create policy "Admins read security audit log" on public.security_audit_log for select to authenticated
  using (public.current_user_role() = 'admin');

-- A teacher is trusted only after an administrator approves the invitation.
-- This also gates legacy table policies that check current_user_role().
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p.role = 'teacher' and coalesce(t.approval_status, 'pending') <> 'approved' then 'pending_teacher'
    else p.role
  end
  from public.profiles p left join public.teacher_profiles t on t.user_id = p.id
  where p.id = (select auth.uid())
$$;
revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;
