-- Each CSV/import row is one physical piece (same name + size allowed many times).
-- Rows with a matching Item ID update that piece; otherwise a new row is inserted.

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
  v_row_id uuid;
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

    v_row_id := null;
    begin
      if nullif(trim(v_row ->> 'id'), '') is not null then
        v_row_id := (trim(v_row ->> 'id'))::uuid;
      end if;
    exception
      when invalid_text_representation then
        v_row_id := null;
    end;

    if v_row_id is not null then
      select i.id into v_item_id
      from public.inventory_items i
      where i.production_id = p_production_id
        and i.id = v_row_id
      limit 1;
    else
      v_item_id := null;
    end if;

    if v_item_id is not null then
      v_merged := v_merged + 1;
      update public.inventory_items i
      set
        kind = v_kind,
        name = v_name,
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
