-- EFRO: Ensure required columns exist on public.products
-- Safe to run multiple times (IF NOT EXISTS)

alter table if exists public.products
  add column if not exists id text;

alter table if exists public.products
  add column if not exists title text;

alter table if exists public.products
  add column if not exists handle text;

alter table if exists public.products
  add column if not exists description text;

alter table if exists public.products
  add column if not exists "featuredImage" text;
