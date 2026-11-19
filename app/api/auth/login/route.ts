// Login memakai USERNAME (nickname). Server mencari email-nya, login di sisi server, lalu mengirim sesi
// ke browser. Email orang lain tidak pernah dikirim ke browser.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const GENERIC = 'Email/username atau password salah.';

// Pembatas laju bersama lewat database (sql/04_rate_limit.sql), jadi berlaku di semua instance serverless.
// Bila database gagal dihubungi, login tetap dibolehkan (fail-open) dan kegagalannya dicatat di log.
async function limited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) { console.error('rate_limit_hit gagal:', error.message); return false; }
  return data === true;
}

const TOO_MANY = { error: 'Terlalu banyak percobaan. Coba lagi sebentar lagi.' };

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function emailFromUsername(username: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const { data: prof } = await admin.from('profiles').select('id').eq('nickname', username).maybeSingle();
  if (!prof?.id) return null;
  const { data, error } = await admin.auth.admin.getUserById(prof.id);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

export async function POST(request: Request) {
  try {
    const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    if (await limited(`login:ip:${ip}`, 10, 60)) return NextResponse.json(TOO_MANY, { status: 429 });

    const body = await request.json().catch(() => ({}));
    const identifier = String(body?.identifier || '').trim().toLowerCase();
    const action = body?.action === 'resend' ? 'resend' : 'login';
    if (!identifier || identifier.includes('@')) return NextResponse.json({ error: GENERIC }, { status: 400 });

    // Batas per akun: serangan dari banyak IP ke satu username tetap tertahan.
    const accountKey = `${action}:user:${identifier.slice(0, 64)}`;
    if (await limited(accountKey, action === 'resend' ? 3 : 8, 15 * 60)) return NextResponse.json(TOO_MANY, { status: 429 });

    const email = await emailFromUsername(identifier);

    if (action === 'resend') {
      // Selalu jawab sama, supaya tidak bisa dipakai menebak username.
      if (email) await anonClient().auth.resend({ type: 'signup', email });
      return NextResponse.json({ ok: true });
    }

    const password = String(body?.password || '');
    if (!email || !password) return NextResponse.json({ error: GENERIC }, { status: 401 });

    const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      if (error?.message?.toLowerCase().includes('email not confirmed')) {
        return NextResponse.json({ error: 'email_not_confirmed' }, { status: 401 });
      }
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }
    return NextResponse.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  } catch (e: unknown) {
    console.error('login gagal:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server belum siap untuk login username. Coba login dengan email.' }, { status: 500 });
  }
}
