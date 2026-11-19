-- =====================================================================
-- CELENGIN - 07b_cicilan_contoh.sql
-- Data contoh dari lembar tagihan CIMB Niaga (statement 16/11/26, jatuh tempo 07/12/26)
-- dan BCA (rekening 12/11/26, jatuh tempo 28/11/26).
-- Jalankan SETELAH 07_cicilan.sql (tabel dasarnya). Kolom tambahan dibuat di bawah. Email akun sudah diisi di v_email.
-- Aman diulang: bucket yang namanya sudah ada dilewati.
--
-- Cara baca: "ke-N dari T" di tagihan => bulan cicilan pertama = bulan tagihan dikurangi (N-1),
-- dan track_from = bulan tagihan (cicilan sebelumnya dianggap sudah lunas).
-- Bulan tagihan CIMB = 2026-12 (jatuh tempo 7 Des), BCA = 2026-11 (jatuh tempo 28 Nov).
-- =====================================================================

-- Kolom yang dipakai data di bawah (sama dengan akhir 07_cicilan.sql; aman diulang)
alter table public.installments add column if not exists track_from varchar
  check (track_from is null or track_from ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
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

do $$
declare
  v_email text := 'imanmuhamad9@gmail.com';
  v_user  uuid;
  v_cimb  uuid;
  v_bca   uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'Email % tidak ditemukan di auth.users. Ganti v_email dulu.', v_email;
  end if;

  -- Nama lama dari skrip versi sebelumnya (kartu di lembar tagihan: BCA Blibli)
  update public.installment_groups set name = 'BCA Blibli Mastercard' where user_id = v_user and name = 'BCA Mastercard';

  -- ---------------------------------------------------------------- CIMB Niaga
  if not exists (select 1 from public.installment_groups where user_id = v_user and name = 'CIMB Niaga MC Gold X') then
    insert into public.installment_groups (user_id, name, kind, due_day)
    values (v_user, 'CIMB Niaga MC Gold X', 'cc', 7) returning id into v_cimb;

    insert into public.installments (user_id, group_id, name, principal, rate_pct, tenor, monthly_amount, start_month, track_from, note) values
      (v_user, v_cimb, 'Shopee (JAKSE) 5/12',           501000.00, 0, 12,  41750.00, '2026-08', '2026-12', 'Tagihan CIMB: cicilan 5 dari 12'),
      (v_user, v_cimb, 'Agoda.com Hotel Kure 12/12',    514723.44, 0, 12,  42893.62, '2026-01', '2026-12', 'Tagihan CIMB: cicilan 12 dari 12 (terakhir)'),
      (v_user, v_cimb, 'Shopee (JAKSE) 16/24',         1134630.00, 0, 24,  47276.25, '2025-09', '2026-12', 'Tagihan CIMB: cicilan 16 dari 24'),
      (v_user, v_cimb, 'Proban Ciater Serpong 8/12',    726999.96, 0, 12,  60583.33, '2026-05', '2026-12', 'Tagihan CIMB: cicilan 8 dari 12'),
      (v_user, v_cimb, 'Pop Mart Paskal 3/3',           310999.98, 0,  3, 103666.66, '2026-10', '2026-12', 'Tagihan CIMB: cicilan 3 dari 3 (terakhir)'),
      (v_user, v_cimb, 'Konversi Cicilan 3x 0%',        400000.02, 0,  3, 133333.34, '2026-10', '2026-12', 'Tagihan CIMB: cicilan 3 dari 3 (terakhir)'),
      (v_user, v_cimb, 'Konversi Cicilan 12x 0% (kartu 4579)', 454500.00, 0, 12, 37875.00, '2026-09', '2026-12', 'Tagihan CIMB: cicilan 4 dari 12, kartu 4579 ...2902'),
      -- Dua baris "Installment Interest" di tagihan; sisa tenornya tidak tertulis, jadi dicatat sebulan saja
      (v_user, v_cimb, 'Installment Interest (1)',        7051.90, 0,  1,   7051.90, '2026-12', '2026-12', 'Bunga cicilan di tagihan 16/11/26. Hapus kalau tidak perlu.'),
      (v_user, v_cimb, 'Installment Interest (2)',       11005.91, 0,  1,  11005.91, '2026-12', '2026-12', 'Bunga cicilan di tagihan 16/11/26. Hapus kalau tidak perlu.');
  end if;

  -- ---------------------------------------------------------------- BCA
  if not exists (select 1 from public.installment_groups where user_id = v_user and name = 'BCA Blibli Mastercard') then
    insert into public.installment_groups (user_id, name, kind, due_day)
    values (v_user, 'BCA Blibli Mastercard', 'cc', 28) returning id into v_bca;

    insert into public.installments (user_id, group_id, name, principal, rate_pct, tenor, monthly_amount, start_month, track_from, note) values
      (v_user, v_bca, 'Trip.com 3/12',     1026204, 0, 12,  85517, '2026-09', '2026-11', 'Tagihan BCA: cicilan ke 03 dari 12'),
      (v_user, v_bca, 'XDT*Fithub 3/9',    1220688, 0,  9, 135632, '2026-09', '2026-11', 'Tagihan BCA: cicilan ke 03 dari 09'),
      (v_user, v_bca, 'Agoda.com RAF 4/9',  785538, 0,  9,  87282, '2026-08', '2026-11', 'Tagihan BCA: cicilan ke 04 dari 09');
  end if;

  -- ---------------------------------------------------------------- Aturan bank + lembar tagihan
  -- Aturan dari RIPLAY BCA (berlaku 19 Agu 2026) dan halaman tarif CIMB Niaga. Relaksasi BI (minimum 5%, denda 1%)
  -- berlaku sampai 31 Des 2026; setelah itu ubah angkanya di Ubah bucket bila bank kembali ke aturan lama.
  update public.installment_groups set
    interest_pct = 1.75, min_pct = 5, min_floor = 50000, min_with_installments = false,
    late_fee_pct = 1, late_fee_min = 75000, late_fee_max = 100000,
    statement_month = '2026-12', statement_total = 847163.84, min_payment = 50000
  where user_id = v_user and name = 'CIMB Niaga MC Gold X';

  update public.installment_groups set
    interest_pct = 1.75, min_pct = 5, min_floor = 0, min_with_installments = true,
    late_fee_pct = 1, late_fee_min = 0, late_fee_max = 100000,
    statement_month = '2026-11', statement_total = 482456, min_payment = 317132
  where user_id = v_user and name = 'BCA Blibli Mastercard';
end $$;
