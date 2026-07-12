-- Aurum — Supabase schema
-- Run this whole file once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Tables are created in dependency order: categories -> quick_add_presets -> transactions -> budgets.

-- ============================================================================
-- 1. categories
-- ============================================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  parent_id uuid references categories(id),
  icon text,
  color text not null default '#C9A46A',
  is_business boolean default false,
  archived boolean default false,
  created_at timestamptz default now()
);

-- ============================================================================
-- 2. quick_add_presets
-- ============================================================================
create table quick_add_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references categories(id) not null,
  amount numeric(10, 2) not null,
  label text not null,
  type text not null check (type in ('income', 'expense')),
  is_business boolean default false,
  use_count int default 0,
  last_used_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================================
-- 3. transactions
-- ============================================================================
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references categories(id) not null,
  amount numeric(10, 2) not null,
  type text not null check (type in ('income', 'expense')),
  date date not null default current_date,
  notes text,
  payment_mode text check (payment_mode in ('cash', 'upi', 'card')),
  is_business boolean default false,
  -- on delete set null: deleting a used preset must not be blocked by (or cascade
  -- into) the transactions that were logged from it.
  preset_id uuid references quick_add_presets(id) on delete set null,
  receipt_url text,
  created_at timestamptz default now()
);

-- ============================================================================
-- 4. budgets
-- ============================================================================
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  category_id uuid references categories(id) not null,
  monthly_limit numeric(10, 2) not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- Row Level Security — enabled on all four tables, no exceptions.
-- A personal finance tracker has no public-read tables; this is what keeps a
-- leaked anon key from exposing one user's data to anyone else, even if this
-- app is ever used by more than one person.
-- ============================================================================
alter table categories enable row level security;
create policy "Users manage own categories" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table quick_add_presets enable row level security;
create policy "Users manage own presets" on quick_add_presets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table transactions enable row level security;
create policy "Users manage own transactions" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table budgets enable row level security;
create policy "Users manage own budgets" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- Storage RLS for the `receipts` bucket.
-- Create the bucket itself in the dashboard first (Storage -> New bucket ->
-- name "receipts" -> Private), then run this policy. Path convention is
-- {user_id}/{transaction_id}.jpg, so foldername(name)[1] is always the owner's
-- own auth.uid() — no cross-user collisions or reads are possible.
-- ============================================================================
create policy "Users manage own receipts"
  on storage.objects for all
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Seed function + trigger: creates the default category set the first time
-- a user signs up, so the Add Transaction screen is never empty on first login.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  business_id uuid;
begin
  -- Income categories
  insert into categories (user_id, name, type, is_business, color) values (new.id, 'Allowance', 'income', false, '#8FAF8B');
  insert into categories (user_id, name, type, is_business, color) values (new.id, 'Gifts', 'income', false, '#B9CBB0');

  insert into categories (user_id, name, type, is_business, color)
  values (new.id, 'Business', 'income', true, '#C9A46A')
  returning id into business_id;

  insert into categories (user_id, name, type, parent_id, is_business, color)
  values (new.id, 'Recurring Retainer', 'income', business_id, true, '#D4B483');

  insert into categories (user_id, name, type, parent_id, is_business, color)
  values (new.id, 'One-time Project', 'income', business_id, true, '#A98955');

  -- Expense categories
  insert into categories (user_id, name, type, color) values
    (new.id, 'College Essentials', 'expense', '#C97C5D'),
    (new.id, 'Eating Out', 'expense', '#D99A78'),
    (new.id, 'Canteen', 'expense', '#B85C3E'),
    (new.id, 'Transport', 'expense', '#8A6552'),
    (new.id, 'Subscriptions', 'expense', '#A47764'),
    (new.id, 'Misc', 'expense', '#8A8F98');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Migration for databases created from an earlier version of this file, where
-- transactions.preset_id lacked ON DELETE SET NULL. Run this once (it's a no-op
-- worry-free on fresh installs — just don't run it before the tables exist):
--
--   alter table transactions drop constraint transactions_preset_id_fkey;
--   alter table transactions add constraint transactions_preset_id_fkey
--     foreign key (preset_id) references quick_add_presets(id) on delete set null;
-- ============================================================================
