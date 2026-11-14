// Katalog pintasan fitur di Home. Menu burger berisi Home, Tantangan, Catat, Impian, Bareng.
// Pintasan di Home hanya 4 fitur yang paling sering dipakai, semuanya selalu tampil (tidak perlu diatur).
import type { ComponentType } from 'react';
import { History, Receipt, BarChart3, ArrowLeftRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export type ShortcutKey = 'riwayat' | 'laporan' | 'tagihan' | 'split';

export type ShortcutDef = {
  key: ShortcutKey;
  label: string;
  desc: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
  /** Ikon maskot Celengin (public/menu-icons) */
  img: string;
};

export const SHORTCUTS: ShortcutDef[] = [
  { key: 'riwayat', label: 'Riwayat', desc: 'Semua transaksi', href: '/transactions', Icon: History, img: '/menu-icons/riwayat.png' },
  { key: 'laporan', label: 'Laporan', desc: 'Grafik, insight, PDF', href: '/reports', Icon: BarChart3, img: '/menu-icons/laporan.png' },
  { key: 'tagihan', label: 'Tagihan', desc: 'Pengingat tagihan & rutin', href: '/bills', Icon: Receipt, img: '/menu-icons/tagihan.png' },
  { key: 'split', label: 'Bayarin', desc: 'Patungan & utang teman', href: '/splitbill', Icon: ArrowLeftRight, img: '/menu-icons/gantian.png' },
];

export const MAX_FAVS = 4;
export const DEFAULT_SHORTCUTS: ShortcutKey[] = ['riwayat', 'laporan', 'tagihan', 'split'];
const LS_KEY = 'celengin:shortcuts';

const VALID = new Set<string>(SHORTCUTS.map((s) => s.key));

/** Rapikan data mentah: buang kunci tak dikenal & duplikat, maksimal 4. Bukan array -> null. */
export function parseShortcuts(raw: unknown): ShortcutKey[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ShortcutKey[] = [];
  for (const k of raw) {
    if (typeof k === 'string' && VALID.has(k) && !out.includes(k as ShortcutKey)) out.push(k as ShortcutKey);
  }
  return out.slice(0, MAX_FAVS);
}

export function readLocalShortcuts(): ShortcutKey[] | null {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v ? parseShortcuts(JSON.parse(v)) : null;
  } catch (_) { return null; }
}

/** Simpan ke perangkat dulu (langsung), lalu ke profil supaya ikut ke perangkat lain. Gagal di profil = diabaikan. */
export async function saveShortcuts(userId: string | null, keys: ShortcutKey[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(keys)); } catch (_) { /* penyimpanan penuh / dinonaktifkan */ }
  if (!userId) return;
  try { await supabase.from('profiles').update({ shortcuts: keys }).eq('id', userId); } catch (_) { /* kolom belum ada */ }
}

export function shortcutByKey(key: ShortcutKey): ShortcutDef {
  return SHORTCUTS.find((s) => s.key === key) as ShortcutDef;
}
