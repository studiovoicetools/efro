-- 20260108223000_rls_keep_efro_shops_server_only.sql
-- Security hardening:
-- efro_shops contains access_token => keep server-only (service_role).
-- Remove authenticated SELECT + policy on efro_shops.
-- Keep products shop-scoped SELECT policy (non-secret data).

begin;

-- Remove client SELECT on efro_shops (server-only)
revoke select on table public.efro_shops from authenticated;
drop policy if exists "efro_shops_select_own_by_jwt_shop_domain" on public.efro_shops;

commit;
