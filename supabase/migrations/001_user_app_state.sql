-- Run in Supabase SQL Editor (or via CLI) before using cloud sync in Fabric Flo.
-- Stores one JSON blob per authenticated user. Security relies on RLS + anon key in the browser.

create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

create policy "user_app_state_select_own"
  on public.user_app_state
  for select
  using (auth.uid() = user_id);

create policy "user_app_state_insert_own"
  on public.user_app_state
  for insert
  with check (auth.uid() = user_id);

create policy "user_app_state_update_own"
  on public.user_app_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: allow delete (app does not require it)
create policy "user_app_state_delete_own"
  on public.user_app_state
  for delete
  using (auth.uid() = user_id);
