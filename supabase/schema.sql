-- Run once in Supabase -> SQL Editor
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('crypto','gold','stock','fund','custom')),
  symbol text,
  coingecko_id text,
  price_idr numeric,
  price_source text check (price_source in ('coingecko','manual')),
  price_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  type text not null check (type in ('buy','sell')),
  date date not null,
  quantity numeric not null check (quantity > 0),
  price numeric not null check (price >= 0),
  fee numeric not null default 0 check (fee >= 0),
  created_at timestamptz not null default now()
);

create index if not exists transactions_asset_idx on public.transactions(asset_id);

alter table public.assets enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "own assets" on public.assets;
create policy "own assets" on public.assets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
