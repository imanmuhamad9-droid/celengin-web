'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { downloadAllData } from '@/lib/exportData';
import { downloadCsv } from '@/lib/exportReport';
import type { Tx } from '@/lib/insights';
import { errMsg } from '@/lib/utils';

type ShowDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;

const CARD = 'glass p-5 rounded-3xl border transition-colors';
const BTN_SOFT = 'glass glass-teal w-full h-11 rounded-2xl border text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50';
const BTN_DANGER = 'glass glass-danger w-full h-11 rounded-2xl border text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50';
const INPUT = 'glass w-full h-12 px-4 rounded-2xl border text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base outline-none';

// Unduh data pribadi dan hapus akun. Penghapusan dilakukan server (app/api/account/delete) setelah password diverifikasi.
export default function DataAccountCard({ showDialog }: { showDialog: ShowDialog }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'json' | 'csv' | 'delete' | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const exportJson = async () => {
    setBusy('json');
    try {
      const r = await downloadAllData();
      showDialog('Terunduh', `${r.rows} baris dari ${r.tables} tabel disimpan ke file JSON.${r.failed ? ` ${r.failed} tabel tidak bisa dibaca dan dilewati.` : ''}`, r.failed ? 'info' : 'success');
    } catch (e) {
      showDialog('Gagal', errMsg(e, 'Data gagal diunduh.'), 'danger');
    } finally { setBusy(null); }
  };

  const exportCsv = async () => {
    setBusy('csv');
    try {
      const rows: Tx[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error: err } = await supabase.from('transactions').select('*').order('transaction_date', { ascending: true }).range(from, from + 999);
        if (err) throw err;
        const batch = (data || []) as Tx[];
        rows.push(...batch);
        if (batch.length < 1000) break;
      }
      if (rows.length === 0) { showDialog('Belum Ada Data', 'Belum ada transaksi untuk diunduh.', 'info'); return; }
      downloadCsv({ filename: `celengin-transaksi-${new Date().toISOString().slice(0, 10)}.csv`, transactions: rows });
    } catch (e) {
      showDialog('Gagal', errMsg(e, 'Transaksi gagal diunduh.'), 'danger');
    } finally { setBusy(null); }
  };

  const deleteAccount = async () => {
    setError('');
    if (confirmText !== 'HAPUS') return setError('Ketik HAPUS (huruf besar) untuk melanjutkan.');
    if (!password) return setError('Masukkan password kamu.');
    setBusy('delete');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ confirm: confirmText, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || 'Akun gagal dihapus.'); return; }
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (e) {
      setError(errMsg(e, 'Akun gagal dihapus. Periksa koneksi lalu coba lagi.'));
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <div className={CARD}>
        <h3 className="font-bold text-gray-800 dark:text-white mb-1">Unduh Data Saya</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Salinan lengkap data milikmu: transaksi, dompet, tagihan, anggaran, target, dan lainnya. Berguna untuk arsip atau pindah aplikasi.</p>
        <div className="space-y-2.5">
          <button onClick={exportJson} disabled={busy !== null} className={BTN_SOFT}><Download className="w-4 h-4" /> {busy === 'json' ? 'Menyiapkan...' : 'Semua data (JSON)'}</button>
          <button onClick={exportCsv} disabled={busy !== null} className={BTN_SOFT}><FileSpreadsheet className="w-4 h-4" /> {busy === 'csv' ? 'Menyiapkan...' : 'Transaksi saja (CSV, bisa dibuka di Excel)'}</button>
        </div>
      </div>

      <div className={CARD}>
        <h3 className="font-bold text-red-500 mb-1">Hapus Akun</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
          Akun dan seluruh datamu dihapus permanen dan tidak bisa dikembalikan. Unduh datamu dulu bila perlu.
          Target Bareng dan grup Gantian/Bayarin yang <b>kamu buat</b> ikut terhapus untuk semua anggotanya.
          Keanggotaanmu di milik orang lain dilepas.
        </p>
        <div className="space-y-3">
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={INPUT} placeholder='Ketik "HAPUS" untuk konfirmasi' autoCapitalize="characters" autoCorrect="off" aria-label="Ketik HAPUS" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} placeholder="Password kamu" autoComplete="current-password" aria-label="Password" />
          {error && <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
          <button onClick={deleteAccount} disabled={busy !== null || confirmText !== 'HAPUS' || !password} className={BTN_DANGER}>
            <Trash2 className="w-4 h-4" /> {busy === 'delete' ? 'Menghapus...' : 'Hapus Akun Saya'}
          </button>
        </div>
      </div>
    </div>
  );
}
