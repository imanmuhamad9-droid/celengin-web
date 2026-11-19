-- =====================================================================
-- CELENGIN - 07_cicilan.sql
-- Menu Cicilan: bucket (bank / paylater / KTA), isi cicilan per barang, dan pembayaran per bulan.
-- Jalankan di Supabase -> SQL Editor. Aman diulang.
-- =====================================================================

create table if not exists public.installment_groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        varchar not null,
  kind        varchar not null default 'cc' check (kind in ('cc','paylater','kta','other')),
  due_day     int not null default 1 check (due_day between 1 and 31),
  created_at  timestamptz default timezone('utc'::text, now())
);

create table if not exists public.installments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  group_id        uuid not null references public.installment_groups(id) on delete cascade,
  name            varchar not null,
  principal       numeric not null default 0 check (principal >= 0),
  rate_pct        numeric not null default 0 check (rate_pct >= 0),
  tenor           int not null check (tenor between 1 and 360),
  monthly_amount  numeric not null check (monthly_amount > 0),
  start_month     varchar not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  note            text,
  created_at      timestamptz default timezone('utc'::text, now())
);

create table if not exists public.installment_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  group_id    uuid not null references public.installment_groups(id) on delete cascade,
  month       varchar not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount      numeric not null check (amount > 0),
  paid_on     date not null default current_date,
  created_at  timestamptz default timezone('utc'::text, now())
);

create index if not exists installments_group_idx on public.installments (group_id);
create index if not exists installment_payments_group_idx on public.installment_payments (group_id, month);

alter table public.installment_groups   enable row level security;
alter table public.installments         enable row level security;
alter table public.installment_payments enable row level security;

drop policy if exists "installment_groups_own" on public.installment_groups;
create policy "installment_groups_own" on public.installment_groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "installments_own" on public.installments;
create policy "installments_own" on public.installments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "installment_payments_own" on public.installment_payments;
create policy "installment_payments_own" on public.installment_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Bulan mulai dilacak: cicilan sebelum bulan ini dianggap sudah dibayar (untuk cicilan yang sudah berjalan)
alter table public.installments add column if not exists track_from varchar
  check (track_from is null or track_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Aturan bank per bucket dan lembar tagihan terakhir (untuk memprediksi tagihan bulan depan)
alter table public.installment_groups
  add column if not exists interest_pct          numeric not null default 0,
  add column if not exists min_pct               numeric not null default 0,
  add column if not exists min_floor             numeric not null default 0,
  add column if not exists min_with_installments boolean not null default false,
  add column if not exists late_fee_pct          numeric not null default 0,
  add column if not exists late_fee_min          numeric not null default 0,
  add column if not exists late_fee_max          numeric not null default 0,
  add column if not exists statement_month       varchar,
  add column if not exists statement_total       numeric,
  add column if not exists min_payment           numeric;
