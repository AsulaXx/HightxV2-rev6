
create table if not exists public.topup_provider_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_by_uid text,
  updated_at timestamptz not null default now()
);
alter table public.topup_provider_config enable row level security;

create table if not exists public.topup_admins (
  firebase_uid text primary key,
  added_at timestamptz not null default now(),
  note text
);
alter table public.topup_admins enable row level security;

-- deny-all from client; service-role bypasses RLS automatically
revoke all on public.topup_provider_config from anon, authenticated;
revoke all on public.topup_admins from anon, authenticated;
