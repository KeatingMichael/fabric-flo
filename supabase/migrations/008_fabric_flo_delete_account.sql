-- Self-service account data deletion (App Store / Play compliance).
-- Removes the caller's memberships and sole-admin productions; does not delete auth.users
-- (requires service-role Edge Function or dashboard — see docs/STORE_RELEASE.md).

create or replace function public.fabric_flo_delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prod_ids uuid[];
  v_deleted_productions int := 0;
  v_removed_memberships int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(array_agg(distinct pm.production_id), '{}')
  into v_prod_ids
  from public.production_members pm
  where pm.user_id = v_uid
    and pm.role = 'admin'
    and not exists (
      select 1
      from public.production_members pm2
      where pm2.production_id = pm.production_id
        and pm2.user_id <> v_uid
        and pm2.role = 'admin'
    );

  if v_prod_ids is not null and array_length(v_prod_ids, 1) > 0 then
    delete from public.productions p where p.id = any (v_prod_ids);
    get diagnostics v_deleted_productions = row_count;
  end if;

  delete from public.production_members where user_id = v_uid;
  get diagnostics v_removed_memberships = row_count;

  delete from public.production_invites where created_by = v_uid;

  delete from public.user_app_state where user_id = v_uid;

  return jsonb_build_object(
    'deletedProductions', v_deleted_productions,
    'removedMemberships', v_removed_memberships
  );
end;
$$;

grant execute on function public.fabric_flo_delete_my_account() to authenticated;
