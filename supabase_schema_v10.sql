-- KOPI BOY V10 — MANAGEMENT APPROVAL + PARTNER NOTIFICATIONS
-- Run this AFTER supabase_schema_v9.sql in the existing Kopi Boy Supabase project.
-- This migration is additive: it does not delete existing data.

-- Link an application to the Google-authenticated partner who submitted it.
alter table public.cook_applications
  add column if not exists user_id uuid,
  add column if not exists email text;

alter table public.rider_applications
  add column if not exists user_id uuid,
  add column if not exists email text;

-- Notification inbox used by the Partner app after management approval.
create table if not exists public.partner_notifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid,
  partner_type text not null check (partner_type in ('cook','rider')),
  recipient_user_id uuid,
  recipient_email text,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists partner_notifications_user_idx
  on public.partner_notifications(recipient_user_id, created_at desc);

create index if not exists partner_notifications_email_idx
  on public.partner_notifications(recipient_email, created_at desc);

alter table public.partner_notifications enable row level security;

drop policy if exists "partners can read own notifications" on public.partner_notifications;
create policy "partners can read own notifications"
on public.partner_notifications
for select to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email,'')) = lower(coalesce(auth.email(),''))
);

drop policy if exists "authenticated can create partner notifications" on public.partner_notifications;
create policy "authenticated can create partner notifications"
on public.partner_notifications
for insert to authenticated
with check (true);

drop policy if exists "partners can mark own notifications read" on public.partner_notifications;
create policy "partners can mark own notifications read"
on public.partner_notifications
for update to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email,'')) = lower(coalesce(auth.email(),''))
)
with check (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email,'')) = lower(coalesce(auth.email(),''))
);

grant select, insert, update on public.partner_notifications to authenticated;
grant select on public.partner_notifications to anon;

-- Keep realtime available for the management dashboard and partner inbox.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='partner_notifications'
  ) then
    alter publication supabase_realtime add table public.partner_notifications;
  end if;
end $$;

-- Existing application rows remain valid. Future Partner app submissions should
-- populate user_id + email so approval messages can be delivered to the right account.
