-- =====================================================================
-- CELENGIN - 04_rate_limit.sql
-- Pembatas laju bersama untuk semua instance serverless (dipakai app/api/auth/login).
-- Jalankan di Supabase -> SQL Editor. Aman diulang.
-- =====================================================================

create table if not exists public.rate_limits (
  key           text primary key,
  hits          integer     not null,
  window_start  timestamptz not null default now()
);

-- RLS aktif tanpa policy = browser tidak bisa menyentuh tabel ini sama sekali.
-- Hanya service_role (server) yang lewat.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Menghitung satu percobaan secara atomik (satu pernyataan, tanpa balapan antar-instance).
-- Mengembalikan true bila percobaan ini MELEWATI batas (harus ditolak).
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (key, hits, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set hits         = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                            then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds)
                            then now() else r.window_start end
  returning hits into v_hits;

  -- Bersihkan baris kedaluwarsa sesekali (sekitar 1 dari 50 panggilan), supaya tabel tidak tumbuh terus.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits > p_limit;
end $$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant  execute on function public.rate_limit_hit(text, integer, integer) to service_role;
