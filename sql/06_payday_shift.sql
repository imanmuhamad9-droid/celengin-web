-- =====================================================================
-- CELENGIN - 06_payday_shift.sql
-- Geser tanggal gajian ke hari kerja bila jatuh di Sabtu/Minggu/libur:
--   none   = tidak digeser (perilaku lama)
--   before = maju ke hari kerja sebelumnya (mis. Jumat)
--   after  = mundur ke hari kerja berikutnya (mis. Senin)
-- Jalankan di Supabase -> SQL Editor. Aman diulang. Prasyarat: kolom profiles.payday sudah ada.
-- =====================================================================
alter table public.profiles
  add column if not exists payday_shift text not null default 'none'
  check (payday_shift in ('none', 'before', 'after'));
