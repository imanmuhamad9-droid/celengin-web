// Tema latar aplikasi (Pengaturan -> Tema Latar). Disimpan per perangkat seperti mode warna & ukuran.
// - celengin:bg         -> { theme, brightness, darkness }
// - celengin:bg-custom  -> gambar unggahan sendiri (data URL JPEG), dipisah karena ukurannya besar
// Saat tema aktif, <html> diberi atribut data-bg sehingga latar halaman jadi transparan (lihat globals.css).
import { useSyncExternalStore } from 'react';
import { createPref } from '@/lib/localPref';

export type BgThemeKey =
  | 'none' | 'custom'
  | 'bintang' | 'gelembung' | 'aurora' | 'gelombang' | 'awan'
  | 'pelangi' | 'angkasa' | 'tropis' | 'konfeti' | 'celengin';

export const BG_THEMES: { key: Exclude<BgThemeKey, 'none' | 'custom'>; label: string }[] = [
  { key: 'bintang', label: 'Bintang malam' },
  { key: 'gelembung', label: 'Gelembung' },
  { key: 'aurora', label: 'Aurora abstrak' },
  { key: 'gelombang', label: 'Gelombang abstrak' },
  { key: 'awan', label: 'Awan kartun' },
  { key: 'pelangi', label: 'Pelangi ceria' },
  { key: 'angkasa', label: 'Luar angkasa kartun' },
  { key: 'tropis', label: 'Daun tropis' },
  { key: 'konfeti', label: 'Konfeti geometri' },
  { key: 'celengin', label: 'Celengin kartun' },
];

export interface BgSettings {
  theme: BgThemeKey;
  /** Kecerahan gambar latar, 50-150 (%) */
  brightness: number;
  /** Lapisan gelap di atas latar, 0-80 (%) */
  darkness: number;
}

export const BG_DEFAULT: BgSettings = { theme: 'none', brightness: 100, darkness: 0 };
export const BRIGHT_MIN = 50, BRIGHT_MAX = 150, DARK_MIN = 0, DARK_MAX = 80;

const VALID = new Set<string>(['none', 'custom', ...BG_THEMES.map((t) => t.key)]);
const num = (v: unknown, lo: number, hi: number, fb: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fb;

export function parseBgSettings(raw: unknown): BgSettings {
  if (!raw || typeof raw !== 'object') return BG_DEFAULT;
  const r = raw as Record<string, unknown>;
  return {
    theme: typeof r.theme === 'string' && VALID.has(r.theme) ? (r.theme as BgThemeKey) : 'none',
    brightness: num(r.brightness, BRIGHT_MIN, BRIGHT_MAX, 100),
    darkness: num(r.darkness, DARK_MIN, DARK_MAX, 0),
  };
}

export const bgPref = createPref<BgSettings>('celengin:bg', parseBgSettings, BG_DEFAULT);
export const useBgSettings = bgPref.useValue;

// ---- Gambar unggahan sendiri ----
const CUSTOM_KEY = 'celengin:bg-custom';
const CUSTOM_EVENT = 'celengin:bg-custom-changed';

const readCustom = (): string => {
  try { return localStorage.getItem(CUSTOM_KEY) || ''; } catch { return ''; }
};
const subscribeCustom = (cb: () => void) => {
  window.addEventListener('storage', cb);
  window.addEventListener(CUSTOM_EVENT, cb);
  return () => { window.removeEventListener('storage', cb); window.removeEventListener(CUSTOM_EVENT, cb); };
};
export const useCustomBg = (): string => useSyncExternalStore(subscribeCustom, readCustom, () => '');

/** Simpan gambar latar sendiri. false = memori perangkat penuh. */
export function saveCustomBg(dataUrl: string | null): boolean {
  try {
    if (dataUrl) localStorage.setItem(CUSTOM_KEY, dataUrl);
    else localStorage.removeItem(CUSTOM_KEY);
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(CUSTOM_EVENT));
  return true;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Gagal membaca gambar'));
    fr.readAsDataURL(blob);
  });
}

// ---- Mode gelap (kelas .dark di <html>) ----
const subscribeDark = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => mo.disconnect();
};
export const useIsDark = (): boolean =>
  useSyncExternalStore(subscribeDark, () => document.documentElement.classList.contains('dark'), () => false);
