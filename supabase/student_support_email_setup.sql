-- Anonymous support-request throttling and status log. Contains hashes and status only,
-- never names, email addresses, phone numbers, subjects, or message bodies.
create table if not exists public.gjm_support_request_events (
  request_id uuid primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('pending', 'provider_failed', 'support_sent', 'sent', 'confirmation_failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  support_provider_id text,
  confirmation_provider_id text
);
create index if not exists gjm_support_request_events_rate_idx
  on public.gjm_support_request_events (email_hash, created_at desc);
create index if not exists gjm_support_request_events_fingerprint_idx
  on public.gjm_support_request_events (request_fingerprint, created_at desc);
alter table public.gjm_support_request_events enable row level security;
revoke all on public.gjm_support_request_events from public, anon, authenticated;
grant all on public.gjm_support_request_events to service_role;

create or replace function public.claim_gjm_support_request(
  p_request_id uuid,
  p_email_hash text,
  p_request_fingerprint text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
  existing public.gjm_support_request_events%rowtype;
  claimed_at timestamptz;
begin
  if p_email_hash !~ '^[0-9a-f]{64}$' or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    return 'invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_email_hash, 0));

  select * into existing from public.gjm_support_request_events where request_id = p_request_id for update;
  if found then
    if existing.status = 'provider_failed' and existing.request_fingerprint = p_request_fingerprint then
      update public.gjm_support_request_events set status = 'pending', completed_at = null where request_id = p_request_id;
      return 'claimed:' || existing.created_at::text;
    end if;
    return 'duplicate_request';
  end if;
  if exists (
    select 1 from public.gjm_support_request_events
    where request_fingerprint = p_request_fingerprint
      and status in ('pending', 'support_sent', 'sent', 'confirmation_failed')
      and created_at > now() - interval '10 minutes'
  ) then
    return 'duplicate_submission';
  end if;

  select count(*) into recent_count from public.gjm_support_request_events
  where email_hash = p_email_hash and created_at > now() - interval '1 hour';
  if recent_count >= 5 then return 'rate_limited'; end if;
  if exists (
    select 1 from public.gjm_support_request_events
    where email_hash = p_email_hash and created_at > now() - interval '45 seconds'
  ) then return 'rate_limited'; end if;

  insert into public.gjm_support_request_events (request_id, email_hash, request_fingerprint, status)
  values (p_request_id, p_email_hash, p_request_fingerprint, 'pending') returning created_at into claimed_at;
  return 'claimed:' || claimed_at::text;
end;
$$;
revoke all on function public.claim_gjm_support_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_gjm_support_request(uuid, text, text) to service_role;
