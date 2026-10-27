-- Migration 22: Stripe subscription per business. Only the server (Netlify functions with the service role) writes this table;
-- owners and admins can read their own business's plan. Safe to re-run.
create table if not exists public.business_billing (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'none' check (status in ('none', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused')),
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.business_billing enable row level security;
revoke all on public.business_billing from anon, authenticated;
grant select on public.business_billing to authenticated;
grant all on public.business_billing to service_role;

drop policy if exists business_billing_read on public.business_billing;
create policy business_billing_read on public.business_billing for select to authenticated using (public.is_business_manager(business_id));
