-- =====================================================================
-- CELENGIN - 02_dompet.sql   (JALANKAN PALING AKHIR, setelah 01 dan setelah
-- kamu cek fitur lain sudah jalan)
-- Menambah: Dompet (tunai / bank / e-wallet) + Transfer antar dompet.
-- Saldo total di Dashboard TIDAK berubah setelah migrasi ini.
-- =====================================================================

create table if not exists public.wallets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  name             varchar not null,
  type             varchar not null default 'cash' check (type in ('cash','bank','ewallet','other')),
  emoji            varchar not null default '💼',
  initial_balance  numeric not null default 0,
  is_default       boolean not null default false,
  created_at       timestamptz default timezone('utc'::text, now())
);

-- Satu user hanya boleh punya 1 dompet utama
create unique index if not exists wallets_one_default_per_user
  on public.wallets (user_id) where is_default;

create table if not exists public.wallet_transfers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  from_wallet_id  uuid not null references public.wallets(id) on delete cascade,
  to_wallet_id    uuid not null references public.wallets(id) on delete cascade,
  amount          numeric not null check (amount > 0),
  note            text,
  transfer_date   date not null default current_date,
  created_at      timestamptz default timezone('utc'::text, now()),
  check (from_wallet_id <> to_wallet_id)
);

alter table public.wallets enable row level security;
alter table public.wallet_transfers enable row level security;

drop policy if exists "wallets_own" on public.wallets;
create policy "wallets_own" on public.wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "wallet_transfers_own" on public.wallet_transfers;
create policy "wallet_transfers_own" on public.wallet_transfers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Kolom dompet di tabel yang sudah ada (dompet dihapus -> transaksi jadi "tanpa dompet")
alter table public.transactions    add column if not exists wallet_id uuid references public.wallets(id) on delete set null;
alter table public.recurring_rules add column if not exists wallet_id uuid references public.wallets(id) on delete set null;
alter table public.bills           add column if not exists wallet_id uuid references public.wallets(id) on delete set null;

create index if not exists transactions_wallet_idx on public.transactions (wallet_id);

-- ---------------------------------------------------------------------
-- MIGRASI DATA LAMA: buat "Dompet Utama" untuk user yang sudah punya transaksi,
-- lalu pindahkan semua transaksi lama ke dompet itu.
-- ---------------------------------------------------------------------
insert into public.wallets (user_id, name, type, emoji, is_default)
select distinct t.user_id, 'Dompet Utama', 'cash', '💼', true
from public.transactions t
where not exists (select 1 from public.wallets w where w.user_id = t.user_id);

update public.transactions t
set wallet_id = w.id
from public.wallets w
where w.user_id = t.user_id and w.is_default = true and t.wallet_id is null;

-- User baru (belum punya transaksi) akan dibuatkan Dompet Utama otomatis oleh aplikasi.

-- ---------------------------------------------------------------------
-- BATALKAN (kalau perlu kembali ke sebelum dompet) - jalankan bagian ini saja:
-- ---------------------------------------------------------------------
-- alter table public.transactions    drop column if exists wallet_id;
-- alter table public.recurring_rules drop column if exists wallet_id;
-- alter table public.bills           drop column if exists wallet_id;
-- drop table if exists public.wallet_transfers;
-- drop table if exists public.wallets;
