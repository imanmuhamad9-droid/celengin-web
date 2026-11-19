// Hapus akun dan seluruh data pribadi. Hanya untuk pemilik akun yang sedang login, dan wajib
// memasukkan ulang password supaya sesi yang tercuri tidak cukup untuk menghapus akun.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const AVATAR_BUCKET = 'widget-images';

// Urutan penting: anak sebelum induk. Semua dihapus lewat service_role (melewati RLS) dengan filter pemilik.
// Tabel yang tidak ada (fitur belum diaktifkan) dilewati.
const OWNED: { table: string; column: string }[] = [
  { table: 'notifications', column: 'user_id' },
  { table: 'push_subscriptions', column: 'user_id' },
  { table: 'user_badges', column: 'user_id' },
  { table: 'goal_transactions', column: 'user_id' },
  { table: 'dream_goals', column: 'user_id' },
  { table: 'emergency_entries', column: 'user_id' },
  { table: 'net_worth_snapshots', column: 'user_id' },
  { table: 'net_worth_items', column: 'user_id' },
  { table: 'budgets', column: 'user_id' },
  { table: 'targets', column: 'user_id' },
  { table: 'presets', column: 'user_id' },
  { table: 'categories', column: 'user_id' },
  { table: 'user_widgets', column: 'user_id' },
  { table: 'weekly_reports', column: 'user_id' },
  { table: 'bills', column: 'user_id' },
  { table: 'transactions', column: 'user_id' },
  { table: 'recurring_rules', column: 'user_id' },
  { table: 'wallet_transfers', column: 'user_id' },
  { table: 'wallets', column: 'user_id' },
  // Dibuat user lain bersama: yang dihapus hanya milik pengguna ini.
  { table: 'couple_transactions', column: 'user_id' },
  { table: 'couple_members', column: 'user_id' },
  { table: 'couple_goals', column: 'created_by' },
  { table: 'split_members', column: 'user_id' },
  { table: 'split_groups', column: 'user_id' },
  { table: 'profiles', column: 'id' },
];

const isMissingTable = (msg: string) => /does not exist|could not find the table|schema cache/i.test(msg);

async function rateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) { console.error('rate_limit_hit gagal:', error.message); return false; }
  return data === true;
}

export async function POST(request: Request) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
    const user = userData.user;

    if (await rateLimited(`delete-account:${user.id}`, 3, 60 * 60)) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== 'HAPUS') return NextResponse.json({ error: 'Ketik HAPUS untuk mengonfirmasi.' }, { status: 400 });
    const password = String(body?.password || '');
    if (!password || !user.email) return NextResponse.json({ error: 'Password wajib diisi.' }, { status: 400 });

    // Verifikasi password lama dengan klien anon (tidak menyimpan sesi)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi.');
    const verifier = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: pwErr } = await verifier.auth.signInWithPassword({ email: user.email, password });
    if (pwErr) return NextResponse.json({ error: 'Password salah.' }, { status: 401 });

    // 1. File di storage (foto profil, sampul, latar widget): nama berawalan "<user-id>-"
    try {
      const { data: files } = await admin.storage.from(AVATAR_BUCKET).list('', { limit: 1000, search: `${user.id}-` });
      const names = (files || []).map((f) => f.name).filter((n) => n.startsWith(`${user.id}-`));
      if (names.length > 0) await admin.storage.from(AVATAR_BUCKET).remove(names);
    } catch (e) {
      console.error('hapus file storage gagal:', e instanceof Error ? e.message : e);
    }

    // 2. Baris data
    const failed: string[] = [];
    for (const { table, column } of OWNED) {
      const { error } = await admin.from(table).delete().eq(column, user.id);
      if (error && !isMissingTable(error.message)) {
        console.error(`hapus ${table} gagal:`, error.message);
        failed.push(table);
      }
    }

    // 3. Akun login. Bila masih ada data yang menahan (foreign key), jangan mengaku berhasil.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error('deleteUser gagal:', delErr.message, 'tabel gagal:', failed.join(','));
      return NextResponse.json(
        { error: 'Akun belum bisa dihapus otomatis karena masih ada data yang terkait. Data pribadimu sudah dibersihkan sebagian; hubungi admin untuk menyelesaikannya.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('hapus akun gagal:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server gagal memproses permintaan. Coba lagi.' }, { status: 500 });
  }
}
