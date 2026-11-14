// Login memakai USERNAME (nickname). Server mencari email-nya, login di sisi server, lalu mengirim sesi
// ke browser. Email orang lain tidak pernah dikirim ke browser.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const GENERIC = 'Email/username atau password salah.';

// Pembatas sederhana per IP (best effort; instance serverless bisa berbeda-beda)
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  h.n += 1;
  return h.n > 10;
}

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
    if (limited(ip)) return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi sebentar lagi.' }, { status: 429 });

    const body = await request.json().catch(() => ({}));
    const identifier = String(body?.identifier || '').trim().toLowerCase();
    const action = body?.action === 'resend' ? 'resend' : 'login';
    if (!identifier || identifier.includes('@')) return NextResponse.json({ error: GENERIC }, { status: 400 });

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
  } catch (e: any) {
    return NextResponse.json({ error: 'Server belum siap untuk login username. Coba login dengan email.' }, { status: 500 });
  }
}
