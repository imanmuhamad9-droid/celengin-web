// Pusat notifikasi (lonceng). Tabel: public.notifications (lihat sql/04_notifications.sql).
// Semua fungsi aman dipanggil walau tabelnya belum ada: hasilnya kosong, tidak melempar error.
import { supabase } from '@/lib/supabaseClient';

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: 'split_invite' | 'couple_invite' | 'info' | string;
  title: string;
  body: string | null;
  link: string | null;
  ref_id: string | null;
  read_at: string | null;
  created_at: string;
};

/** Event global: dikirim setiap jumlah notifikasi belum dibaca berubah. detail = { unread: number } */
export const NOTIF_EVENT = 'celengin:notif-changed';

export function emitNotifChanged(unread?: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIF_EVENT, { detail: { unread } }));
}

export async function fetchNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,user_id,actor_id,kind,title,body,link,ref_id,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as AppNotification[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) return 0;
  return count || 0;
}

export async function markNotificationRead(id: string) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
  emitNotifChanged();
}

export async function markAllNotificationsRead() {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  emitNotifChanged();
}

export async function deleteNotification(id: string) {
  await supabase.from('notifications').delete().eq('id', id);
  emitNotifChanged();
}

/** Kirim push untuk notifikasi baru milik orang lain (dipanggil setelah mengirim undangan). Gagal = diabaikan. */
export async function pushInviteNow(targetUserId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ targetUserId }),
    });
  } catch (_) { /* push hanya tambahan */ }
}

/** Waktu relatif singkat, mis. "baru saja", "5 mnt", "2 jam", "3 hari". Dipanggil hanya di sisi klien. */
export function timeAgo(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
