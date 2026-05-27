-- Append-only audit trail for security-relevant actions (RLS: admins/heads read only).

create table if not exists public.fabric_flo_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  production_id uuid references public.productions (id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fabric_flo_audit_log_production_id_idx
  on public.fabric_flo_audit_log (production_id, created_at desc);

alter table public.fabric_flo_audit_log enable row level security;

create policy fabric_flo_audit_log_select_heads
  on public.fabric_flo_audit_log for select
  using (
    production_id is not null
    and public.is_production_member(
      production_id,
      array['admin', 'department_head']::text[]
    )
  );

create policy fabric_flo_audit_log_no_client_write
  on public.fabric_flo_audit_log for insert
  with check (false);

create policy fabric_flo_audit_log_no_update
  on public.fabric_flo_audit_log for update
  using (false);

create policy fabric_flo_audit_log_no_delete
  on public.fabric_flo_audit_log for delete
  using (false);

-- Inserts are intended from SECURITY DEFINER RPCs or service role (bypasses RLS).
