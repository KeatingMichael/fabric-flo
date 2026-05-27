-- Phase 2: audit logging, production invites, server-side inventory import.
-- Requires 002–004.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Audit helper (SECURITY DEFINER — bypasses RLS insert deny on audit table)
-- ---------------------------------------------------------------------------
create or replace function public.fabric_flo_audit(
  p_production_id uuid,
  p_action text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fabric_flo_audit_log (user_id, production_id, action, detail)
  values (auth.uid(), p_production_id, p_action, coalesce(p_detail, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Create production (+ audit)
-- ---------------------------------------------------------------------------
create or replace function public.fabric_flo_create_production(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if trim(p_name) = '' then
    raise exception 'invalid_name';
  end if;

  insert into public.productions (name)
  values (trim(p_name))
  returning id into v_id;

  insert into public.production_members (production_id, user_id, role)
  values (v_id, auth.uid(), 'admin');

  perform public.fabric_flo_audit(v_id, 'production_created', jsonb_build_object('name', trim(p_name)));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Push (+ per-production audit)
-- ---------------------------------------------------------------------------
create or replace function public.fabric_flo_push(p_state jsonb, p_expected_versions jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prod record;
  v_pid uuid;
  v_exp bigint;
  v_cur bigint;
  v_loc jsonb;
  v_item jsonb;
  v_scan jsonb;
  v_sid uuid;
  v_settings jsonb;
  v_versions jsonb := '{}'::jsonb;
  v_ik text;
  v_update_count int;
  v_item_count int;
  v_loc_count int;
  v_scan_count int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_state is null or jsonb_typeof(p_state -> 'productions') <> 'array' then
    raise exception 'invalid_state';
  end if;

  for v_prod in select * from jsonb_array_elements(coalesce(p_state -> 'productions', '[]'::jsonb))
  loop
    v_pid := (v_prod.value ->> 'id')::uuid;
    if v_pid is null then
      continue;
    end if;

    if not exists (select 1 from public.productions where id = v_pid) then
      raise exception 'unknown_production %', v_pid;
    end if;

    if not public.is_production_member(
      v_pid,
      array['admin', 'department_head', 'crew']::text[]
    ) then
      raise exception 'forbidden_production %', v_pid;
    end if;

    if p_expected_versions ? v_pid::text then
      v_exp := (p_expected_versions ->> v_pid::text)::bigint;
      select version into v_cur from public.productions where id = v_pid for update;
      if v_cur is distinct from v_exp then
        raise exception 'version_conflict'
          using errcode = 'P0001',
            message = format('production=%s server_version=%s', v_pid, v_cur);
      end if;
    end if;

    delete from public.scan_events where production_id = v_pid;
    delete from public.item_qr_aliases a
      using public.inventory_items i
      where a.item_id = i.id and i.production_id = v_pid;
    delete from public.inventory_items where production_id = v_pid;
    delete from public.locations where production_id = v_pid;

    v_settings := coalesce(v_prod.value -> 'settings', '{}'::jsonb);
    if (v_prod.value ? 'departmentHeadPin') then
      v_settings := v_settings || jsonb_build_object(
        'departmentHeadPin',
        nullif(v_prod.value ->> 'departmentHeadPin', '')
      );
    end if;

    update public.productions
    set
      name = coalesce(nullif(trim(v_prod.value ->> 'name'), ''), name),
      settings = coalesce(v_settings, '{}'::jsonb),
      updated_at = now(),
      version = version + 1
    where id = v_pid
    returning version into v_cur;

    get diagnostics v_update_count = row_count;
    if v_update_count = 0 then
      raise exception 'unknown_production %', v_pid;
    end if;

    v_versions := v_versions || jsonb_build_object(v_pid::text, v_cur);

    v_loc_count := 0;
    for v_loc in select * from jsonb_array_elements(coalesce(v_prod.value -> 'locations', '[]'::jsonb))
    loop
      v_loc_count := v_loc_count + 1;
      insert into public.locations (id, production_id, kind, name, sort_order)
      values (
        coalesce((v_loc.value ->> 'id')::uuid, gen_random_uuid()),
        v_pid,
        v_loc.value ->> 'kind',
        v_loc.value ->> 'name',
        coalesce((v_loc.value ->> 'sort_order')::int, 0)
      );
    end loop;

    v_item_count := 0;
    for v_item in select * from jsonb_array_elements(coalesce(v_prod.value -> 'items', '[]'::jsonb))
    loop
      v_item_count := v_item_count + 1;
      v_sid := coalesce((v_item.value ->> 'id')::uuid, gen_random_uuid());
      insert into public.inventory_items (
        id, production_id, kind, name, size, notes, condition, stable_public_id
      )
      values (
        v_sid,
        v_pid,
        v_item.value ->> 'kind',
        v_item.value ->> 'name',
        nullif(trim(v_item.value ->> 'size'), ''),
        nullif(v_item.value ->> 'notes', ''),
        nullif(v_item.value ->> 'condition', ''),
        v_item.value ->> 'id'
      );

      if jsonb_typeof(v_item.value -> 'qrAliases') = 'array' then
        insert into public.item_qr_aliases (item_id, alias)
        select v_sid, trim(x)
        from jsonb_array_elements_text(v_item.value -> 'qrAliases') as t(x)
        where trim(x) <> ''
        on conflict (item_id, alias) do nothing;
      end if;
    end loop;

    select count(*)::int into v_scan_count
    from jsonb_array_elements(coalesce(p_state -> 'scanLog', '[]'::jsonb)) se
    where (se.value ->> 'productionId')::uuid = v_pid;

    perform public.fabric_flo_audit(
      v_pid,
      'bundle_push',
      jsonb_build_object(
        'version', v_cur,
        'locations', v_loc_count,
        'items', v_item_count,
        'scans', v_scan_count
      )
    );
  end loop;

  for v_scan in select * from jsonb_array_elements(coalesce(p_state -> 'scanLog', '[]'::jsonb))
  loop
    v_pid := (v_scan.value ->> 'productionId')::uuid;
    if not exists (
      select 1
      from jsonb_array_elements(coalesce(p_state -> 'productions', '[]'::jsonb)) pe
      where (pe.value ->> 'id')::uuid = v_pid
    ) then
      continue;
    end if;

    if not public.is_production_member(
      v_pid,
      array['admin', 'department_head', 'crew']::text[]
    ) then
      continue;
    end if;

    v_ik := nullif(trim(v_scan.value ->> 'idempotencyKey'), '');

    if v_ik is not null then
      insert into public.scan_events (
        id, production_id, item_id, location_id,
        item_kind, item_name, location_kind, location_label,
        scanned_at, raw_qr, scanned_by, idempotency_key
      )
      values (
        coalesce((v_scan.value ->> 'id')::uuid, gen_random_uuid()),
        v_pid,
        (v_scan.value ->> 'itemId')::uuid,
        nullif(v_scan.value ->> 'locationId', '')::uuid,
        v_scan.value ->> 'itemKind',
        v_scan.value ->> 'itemName',
        v_scan.value ->> 'locationKind',
        v_scan.value ->> 'locationLabel',
        coalesce((v_scan.value ->> 'scannedAt')::timestamptz, now()),
        v_scan.value ->> 'rawQr',
        v_uid,
        v_ik
      )
      on conflict (idempotency_key) do nothing;
    else
      insert into public.scan_events (
        id, production_id, item_id, location_id,
        item_kind, item_name, location_kind, location_label,
        scanned_at, raw_qr, scanned_by, idempotency_key
      )
      values (
        coalesce((v_scan.value ->> 'id')::uuid, gen_random_uuid()),
        v_pid,
        (v_scan.value ->> 'itemId')::uuid,
        nullif(v_scan.value ->> 'locationId', '')::uuid,
        v_scan.value ->> 'itemKind',
        v_scan.value ->> 'itemName',
        v_scan.value ->> 'locationKind',
        v_scan.value ->> 'locationLabel',
        coalesce((v_scan.value ->> 'scannedAt')::timestamptz, now()),
        v_scan.value ->> 'rawQr',
        v_uid,
        null
      );
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'versions', v_versions);
end;
$$;

-- ---------------------------------------------------------------------------
-- Create invite (admin / department_head) — returns one-time token
-- ---------------------------------------------------------------------------
create or replace function public.fabric_flo_create_invite(
  p_production_id uuid,
  p_role text default 'crew',
  p_email text default null,
  p_expires_days int default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_hash text;
  v_invite_id uuid;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_production_member(
    p_production_id,
    array['admin', 'department_head']::text[]
  ) then
    raise exception 'forbidden';
  end if;

  if p_role not in ('viewer', 'crew', 'department_head') then
    raise exception 'invalid_role';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := now() + make_interval(days => greatest(1, least(coalesce(p_expires_days, 7), 30)));

  insert into public.production_invites (
    production_id, email, role, token_hash, expires_at, created_by
  )
  values (
    p_production_id,
    nullif(trim(p_email), ''),
    p_role,
    v_hash,
    v_expires,
    auth.uid()
  )
  returning id into v_invite_id;

  perform public.fabric_flo_audit(
    p_production_id,
    'invite_created',
    jsonb_build_object('invite_id', v_invite_id, 'role', p_role, 'email', nullif(trim(p_email), ''))
  );

  return jsonb_build_object(
    'inviteId', v_invite_id,
    'token', v_token,
    'expiresAt', v_expires,
    'role', p_role
  );
end;
$$;

grant execute on function public.fabric_flo_create_invite(uuid, text, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Accept invite by token
-- ---------------------------------------------------------------------------
create or replace function public.fabric_flo_accept_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_inv record;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if nullif(trim(p_token), '') is null then
    raise exception 'invalid_token';
  end if;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  select i.* into v_inv
  from public.production_invites i
  where i.token_hash = v_hash
    and i.expires_at > now()
  limit 1;

  if not found then
    raise exception 'invite_not_found_or_expired';
  end if;

  if v_inv.email is not null then
    select u.email into v_email from auth.users u where u.id = auth.uid();
    if lower(trim(v_inv.email)) is distinct from lower(trim(coalesce(v_email, ''))) then
      raise exception 'invite_email_mismatch';
    end if;
  end if;

  insert into public.production_members (production_id, user_id, role)
  values (v_inv.production_id, auth.uid(), v_inv.role)
  on conflict (production_id, user_id) do update set role = excluded.role;

  delete from public.production_invites where id = v_inv.id;

  perform public.fabric_flo_audit(
    v_inv.production_id,
    'invite_accepted',
    jsonb_build_object('role', v_inv.role)
  );

  return jsonb_build_object('productionId', v_inv.production_id, 'role', v_inv.role);
end;
$$;

grant execute on function public.fabric_flo_accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Server-side inventory merge (parsed rows as jsonb array)
-- ---------------------------------------------------------------------------
create or replace function public.fabric_flo_import_inventory_rows(
  p_production_id uuid,
  p_rows jsonb,
  p_expected_version bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_kind text;
  v_name text;
    v_notes text;
    v_size text;
    v_condition text;
  v_item_id uuid;
  v_merged int := 0;
  v_added int := 0;
  v_cur bigint;
  v_row_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_rows';
  end if;

  select jsonb_array_length(p_rows) into v_row_count;
  if v_row_count > 500 then
    raise exception 'too_many_rows';
  end if;

  if not public.is_production_member(
    p_production_id,
    array['admin', 'department_head']::text[]
  ) then
    raise exception 'forbidden';
  end if;

  if p_expected_version is not null then
    select version into v_cur from public.productions where id = p_production_id for update;
    if v_cur is distinct from p_expected_version then
      raise exception 'version_conflict'
        using errcode = 'P0001',
          message = format('production=%s server_version=%s', p_production_id, v_cur);
    end if;
  else
    perform 1 from public.productions where id = p_production_id for update;
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_kind := lower(trim(v_row ->> 'kind'));
    v_name := trim(v_row ->> 'name');
    if v_kind not in ('fabric', 'bag') or v_name = '' then
      continue;
    end if;

    v_notes := nullif(trim(v_row ->> 'notes'), '');
    v_size := nullif(trim(v_row ->> 'size'), '');
    v_condition := nullif(trim(v_row ->> 'condition'), '');
    if v_condition not in ('ok', 'lost', 'damaged') then
      v_condition := null;
    end if;

    select i.id into v_item_id
    from public.inventory_items i
    where i.production_id = p_production_id
      and i.kind = v_kind
      and lower(trim(i.name)) = lower(v_name)
    limit 1;

    if found then
      v_merged := v_merged + 1;
      update public.inventory_items i
      set
        size = coalesce(v_size, i.size),
        notes = coalesce(v_notes, i.notes),
        condition = case
          when v_condition in ('lost', 'damaged') then v_condition
          when v_condition = 'ok' then 'ok'
          else i.condition
        end,
        updated_at = now()
      where i.id = v_item_id;

      if jsonb_typeof(v_row -> 'qrAliases') = 'array' then
        insert into public.item_qr_aliases (item_id, alias)
        select v_item_id, trim(x)
        from jsonb_array_elements_text(v_row -> 'qrAliases') as t(x)
        where trim(x) <> ''
        on conflict (item_id, alias) do nothing;
      end if;
    else
      v_added := v_added + 1;
      v_item_id := gen_random_uuid();
      insert into public.inventory_items (
        id, production_id, kind, name, size, notes, condition, stable_public_id
      )
      values (
        v_item_id,
        p_production_id,
        v_kind,
        v_name,
        v_size,
        v_notes,
        v_condition,
        v_item_id::text
      );

      if jsonb_typeof(v_row -> 'qrAliases') = 'array' then
        insert into public.item_qr_aliases (item_id, alias)
        select v_item_id, trim(x)
        from jsonb_array_elements_text(v_row -> 'qrAliases') as t(x)
        where trim(x) <> ''
        on conflict (item_id, alias) do nothing;
      end if;
    end if;
  end loop;

  update public.productions
  set version = version + 1, updated_at = now()
  where id = p_production_id
  returning version into v_cur;

  perform public.fabric_flo_audit(
    p_production_id,
    'inventory_import',
    jsonb_build_object('merged', v_merged, 'added', v_added, 'row_count', v_row_count)
  );

  return jsonb_build_object(
    'merged', v_merged,
    'added', v_added,
    'version', v_cur
  );
end;
$$;

grant execute on function public.fabric_flo_import_inventory_rows(uuid, jsonb, bigint) to authenticated;
