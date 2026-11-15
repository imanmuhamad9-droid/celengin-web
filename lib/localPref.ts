// Pengaturan kecil yang disimpan per perangkat (localStorage) dan dibaca lewat useSyncExternalStore,
// jadi semua komponen ikut berubah begitu nilainya diubah.
import { useSyncExternalStore } from 'react';

export function createPref<T>(key: string, parse: (raw: unknown) => T, fallback: T) {
  const eventName = `celengin:pref:${key}`;
  let cacheRaw: string | null = null;
  let cacheVal: T = fallback;

  const snapshot = (): T => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(key); } catch { raw = null; }
    if (raw === cacheRaw) return cacheVal;
    cacheRaw = raw;
    try { cacheVal = raw ? parse(JSON.parse(raw)) : fallback; } catch { cacheVal = fallback; }
    return cacheVal;
  };
  const subscribe = (cb: () => void) => {
    window.addEventListener('storage', cb);
    window.addEventListener(eventName, cb);
    return () => { window.removeEventListener('storage', cb); window.removeEventListener(eventName, cb); };
  };

  return {
    useValue: (): T => useSyncExternalStore(subscribe, snapshot, () => fallback),
    set: (v: T) => {
      try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* penyimpanan penuh atau dinonaktifkan */ }
      window.dispatchEvent(new Event(eventName));
    },
  };
}
