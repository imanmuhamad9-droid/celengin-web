'use client';
import { useEffect, useState } from 'react';
import { Bell, Download, Send, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

type ShowDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushSettingsCard({ showDialog }: { showDialog: ShowDialog }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);

    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (ok) {
      setPermission(Notification.permission);
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then(async (sub) => {
          if (!sub) return setSubscribed(false);
          const { count } = await supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('endpoint', sub.endpoint);
          setSubscribed((count || 0) > 0);
        })
        .catch(() => setSubscribed(false));
    }

    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e); };
    const onInstalled = () => { setStandalone(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const enable = async () => {
    if (!VAPID_PUBLIC) return showDialog('Belum Siap', 'Kunci notifikasi (VAPID) belum diisi di environment variable.', 'danger');
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        showDialog('Izin Ditolak', 'Aktifkan izin notifikasi untuk Celengin di pengaturan browser/HP kamu, lalu coba lagi.', 'danger');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) });
      const json = sub.toJSON();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase.from('push_subscriptions').upsert(
        { user_id: session.user.id, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, user_agent: navigator.userAgent.slice(0, 200) },
        { onConflict: 'endpoint' },
      );
      if (error) throw error;
      setSubscribed(true);
      showDialog('Berhasil', 'Notifikasi aktif di perangkat ini. Coba tombol "Kirim Tes Notifikasi".', 'success');
    } catch (e: any) {
      showDialog('Gagal', e?.message || 'Tidak bisa mengaktifkan notifikasi.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e: any) {
      showDialog('Gagal', e?.message || 'Tidak bisa menonaktifkan notifikasi.', 'danger');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/push/test', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) showDialog('Gagal', body.error || 'Tes notifikasi gagal.', 'danger');
      else showDialog('Terkirim', 'Tes notifikasi dikirim. Harusnya muncul beberapa detik lagi.', 'success');
    } finally {
      setBusy(false);
    }
  };

  const iosNeedsInstall = isIos && !standalone;

  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
      <h3 className="font-bold text-gray-800 dark:text-white mb-1">Aplikasi & Notifikasi</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Pasang Celengin di layar utama dan dapatkan pengingat tagihan, transaksi rutin, dan ringkasan mingguan.</p>

      {/* Pasang aplikasi */}
      <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0"><Smartphone className="w-4 h-4" /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-100">Pasang Aplikasi</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {standalone ? 'Sudah terpasang ✓' : installEvent ? 'Buka langsung dari layar utama' : isIos ? 'Ketuk Bagikan → Tambah ke Layar Utama' : 'Gunakan menu browser: Instal / Add to Home Screen'}
            </p>
          </div>
        </div>
        {!standalone && installEvent && (
          <button onClick={handleInstall} className="shrink-0 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 px-3 py-2 rounded-xl flex items-center gap-1 transition-all"><Download className="w-3.5 h-3.5" /> Pasang</button>
        )}
      </div>

      {/* Notifikasi */}
      <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-600">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-500 flex items-center justify-center shrink-0"><Bell className="w-4 h-4" /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-100">Notifikasi Pengingat</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {supported === false || iosNeedsInstall
                ? 'Belum tersedia di perangkat ini'
                : permission === 'denied' ? 'Diblokir di pengaturan browser' : subscribed ? 'Aktif di perangkat ini' : 'Belum aktif'}
            </p>
          </div>
        </div>
        <button
          disabled={busy || !supported || iosNeedsInstall || permission === 'denied'}
          onClick={subscribed ? disable : enable}
          className={`w-12 h-6 rounded-full transition-colors relative shrink-0 disabled:opacity-40 ${subscribed ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${subscribed ? 'left-7' : 'left-1'}`}></div>
        </button>
      </div>

      {iosNeedsInstall && (
        <p className="text-[10px] text-orange-600 dark:text-orange-400 mt-2 leading-relaxed">Di iPhone/iPad, notifikasi hanya bisa diaktifkan setelah Celengin ditambahkan ke Layar Utama (iOS 16.4+). Buka aplikasi dari ikon di layar utama, lalu kembali ke sini.</p>
      )}

      {subscribed && (
        <button onClick={sendTest} disabled={busy} className="w-full mt-3 text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all">
          <Send className="w-3.5 h-3.5" /> Kirim Tes Notifikasi
        </button>
      )}
    </div>
  );
}
