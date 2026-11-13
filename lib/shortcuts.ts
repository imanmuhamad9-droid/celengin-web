// Katalog pintasan fitur di Home. Menu burger hanya berisi Home, Target, Catat, Impian, Bareng;
// semua fitur lain ada di sini. Pilihan 4 favorit disimpan di profiles.shortcuts (+ cadangan localStorage).
import type { ComponentType } from 'react';
import { History, Receipt, BarChart3, Users2, ArrowLeftRight, Wallet, Trophy, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export type ShortcutKey = 'riwayat' | 'tagihan' | 'laporan' | 'split' | 'gantian' | 'dompet' | 'badge' | 'setelan';

export type ShortcutDef = {
  key: ShortcutKey;
  label: string;
  desc: string;
  href: string;
  Icon: ComponentType<{ className?: string }>;
};

export const SHORTCUTS: ShortcutDef[] = [
  { key: 'riwayat', label: 'Riwayat', desc: 'Semua transaksi', href: '/transactions', Icon: History },
  { key: 'tagihan', label: 'Tagihan', desc: 'Tagihan & langganan', href: '/bills', Icon: Receipt },
  { key: 'laporan', label: 'Laporan', desc: 'Grafik, insight, PDF', href: '/reports', Icon: BarChart3 },
  { key: 'split', label: 'Split Bill', desc: 'Patungan makan & jalan', href: '/splitbill', Icon: Users2 },
  { key: 'gantian', label: 'Gantian', desc: 'Beli gantian, saldo bergulir', href: '/gantian', Icon: ArrowLeftRight },
  { key: 'dompet', label: 'Dompet', desc: 'Saldo tiap dompet', href: '/wallets', Icon: Wallet },
  { key: 'badge', label: 'Badge', desc: 'Pencapaian kamu', href: '/badges', Icon: Trophy },
  { key: 'setelan', label: 'Setelan', desc: 'Profil, tema, notifikasi', href: '/settings', Icon: Settings },
];

export const MAX_FAVS = 4;
export const DEFAULT_SHORTCUTS: ShortcutKey[] = ['tagihan', 'laporan', 'dompet', 'badge'];
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
