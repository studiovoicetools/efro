-- 20260108190000_rls_lockdown_public_tables.sql
-- Goal: Fix "RLS Disabled in Public" + lock down public tables:
-- - public.efro_shops
-- - public.products
-- - public.efro_action_log
--
-- Requirements:
-- - service_role keeps full access (Supabase bypasses RLS for service_role)
-- - anon/authenticated must NOT freely read/write
-- - shop-scoped access can be added later (JWT claim based)

begin;

-- 1) Enable RLS
alter table if exists public.efro_shops enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.efro_action_log enable row level security;

-- Optional hardening (forces RLS for table owner too). Usually not needed in Supabase.
-- alter table if exists public.efro_shops force row level security;
-- alter table if exists public.products force row level security;
-- alter table if exists public.efro_action_log force row level security;

-- 2) Revoke client privileges (least privilege)
revoke all on table public.efro_shops from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.efro_action_log from anon, authenticated;

-- By default: NO grants for authenticated either.
-- All access should go through server routes using SUPABASE_SERVICE_KEY.
-- If you later need client-side, add explicit GRANT + RLS policies carefully.

-- -------------------------------------------------------------------
-- OPTIONAL (future): Shop-scoped READ for authenticated (JWT claim)
-- -------------------------------------------------------------------
grant select on table public.efro_shops to authenticated;
grant select on table public.products to authenticated;
--
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
--
drop policy if exists "products_select_own_by_jwt_shop_domain" on public.products;
create policy "products_select_own_by_jwt_shop_domain"
on public.products
for select
to authenticated
using (
  shop_domain = coalesce(
    nullif(auth.jwt() ->> 'shop_domain',''),
    nullif(auth.jwt() ->> 'shop','')
  )
);
--
-- Note: efro_action_log should stay server-only (no grants + no policies).

commit;
