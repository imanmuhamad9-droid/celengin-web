'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, Users2, ArrowLeftRight, HeartHandshake, Receipt, AlertTriangle, ShieldAlert, Award, Info, Check, BellOff } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  AppNotification, NOTIF_EVENT, fetchNotifications, markNotificationRead, markAllNotificationsRead,
  deleteNotification, emitNotifChanged, timeAgo,
} from '@/lib/notifications';

/** Pengingat yang dihitung di halaman (tagihan jatuh tempo, target hampir habis / tercapai). */
export type LocalNotif = {
  key: string; // harus stabil per hari, dipakai untuk mengingat yang sudah ditutup
  tone: 'danger' | 'warning' | 'praise';
  icon: 'bill' | 'warn' | 'crit' | 'praise';
  title: string;
  body: React.ReactNode;
  href?: string;
};

type Props = { userId: string | null; local: LocalNotif[] };

const DISMISS_KEY = 'celengin:dismissed-local';
const INVITE_KINDS = ['split_invite', 'couple_invite', 'gantian_invite'];

const LOCAL_TONE: Record<LocalNotif['tone'], { box: string; title: string; text: string; icon: string }> = {
  danger: { box: 'bg-red-50 dark:bg-red-900/30 border-red-500', title: 'text-red-700 dark:text-red-400', text: 'text-red-600 dark:text-red-400', icon: 'text-red-500' },
  warning: { box: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500', title: 'text-yellow-700 dark:text-yellow-400', text: 'text-yellow-600 dark:text-yellow-400', icon: 'text-yellow-600' },
  praise: { box: 'bg-blue-50 dark:bg-blue-900/30 border-blue-500', title: 'text-blue-700 dark:text-blue-300', text: 'text-blue-600 dark:text-blue-400', icon: 'text-blue-600 dark:text-blue-400' },
};

function LocalIcon({ icon, cls }: { icon: LocalNotif['icon']; cls: string }) {
  if (icon === 'bill') return <Receipt className={cls} />;
  if (icon === 'crit') return <ShieldAlert className={cls} />;
  if (icon === 'praise') return <Award className={cls} />;
  return <AlertTriangle className={cls} />;
}

function KindIcon({ kind }: { kind: string }) {
  const cls = 'w-5 h-5 text-teal-600 dark:text-teal-400';
  if (kind === 'split_invite') return <Users2 className={cls} />;
  if (kind === 'gantian_invite' || kind === 'gantian_reminder') return <ArrowLeftRight className={cls} />;
  if (kind === 'couple_invite') return <HeartHandshake className={cls} />;
  return <Info className={cls} />;
}

export default function NotificationBell({ userId, local }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [now, setNow] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setItems(await fetchNotifications(30));
    setNow(Date.now());
  }, [userId]);

  // Muat daftar + dengar perubahan dari BottomNav (realtime / polling) dan dari aksi di panel ini
  useEffect(() => {
    load();
    const onChange = () => { load(); };
    window.addEventListener(NOTIF_EVENT, onChange);
    return () => window.removeEventListener(NOTIF_EVENT, onChange);
  }, [load]);

  useEffect(() => {
    try { setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')); } catch (_) { setDismissed([]); }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const visibleLocal = local.filter((n) => !dismissed.includes(n.key));
  const unreadDb = items.filter((n) => !n.read_at).length;
  const badge = unreadDb + visibleLocal.length;

  const persistDismissed = (keys: string[]) => {
    const next = keys.slice(-200);
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch (_) { /* abaikan */ }
  };
  const dismissLocal = (key: string) => persistDismissed([...dismissed, key]);

  const openPanel = () => { setErrorMsg(''); setOpen(true); load(); };

  const handleOpenItem = async (n: AppNotification) => {
    if (!n.read_at && !INVITE_KINDS.includes(n.kind)) await markNotificationRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const handleMarkAll = async () => {
    // Undangan yang belum dijawab sengaja tidak ikut ditandai: harus diterima / ditolak / dihapus dulu.
    const ids = items.filter((n) => !n.read_at && !INVITE_KINDS.includes(n.kind)).map((n) => n.id);
    if (ids.length > 0) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    }
    persistDismissed([...dismissed, ...visibleLocal.map((n) => n.key)]);
    emitNotifChanged();
    await load();
  };

  const respond = async (n: AppNotification, accept: boolean) => {
    if (!n.ref_id) return;
    setBusyId(n.id);
    setErrorMsg('');
    let err: { message: string } | null = null;

    if (n.kind === 'split_invite' || n.kind === 'gantian_invite') {
      const res = await supabase.rpc('split_respond_invite', { p_member_id: n.ref_id, p_accept: accept });
      err = res.error;
    } else if (n.kind === 'couple_invite') {
      const res = accept
        ? await supabase.from('couple_members').update({ status: 'accepted' }).eq('id', n.ref_id)
        : await supabase.from('couple_members').delete().eq('id', n.ref_id);
      err = res.error;
    }

    setBusyId(null);
    if (err) { setErrorMsg(`Gagal memproses undangan: ${err.message}`); return; }

    setResolved((prev) => ({ ...prev, [n.id]: accept ? 'accepted' : 'rejected' }));
    // Trigger database menandai notifikasi ini sudah dibaca; pastikan juga dari sisi klien.
    await markNotificationRead(n.id);
    await load();
    // Halaman terkait memuat ulang datanya saat dibuka berikutnya.
  };

  const remove = async (n: AppNotification) => {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    await deleteNotification(n.id);
  };

  const hasAnything = items.length > 0 || visibleLocal.length > 0;
  const canMarkAll = items.some((n) => !n.read_at && !INVITE_KINDS.includes(n.kind)) || visibleLocal.length > 0;

  return (
    <>
      <button
        onClick={openPanel}
        aria-label={badge > 0 ? `Notifikasi, ${badge} belum dibaca` : 'Notifikasi'}
        className="relative w-9 h-9 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-teal-600 transition-all active:scale-95"
      >
        <Bell className="w-5 h-5" />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-900">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]">
          <div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200" />
          <div className="absolute inset-x-0 top-[68px] mx-auto w-full max-w-md px-3">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[75vh] flex flex-col animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-base text-gray-800 dark:text-gray-100">Notifikasi</h3>
                <div className="flex items-center gap-2">
                  {canMarkAll && (
                    <button onClick={handleMarkAll} className="flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-full">
                      <Check className="w-3.5 h-3.5" /> Tandai dibaca
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} aria-label="Tutup" className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center"><X className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="overflow-y-auto p-3 space-y-2">
                {errorMsg && <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-xl px-3 py-2">{errorMsg}</p>}

                {!hasAnything && (
                  <div className="py-10 flex flex-col items-center text-center text-gray-400 dark:text-gray-500">
                    <BellOff className="w-9 h-9 mb-2" />
                    <p className="text-sm font-bold">Belum ada notifikasi</p>
                    <p className="text-xs mt-1">Undangan dan pengingat akan muncul di sini.</p>
                  </div>
                )}

                {/* Notifikasi dari database: undangan, dll. */}
                {items.map((n) => {
                  const isInvite = INVITE_KINDS.includes(n.kind);
                  const unread = !n.read_at;
                  const res = resolved[n.id];
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleOpenItem(n)}
                      className={`relative cursor-pointer rounded-2xl p-3 border transition-colors ${unread ? 'bg-teal-50/60 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800' : 'bg-gray-50 dark:bg-gray-800/60 border-transparent'}`}
                    >
                      <div className="flex items-start gap-3 pr-6">
                        <div className="w-9 h-9 shrink-0 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm"><KindIcon kind={n.kind} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {unread && <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />}
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{n.title}</p>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto shrink-0">{now ? timeAgo(n.created_at, now) : ''}</span>
                          </div>
                          {n.body && <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 break-words">{n.body}</p>}

                          {isInvite && unread && !res && (
                            <div className="flex gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => respond(n, true)}
                                disabled={busyId === n.id}
                                className="flex-1 bg-teal-600 text-white text-xs font-bold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-60"
                              >
                                {busyId === n.id ? 'Memproses...' : 'Terima'}
                              </button>
                              <button
                                onClick={() => respond(n, false)}
                                disabled={busyId === n.id}
                                className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-60"
                              >
                                Tolak
                              </button>
                            </div>
                          )}
                          {res && (
                            <p className={`text-[11px] font-bold mt-2 ${res === 'accepted' ? 'text-teal-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400'}`}>
                              {res === 'accepted' ? '✓ Undangan diterima' : 'Undangan ditolak'}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); remove(n); }}
                        aria-label="Hapus notifikasi"
                        className="absolute top-2 right-2 p-1 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {/* Pengingat yang dihitung otomatis */}
                {visibleLocal.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest pt-2 px-1">Pengingat</p>
                    {visibleLocal.map((n) => {
                      const t = LOCAL_TONE[n.tone];
                      return (
                        <div
                          key={n.key}
                          onClick={() => { if (n.href) { setOpen(false); router.push(n.href); } }}
                          className={`relative p-3 rounded-xl border-l-4 flex items-start gap-2 ${t.box} ${n.href ? 'cursor-pointer' : ''}`}
                        >
                          <LocalIcon icon={n.icon} cls={`w-5 h-5 shrink-0 mt-0.5 ${t.icon}`} />
                          <div className="flex-1 pr-5 min-w-0">
                            <p className={`text-xs font-bold mb-0.5 ${t.title}`}>{n.title}</p>
                            <p className={`text-[11px] ${t.text}`}>{n.body}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); dismissLocal(n.key); }}
                            aria-label="Tutup pengingat"
                            className={`p-1 absolute top-2 right-2 opacity-70 ${t.icon}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
