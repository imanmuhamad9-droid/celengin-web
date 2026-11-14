'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Printer, Info, X, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, toLocalDateStr } from '@/lib/utils';
import { normalizePayday } from '@/lib/cycle';
import { Period, Tx, getRange, shiftAnchor, summarize, pctChange, healthScore, buildInsights } from '@/lib/insights';
import { downloadCsv } from '@/lib/exportReport';
import { listWallets, Wallet } from '@/lib/wallets';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SubTabs, { RIWAYAT_TABS } from '@/components/SubTabs';
import SkeletonLoader from '@/components/SkeletonLoader';
import { buildReportPdf, savePdf } from '@/lib/pdfReport';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week', label: 'Mingguan' },
  { id: 'month', label: 'Bulanan' },
  { id: 'year', label: 'Tahunan' },
];

export default function ReportsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [nickname, setNickname] = useState('');
  const [payday, setPayday] = useState(1);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState('');
  const [today, setToday] = useState('');
  const [showHealthInfo, setShowHealthInfo] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const t = toLocalDateStr(new Date());
    setToday(t);
    setAnchor(t);
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      const { data: tx } = await supabase.from('transactions').select('*').order('transaction_date', { ascending: false });
      if (tx) setTransactions(tx as Tx[]);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setNickname(prof?.nickname || prof?.full_name || '');
      setPayday(normalizePayday(prof?.payday));
      setWallets(await listWallets(session.user.id, false));
      setLoading(false);
    };
    load();
  }, [router]);

  if (loading || !anchor || !today) return <div className="min-h-screen bg-[var(--bg-main)]"><SkeletonLoader /></div>;

  const range = getRange(period, anchor, payday);
  const prevRange = getRange(period, shiftAnchor(period, anchor, -1, payday), payday);
  const cur = summarize(transactions, range, period, today);
  const prev = summarize(transactions, prevRange, period, today);
  const health = healthScore(cur, prev);
  const insights = buildInsights(cur, prev, period, formatRupiah);
  const inPeriod = transactions.filter((t) => t.transaction_date >= range.start && t.transaction_date <= range.end);
  const canGoNext = range.end < today;
  const noun = period === 'week' ? 'minggu' : period === 'month' ? 'bulan' : 'tahun';

  const maxBar = Math.max(10000, ...cur.series.map((s) => Math.max(s.income, s.expense)));
  const ringColor = !health ? '#9ca3af' : health.score >= 80 ? '#10b981' : health.score >= 60 ? '#14b8a6' : health.score >= 40 ? '#f59e0b' : '#ef4444';

  const walletName = (id?: string | null) => {
    const w = wallets.find((x) => x.id === id);
    return w ? `${w.emoji} ${w.name}` : '';
  };

  const handleCsv = () => {
    if (inPeriod.length === 0) return showDialog('Tidak Ada Data', 'Tidak ada transaksi di periode ini untuk diunduh.', 'info');
    downloadCsv({ filename: `celengin-${period}-${range.start}.csv`, transactions: inPeriod, walletName });
  };

  const handlePdf = async () => {
    if (inPeriod.length === 0) return showDialog('Tidak Ada Data', 'Tidak ada transaksi di periode ini untuk dibuat PDF.', 'info');
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const bytes = await buildReportPdf({ title: 'Laporan Keuangan Celengin', periodLabel: range.label, nickname, summary: cur, transactions: inPeriod, fmt: formatRupiah });
      await savePdf(bytes, `laporan-celengin-${period}-${range.start}.pdf`);
    } catch (e: any) {
      showDialog('Gagal Membuat PDF', e?.message || 'Terjadi kesalahan saat membuat PDF.', 'danger');
    } finally {
      setPdfBusy(false);
    }
  };

  const Delta = ({ now, before, inverse }: { now: number; before: number; inverse?: boolean }) => {
    const ch = pctChange(now, before);
    if (ch === null) return <span className="text-[10px] text-white/60">baru</span>;
    const up = ch > 0;
    const good = inverse ? !up : up;
    return (
      <span className={`text-[10px] font-bold flex items-center gap-0.5 ${Math.abs(ch) < 1 ? 'text-white/70' : good ? 'text-green-300' : 'text-red-300'}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} {Math.abs(Math.round(ch))}%
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-40 transition-colors">
      <AppHeader title="Laporan" />

      <main className="px-5 mt-4 space-y-5">
        <SubTabs items={RIWAYAT_TABS} />

        {/* Pilih periode */}
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${period === p.id ? 'glass glass-teal' : 'glass text-gray-500 dark:text-gray-400'}`}>{p.label}</button>
          ))}
        </div>

        <div className="flex items-center justify-between glass rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm px-3 py-2">
          <button onClick={() => setAnchor(shiftAnchor(period, anchor, -1, payday))} className="glass p-1.5 rounded-md text-gray-500 hover:text-teal-600"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{range.label}</span>
          <button disabled={!canGoNext} onClick={() => setAnchor(shiftAnchor(period, anchor, 1, payday))} className="glass p-1.5 rounded-md text-gray-500 hover:text-teal-600 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {/* Ringkasan */}
        <div className="rounded-3xl p-6 text-white shadow-lg bg-teal-700">
          <p className="text-white/80 text-xs font-medium mb-1">Selisih {noun} ini</p>
          <h3 className={`text-3xl font-extrabold mb-4 ${cur.net < 0 ? 'text-red-200' : ''}`}>{cur.net < 0 ? '-' : ''}{formatRupiah(Math.abs(cur.net))}</h3>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-white/80 text-[10px] uppercase font-bold">Masuk</p>
              <p className="font-bold text-green-300">+{formatRupiah(cur.income)}</p>
              <Delta now={cur.income} before={prev.income} />
            </div>
            <div>
              <p className="text-white/80 text-[10px] uppercase font-bold">Keluar</p>
              <p className="font-bold text-red-300">-{formatRupiah(cur.expense)}</p>
              <Delta now={cur.expense} before={prev.expense} inverse />
            </div>
          </div>
          <p className="text-white/60 text-[10px] mt-3">Perbandingan dengan {noun} sebelumnya ({prevRange.label}).</p>
        </div>

        {cur.txCount === 0 ? (
          <div className="glass rounded-3xl p-10 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-gray-400 dark:text-gray-500 text-sm">Belum ada transaksi di periode ini.</p>
          </div>
        ) : (
          <>
            {/* Skor kesehatan */}
            {health && (
              <div className="glass p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors relative">
                <button onClick={() => setShowHealthInfo(true)} className="absolute top-4 right-4 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"><Info className="w-4 h-4" /></button>
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-4">Skor Kesehatan Keuangan</h3>
                <div className="flex items-center gap-5">
                  <div className="relative w-20 h-20 rounded-full flex items-center justify-center shrink-0" style={{ background: `conic-gradient(${ringColor} ${health.score}%, #e5e7eb 0)` }}>
                    <div className="absolute w-14 h-14 glass rounded-full"></div>
                    <span className="relative z-10 font-extrabold text-lg text-gray-800 dark:text-white">{health.score}</span>
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 dark:text-gray-100">{health.label} {health.emoji}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Dari 100 poin, berdasarkan tabungan, tren pengeluaran, dan kerajinan mencatat.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Insight */}
            {insights.length > 0 && (
              <div className="glass p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-3">Insight</h3>
                <div className="space-y-2">
                  {insights.map((l, i) => (
                    <div key={i} className={`flex items-start gap-2 p-3 rounded-xl border-l-4 ${l.tone === 'good' ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : l.tone === 'warn' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-500'}`}>
                      <span className="text-sm leading-none mt-0.5">{l.icon}</span>
                      <p className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">{l.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grafik */}
            <div className="glass p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">{period === 'year' ? 'Per Bulan' : 'Per Hari'}</h3>
                <div className="flex gap-2 text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-green-500"><span className="w-2 h-2 rounded-full bg-green-500"></span> Masuk</span>
                  <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 rounded-full bg-red-500"></span> Keluar</span>
                </div>
              </div>
              <div className="flex items-end justify-between gap-[3px] h-32">
                {cur.series.map((s, idx) => (
                  <div key={s.key} className="flex flex-col items-center flex-1 h-full justify-end min-w-0">
                    <div className="w-full relative flex justify-center items-end gap-[1px] h-full pb-2">
                      <div className="w-full max-w-[8px] rounded-t-sm bg-green-500" style={{ height: `${Math.max((s.income / maxBar) * 100, s.income > 0 ? 4 : 2)}px`, opacity: s.income > 0 ? 1 : 0.25 }}></div>
                      <div className="w-full max-w-[8px] rounded-t-sm bg-red-500" style={{ height: `${Math.max((s.expense / maxBar) * 100, s.expense > 0 ? 4 : 2)}px`, opacity: s.expense > 0 ? 1 : 0.25 }}></div>
                    </div>
                    <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 h-3">
                      {period !== 'month' || idx % 5 === 0 || idx === cur.series.length - 1 ? s.label : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kategori */}
            <div className="glass p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors space-y-5">
              {cur.expenseCats.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-3">Pengeluaran per kategori</p>
                  <div className="space-y-3">
                    {cur.expenseCats.slice(0, 8).map((c, i) => {
                      const pct = cur.expense > 0 ? (c.amount / cur.expense) * 100 : 0;
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className={`truncate text-sm ${i === 0 ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-gray-700 dark:text-gray-200 font-semibold'}`}>{c.name}</span>
                            <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold glass glass-teal">{Math.round(pct)}%</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden"><div className="h-2 rounded-full bg-red-500" style={{ width: `${pct}%` }}></div></div>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{formatRupiah(c.amount)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {cur.incomeCats.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-3">Sumber pemasukan</p>
                  <div className="space-y-3">
                    {cur.incomeCats.slice(0, 6).map((c) => {
                      const pct = cur.income > 0 ? (c.amount / cur.income) * 100 : 0;
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">{c.name}</span>
                            <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white bg-green-500">{Math.round(pct)}%</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden"><div className="h-2 rounded-full bg-green-500" style={{ width: `${pct}%` }}></div></div>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">{formatRupiah(c.amount)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Ekspor */}
        <div className="glass p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1">Ekspor Laporan</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-3">{inPeriod.length} transaksi di {range.label}. CSV bisa dibuka di Excel. PDF berisi ringkasan, kategori, dan seluruh transaksi; di HP akan muncul menu berbagi (pilih Simpan ke File).</p>
          <div className="flex gap-2">
            <button onClick={handleCsv} className="glass glass-teal flex-1 border text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"><Download className="w-4 h-4" /> Unduh CSV</button>
            <button onClick={handlePdf} disabled={pdfBusy} className="glass glass-solid-teal flex-1 disabled:opacity-60 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"><Printer className="w-4 h-4" /> {pdfBusy ? 'Membuat PDF...' : 'Unduh PDF'}</button>
          </div>
        </div>
      </main>

      {showHealthInfo && health && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="glass glass-sheet rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setShowHealthInfo(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Apa itu Skor Kesehatan?</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">Angka 0-100 yang merangkum seberapa sehat keuanganmu di periode ini.</p>
            <div className="bg-teal-50 dark:bg-teal-900/30 p-3 rounded-xl border border-teal-100 dark:border-teal-800 mb-4 space-y-2">
              {health.parts.map((p) => (
                <div key={p.name}>
                  <div className="flex justify-between text-[11px] font-bold text-teal-800 dark:text-teal-300"><span>{p.name}</span><span>{p.got}/{p.max}</span></div>
                  <div className="w-full bg-white dark:bg-gray-700 rounded-full h-1.5 mt-1 overflow-hidden"><div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${(p.got / p.max) * 100}%` }}></div></div>
                </div>
              ))}
            </div>
            <ul className="text-[10px] text-gray-500 dark:text-gray-400 space-y-1 list-disc pl-4">
              <li>Tabungan: penuh bila kamu menyisihkan 20% atau lebih dari pemasukan.</li>
              <li>Tren: penuh bila pengeluaran tidak naik dibanding {noun} lalu.</li>
              <li>Mencatat: makin banyak hari tercatat, makin tinggi.</li>
            </ul>
          </div>
        </div>
      )}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
