-- 20260107_add_efro_action_log.sql
-- Gate-2: Idempotency + Audit logging for commerce actions
-- Key: (shop, correlation_id, action_type)
-- Server-only usage via SUPABASE_SERVICE_KEY.

create extension if not exists pgcrypto;

create table if not exists public.efro_action_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  shop text not null,
  correlation_id text not null,
  action_type text not null,

  ok boolean not null default false,
  status_code int null,

  draft_order_id text null,
  invoice_url text null,

  duration_ms int null,
  token_source text null,

  -- cached/diagnostic payload (server only)
  result jsonb null,
  error jsonb null
);

-- Prevent duplicates for retries:
create unique index if not exists efro_action_log_uniq
  on public.efro_action_log (shop, correlation_id, action_type);

-- Query helper:
create index if not exists efro_action_log_shop_created_at
  on public.efro_action_log (shop, created_at desc);
