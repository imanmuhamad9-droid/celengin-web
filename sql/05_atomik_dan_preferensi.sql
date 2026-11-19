-- =====================================================================
-- CELENGIN - 05_atomik_dan_preferensi.sql
-- 1) Setoran/penarikan target Bareng dan Impian dalam SATU transaksi database
--    (sebelumnya dua langkah dari browser: saldo diubah, lalu riwayat dicatat).
-- 2) Transfer dompet: kedua dompet harus milik sendiri.
-- 3) Preferensi notifikasi push per jenis (kolom profiles.push_prefs).
-- Jalankan di Supabase -> SQL Editor SEBELUM men-deploy kode yang memakainya. Aman diulang.
-- Prasyarat: audit_and_fix_rls.sql Bagian 3 (fungsi is_goal_member sudah ada).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1a. Target Bareng: setor / tarik
-- ---------------------------------------------------------------------
create or replace function public.couple_deposit(p_goal_id uuid, p_amount numeric, p_type text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new numeric;
begin
  if auth.uid() is null then raise exception 'Belum login'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  if p_type not in ('in', 'out') then raise exception 'Jenis harus in atau out'; end if;
  if not public.is_goal_member(p_goal_id) then raise exception 'Kamu bukan anggota target ini'; end if;

  update public.couple_goals
     set current_amount = greatest(0, coalesce(current_amount, 0) + case when p_type = 'in' then p_amount else -p_amount end)
   where id = p_goal_id
  returning current_amount into v_new;

  if not found then raise exception 'Target tidak ditemukan'; end if;

  insert into public.couple_transactions (goal_id, user_id, amount, type)
  values (p_goal_id, auth.uid(), p_amount, p_type);

  return v_new;
end $$;

revoke execute on function public.couple_deposit(uuid, numeric, text) from public, anon;
grant  execute on function public.couple_deposit(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- 1b. Impian (dream_goals): setor / tarik
-- ---------------------------------------------------------------------
create or replace function public.dream_deposit(p_goal_id uuid, p_amount numeric, p_type text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new numeric;
begin
  if auth.uid() is null then raise exception 'Belum login'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Nominal harus lebih dari 0'; end if;
  if p_type not in ('in', 'out') then raise exception 'Jenis harus in atau out'; end if;

  update public.dream_goals
     set current_amount = greatest(0, coalesce(current_amount, 0) + case when p_type = 'in' then p_amount else -p_amount end)
   where id = p_goal_id and user_id = auth.uid()
  returning current_amount into v_new;

  if not found then raise exception 'Impian tidak ditemukan'; end if;

  insert into public.goal_transactions (goal_id, user_id, amount, type)
  values (p_goal_id, auth.uid(), p_amount, p_type);

  return v_new;
end $$;

revoke execute on function public.dream_deposit(uuid, numeric, text) from public, anon;
grant  execute on function public.dream_deposit(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Transfer dompet: dompet asal dan tujuan harus milik user yang sama
--    (policy lama hanya memeriksa user_id, jadi id dompet orang lain bisa disisipkan).
-- ---------------------------------------------------------------------
drop policy if exists "wallet_transfers_own" on public.wallet_transfers;
create policy "wallet_transfers_own" on public.wallet_transfers
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.wallets w where w.id = from_wallet_id and w.user_id = auth.uid())
    and exists (select 1 from public.wallets w where w.id = to_wallet_id   and w.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 3. Preferensi notifikasi push per jenis.
--    Bentuk: {"bills":true,"routine":true,"daily":false,"weekly":true,"gantian":true}
--    Kunci yang tidak ada dianggap AKTIF.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists push_prefs jsonb not null default '{}'::jsonb;
