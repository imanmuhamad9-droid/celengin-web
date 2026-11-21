-- =====================================================================
-- CELENGIN - 08_simulasi.sql
-- Menu Simulasi: rencana hitung-hitungan gaji dikurangi kewajiban, disimpan sebagai riwayat yang bisa diedit.
-- Isi rencana (baris pemasukan, kewajiban, tabungan) disimpan sebagai JSON di kolom data.
-- Jalankan di Supabase -> SQL Editor. Aman diulang.
-- =====================================================================

create table if not exists public.simulations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        varchar not null default 'Rencana baru',
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz default timezone('utc'::text, now()),
  updated_at  timestamptz default timezone('utc'::text, now())
);

create index if not exists simulations_user_idx on public.simulations (user_id, updated_at desc);

alter table public.simulations enable row level security;

drop policy if exists "simulations_own" on public.simulations;
create policy "simulations_own" on public.simulations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
