-- =====================================================================
-- CELENGIN - audit_and_fix_rls.sql
-- Audit + perbaikan Row Level Security (RLS) untuk Supabase.
--
-- CARA PAKAI (Supabase Dashboard -> SQL Editor):
--   1. Jalankan BAGIAN 1 (diagnostik) satu query per satu. Hanya membaca, aman.
--      Select satu blok, klik Run. Simpan hasilnya (screenshot / export CSV).
--   2. Baca hasil 1.3, 1.7, 1.8, 1.9, 1.10. Perbaiki yang diminta SEBELUM lanjut.
--   3. Jalankan BAGIAN 2 (hak EXECUTE fungsi). Aman, langsung dipakai.
--   4. Jalankan BAGIAN 3 (policy tabel inti) SEKALI, utuh, setelah 1.10 bersih.
--      Sebaiknya di project staging dulu, atau di jam sepi.
--   5. Jalankan BAGIAN 4 (storage) bila bucket widget-images dipakai.
--   6. Uji dengan BAGIAN 5 memakai dua akun.
--
-- CATATAN PENTING
--   * Policy RLS bersifat OR: jika ada policy lama yang longgar (mis. using (true))
--     pada tabel yang sama, policy ketat di sini TIDAK ada gunanya. Cek hasil 1.3.
--   * service_role (dipakai app/api/*) selalu melewati RLS, jadi cron dan push
--     tidak terpengaruh.
--   * Tabel di 01_fitur_baru.sql dan 02_dompet.sql (recurring_rules, bills,
--     push_subscriptions, user_badges, wallets, wallet_transfers, shared_*) sudah
--     punya policy; file ini tidak mengubahnya.
-- =====================================================================


-- =====================================================================
-- BAGIAN 1 - DIAGNOSTIK (hanya membaca)
-- =====================================================================

-- 1.1  Tabel di schema public yang RLS-nya MATI. Targetnya: hasil kosong.
select c.relname as tabel, c.relrowsecurity as rls_aktif, c.relforcerowsecurity as rls_force
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity
order by c.relname;

-- 1.2  Semua policy yang aktif sekarang.
select tablename, policyname, cmd, permissive, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 1.3  Policy MENCURIGAKAN: untuk role public/anon, atau kondisi selalu benar.
--      Setiap baris di sini harus dijelaskan atau dihapus (drop policy "..." on public.xxx;).
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
  and (
        roles && array['public','anon']::name[]
     or lower(coalesce(qual, '')) in ('true', '(true)')
     or lower(coalesce(with_check, '')) in ('true', '(true)')
  )
order by tablename, policyname;

-- 1.4  Tabel dengan RLS aktif tapi TANPA policy sama sekali (semua akses user ditolak).
select c.relname as tabel
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
order by c.relname;

-- 1.5  Hak tabel untuk role anon (belum login). Idealnya hanya SELECT yang tidak
--      dilindungi RLS = kosong. Baris dengan INSERT/UPDATE/DELETE untuk anon perlu dicek.
select table_name, string_agg(privilege_type, ', ' order by privilege_type) as hak_anon
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
group by table_name
order by table_name;

-- 1.6  Semua fungsi public + siapa yang boleh EXECUTE. Perhatikan kolom anon_bisa_jalankan
--      dan fungsi SECURITY DEFINER tanpa search_path (aman bila kolom search_path terisi).
select p.oid::regprocedure                                   as fungsi,
       p.prosecdef                                           as security_definer,
       p.proconfig                                           as search_path_dkk,
       has_function_privilege('anon', p.oid, 'execute')      as anon_bisa_jalankan,
       has_function_privilege('authenticated', p.oid, 'execute') as login_bisa_jalankan
from pg_proc p
where p.pronamespace = 'public'::regnamespace
order by p.prosecdef desc, p.proname;

-- 1.7  RPC get_user_id_by_email: hak akses + isi fungsi.
--      Jika anon_bisa_jalankan = true, siapa pun di internet bisa menebak email terdaftar
--      (hasil uuid = email ada, kosong = tidak ada). Bagian 2 menutupnya.
select p.oid::regprocedure                                   as fungsi,
       pg_get_function_result(p.oid)                         as tipe_hasil,
       p.prosecdef                                           as security_definer,
       p.proconfig                                           as search_path_dkk,
       p.proacl                                              as acl,
       has_function_privilege('anon', p.oid, 'execute')      as anon_bisa_jalankan,
       has_function_privilege('authenticated', p.oid, 'execute') as login_bisa_jalankan,
       pg_get_functiondef(p.oid)                             as definisi
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname = 'get_user_id_by_email';

-- 1.8  RPC split_respond_invite: baca isinya. Pastikan ada pengecekan bahwa baris
--      split_members itu milik auth.uid() dan masih 'pending'. Jika tidak, ganti.
select p.oid::regprocedure as fungsi, p.prosecdef as security_definer, p.proconfig,
       has_function_privilege('anon', p.oid, 'execute') as anon_bisa_jalankan,
       pg_get_functiondef(p.oid) as definisi
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.proname = 'split_respond_invite';

-- 1.9  Trigger pada tabel sumber notifikasi. Aplikasi tidak pernah INSERT ke
--      notifications dari browser, jadi notifikasi undangan pasti dibuat trigger.
--      Trigger itu HARUS security definer, kalau tidak, notifikasi berhenti setelah Bagian 3.
select event_object_table as tabel, trigger_name, event_manipulation as event, action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('couple_members','split_members','notifications','profiles','couple_goals')
order by event_object_table, trigger_name;

select p.oid::regprocedure as fungsi_trigger, p.prosecdef as security_definer
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_class c on c.oid = t.tgrelid
where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
  and c.relname in ('couple_members','split_members','notifications','profiles','couple_goals');

-- 1.10 Kolom yang DIPAKAI Bagian 3. Targetnya: hasil kosong.
--      Baris yang muncul = kolom/tabel tidak ada. Sesuaikan Bagian 3 atau skema Anda dulu.
with perlu(tabel, kolom) as (values
  ('transactions','user_id'),('transactions','wallet_id'),
  ('presets','user_id'),('targets','user_id'),('budgets','user_id'),
  ('dream_goals','user_id'),('goal_transactions','goal_id'),('goal_transactions','user_id'),
  ('emergency_entries','user_id'),('net_worth_items','user_id'),('net_worth_snapshots','user_id'),
  ('profiles','id'),('profiles','nickname'),
  ('couple_goals','id'),('couple_goals','created_by'),('couple_goals','current_amount'),
  ('couple_members','id'),('couple_members','goal_id'),('couple_members','user_id'),('couple_members','status'),
  ('couple_transactions','goal_id'),('couple_transactions','user_id'),
  ('split_groups','id'),('split_groups','user_id'),
  ('split_members','id'),('split_members','group_id'),('split_members','user_id'),('split_members','status'),
  ('split_expenses','id'),('split_expenses','group_id'),
  ('split_expense_items','id'),('split_expense_items','expense_id'),
  ('split_item_assignees','item_id'),
  ('split_shares','expense_id'),
  ('split_settlements','group_id'),('split_settlements','created_by'),
  ('notifications','user_id'),('notifications','read_at')
)
select p.tabel, p.kolom,
       case when not exists (select 1 from information_schema.tables t
                             where t.table_schema='public' and t.table_name=p.tabel)
            then 'TABEL TIDAK ADA' else 'KOLOM TIDAK ADA' end as masalah
from perlu p
where not exists (select 1 from information_schema.columns c
                  where c.table_schema='public' and c.table_name=p.tabel and c.column_name=p.kolom)
order by p.tabel, p.kolom;

-- 1.11 Nickname ganda (huruf besar/kecil diabaikan). Harus kosong sebelum membuat
--      indeks unik di Bagian 3 (langkah 3.3).
select lower(nickname) as nickname, count(*) as jumlah
from public.profiles
where nickname is not null
group by lower(nickname)
having count(*) > 1;


-- =====================================================================
-- BAGIAN 2 - HAK EXECUTE FUNGSI (aman dijalankan ulang)
-- Fungsi baru di Postgres otomatis bisa dijalankan PUBLIC, dan Supabase juga memberi
-- hak ke anon. Di sini: cabut dari public + anon, beri hanya ke authenticated.
-- Tidak mengubah isi fungsi, jadi aplikasi (yang selalu login saat memanggil RPC) tetap jalan.
-- =====================================================================
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('get_user_id_by_email', 'split_respond_invite', 'is_goal_member')
  loop
    execute format('revoke execute on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
    raise notice 'EXECUTE dibatasi untuk %', r.fn;
  end loop;
end $$;

-- Cek ulang: anon_bisa_jalankan harus false semua untuk tiga fungsi di atas.
select p.oid::regprocedure as fungsi,
       has_function_privilege('anon', p.oid, 'execute')          as anon_bisa_jalankan,
       has_function_privilege('authenticated', p.oid, 'execute') as login_bisa_jalankan
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('get_user_id_by_email', 'split_respond_invite', 'is_goal_member');

-- OPSIONAL (hapus tanda komentar bila hasil 1.7 menunjukkan definisi lemah, mis. tanpa
-- search_path, atau tipe hasil bukan uuid). CREATE OR REPLACE gagal bila nama parameter
-- atau tipe hasil berbeda; itu disengaja supaya tidak merusak pemanggil.
-- Catatan: pengguna yang login tetap bisa mencoba banyak email. Batasi lewat rate limit
-- (mis. lewat Edge Function) bila ini jadi kekhawatiran.
--
-- create or replace function public.get_user_id_by_email(email_input text)
-- returns uuid
-- language sql
-- security definer
-- stable
-- set search_path = public, auth
-- as $$
--   select u.id
--   from auth.users u
--   where auth.uid() is not null
--     and lower(u.email) = lower(btrim(email_input))
--   limit 1;
-- $$;
-- revoke execute on function public.get_user_id_by_email(text) from public, anon;
-- grant  execute on function public.get_user_id_by_email(text) to authenticated;


-- =====================================================================
-- BAGIAN 3 - POLICY TABEL INTI
-- Jalankan utuh. Bila ada error, seluruh transaksi dibatalkan (tidak ada perubahan
-- setengah jalan). Hanya policy bernama "celengin_*" yang dibuat ulang.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 3.0 Fungsi pembantu (security definer: membaca tabel tanpa memicu rekursi RLS)
-- ---------------------------------------------------------------------

-- Target Bareng: pencipta atau anggota dengan status apa pun (termasuk undangan pending).
-- Dipakai agar penerima undangan bisa melihat judul target. (is_goal_member dari 01
-- hanya menghitung anggota 'accepted'.)
create or replace function public.is_goal_related(gid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.couple_goals g where g.id = gid and g.created_by = auth.uid())
      or exists (select 1 from public.couple_members m where m.goal_id = gid and m.user_id = auth.uid());
$$;

-- Gantian / Bayarin: boleh MELIHAT grup = pemilik atau anggota (termasuk pending).
create or replace function public.split_can_view(gid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.split_groups g where g.id = gid and g.user_id = auth.uid())
      or exists (select 1 from public.split_members m where m.group_id = gid and m.user_id = auth.uid());
$$;

-- Boleh MENGUBAH isi grup = pemilik atau anggota yang sudah menerima undangan.
create or replace function public.split_can_edit(gid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.split_groups g where g.id = gid and g.user_id = auth.uid())
      or exists (select 1 from public.split_members m
                 where m.group_id = gid and m.user_id = auth.uid() and m.status = 'accepted');
$$;

-- Apakah orang ini (uid) berbagi target/grup dengan saya? Untuk membaca nama di profiles.
create or replace function public.shares_context_with(uid uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select
    exists (select 1 from public.couple_members a
            join public.couple_members b on b.goal_id = a.goal_id
            where a.user_id = auth.uid() and b.user_id = uid)
    or exists (select 1 from public.split_members a
               join public.split_members b on b.group_id = a.group_id
               where a.user_id = auth.uid() and b.user_id = uid)
    or exists (select 1 from public.split_groups g
               join public.split_members b on b.group_id = g.id
               where g.user_id = auth.uid() and b.user_id = uid)
    or exists (select 1 from public.split_groups g
               join public.split_members a on a.group_id = g.id
               where g.user_id = uid and a.user_id = auth.uid());
$$;

revoke execute on function public.is_goal_related(uuid)     from public, anon;
revoke execute on function public.split_can_view(uuid)      from public, anon;
revoke execute on function public.split_can_edit(uuid)      from public, anon;
revoke execute on function public.shares_context_with(uuid) from public, anon;
grant  execute on function public.is_goal_related(uuid)     to authenticated;
grant  execute on function public.split_can_view(uuid)      to authenticated;
grant  execute on function public.split_can_edit(uuid)      to authenticated;
grant  execute on function public.shares_context_with(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3.1 Tabel milik satu user (kolom user_id). Kode membaca banyak tabel ini tanpa
--     filter user_id, jadi policy inilah satu-satunya pagar antar-user.
--     transactions diberi syarat tambahan: dompet harus milik sendiri.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['presets','targets','budgets','dream_goals',
                           'emergency_entries','net_worth_items','net_worth_snapshots']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'celengin_' || t || '_own', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())',
      'celengin_' || t || '_own', t);
  end loop;
end $$;

alter table public.transactions enable row level security;
drop policy if exists celengin_transactions_own on public.transactions;
create policy celengin_transactions_own on public.transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (wallet_id is null
         or exists (select 1 from public.wallets w where w.id = wallet_id and w.user_id = auth.uid()))
  );

-- Riwayat target mimpi: milik sendiri DAN targetnya milik sendiri.
alter table public.goal_transactions enable row level security;
drop policy if exists celengin_goal_transactions_own on public.goal_transactions;
create policy celengin_goal_transactions_own on public.goal_transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.dream_goals d where d.id = goal_id and d.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 3.2 notifications
--     Baca/hapus milik sendiri. UPDATE hanya kolom read_at (lewat hak kolom).
--     Tanpa policy INSERT: notifikasi dibuat trigger (security definer, lihat 1.9)
--     dan cron (service_role). Browser tidak boleh mengirim notifikasi palsu
--     (judul + link) ke orang lain.
-- ---------------------------------------------------------------------
alter table public.notifications enable row level security;
drop policy if exists celengin_notifications_select on public.notifications;
drop policy if exists celengin_notifications_update on public.notifications;
drop policy if exists celengin_notifications_delete on public.notifications;
create policy celengin_notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy celengin_notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy celengin_notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

revoke update on public.notifications from authenticated, anon;
grant  update (read_at) on public.notifications to authenticated;
revoke insert on public.notifications from authenticated, anon;

-- ---------------------------------------------------------------------
-- 3.3 profiles
--     Baca: milik sendiri, atau orang yang berbagi target/grup dengan saya.
--     Ubah: hanya milik sendiri. Tidak ada INSERT/DELETE dari browser (profil dibuat
--     trigger saat daftar).
--
--     DAMPAK KE KODE (butuh perubahan kecil, tawarkan di Tahap berikut):
--       * app/(auth)/register/page.tsx:33 dan settings/page.tsx:204 mengecek nickname
--         dengan SELECT ke profiles. Setelah ini hasilnya selalu "kosong" (dianggap
--         tersedia). Ganti ke RPC public.nickname_available(...) di bawah. Sampai
--         kode diganti, keunikan dijaga indeks unik (langkah di bawah).
--       * SplitBoard.tsx:252,328 membaca nama orang yang BARU diundang (belum berbagi
--         grup). Kode sudah punya fallback ke bagian depan email, jadi tidak error.
--     Pilihan lain bila tidak mau perubahan kode: izinkan semua user login membaca
--     profiles (using (true)); tapi payday, emergency_months, dst jadi terbaca semua orang.
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists celengin_profiles_select on public.profiles;
drop policy if exists celengin_profiles_update on public.profiles;
create policy celengin_profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_context_with(id));
create policy celengin_profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Pengecekan nickname untuk halaman daftar (anon) dan pengaturan. Hanya mengembalikan
-- ya/tidak, tidak membocorkan data lain. Tetap bisa dipakai menebak nickname; batasi
-- lewat rate limit bila perlu.
create or replace function public.nickname_available(n text)
returns boolean
language sql security definer stable set search_path = public
as $$
  select not exists (select 1 from public.profiles p where lower(p.nickname) = lower(btrim(n)));
$$;
revoke execute on function public.nickname_available(text) from public;
grant  execute on function public.nickname_available(text) to anon, authenticated;

-- Indeks unik nickname (tanpa beda huruf besar/kecil). Jalankan 1.11 dulu; bila ada
-- duplikat, perintah ini gagal dan seluruh Bagian 3 dibatalkan (aman).
create unique index if not exists profiles_nickname_lower_uniq
  on public.profiles (lower(nickname)) where nickname is not null;

-- ---------------------------------------------------------------------
-- 3.4 Target Bareng (couple_*)
-- ---------------------------------------------------------------------
alter table public.couple_goals        enable row level security;
alter table public.couple_members      enable row level security;
alter table public.couple_transactions enable row level security;

-- couple_goals
drop policy if exists celengin_couple_goals_select on public.couple_goals;
drop policy if exists celengin_couple_goals_insert on public.couple_goals;
drop policy if exists celengin_couple_goals_update on public.couple_goals;
drop policy if exists celengin_couple_goals_delete on public.couple_goals;
create policy celengin_couple_goals_select on public.couple_goals
  for select to authenticated using (public.is_goal_related(id));
create policy celengin_couple_goals_insert on public.couple_goals
  for insert to authenticated with check (created_by = auth.uid());
create policy celengin_couple_goals_update on public.couple_goals
  for update to authenticated
  using (public.is_goal_member(id)) with check (public.is_goal_member(id));
create policy celengin_couple_goals_delete on public.couple_goals
  for delete to authenticated using (created_by = auth.uid());

-- Anggota biasa hanya boleh mengubah current_amount; pencipta tidak boleh diganti.
-- Dilewati bila auth.uid() kosong (SQL Editor / service_role).
create or replace function public.couple_goals_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by tidak boleh diubah';
  end if;
  if auth.uid() is distinct from old.created_by
     and (to_jsonb(new) - 'current_amount') is distinct from (to_jsonb(old) - 'current_amount') then
    raise exception 'Hanya pembuat target yang boleh mengubah detail target';
  end if;
  return new;
end $$;
drop trigger if exists couple_goals_guard on public.couple_goals;
create trigger couple_goals_guard before update on public.couple_goals
  for each row execute function public.couple_goals_guard();

-- couple_members
drop policy if exists celengin_couple_members_select on public.couple_members;
drop policy if exists celengin_couple_members_insert on public.couple_members;
drop policy if exists celengin_couple_members_update on public.couple_members;
drop policy if exists celengin_couple_members_delete on public.couple_members;
create policy celengin_couple_members_select on public.couple_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_goal_member(goal_id));
-- Pencipta menambah dirinya (accepted); anggota sah mengundang orang lain (pending saja).
create policy celengin_couple_members_insert on public.couple_members
  for insert to authenticated
  with check (
    (user_id = auth.uid() and status = 'accepted'
       and exists (select 1 from public.couple_goals g where g.id = goal_id and g.created_by = auth.uid()))
    or
    (user_id <> auth.uid() and status = 'pending' and public.is_goal_member(goal_id))
  );
-- Penerima menerima undangannya sendiri: pending -> accepted. Tidak ada yang lain.
create policy celengin_couple_members_update on public.couple_members
  for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'accepted');
-- Tolak/keluar (diri sendiri) atau pencipta mengeluarkan anggota.
create policy celengin_couple_members_delete on public.couple_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.couple_goals g where g.id = goal_id and g.created_by = auth.uid())
  );
-- Hak kolom: yang boleh diubah hanya status (goal_id / user_id tidak bisa dipindah).
revoke update on public.couple_members from authenticated, anon;
grant  update (status) on public.couple_members to authenticated;

-- couple_transactions
drop policy if exists celengin_couple_tx_select on public.couple_transactions;
drop policy if exists celengin_couple_tx_insert on public.couple_transactions;
create policy celengin_couple_tx_select on public.couple_transactions
  for select to authenticated using (public.is_goal_member(goal_id));
create policy celengin_couple_tx_insert on public.couple_transactions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_goal_member(goal_id));

-- ---------------------------------------------------------------------
-- 3.5 Gantian / Bayarin (split_*)
-- ---------------------------------------------------------------------
alter table public.split_groups         enable row level security;
alter table public.split_members        enable row level security;
alter table public.split_expenses       enable row level security;
alter table public.split_expense_items  enable row level security;
alter table public.split_item_assignees enable row level security;
alter table public.split_shares         enable row level security;
alter table public.split_settlements    enable row level security;

-- split_groups
drop policy if exists celengin_split_groups_select on public.split_groups;
drop policy if exists celengin_split_groups_insert on public.split_groups;
drop policy if exists celengin_split_groups_update on public.split_groups;
drop policy if exists celengin_split_groups_delete on public.split_groups;
create policy celengin_split_groups_select on public.split_groups
  for select to authenticated using (user_id = auth.uid() or public.split_can_view(id));
create policy celengin_split_groups_insert on public.split_groups
  for insert to authenticated with check (user_id = auth.uid());
create policy celengin_split_groups_update on public.split_groups
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy celengin_split_groups_delete on public.split_groups
  for delete to authenticated using (user_id = auth.uid());

-- split_members
-- Orang lain hanya bisa ditambah sebagai "pending" (undangan) atau tanpa akun (user_id kosong).
drop policy if exists celengin_split_members_select on public.split_members;
drop policy if exists celengin_split_members_insert on public.split_members;
drop policy if exists celengin_split_members_update on public.split_members;
drop policy if exists celengin_split_members_delete on public.split_members;
create policy celengin_split_members_select on public.split_members
  for select to authenticated using (public.split_can_view(group_id));
create policy celengin_split_members_insert on public.split_members
  for insert to authenticated
  with check (
    public.split_can_edit(group_id)
    and (user_id is null or user_id = auth.uid() or status = 'pending')
  );
create policy celengin_split_members_update on public.split_members
  for update to authenticated
  using (public.split_can_edit(group_id)) with check (public.split_can_edit(group_id));
create policy celengin_split_members_delete on public.split_members
  for delete to authenticated
  using (public.split_can_edit(group_id) or user_id = auth.uid());

-- Hanya orang yang bersangkutan yang boleh mengubah status undangan; user_id tidak boleh diganti.
-- (split_respond_invite berjalan atas nama penerima, jadi tetap lolos.)
create or replace function public.split_members_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id anggota tidak boleh diubah';
  end if;
  if new.status is distinct from old.status and old.user_id is distinct from auth.uid() then
    raise exception 'Status undangan hanya bisa diubah oleh penerimanya';
  end if;
  return new;
end $$;
drop trigger if exists split_members_guard on public.split_members;
create trigger split_members_guard before update on public.split_members
  for each row execute function public.split_members_guard();

-- split_expenses
drop policy if exists celengin_split_expenses_select on public.split_expenses;
drop policy if exists celengin_split_expenses_insert on public.split_expenses;
drop policy if exists celengin_split_expenses_update on public.split_expenses;
drop policy if exists celengin_split_expenses_delete on public.split_expenses;
create policy celengin_split_expenses_select on public.split_expenses
  for select to authenticated using (public.split_can_view(group_id));
create policy celengin_split_expenses_insert on public.split_expenses
  for insert to authenticated with check (public.split_can_edit(group_id));
create policy celengin_split_expenses_update on public.split_expenses
  for update to authenticated
  using (public.split_can_edit(group_id)) with check (public.split_can_edit(group_id));
create policy celengin_split_expenses_delete on public.split_expenses
  for delete to authenticated using (public.split_can_edit(group_id));

-- split_expense_items, split_shares: mengikuti pengeluaran induknya
drop policy if exists celengin_split_items_all  on public.split_expense_items;
drop policy if exists celengin_split_shares_all on public.split_shares;
create policy celengin_split_items_all on public.split_expense_items
  for all to authenticated
  using (exists (select 1 from public.split_expenses e
                 where e.id = expense_id and public.split_can_view(e.group_id)))
  with check (exists (select 1 from public.split_expenses e
                      where e.id = expense_id and public.split_can_edit(e.group_id)));
create policy celengin_split_shares_all on public.split_shares
  for all to authenticated
  using (exists (select 1 from public.split_expenses e
                 where e.id = expense_id and public.split_can_view(e.group_id)))
  with check (exists (select 1 from public.split_expenses e
                      where e.id = expense_id and public.split_can_edit(e.group_id)));

-- split_item_assignees: mengikuti item -> pengeluaran -> grup
drop policy if exists celengin_split_assignees_all on public.split_item_assignees;
create policy celengin_split_assignees_all on public.split_item_assignees
  for all to authenticated
  using (exists (select 1 from public.split_expense_items i
                 join public.split_expenses e on e.id = i.expense_id
                 where i.id = item_id and public.split_can_view(e.group_id)))
  with check (exists (select 1 from public.split_expense_items i
                      join public.split_expenses e on e.id = i.expense_id
                      where i.id = item_id and public.split_can_edit(e.group_id)));

-- split_settlements
drop policy if exists celengin_split_settlements_select on public.split_settlements;
drop policy if exists celengin_split_settlements_insert on public.split_settlements;
drop policy if exists celengin_split_settlements_delete on public.split_settlements;
create policy celengin_split_settlements_select on public.split_settlements
  for select to authenticated using (public.split_can_view(group_id));
create policy celengin_split_settlements_insert on public.split_settlements
  for insert to authenticated
  with check (created_by = auth.uid() and public.split_can_edit(group_id));
create policy celengin_split_settlements_delete on public.split_settlements
  for delete to authenticated using (public.split_can_edit(group_id));

commit;

-- Bila ada pesan error di atas: tidak ada yang berubah. Salin pesannya, perbaiki skema
-- atau hasil 1.10, lalu jalankan ulang.


-- =====================================================================
-- BAGIAN 3B - BERSIHKAN POLICY LAMA (hasil audit 1.2)
-- Policy RLS bersifat OR. Policy lama di bawah ini terlalu longgar dan membatalkan
-- policy celengin_* di Bagian 3. Jalankan utuh setelah Bagian 3. Satu transaksi.
-- =====================================================================
begin;

-- couple_members: semua policy lama = "asal sudah login" (siapa pun bisa baca/ubah/hapus)
drop policy if exists "Users can delete members" on public.couple_members;
drop policy if exists "Users can insert members" on public.couple_members;
drop policy if exists "Users can update members" on public.couple_members;
drop policy if exists "Users can view members"   on public.couple_members;

-- couple_goals: semua target terbaca semua user login (termasuk nomor rekening)
drop policy if exists "Users can view own or joined goals" on public.couple_goals;
drop policy if exists "Users can update joined goals"      on public.couple_goals;  -- ikut menghitung anggota pending
drop policy if exists "Users can insert goals"             on public.couple_goals;  -- sudah digantikan celengin_couple_goals_insert

-- couple_transactions: "asal sudah login"
drop policy if exists "User Access Own Couple Tx" on public.couple_transactions;

-- profiles: terbaca oleh semua orang, bahkan tanpa login
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
-- "Users can view own profile" / "update own" / "insert own" dibiarkan (sudah benar).

-- transactions & goal_transactions: policy lama tidak memeriksa dompet/target milik sendiri
drop policy if exists "User Access Own Transactions" on public.transactions;
drop policy if exists "User Access Own Goal Tx"      on public.goal_transactions;

-- split_*: policy LAMA lebih ketat dari buatan saya (hanya pembuat/pemilik boleh ubah/hapus,
-- hanya anggota accepted boleh melihat pengeluaran). Pakai yang lama, buang celengin_split_*.
-- Trigger split_members_guard tetap dipakai (melindungi status undangan & user_id).
do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies
           where schemaname = 'public' and policyname like 'celengin\_split\_%'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

commit;

-- Verifikasi: kedua query harus kosong.
-- (a) Policy "asal login" / "semua orang" yang tersisa:
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (lower(coalesce(qual,'')) in ('true','(true)', '(auth.uid() is not null)')
    or lower(coalesce(with_check,'')) in ('true','(true)', '(auth.uid() is not null)'))
order by tablename, policyname;
-- (b) Tabel inti yang kini TIDAK punya policy sama sekali untuk salah satu perintah
--     akan menolak perintah itu; cek aplikasi (tambah/hapus data) setelah ini.


-- =====================================================================
-- BAGIAN 4 - STORAGE bucket "widget-images" (foto profil, sampul, latar widget)
-- Aplikasi mengunggah ke akar bucket dengan nama "<user-id>-<jenis>-<waktu>.<ekstensi>".
-- Bucket publik: URL gambar tetap bisa dibuka tanpa policy SELECT.
-- Policy ini mencegah user menimpa / menghapus file orang lain.
-- =====================================================================
drop policy if exists celengin_widget_images_insert on storage.objects;
drop policy if exists celengin_widget_images_update on storage.objects;
drop policy if exists celengin_widget_images_delete on storage.objects;
create policy celengin_widget_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'widget-images' and name like auth.uid()::text || '-%');
create policy celengin_widget_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'widget-images' and name like auth.uid()::text || '-%');
create policy celengin_widget_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'widget-images' and name like auth.uid()::text || '-%');

-- Batasi ukuran dan jenis file (mencegah unggahan HTML/SVG/file besar ke domain Anda).
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'widget-images';

-- Policy lama yang longgar (ditemukan di audit). Policy RLS bersifat OR, jadi policy ini
-- membatalkan pembatasan nama file di atas. Hapus keduanya.
-- Syarat: bucket harus publik (cek query di bawah, kolom public = true), karena gambar
-- dibuka lewat getPublicUrl dan tidak butuh policy SELECT.
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'widget-images';

drop policy if exists "Allow authenticated uploads to widget-images" on storage.objects;
drop policy if exists "Allow authenticated reads from widget-images"  on storage.objects;

-- Cek policy storage yang tersisa. Untuk bucket ini harus hanya ada tiga policy
-- celengin_widget_images_* (insert, update, delete):
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;


-- =====================================================================
-- BAGIAN 5 - UJI DUA AKUN (dijalankan di SQL Editor sebagai role "authenticated")
-- Ganti UUID_A dan UUID_B dengan id dua akun uji (lihat Authentication -> Users).
-- Semua perintah di sini tidak mengubah data (diakhiri rollback).
-- Hasil yang BENAR ditulis di komentar.
-- =====================================================================
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"UUID_A","role":"authenticated"}';
--
--   -- Hanya baris milik A:
--   select count(*) as total, count(*) filter (where user_id <> 'UUID_A') as milik_orang_lain
--   from public.transactions;                         -- milik_orang_lain = 0
--
--   -- Update/hapus baris B harus 0 baris terpengaruh:
--   update public.transactions set amount = amount where user_id = 'UUID_B';   -- UPDATE 0
--   delete from public.dream_goals where user_id = 'UUID_B';                   -- DELETE 0
--
--   -- A tidak bisa menyuntik notifikasi ke B:
--   insert into public.notifications(user_id, actor_id, kind, title)
--   values ('UUID_B', 'UUID_A', 'x', 'palsu');        -- ERROR: permission denied / RLS
--
--   -- A tidak bisa membaca profil B bila tidak berbagi target/grup:
--   select count(*) from public.profiles where id = 'UUID_B';                  -- 0
--
--   -- anon tidak bisa menebak email:
--   reset role; set local role anon;
--   select public.get_user_id_by_email('seseorang@contoh.com');                -- ERROR: permission denied
-- rollback;
