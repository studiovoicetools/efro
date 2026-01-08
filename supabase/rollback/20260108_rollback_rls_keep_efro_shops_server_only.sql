-- 20260108_rollback_rls_keep_efro_shops_server_only.sql
-- Rollback: re-enable authenticated SELECT + policy on efro_shops (NOT recommended unless you really need it).

begin;

grant select on table public.efro_shops to authenticated;

drop policy if exists "efro_shops_select_own_by_jwt_shop_domain" on public.efro_shops;
create policy "efro_shops_select_own_by_jwt_shop_domain"
on public.efro_shops
for select
to authenticated
using (
  shop_domain = coalesce(
    nullif(auth.jwt() ->> 'shop_domain',''),
    nullif(auth.jwt() ->> 'shop','')
  )
);

commit;
