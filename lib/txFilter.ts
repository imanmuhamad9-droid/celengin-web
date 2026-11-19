// Penyaringan transaksi di Riwayat dan penyimpanan filter favorit. Murni (tanpa Supabase / React) supaya mudah dites.
import type { Transaction } from '@/lib/types';

export interface TxFilter {
  search: string;
  type: 'all' | 'income' | 'expense';
  category: string; // 'all' = semua
  start: string;    // YYYY-MM-DD atau ''
  end: string;
}

export const EMPTY_FILTER: TxFilter = { search: '', type: 'all', category: 'all', start: '', end: '' };

export const isFilterActive = (f: TxFilter): boolean =>
  f.search.trim() !== '' || f.type !== 'all' || f.category !== 'all' || f.start !== '' || f.end !== '';

type Searchable = Pick<Transaction, 'merchant_name' | 'amount'> & { notes?: string | null };

/**
 * Cocok bila SETIAP kata pencarian ditemukan di kategori atau catatan, atau (untuk kata berbentuk angka,
 * mis. "25000", "25.000", "rp 25.000") di nominalnya. Tanpa membedakan huruf besar/kecil.
 */
export function matchesSearch(tx: Searchable, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = `${tx.merchant_name || ''} ${tx.notes || ''}`.toLowerCase();
  const amount = String(Math.round(Number(tx.amount) || 0));
  return tokens.every((tok) => {
    if (text.includes(tok)) return true;
    if (!/^(rp\.?)?[\d.,]+$/.test(tok)) return false;
    const digits = tok.replace(/\D/g, '');
    return digits.length > 0 && amount.includes(digits);
  });
}

export function applyFilter<T extends Searchable & Pick<Transaction, 'type' | 'transaction_date'>>(txs: T[], f: TxFilter): T[] {
  return txs.filter((tx) => {
    if (!matchesSearch(tx, f.search)) return false;
    if (f.type !== 'all' && tx.type !== f.type) return false;
    if (f.category !== 'all' && tx.merchant_name !== f.category) return false;
    if (f.start && tx.transaction_date < f.start) return false;
    if (f.end && tx.transaction_date > f.end) return false;
    return true;
  });
}

const shortDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return y && m && day ? `${Number(day)}/${Number(m)}/${y.slice(2)}` : d;
};

/** Nama singkat untuk chip filter tersimpan, mis. `Keluar · Makan · 1/11/26–30/11/26 · "kopi"`. */
export function filterLabel(f: TxFilter): string {
  const parts: string[] = [];
  if (f.type !== 'all') parts.push(f.type === 'income' ? 'Masuk' : 'Keluar');
  if (f.category !== 'all') parts.push(f.category);
  if (f.start || f.end) parts.push(`${f.start ? shortDate(f.start) : '…'}–${f.end ? shortDate(f.end) : '…'}`);
  if (f.search.trim()) parts.push(`"${f.search.trim()}"`);
  return parts.join(' · ') || 'Semua';
}

// ---- Filter tersimpan (per perangkat) ----
const KEY = 'celengin:tx-filters:v1';
const MAX_SAVED = 8;

export interface SavedFilter extends TxFilter { id: string }

const sameFilter = (a: TxFilter, b: TxFilter) =>
  a.search.trim() === b.search.trim() && a.type === b.type && a.category === b.category && a.start === b.start && a.end === b.end;

function parseSaved(raw: unknown): SavedFilter[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedFilter[] = [];
  for (const x of raw) {
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== 'string') continue;
    out.push({
      id: o.id,
      search: typeof o.search === 'string' ? o.search : '',
      type: o.type === 'income' || o.type === 'expense' ? o.type : 'all',
      category: typeof o.category === 'string' ? o.category : 'all',
      start: typeof o.start === 'string' ? o.start : '',
      end: typeof o.end === 'string' ? o.end : '',
    });
  }
  return out.slice(0, MAX_SAVED);
}

export function loadSavedFilters(): SavedFilter[] {
  try { return parseSaved(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return []; }
}

/** Tambah filter (yang sama persis tidak digandakan, yang terbaru di depan, maksimal 8). */
export function addSavedFilter(list: SavedFilter[], f: TxFilter): SavedFilter[] {
  if (list.some((s) => sameFilter(s, f))) return list;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return [{ ...f, search: f.search.trim(), id }, ...list].slice(0, MAX_SAVED);
}

export const removeSavedFilter = (list: SavedFilter[], id: string): SavedFilter[] => list.filter((s) => s.id !== id);

export function persistSavedFilters(list: SavedFilter[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* penyimpanan penuh atau dinonaktifkan */ }
}
