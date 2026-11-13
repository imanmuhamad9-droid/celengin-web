// Tombol "Kirim Tes Notifikasi" di Pengaturan memanggil ini dengan access token user.
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    return NextResponse.json({ error: 'VAPID key belum diisi di server (environment variable).' }, { status: 500 });
  }

  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });

  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', userData.user.id);
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'Belum ada perangkat yang berlangganan notifikasi.' }, { status: 404 });
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: '🔔 Celengin', body: 'Notifikasi berhasil! Pengingat tagihan & ringkasan akan muncul di sini.', url: '/dashboard', tag: 'test' }),
      );
      sent += 1;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }
  if (sent === 0) return NextResponse.json({ error: 'Pengiriman gagal. Coba nonaktifkan lalu aktifkan ulang notifikasi.' }, { status: 502 });
  return NextResponse.json({ sent });
}
