-- Fabric Flo: normalized multi-tenant schema + membership (RBAC)
-- Apply after 001_user_app_state.sql (legacy blob can coexist until clients migrate).

-- ---------------------------------------------------------------------------
-- Helper: membership check (SECURITY INVOKER — uses caller RLS on members)
-- ---------------------------------------------------------------------------
create or replace function public.is_production_member(p_production_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.production_members m
    where m.production_id = p_production_id
      and m.user_id = auth.uid()
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

-- ---------------------------------------------------------------------------
-- Productions
-- ---------------------------------------------------------------------------
create table if not exists public.productions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  version bigint not null default 1,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists productions_archived_at_idx on public.productions (archived_at) where archived_at is null;

-- ---------------------------------------------------------------------------
-- Members (replaces plaintext PIN as primary gate; PIN may live in settings during transition)
-- Roles: admin, department_head, crew, viewer
-- ---------------------------------------------------------------------------
create table if not exists public.production_members (
  production_id uuid not null references public.productions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'department_head', 'crew', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (production_id, user_id)
);

create index if not exists production_members_user_id_idx on public.production_members (user_id);

-- ---------------------------------------------------------------------------
-- Invites (token_hash = hex digest of random token; never store raw token)
-- ---------------------------------------------------------------------------
create table if not exists public.production_invites (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions (id) on delete cascade,
  email text,
  role text not null check (role in ('admin', 'department_head', 'crew', 'viewer')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists production_invites_production_id_idx on public.production_invites (production_id);

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions (id) on delete cascade,
  kind text not null check (kind in ('studio', 'filming_location', 'transport_truck')),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists locations_production_id_idx on public.locations (production_id);

-- ---------------------------------------------------------------------------
-- Inventory items
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions (id) on delete cascade,
  kind text not null check (kind in ('fabric', 'bag')),
  name text not null,
  size text,
  notes text,
  condition text check (condition is null or condition in ('ok', 'lost', 'damaged')),
  stable_public_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version bigint not null default 1
);

create index if not exists inventory_items_production_id_idx on public.inventory_items (production_id);
create unique index if not exists inventory_items_stable_public_id_uidx
  on public.inventory_items (production_id, stable_public_id)
  where stable_public_id is not null;

-- ---------------------------------------------------------------------------
-- QR aliases (rotating / dynamic codes)
-- ---------------------------------------------------------------------------
create table if not exists public.item_qr_aliases (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  unique (item_id, alias)
);

create index if not exists item_qr_aliases_alias_idx on public.item_qr_aliases (alias);

-- ---------------------------------------------------------------------------
-- Scan events (append-only; idempotency for flaky mobile networks)
-- ---------------------------------------------------------------------------
create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  item_kind text not null check (item_kind in ('fabric', 'bag')),
  item_name text not null,
  location_kind text not null check (location_kind in ('studio', 'filming_location', 'transport_truck')),
  location_label text not null,
  scanned_at timestamptz not null,
  raw_qr text not null,
  scanned_by uuid references auth.users (id) on delete set null,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create index if not exists scan_events_production_scanned_at_idx
  on public.scan_events (production_id, scanned_at desc);
create index if not exists scan_events_item_id_idx on public.scan_events (item_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.productions enable row level security;
alter table public.production_members enable row level security;
alter table public.production_invites enable row level security;
alter table public.locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.item_qr_aliases enable row level security;
alter table public.scan_events enable row level security;

-- Members: each user reads their own membership rows
create policy production_members_select_own
  on public.production_members for select
  using (user_id = auth.uid());

-- Productions: visible if member
create policy productions_select_member
  on public.productions for select
  using (public.is_production_member(id));

-- Inserts: only via RPC in practice; allow admin insert for bootstrap if needed — deny direct insert
create policy productions_no_direct_insert
  on public.productions for insert
  with check (false);

create policy productions_update_admin
  on public.productions for update
  using (public.is_production_member(id, array['admin', 'department_head']::text[]))
  with check (public.is_production_member(id, array['admin', 'department_head']::text[]));

-- production_members: managed by RPC / service; deny direct writes from clients
create policy production_members_no_direct_write
  on public.production_members for all
  using (false);

-- invites: members with admin or department_head can read invites for their production
create policy production_invites_select_heads
  on public.production_invites for select
  using (public.is_production_member(production_id, array['admin', 'department_head']::text[]));

create policy production_invites_no_direct_mutate
  on public.production_invites for insert
  with check (false);

-- locations
create policy locations_select_member
  on public.locations for select
  using (public.is_production_member(production_id));

create policy locations_mutate_heads
  on public.locations for all
  using (public.is_production_member(production_id, array['admin', 'department_head']::text[]))
  with check (public.is_production_member(production_id, array['admin', 'department_head']::text[]));

-- inventory_items
create policy inventory_items_select_member
  on public.inventory_items for select
  using (public.is_production_member(production_id));

create policy inventory_items_mutate_heads
  on public.inventory_items for all
  using (public.is_production_member(production_id, array['admin', 'department_head']::text[]))
  with check (public.is_production_member(production_id, array['admin', 'department_head']::text[]));

-- item_qr_aliases (join item -> production)
create policy item_qr_aliases_select_member
  on public.item_qr_aliases for select
  using (
    exists (
      select 1 from public.inventory_items i
      where i.id = item_qr_aliases.item_id
        and public.is_production_member(i.production_id)
    )
  );

create policy item_qr_aliases_mutate_heads
  on public.item_qr_aliases for all
  using (
    exists (
      select 1 from public.inventory_items i
      where i.id = item_qr_aliases.item_id
        and public.is_production_member(i.production_id, array['admin', 'department_head']::text[])
    )
  )
  with check (
    exists (
      select 1 from public.inventory_items i
      where i.id = item_qr_aliases.item_id
        and public.is_production_member(i.production_id, array['admin', 'department_head']::text[])
    )
  );

-- scan_events: members can read; crew+ can insert (handled by RPC); restrict direct insert
create policy scan_events_select_member
  on public.scan_events for select
  using (public.is_production_member(production_id));

create policy scan_events_insert_member
  on public.scan_events for insert
  with check (
    public.is_production_member(production_id, array['admin', 'department_head', 'crew']::text[])
  );

create policy scan_events_no_update
  on public.scan_events for update
  using (false);

create policy scan_events_no_delete
  on public.scan_events for delete
  using (false);
