-- 20260108_rollback_rls_lockdown_public_tables.sql
-- Emergency rollback (SECURE): drop policies + revoke client grants + disable RLS
-- Note: This keeps tables locked down (no broad re-open).

begin;

-- Drop policies (if exist)
drop policy if exists "efro_shops_select_own_by_jwt_shop_domain" on public.efro_shops;
drop policy if exists "products_select_own_by_jwt_shop_domain" on public.products;

-- Remove client grants (secure baseline)
revoke all on table public.efro_shops from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.efro_action_log from anon, authenticated;

-- Disable RLS (only relevant if someone later grants privileges again)
alter table if exists public.efro_shops disable row level security;
alter table if exists public.products disable row level security;
alter table if exists public.efro_action_log disable row level security;

commit;
