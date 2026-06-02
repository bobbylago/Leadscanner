create table if not exists public.saved_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  city text not null,
  industry text not null,
  lead_count integer not null default 0,
  leads jsonb not null default '[]'::jsonb,
  map_center jsonb,
  created_at timestamptz not null default now()
);

alter table public.saved_scans enable row level security;

drop policy if exists "Users can manage their saved scans" on public.saved_scans;
create policy "Users can manage their saved scans"
on public.saved_scans
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan text not null default 'free',
  status text not null default 'free',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions add column if not exists stripe_customer_id text;
alter table public.subscriptions add column if not exists stripe_subscription_id text;
alter table public.subscriptions add column if not exists stripe_price_id text;
alter table public.subscriptions add column if not exists plan text not null default 'free';
alter table public.subscriptions add column if not exists status text not null default 'free';
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions add column if not exists updated_at timestamptz not null default now();

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read their subscription" on public.subscriptions;
create policy "Users can read their subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  month_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

drop policy if exists "Users can read their usage" on public.usage_events;
create policy "Users can read their usage"
on public.usage_events
for select
to authenticated
using (auth.uid() = user_id);

create table if not exists public.lead_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id text not null,
  website_domain text,
  name_key text not null default '',
  audit jsonb not null,
  audited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lead_audits add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.lead_audits add column if not exists lead_id text;
alter table public.lead_audits add column if not exists website_domain text;
alter table public.lead_audits add column if not exists name_key text not null default '';
alter table public.lead_audits add column if not exists audit jsonb;
alter table public.lead_audits add column if not exists audited_at timestamptz not null default now();
alter table public.lead_audits add column if not exists created_at timestamptz not null default now();
alter table public.lead_audits add column if not exists updated_at timestamptz not null default now();

create unique index if not exists lead_audits_user_lead_id_key
on public.lead_audits(user_id, lead_id);

create index if not exists lead_audits_user_website_domain_idx
on public.lead_audits(user_id, website_domain)
where website_domain is not null;

alter table public.lead_audits enable row level security;

drop policy if exists "Users can manage their lead audits" on public.lead_audits;
create policy "Users can manage their lead audits"
on public.lead_audits
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.free_account_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email_hash text not null,
  ip_hash text,
  device_hash text,
  created_at timestamptz not null default now()
);

alter table public.free_account_claims add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.free_account_claims add column if not exists email_hash text;
alter table public.free_account_claims add column if not exists ip_hash text;
alter table public.free_account_claims add column if not exists device_hash text;
alter table public.free_account_claims add column if not exists created_at timestamptz not null default now();

create unique index if not exists free_account_claims_user_id_key
on public.free_account_claims(user_id)
where user_id is not null;

create unique index if not exists free_account_claims_email_hash_key
on public.free_account_claims(email_hash);

create index if not exists free_account_claims_ip_hash_created_at_idx
on public.free_account_claims(ip_hash, created_at desc);

create index if not exists free_account_claims_device_hash_created_at_idx
on public.free_account_claims(device_hash, created_at desc);

alter table public.free_account_claims enable row level security;

create table if not exists public.contacted (
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  lead_id text,
  lead_name text,
  subject text,
  sent_at timestamptz not null default now(),
  primary key (user_id, email)
);

alter table public.contacted enable row level security;

drop policy if exists "Users manage their contacted leads" on public.contacted;
create policy "Users manage their contacted leads"
on public.contacted
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
