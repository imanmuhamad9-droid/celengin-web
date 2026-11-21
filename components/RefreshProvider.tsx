'use client';
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

// Muat ulang manual tanpa memuat ulang seluruh aplikasi: halaman yang sedang tampil dipasang ulang (key berganti),
// jadi datanya diambil lagi dari awal sementara kerangka aplikasi tetap. Dipicu tombol di header atau tarik layar ke bawah.
// Data dianggap "basi" bila lebih dari STALE_MS sejak terakhir diperbarui, dan tombol di header memberi titik penanda.

const STALE_MS = 5 * 60 * 1000;
const PULL_TRIGGER = 64; // px tarikan (setelah diredam) yang dibutuhkan untuk memuat ulang
const PULL_MAX = 96;

interface RefreshCtx { refresh: () => void; refreshing: boolean; stale: boolean; lastAt: number }
const Ctx = createContext<RefreshCtx>({ refresh: () => { window.location.reload(); }, refreshing: false, stale: false, lastAt: 0 });
export const useRefresh = () => useContext(Ctx);

const agoText = (ms: number) => {
  const m = Math.floor(ms / 60000);
  return m < 1 ? 'baru saja' : m < 60 ? `${m} menit lalu` : `${Math.floor(m / 60)} jam lalu`;
};

export default function RefreshProvider({ children }: { children: ReactNode }) {
  const [nonce, setNonce] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastAt, setLastAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setNonce((n) => n + 1);
    const t = Date.now();
    setLastAt(t);
    setNow(t);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Jam ikut berjalan supaya penanda "basi" muncul sendiri, termasuk saat app kembali dibuka
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);

  // Tarik ke bawah dari paling atas halaman
  useEffect(() => {
    let startY: number | null = null;
    const blocked = (t: EventTarget | null) =>
      t instanceof Element && (t.closest('input, textarea, select, .overflow-y-auto, .overflow-x-auto') !== null || document.querySelector('.fixed.inset-0') !== null);

    const onStart = (e: TouchEvent) => {
      startY = window.scrollY <= 0 && !blocked(e.target) ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) { pullRef.current = 0; setPull(0); return; }
      pullRef.current = Math.min(PULL_MAX, dy * 0.5);
      setPull(pullRef.current);
    };
    const onEnd = () => {
      if (startY !== null && pullRef.current >= PULL_TRIGGER) refresh();
      startY = null;
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [refresh]);

  const stale = now - lastAt > STALE_MS;
  const value = useMemo(() => ({ refresh, refreshing, stale, lastAt }), [refresh, refreshing, stale, lastAt]);
  const ready = pull >= PULL_TRIGGER;

  return (
    <Ctx.Provider value={value}>
      {(pull > 0 || refreshing) && (
        <div
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 z-[80] pointer-events-none flex flex-col items-center gap-1"
          style={{ top: `calc(env(safe-area-inset-top, 0px) + ${refreshing ? 14 : Math.max(0, pull - 28)}px)`, opacity: refreshing ? 1 : Math.min(1, pull / 40) }}
        >
          <span className="glass w-10 h-10 rounded-full flex items-center justify-center text-[color:var(--teal-primary)]">
            <RefreshCw className={`w-[18px] h-[18px] ${refreshing ? 'animate-spin' : ''}`} style={refreshing ? undefined : { transform: `rotate(${pull * 4}deg)` }} />
          </span>
          <span className="glass px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[color:var(--text-muted)]">
            {refreshing ? 'Memperbarui...' : ready ? 'Lepas untuk memperbarui' : `Diperbarui ${agoText(now - lastAt)}`}
          </span>
        </div>
      )}
      <Fragment key={nonce}>{children}</Fragment>
    </Ctx.Provider>
  );
}
