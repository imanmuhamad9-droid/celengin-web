import { describe, expect, it } from 'vitest';
import { parseReceiptText } from '@/lib/receiptParser';

const STRUK = [
  'WARUNG MAKAN SEDERHANA',
  'Jl. Merdeka No. 10',
  '12/11/2026 19:45',
  'Nasi Goreng  2 x 25.000  50.000',
  'Es Teh Manis  2 x 5.000  10.000',
  'Kerupuk  5.000',
  'SUBTOTAL  65.000',
  'PB1 10%  6.500',
  'TOTAL  71.500',
  'TUNAI  100.000',
  'KEMBALI  28.500',
].join('\n');

describe('parseReceiptText', () => {
  const r = parseReceiptText(STRUK);

  it('membaca total akhir, bukan tunai atau kembalian', () => {
    expect(r.total).toBe(71500);
  });
  it('membaca subtotal, pajak, dan tanggal', () => {
    expect(r.subtotal).toBe(65000);
    expect(r.tax?.amount).toBe(6500);
    expect(r.date).toBe('2026-11-12');
  });
  it('membaca item beserta jumlah dan harga satuan', () => {
    expect(r.items.map((i) => [i.name, i.qty, i.unitPrice])).toEqual([
      ['Nasi Goreng', 2, 25000],
      ['Es Teh Manis', 2, 5000],
      ['Kerupuk', 1, 5000],
    ]);
  });
  it('nama toko diambil dari baris atas (diubah ke huruf judul)', () => {
    expect(r.merchant).toBe('Warung Makan Sederhana');
  });
  it('salah baca OCR O/o dan I/l di dalam angka diperbaiki', () => {
    expect(parseReceiptText('Kopi Susu  44.OOO\nTOTAL  44.OOO').total).toBe(44000);
  });
  it('teks kosong atau tanpa angka tidak error dan tidak menebak', () => {
    const e = parseReceiptText('');
    expect(e.total).toBeNull();
    expect(e.items).toEqual([]);
    expect(parseReceiptText('terima kasih atas kunjungan anda').total).toBeNull();
  });
});
