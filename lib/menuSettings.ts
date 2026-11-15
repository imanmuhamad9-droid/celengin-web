// Pengaturan "Menu tambahan": menu yang boleh muncul di hamburger (menggantikan gelembung Catat).
// Disimpan di perangkat dulu (langsung terasa), lalu ke profil supaya ikut ke perangkat lain.
// Gagal di profil (kolom belum ada) = diabaikan; pengaturan tetap jalan di perangkat ini.
import { useSyncExternalStore } from 'react';
import type { ComponentType } from 'react';
import { History, Receipt, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export type ExtraMenuKey = 'riwayat' | 'tagihan' | 'pencapaian';

export interface ExtraMenuDef {
  key: ExtraMenuKey;
  label: string;
  desc: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
}

export const EXTRA_MENUS: ExtraMenuDef[] = [
  { key: 'riwayat', label: 'Riwayat', desc: 'Semua transaksi', href: '/transactions', Icon: History },
  { key: 'tagihan', label: 'Tagihan', desc: 'Pengingat tagihan dan rutin', href: '/bills', Icon: Receipt },
  { key: 'pencapaian', label: 'Pencapaian', desc: 'Badge bonus buat kamu', href: '/badges', Icon: Trophy },
];

const LS_KEY = 'celengin:extra-menus';
const CHANGED_EVENT = 'celengin:extra-menus-changed';
const EMPTY: ExtraMenuKey[] = [];
const VALID = new Set<string>(EXTRA_MENUS.map((m) => m.key));

/** Rapikan data mentah: buang kunci tak dikenal dan duplikat. Bukan array -> null. */
export function parseExtraMenus(raw: unknown): ExtraMenuKey[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ExtraMenuKey[] = [];
  for (const k of raw) {
    if (typeof k === 'string' && VALID.has(k) && !out.includes(k as ExtraMenuKey)) out.push(k as ExtraMenuKey);
  }
  return out;
}

// Snapshot dibuat stabil (objek yang sama selama isi penyimpanan tidak berubah) untuk useSyncExternalStore
let cacheRaw: string | null = null;
let cacheVal: ExtraMenuKey[] = EMPTY;
function snapshot(): ExtraMenuKey[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LS_KEY); } catch { raw = null; }
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  try { cacheVal = raw ? parseExtraMenus(JSON.parse(raw)) ?? EMPTY : EMPTY; } catch { cacheVal = EMPTY; }
  return cacheVal;
}
function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(CHANGED_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(CHANGED_EVENT, cb);
  };
}

/** Menu tambahan yang sedang dinyalakan (kosong = tidak ada hamburger, hanya tombol Catat). */
export function useExtraMenus(): ExtraMenuKey[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export async function saveExtraMenus(userId: string | null, keys: ExtraMenuKey[]) {
  const clean = parseExtraMenus(keys) ?? [];
  try { localStorage.setItem(LS_KEY, JSON.stringify(clean)); } catch { /* penyimpanan penuh atau dinonaktifkan */ }
  window.dispatchEvent(new Event(CHANGED_EVENT));
  if (!userId) return;
  try { await supabase.from('profiles').update({ extra_menus: clean }).eq('id', userId); } catch { /* kolom belum ada */ }
}

let synced = false;
/** Sekali per sesi: ambil pengaturan dari profil (kalau ada) supaya perangkat ini ikut perangkat lain. */
export async function syncExtraMenusFromProfile() {
  if (synced) return;
  synced = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { synced = false; return; }
    const { data, error } = await supabase.from('profiles').select('extra_menus').eq('id', session.user.id).maybeSingle();
    if (error || !data) return;
    const remote = parseExtraMenus((data as { extra_menus?: unknown }).extra_menus);
    if (!remote) return; // kolom belum ada atau belum pernah disimpan
    if (JSON.stringify(snapshot()) === JSON.stringify(remote)) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(remote)); } catch { /* abaikan */ }
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch { /* abaikan */ }
}
