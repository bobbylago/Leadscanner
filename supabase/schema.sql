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
