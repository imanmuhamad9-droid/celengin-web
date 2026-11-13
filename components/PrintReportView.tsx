'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import type { Tx, Summary } from '@/lib/insights';

interface Props {
  title: string;
  periodLabel: string;
  summary: Summary;
  transactions: Tx[];
  fmt: (n: number) => string;
  nickname?: string;
  onClose: () => void;
}

/**
 * Tampilan cetak di DALAM aplikasi (bukan jendela pop-up), jadi ada tombol Kembali
 * dan tombol Cetak selalu berfungsi, termasuk saat aplikasi dipasang sebagai PWA.
 * Saat dicetak, semua elemen lain disembunyikan lewat CSS @media print.
 */
export default function PrintReportView({ title, periodLabel, summary: s, transactions, fmt, nickname, onClose }: Props) {
  // Kunci scroll halaman di belakang, dan tutup dengan tombol Escape
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const sorted = transactions.slice().sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
  const catRows = (list: { name: string; amount: number }[], total: number) =>
    list.length === 0 ? (
      <tr><td colSpan={3} className="py-2 text-gray-400">Tidak ada data</td></tr>
    ) : (
      list.map((c) => (
        <tr key={c.name} className="border-b border-gray-100">
          <td className="py-1.5 pr-2">{c.name}</td>
          <td className="py-1.5 text-right">{fmt(c.amount)}</td>
          <td className="py-1.5 text-right w-12">{total > 0 ? Math.round((c.amount / total) * 100) : 0}%</td>
        </tr>
      ))
    );

  const handlePrint = () => { try { window.print(); } catch { /* abaikan */ } };

  return createPortal(
    <div id="print-root" className="fixed inset-0 z-[90] bg-gray-100 flex flex-col">
      <style>{`
        @media print {
          body > *:not(#print-root) { display: none !important; }
          #print-root { position: static !important; inset: auto !important; background: #fff !important; display: block !important; }
          #print-root .no-print { display: none !important; }
          #print-root .print-scroll { overflow: visible !important; padding: 0 !important; }
          #print-root .print-sheet { box-shadow: none !important; border-radius: 0 !important; max-width: none !important; padding: 0 !important; }
          @page { margin: 12mm; }
        }
      `}</style>

      {/* Bilah atas: tidak ikut tercetak */}
      <div className="no-print flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-bold text-gray-600 hover:text-teal-700">
          <ArrowLeft className="w-5 h-5" /> Kembali
        </button>
        <span className="flex-1" />
        <button onClick={handlePrint} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="print-scroll flex-1 overflow-y-auto p-4">
        <div className="print-sheet bg-white text-gray-900 max-w-2xl mx-auto rounded-2xl shadow-sm p-6 text-[12px]">
          <h1 className="text-xl font-bold text-teal-700">{title}</h1>
          <p className="text-gray-500 mb-4">{periodLabel}{nickname ? ` · ${nickname}` : ''}</p>

          <div className="grid grid-cols-4 gap-2 mb-5">
            <div className="border border-gray-200 rounded-xl p-2.5"><p className="text-gray-500">Pemasukan</p><p className="font-bold text-green-600 text-[13px]">{fmt(s.income)}</p></div>
            <div className="border border-gray-200 rounded-xl p-2.5"><p className="text-gray-500">Pengeluaran</p><p className="font-bold text-red-600 text-[13px]">{fmt(s.expense)}</p></div>
            <div className="border border-gray-200 rounded-xl p-2.5"><p className="text-gray-500">Selisih</p><p className="font-bold text-[13px]">{fmt(s.net)}</p></div>
            <div className="border border-gray-200 rounded-xl p-2.5"><p className="text-gray-500">Tabungan</p><p className="font-bold text-[13px]">{Math.round(s.savingRate * 100)}%</p></div>
          </div>

          <h2 className="font-bold text-teal-700 text-[13px] mb-1">Pengeluaran per kategori</h2>
          <table className="w-full mb-5"><tbody>{catRows(s.expenseCats, s.expense)}</tbody></table>

          <h2 className="font-bold text-teal-700 text-[13px] mb-1">Pemasukan per kategori</h2>
          <table className="w-full mb-5"><tbody>{catRows(s.incomeCats, s.income)}</tbody></table>

          <h2 className="font-bold text-teal-700 text-[13px] mb-1">Daftar transaksi ({sorted.length})</h2>
          <table className="w-full">
            <thead>
              <tr className="bg-teal-50 text-teal-700 text-left">
                <th className="py-1.5 px-1">Tanggal</th><th className="py-1.5 px-1">Kategori</th><th className="py-1.5 px-1">Tipe</th><th className="py-1.5 px-1 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={4} className="py-2 text-gray-400">Tidak ada transaksi</td></tr>
              ) : sorted.map((t, i) => (
                <tr key={t.id || i} className="border-b border-gray-100 break-inside-avoid">
                  <td className="py-1.5 px-1 whitespace-nowrap">{t.transaction_date}</td>
                  <td className="py-1.5 px-1">{t.merchant_name || ''}</td>
                  <td className="py-1.5 px-1">{t.type === 'income' ? 'Masuk' : 'Keluar'}</td>
                  <td className={`py-1.5 px-1 text-right whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-gray-400 mt-5">Dibuat oleh Celengin.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
