// Pengaturan "Menu tambahan": menu yang boleh muncul di strip Menu Cepat di Home.
// Disimpan di perangkat dulu (langsung terasa), lalu ke profil supaya ikut ke perangkat lain.
// Gagal di profil (kolom belum ada) = diabaikan; pengaturan tetap jalan di perangkat ini.
import { useSyncExternalStore } from 'react';
import type { ComponentType } from 'react';
import { BarChart3, History, Landmark, PieChart, Receipt, ShieldCheck, Target, Trophy, Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export type ExtraMenuKey = 'riwayat' | 'tagihan' | 'pencapaian' | 'darurat' | 'anggaran' | 'kekayaan' | 'tantangan' | 'laporan' | 'kolektif';

export interface ExtraMenuDef {
  key: ExtraMenuKey;
  label: string;
  desc: string;
  href: string;
  /** menu = halaman yang sudah ada, fitur = fitur keuangan tambahan */
  group: 'menu' | 'fitur';
  Icon: ComponentType<{ className?: string }>;
}

export const EXTRA_MENUS: ExtraMenuDef[] = [
  { key: 'laporan', label: 'Laporan', desc: 'Ke mana uangmu pergi, per minggu, bulan, atau siklus gajian. Bisa diunduh PDF atau Excel', href: '/reports', group: 'menu', Icon: BarChart3 },
  { key: 'riwayat', label: 'Riwayat', desc: 'Semua transaksi', href: '/transactions', group: 'menu', Icon: History },
  { key: 'tagihan', label: 'Tagihan', desc: 'Pengingat tagihan dan rutin', href: '/bills', group: 'menu', Icon: Receipt },
  { key: 'tantangan', label: 'Tantangan', desc: 'Batas pengeluaran harian, mingguan, atau bulanan', href: '/spending-challenge', group: 'menu', Icon: Target },
  { key: 'pencapaian', label: 'Pencapaian', desc: 'Badge bonus buat kamu', href: '/badges', group: 'menu', Icon: Trophy },
  { key: 'darurat', label: 'Dana Darurat', desc: 'Target otomatis dari pengeluaranmu dan progres menabungnya', href: '/emergency-fund', group: 'fitur', Icon: ShieldCheck },
  { key: 'anggaran', label: 'Anggaran', desc: 'Batas bulanan per kategori pengeluaran', href: '/budgets', group: 'fitur', Icon: PieChart },
  { key: 'kekayaan', label: 'Kekayaan Bersih', desc: 'Aset dikurangi utang, dengan grafik per bulan', href: '/net-worth', group: 'fitur', Icon: Landmark },
  { key: 'kolektif', label: 'Kolektif', desc: 'Catatan keuangan bareng pasangan atau kelompok', href: '/couple', group: 'fitur', Icon: Users },
];

const LS_KEY = 'celengin:extra-menus';
const CHANGED_EVENT = 'celengin:extra-menus-changed';
/** Bawaan sebelum pengguna pernah mengatur Menu Tambahan. Mematikan semuanya tersimpan sebagai [] dan menang atas bawaan ini. */
const DEFAULT_MENUS: ExtraMenuKey[] = ['laporan'];
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
let cacheVal: ExtraMenuKey[] = DEFAULT_MENUS;
function snapshot(): ExtraMenuKey[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LS_KEY); } catch { raw = null; }
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  try { cacheVal = raw ? parseExtraMenus(JSON.parse(raw)) ?? DEFAULT_MENUS : DEFAULT_MENUS; } catch { cacheVal = DEFAULT_MENUS; }
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

/** Menu tambahan yang sedang dinyalakan (kosong = strip Menu Cepat disembunyikan). Belum pernah diatur = Laporan saja. */
export function useExtraMenus(): ExtraMenuKey[] {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_MENUS);
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
