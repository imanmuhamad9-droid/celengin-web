// Mengirim push untuk undangan yang BARU dibuat oleh pemanggil.
// Aman dari penyalahgunaan: server hanya mengirim notifikasi yang sudah ada di tabel notifications,
// dibuat oleh pemanggil sendiri (actor_id), belum pernah di-push, dan baru (<= 10 menit).
import { NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });

  let targetUserId = '';
  try { targetUserId = String((await request.json())?.targetUserId || ''); } catch (_) { /* body kosong */ }
  if (!targetUserId) return NextResponse.json({ error: 'targetUserId wajib diisi.' }, { status: 400 });

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ sent: 0, skipped: 'VAPID belum diisi' });

  const admin = supabaseAdmin();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
  const callerId = userData.user.id;

  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: notifs } = await admin
    .from('notifications')
    .select('id,title,body,link')
    .eq('user_id', targetUserId)
    .eq('actor_id', callerId)
    .is('pushed_at', null)
    .is('read_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (!notifs || notifs.length === 0) return NextResponse.json({ sent: 0 });

  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', targetUserId);

  // Tandai sudah diproses agar tidak terkirim dua kali, walau penerima belum berlangganan push.
  // PERBAIKAN: Menambahkan : any pada parameter 'n'
  await admin.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', notifs.map((n: any) => n.id));
  
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
  let sent = 0;
  for (const n of notifs) {
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: `🔔 ${n.title}`, body: n.body || '', url: n.link || '/dashboard', tag: `notif-${n.id}` }),
        );
        sent += 1;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }
  }
  return NextResponse.json({ sent });
}