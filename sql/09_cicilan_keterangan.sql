-- =====================================================================
-- CELENGIN - 09_cicilan_keterangan.sql
-- Keterangan opsional di kartu/pinjaman cicilan, mis. harus bayar ke mana atau transfer ke rekening apa.
-- Jalankan di Supabase -> SQL Editor. Aman diulang.
-- =====================================================================

alter table public.installment_groups add column if not exists pay_note varchar;
