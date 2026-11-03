-- Migration 27: payment button for business chats (opens the payment link the business sets). Safe to re-run.
alter table public.business_actions drop constraint if exists business_actions_type_check;
alter table public.business_actions add constraint business_actions_type_check check (type in ('appointment', 'catalog', 'call', 'human', 'link', 'payment'));
alter table public.business_actions drop constraint if exists business_actions_check;
alter table public.business_actions drop constraint if exists business_actions_url_required;
alter table public.business_actions add constraint business_actions_url_required check (type not in ('link', 'payment') or url is not null);
