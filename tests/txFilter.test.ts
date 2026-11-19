import { describe, expect, it } from 'vitest';
import { addSavedFilter, applyFilter, EMPTY_FILTER, filterLabel, isFilterActive, matchesSearch, removeSavedFilter, type TxFilter } from '@/lib/txFilter';
import type { Transaction } from '@/lib/types';

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 'x', user_id: 'u', merchant_name: 'Makan', amount: 25000, type: 'expense', transaction_date: '2026-11-10', ...over,
});

describe('matchesSearch', () => {
  it('mencari di catatan, bukan hanya kategori', () => {
    expect(matchesSearch(tx({ notes: 'Kopi sama Budi' }), 'budi')).toBe(true);
    expect(matchesSearch(tx({ notes: null }), 'budi')).toBe(false);
  });
  it('mencari di kategori tanpa membedakan huruf besar/kecil', () => {
    expect(matchesSearch(tx({ merchant_name: 'Makan Siang' }), 'SIANG')).toBe(true);
  });
  it('semua kata harus cocok, urutan bebas', () => {
    const t = tx({ merchant_name: 'Makan', notes: 'Nasi padang kantor' });
    expect(matchesSearch(t, 'padang makan')).toBe(true);
    expect(matchesSearch(t, 'padang sushi')).toBe(false);
  });
  it('kata berbentuk angka dicocokkan ke nominal, dengan atau tanpa titik dan Rp', () => {
    const t = tx({ amount: 25000 });
    for (const q of ['25000', '25.000', 'rp25.000', '2500']) expect(matchesSearch(t, q)).toBe(true);
    expect(matchesSearch(t, '30000')).toBe(false);
  });
  it('pencarian kosong atau spasi cocok dengan semuanya', () => {
    expect(matchesSearch(tx({}), '')).toBe(true);
    expect(matchesSearch(tx({}), '   ')).toBe(true);
  });
});

describe('applyFilter', () => {
  const data = [
    tx({ id: '1', type: 'expense', merchant_name: 'Makan', transaction_date: '2026-11-01' }),
    tx({ id: '2', type: 'income', merchant_name: 'Gaji', amount: 5_000_000, transaction_date: '2026-11-25' }),
    tx({ id: '3', type: 'expense', merchant_name: 'Kopi', transaction_date: '2026-12-02' }),
  ];
  const ids = (f: Partial<TxFilter>) => applyFilter(data, { ...EMPTY_FILTER, ...f }).map((t) => t.id);

  it('tanpa filter mengembalikan semuanya', () => expect(ids({})).toEqual(['1', '2', '3']));
  it('menyaring tipe dan kategori', () => {
    expect(ids({ type: 'income' })).toEqual(['2']);
    expect(ids({ category: 'Kopi' })).toEqual(['3']);
  });
  it('rentang tanggal termasuk kedua ujungnya; boleh hanya salah satu ujung', () => {
    expect(ids({ start: '2026-11-01', end: '2026-11-25' })).toEqual(['1', '2']);
    expect(ids({ start: '2026-11-26' })).toEqual(['3']);
    expect(ids({ end: '2026-11-01' })).toEqual(['1']);
  });
  it('gabungan beberapa filter bersifat DAN', () => {
    expect(ids({ type: 'expense', end: '2026-11-30' })).toEqual(['1']);
  });
});

describe('filter tersimpan', () => {
  const f: TxFilter = { ...EMPTY_FILTER, type: 'expense', category: 'Makan', search: ' kopi ' };

  it('isFilterActive dan filterLabel', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect(isFilterActive(f)).toBe(true);
    expect(filterLabel(f)).toBe('Keluar · Makan · "kopi"');
    expect(filterLabel({ ...EMPTY_FILTER, start: '2026-11-01', end: '2026-11-30' })).toBe('1/11/26–30/11/26');
  });
  it('tidak menggandakan filter yang sama, yang baru di depan, maksimal 8', () => {
    const one = addSavedFilter([], f);
    expect(addSavedFilter(one, { ...f, search: 'kopi' })).toBe(one);
    let list = one;
    for (let i = 0; i < 12; i++) list = addSavedFilter(list, { ...EMPTY_FILTER, search: `k${i}` });
    expect(list).toHaveLength(8);
    expect(list[0].search).toBe('k11');
  });
  it('menghapus berdasarkan id', () => {
    const list = addSavedFilter([], f);
    expect(removeSavedFilter(list, list[0].id)).toEqual([]);
  });
});
