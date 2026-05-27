-- Fabric Flo: SECURITY DEFINER RPCs for bundle pull/push + bootstrap create production.
-- Requires migration 002.

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

  return v_id;
end;
$$;

grant execute on function public.fabric_flo_create_production(text) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.fabric_flo_pull()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_productions jsonb := '[]'::jsonb;
  v_scans jsonb := '[]'::jsonb;
  v_versions jsonb := '{}'::jsonb;
  r_prod record;
  v_loc jsonb;
  v_items jsonb;
  v_item record;
  v_scan record;
  v_pin text;
  v_qr text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  for r_prod in
    select p.*
    from public.productions p
    join public.production_members m on m.production_id = p.id
    where m.user_id = v_uid
      and p.archived_at is null
    order by p.created_at asc
  loop
    v_versions := v_versions || jsonb_build_object(r_prod.id::text, r_prod.version);

    v_pin := nullif(r_prod.settings ->> 'departmentHeadPin', '');

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'kind', l.kind,
        'name', l.name
      ) order by l.sort_order, l.name
    ), '[]'::jsonb)
    into v_loc
    from public.locations l
    where l.production_id = r_prod.id;

    v_items := '[]'::jsonb;
    for v_item in
      select i.*
      from public.inventory_items i
      where i.production_id = r_prod.id
      order by i.name
    loop
      select coalesce(array_agg(a.alias order by a.created_at), array[]::text[])
      into v_qr
      from public.item_qr_aliases a
      where a.item_id = v_item.id;

      v_items := v_items || jsonb_build_array(
        jsonb_build_object(
          'id', v_item.id,
          'kind', v_item.kind,
          'name', v_item.name,
          'qrAliases', to_jsonb(v_qr),
          'size', v_item.size,
          'notes', v_item.notes,
          'condition', v_item.condition
        )
      );
    end loop;

    v_productions := v_productions || jsonb_build_array(
      jsonb_build_object(
        'id', r_prod.id,
        'name', r_prod.name,
        'createdAt', to_jsonb(r_prod.created_at),
        'departmentHeadPin', to_jsonb(v_pin),
        'locations', coalesce(v_loc, '[]'::jsonb),
        'items', coalesce(v_items, '[]'::jsonb)
      )
    );
  end loop;

  for v_scan in
    select s.*
    from public.scan_events s
    where public.is_production_member(s.production_id)
    order by s.scanned_at desc
  loop
    v_scans := v_scans || jsonb_build_array(
      jsonb_build_object(
        'id', v_scan.id,
        'productionId', v_scan.production_id,
        'itemId', v_scan.item_id,
        'itemKind', v_scan.item_kind,
        'itemName', v_scan.item_name,
        'locationId', coalesce(v_scan.location_id::text, ''),
        'locationKind', v_scan.location_kind,
        'locationLabel', v_scan.location_label,
        'scannedAt', to_jsonb(v_scan.scanned_at),
        'rawQr', v_scan.raw_qr
      )
    );
  end loop;

  return jsonb_build_object(
    'productions', v_productions,
    'scanLog', v_scans,
    'activeProductionId', null::jsonb,
    'versions', v_versions
  );
end;
$$;

grant execute on function public.fabric_flo_pull() to authenticated;

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

    for v_loc in select * from jsonb_array_elements(coalesce(v_prod.value -> 'locations', '[]'::jsonb))
    loop
      insert into public.locations (id, production_id, kind, name, sort_order)
      values (
        coalesce((v_loc.value ->> 'id')::uuid, gen_random_uuid()),
        v_pid,
        v_loc.value ->> 'kind',
        v_loc.value ->> 'name',
        coalesce((v_loc.value ->> 'sort_order')::int, 0)
      );
    end loop;

    for v_item in select * from jsonb_array_elements(coalesce(v_prod.value -> 'items', '[]'::jsonb))
    loop
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

grant execute on function public.fabric_flo_push(jsonb, jsonb) to authenticated;
