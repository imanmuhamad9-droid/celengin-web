// Aksi "Catat" yang mengikuti halaman. Tiap halaman yang punya aksi tambah sendiri (buat grup, buat tantangan, dst.)
// mendaftarkannya lewat useCatatAction; gelembung Catat / hamburger di BottomNav menjalankan aksi halaman yang sedang
// dibuka. Halaman yang tidak mendaftar memakai bawaan: Catat transaksi.
import { useEffect, useRef, useSyncExternalStore } from 'react';

export interface CatatEntry {
  /** Teks pendek di gelembung, mis. "Grup" */
  label: string;
  /** Teks lengkap di dalam hamburger, mis. "Buat grup patungan" */
  long: string;
  run: () => void;
}

let stack: CatatEntry[] = [];
let top: CatatEntry | null = null;
const listeners = new Set<() => void>();

function emit() {
  top = stack.length > 0 ? stack[stack.length - 1] : null;
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Dipakai BottomNav: aksi Catat milik halaman yang sedang dibuka (null = bawaan). */
export function useCatatEntry(): CatatEntry | null {
  return useSyncExternalStore(subscribe, () => top, () => null);
}

/** Dipakai halaman: daftarkan aksi Catat. Pemanggilan selalu memakai fungsi terbaru (tidak basi). */
export function useCatatAction(label: string, long: string, onClick: () => void) {
  const ref = useRef(onClick);
  useEffect(() => { ref.current = onClick; });
  useEffect(() => {
    const entry: CatatEntry = { label, long, run: () => ref.current() };
    stack = [...stack, entry];
    emit();
    return () => {
      stack = stack.filter((e) => e !== entry);
      emit();
    };
  }, [label, long]);
}
