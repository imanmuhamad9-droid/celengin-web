-- =====================================================================
-- CELENGIN - 01_fitur_baru.sql
-- Jalankan di Supabase -> SQL Editor (sekali saja, aman diulang).
-- Isi: Transaksi Rutin Otomatis, Tagihan, Push Notification, Badge, Split Bill.
-- (Dompet ada di file terpisah: 02_dompet.sql)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TRANSAKSI RUTIN OTOMATIS
-- ---------------------------------------------------------------------
create table if not exists public.recurring_rules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  merchant_name  varchar not null,                 -- kategori, mis. "🍛 Makan"
  amount         numeric not null check (amount > 0),
  type           varchar not null check (type in ('income','expense')),
  frequency      varchar not null check (frequency in ('daily','weekly','monthly','yearly')),
  start_date     date not null,
  anchor_day     smallint not null,                -- tanggal (1-31) acuan bulanan/tahunan
  next_run_date  date not null,                    -- kapan transaksi berikutnya dibuat otomatis
  end_date       date,                             -- opsional: berhenti setelah tanggal ini
  is_active      boolean not null default true,
  last_run_date  date,
  created_at     timestamptz default timezone('utc'::text, now())
);

create index if not exists recurring_rules_due_idx
  on public.recurring_rules (is_active, next_run_date);

-- Hubungkan transaksi dengan aturan yang membuatnya
alter table public.transactions
  add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null;

-- Satu aturan hanya boleh membuat 1 transaksi per tanggal (anti dobel)
create unique index if not exists transactions_rule_date_uniq
  on public.transactions (recurring_rule_id, transaction_date);

alter table public.recurring_rules enable row level security;
drop policy if exists "recurring_rules_own" on public.recurring_rules;
create policy "recurring_rules_own" on public.recurring_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. TAGIHAN & LANGGANAN
-- ---------------------------------------------------------------------
create table if not exists public.bills (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  name             varchar not null,               -- mis. "Listrik PLN"
  amount           numeric not null check (amount > 0),
  merchant_name    varchar not null,               -- kategori saat dicatat lunas
  frequency        varchar not null default 'monthly' check (frequency in ('once','weekly','monthly','yearly')),
  due_date         date not null,                  -- jatuh tempo berikutnya
  anchor_day       smallint not null,
  remind_days_before smallint not null default 3,
  is_active        boolean not null default true,
  last_paid_date   date,
  paid_count       integer not null default 0,
  created_at       timestamptz default timezone('utc'::text, now())
);

create index if not exists bills_user_due_idx on public.bills (user_id, is_active, due_date);

alter table public.bills enable row level security;
drop policy if exists "bills_own" on public.bills;
create policy "bills_own" on public.bills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. PUSH NOTIFICATION
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz default timezone('utc'::text, now())
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. PENCAPAIAN (BADGE)
-- ---------------------------------------------------------------------
create table if not exists public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_key  text not null,
  earned_at  timestamptz default timezone('utc'::text, now()),
  unique (user_id, badge_key)
);

alter table public.user_badges enable row level security;
drop policy if exists "user_badges_own" on public.user_badges;
create policy "user_badges_own" on public.user_badges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. SPLIT BILL DI BARENG
-- ---------------------------------------------------------------------
-- Fungsi pembantu: apakah user yang login adalah pembuat / anggota (accepted) target Bareng ini?
create or replace function public.is_goal_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.couple_goals g where g.id = gid and g.created_by = auth.uid())
      or exists (select 1 from public.couple_members m
                 where m.goal_id = gid and m.user_id = auth.uid() and m.status = 'accepted');
$$;
grant execute on function public.is_goal_member(uuid) to authenticated;

create table if not exists public.shared_expenses (
  id            uuid primary key default gen_random_uuid(),
  goal_id       uuid not null references public.couple_goals(id) on delete cascade,
  title         varchar not null,
  total_amount  numeric not null check (total_amount > 0),
  paid_by       uuid not null references public.profiles(id),
  created_by    uuid not null references public.profiles(id),
  expense_date  date not null default current_date,
  split_type    varchar not null default 'equal' check (split_type in ('equal','custom')),
  created_at    timestamptz default timezone('utc'::text, now())
);
create index if not exists shared_expenses_goal_idx on public.shared_expenses (goal_id, expense_date desc);

create table if not exists public.shared_expense_shares (
  id           uuid primary key default gen_random_uuid(),
  expense_id   uuid not null references public.shared_expenses(id) on delete cascade,
  user_id      uuid not null references public.profiles(id),
  share_amount numeric not null check (share_amount >= 0)
);
create index if not exists shared_expense_shares_exp_idx on public.shared_expense_shares (expense_id);

create table if not exists public.shared_settlements (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.couple_goals(id) on delete cascade,
  from_user   uuid not null references public.profiles(id),   -- yang membayar
  to_user     uuid not null references public.profiles(id),   -- yang menerima
  amount      numeric not null check (amount > 0),
  created_at  timestamptz default timezone('utc'::text, now())
);
create index if not exists shared_settlements_goal_idx on public.shared_settlements (goal_id);

alter table public.shared_expenses enable row level security;
alter table public.shared_expense_shares enable row level security;
alter table public.shared_settlements enable row level security;

drop policy if exists "shared_expenses_select" on public.shared_expenses;
drop policy if exists "shared_expenses_insert" on public.shared_expenses;
drop policy if exists "shared_expenses_delete" on public.shared_expenses;
create policy "shared_expenses_select" on public.shared_expenses
  for select using (public.is_goal_member(goal_id));
create policy "shared_expenses_insert" on public.shared_expenses
  for insert with check (public.is_goal_member(goal_id) and created_by = auth.uid());
create policy "shared_expenses_delete" on public.shared_expenses
  for delete using (created_by = auth.uid());

drop policy if exists "shared_shares_select" on public.shared_expense_shares;
drop policy if exists "shared_shares_insert" on public.shared_expense_shares;
create policy "shared_shares_select" on public.shared_expense_shares
  for select using (exists (select 1 from public.shared_expenses e
                            where e.id = expense_id and public.is_goal_member(e.goal_id)));
create policy "shared_shares_insert" on public.shared_expense_shares
  for insert with check (exists (select 1 from public.shared_expenses e
                                 where e.id = expense_id and e.created_by = auth.uid()));

drop policy if exists "shared_settlements_select" on public.shared_settlements;
drop policy if exists "shared_settlements_insert" on public.shared_settlements;
create policy "shared_settlements_select" on public.shared_settlements
  for select using (public.is_goal_member(goal_id));
create policy "shared_settlements_insert" on public.shared_settlements
  for insert with check (public.is_goal_member(goal_id)
                         and (from_user = auth.uid() or to_user = auth.uid()));

-- =====================================================================
-- SELESAI. Cek: Table Editor harus menampilkan tabel baru:
-- recurring_rules, bills, push_subscriptions, user_badges,
-- shared_expenses, shared_expense_shares, shared_settlements
-- =====================================================================

-- ---------------------------------------------------------------------
-- OPSIONAL (jalankan HANYA jika mau): ubah transaksi "Rutin" lama jadi aturan otomatis.
-- Tiap kombinasi (kategori + tipe + nominal) yang pernah ditandai rutin dijadikan
-- aturan BULANAN, mulai dari bulan setelah transaksi terakhirnya.
-- Kalau ada yang sebenarnya mingguan/harian, lebih aman atur lewat menu
-- Riwayat -> "Transaksi Rutin" di aplikasi (ada bagian "Rutin lama").
-- ---------------------------------------------------------------------
-- insert into public.recurring_rules
--   (user_id, merchant_name, amount, type, frequency, start_date, anchor_day, next_run_date)
-- select user_id, merchant_name, amount, type, 'monthly',
--        max(transaction_date), extract(day from max(transaction_date))::smallint,
--        (max(transaction_date) + interval '1 month')::date
-- from public.transactions
-- where is_routine = true and recurring_rule_id is null
-- group by user_id, merchant_name, amount, type;
