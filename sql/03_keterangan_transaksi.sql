-- =====================================================================
-- KETERANGAN TRANSAKSI (opsional)
-- Menambah kolom catatan bebas pada transaksi, diisi dari layar Catat.
-- Jalankan di Supabase: Dashboard -> SQL Editor -> New query -> Run.
-- Aman dijalankan berulang: "if not exists" membuat perintah dilewati
-- kalau kolomnya sudah ada (fitur Tagihan sudah memakai kolom ini).
-- =====================================================================
alter table public.transactions
  add column if not exists notes text;

-- ---------------------------------------------------------------------
-- BATALKAN (kalau perlu menghapus kolom ini) - jalankan bagian ini saja:
-- ---------------------------------------------------------------------
-- alter table public.transactions drop column if exists notes;
