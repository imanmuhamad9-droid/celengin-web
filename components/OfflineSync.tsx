'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { flushQueue, pendingCount, QUEUE_CHANGED_EVENT, TX_SYNCED_EVENT } from '@/lib/offlineQueue';

// Mengirim antrean transaksi offline begitu koneksi kembali, dan menampilkan status kecil di atas layar.
export default function OfflineSync() {
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const [sentMsg, setSentMsg] = useState('');

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sync = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !alive) return;
      const sent = await flushQueue(session.user.id);
      if (!alive) return;
      setPending(pendingCount(session.user.id));
      if (sent > 0) {
        window.dispatchEvent(new Event(TX_SYNCED_EVENT));
        setSentMsg(`${sent} transaksi offline sudah terkirim`);
        clearTimeout(timer);
        timer = setTimeout(() => setSentMsg(''), 4000);
      }
    };
    const refresh = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (alive) setPending(pendingCount(session?.user.id));
    };
    const onOnline = () => { setOffline(false); void sync(); };
    const onOffline = () => setOffline(true);

    setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    void sync();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(QUEUE_CHANGED_EVENT, refresh);
    const poll = setInterval(() => { if (pendingCount() > 0) void sync(); }, 60_000);

    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, refresh);
    };
  }, []);

  const text = sentMsg || (pending > 0 ? `${pending} transaksi menunggu dikirim${offline ? ' (offline)' : ''}` : offline ? 'Kamu sedang offline' : '');
  if (!text) return null;
  return (
    <div role="status" aria-live="polite" className="fixed top-2 inset-x-0 z-[60] flex justify-center pointer-events-none px-4">
      <span className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-lg text-white ${sentMsg ? 'bg-teal-600' : 'bg-amber-500'}`}>{text}</span>
    </div>
  );
}
