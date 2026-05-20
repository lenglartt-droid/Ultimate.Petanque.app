-- Run in Supabase Dashboard → SQL Editor (project xzkdtudhtprpuzlamjdt).
-- Fixes admin Sponsors/Partners save: "new row violates row-level security policy for table ambassadors"
-- when toggling Active / Featured off.

-- 1) RLS: admins can SELECT/UPDATE all rows (including is_active = false)
drop policy if exists "admin_select_all_ambassadors" on public.ambassadors;
create policy "admin_select_all_ambassadors" on public.ambassadors
  for select to authenticated
  using (public.is_admin());

drop policy if exists "own_update_ambassadors" on public.ambassadors;
create policy "own_update_ambassadors" on public.ambassadors
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "admin_update_ambassadors" on public.ambassadors;
create policy "admin_update_ambassadors" on public.ambassadors
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin_insert_ambassadors" on public.ambassadors;
create policy "admin_insert_ambassadors" on public.ambassadors
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "admin_delete_ambassadors" on public.ambassadors;
create policy "admin_delete_ambassadors" on public.ambassadors
  for delete to authenticated
  using (public.is_admin());

-- 2) RPC fallback: bypasses RLS for verified admins (used by admin app screens)
create or replace function public.admin_patch_ambassador(p_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.ambassadors
  set
    display_name = case when p_patch ? 'display_name' then (p_patch->>'display_name')::text else display_name end,
    bio = case when p_patch ? 'bio' then nullif(p_patch->>'bio', '') else bio end,
    photo = case when p_patch ? 'photo' then nullif(p_patch->>'photo', '') else photo end,
    badge_type = case when p_patch ? 'badge_type' then (p_patch->>'badge_type')::text else badge_type end,
    ambassador_level = case when p_patch ? 'ambassador_level' then (p_patch->>'ambassador_level')::text else ambassador_level end,
    is_active = case when p_patch ? 'is_active' then (p_patch->>'is_active')::boolean else is_active end,
    is_featured = case when p_patch ? 'is_featured' then (p_patch->>'is_featured')::boolean else is_featured end,
    sort_order = case when p_patch ? 'sort_order' then (p_patch->>'sort_order')::integer else sort_order end,
    youtube_url = case when p_patch ? 'youtube_url' then nullif(p_patch->>'youtube_url', '') else youtube_url end,
    tiktok_url = case when p_patch ? 'tiktok_url' then nullif(p_patch->>'tiktok_url', '') else tiktok_url end,
    instagram_handle = case when p_patch ? 'instagram_handle' then nullif(p_patch->>'instagram_handle', '') else instagram_handle end,
    twitter_handle = case when p_patch ? 'twitter_handle' then nullif(p_patch->>'twitter_handle', '') else twitter_handle end,
    website_url = case when p_patch ? 'website_url' then nullif(p_patch->>'website_url', '') else website_url end,
    brand_color = case when p_patch ? 'brand_color' then nullif(p_patch->>'brand_color', '') else brand_color end,
    expires_at = case
      when p_patch ? 'expires_at' and p_patch->>'expires_at' is not null and p_patch->>'expires_at' <> ''
        then (p_patch->>'expires_at')::timestamptz
      when p_patch ? 'expires_at' and (p_patch->>'expires_at' is null or p_patch->>'expires_at' = '')
        then null
      else expires_at
    end,
    monthly_cost = case when p_patch ? 'monthly_cost' then (p_patch->>'monthly_cost')::numeric else monthly_cost end,
    total_invested = case when p_patch ? 'total_invested' then (p_patch->>'total_invested')::numeric else total_invested end,
    updated_at = now()
  where id = p_id;

  if not found then
    raise exception 'ambassador not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_patch_ambassador(uuid, jsonb) from public;
grant execute on function public.admin_patch_ambassador(uuid, jsonb) to authenticated;
