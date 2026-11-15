'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, formatDateID } from '@/lib/utils';
import { Wallet, WalletTransfer, WALLET_TYPE_LABEL, computeWalletBalances, listWallets } from '@/lib/wallets';
import { useCatatAction } from '@/lib/catatAction';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import WalletFormModal from '@/components/WalletFormModal';
import WalletTransferModal from '@/components/WalletTransferModal';
import { StatusBadge } from '@/components/FinUI';

interface TxRow { wallet_id: string | null; type: string; amount: number | string }

export default function WalletsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [tableOk, setTableOk] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Wallet | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    setUserId(session.user.id);
    const list = await listWallets(session.user.id, true);
    const { data: tx } = await supabase.from('transactions').select('wallet_id,type,amount');
    const { data: tr } = await supabase.from('wallet_transfers').select('*').order('transfer_date', { ascending: false }).order('created_at', { ascending: false });
    setWallets(list);
    setTableOk(list.length > 0);
    setTxs((tx || []) as TxRow[]);
    setTransfers((tr || []) as WalletTransfer[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  useCatatAction('Dompet', 'Tambah dompet', openNew);

  if (loading) return <div className="min-h-screen bg-[var(--bg-main)]"><SkeletonLoader /></div>;

  const { balances, unassigned } = computeWalletBalances(wallets, txs, transfers);
  const total = wallets.reduce((s, w) => s + (balances[w.id] || 0), 0) + unassigned;
  const nameOf = (id: string) => wallets.find((w) => w.id === id)?.name || 'Dompet dihapus';
  const defaultId = wallets.find((w) => w.is_default)?.id ?? null;

  const handleDelete = async (w: Wallet) => {
    if (w.is_default) return showDialog('Dompet Utama', 'Dompet utama tidak bisa dihapus. Jadikan dompet lain sebagai utama dulu lewat tombol Ubah.', 'info');
    const { count: txCount } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('wallet_id', w.id);
    const { count: trCount } = await supabase.from('wallet_transfers').select('id', { count: 'exact', head: true }).or(`from_wallet_id.eq.${w.id},to_wallet_id.eq.${w.id}`);
    if ((txCount || 0) > 0 || (trCount || 0) > 0) {
      return showDialog('Dompet Sudah Dipakai', `Dompet ini dipakai di ${txCount || 0} transaksi dan ${trCount || 0} transfer, jadi tidak dihapus supaya riwayatmu tetap utuh. Kamu bisa mengganti namanya lewat tombol Ubah.`, 'info');
    }
    showDialog('Hapus Dompet?', `Dompet ${w.name} akan dihapus.`, 'danger', async () => {
      const { error } = await supabase.from('wallets').delete().eq('id', w.id);
      if (error) showDialog('Gagal', error.message, 'danger');
      else load();
    });
  };

  const handleDeleteTransfer = (t: WalletTransfer) => {
    showDialog('Hapus Transfer?', 'Saldo kedua dompet akan kembali seperti sebelum transfer ini.', 'danger', async () => {
      const { error } = await supabase.from('wallet_transfers').delete().eq('id', t.id);
      if (error) showDialog('Gagal', error.message, 'danger');
      else load();
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-40 transition-colors">
      <AppHeader title="Dompet" />

      <main className="max-w-md mx-auto px-4 mt-3 space-y-4">
        {!tableOk && (
          <div className="glass glass-teal rounded-3xl p-4 text-xs leading-relaxed">
            <p className="font-bold mb-1">Dompet belum bisa dimuat</p>
            <p>Tabel dompet belum ada di database. Jalankan <strong>sql/02_dompet.sql</strong> di Supabase SQL Editor, lalu muat ulang halaman ini.</p>
          </div>
        )}

        {tableOk && (
          <>
            <GlassCard>
              <p className="text-xs font-semibold text-[color:var(--text-muted)]">Total semua dompet</p>
              <p className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: 'var(--text-main)' }}>{formatRupiah(total)}</p>
              <p className="text-[11px] mt-1 text-[color:var(--text-muted)]">{wallets.length} dompet{unassigned !== 0 ? ` · ${formatRupiah(unassigned)} belum masuk dompet mana pun` : ''}</p>
              {wallets.length > 1 && (
                <GlassButton variant="teal" size="lg" full className="mt-4" onClick={() => setTransferOpen(true)}><ArrowLeftRight className="w-4 h-4" /> Transfer antar dompet</GlassButton>
              )}
            </GlassCard>

            <div className="space-y-3">
              {wallets.map((w) => (
                <GlassCard key={w.id}>
                  <div className="flex items-center gap-3">
                    <span className="glass w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0">{w.emoji || '💵'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                        <span className="truncate">{w.name}</span>
                        {w.is_default && <StatusBadge tone="ok">Utama</StatusBadge>}
                      </p>
                      <p className="text-[11px] text-[color:var(--text-muted)]">{WALLET_TYPE_LABEL[w.type] || 'Lainnya'}</p>
                    </div>
                    <p className="text-base font-extrabold shrink-0" style={{ color: 'var(--text-main)' }}>{formatRupiah(balances[w.id] || 0)}</p>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <GlassButton variant="teal" size="sm" onClick={() => { setEditing(w); setFormOpen(true); }}>Ubah</GlassButton>
                    <GlassButton variant="danger" size="sm" onClick={() => handleDelete(w)}>Hapus</GlassButton>
                  </div>
                </GlassCard>
              ))}
              <GlassButton variant="teal" size="lg" full className="border-dashed" onClick={openNew}>+ Tambah dompet</GlassButton>
            </div>

            {transfers.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest mb-2 px-1 text-[color:var(--text-muted)]">Riwayat transfer</p>
                <div className="glass rounded-3xl px-4 py-1">
                  {transfers.slice(0, 20).map((t, i, arr) => (
                    <div key={t.id} className={`flex items-center gap-2 py-2.5 ${i === arr.length - 1 ? '' : 'border-b border-black/[0.07] dark:border-white/10'}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{nameOf(t.from_wallet_id)} → {nameOf(t.to_wallet_id)}</p>
                        <p className="text-[11px] truncate text-[color:var(--text-muted)]">{formatDateID(t.transfer_date)}{t.note ? ` · ${t.note}` : ''}</p>
                      </div>
                      <span className="text-sm font-bold shrink-0" style={{ color: 'var(--text-main)' }}>{formatRupiah(Number(t.amount))}</span>
                      <button type="button" onClick={() => handleDeleteTransfer(t)} aria-label="Hapus transfer" className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:text-red-500 active:scale-90 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <WalletFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} userId={userId} wallet={editing} currentDefaultId={defaultId} onSaved={load} showDialog={showDialog} />
      <WalletTransferModal isOpen={transferOpen} onClose={() => setTransferOpen(false)} userId={userId} wallets={wallets} balances={balances} onSaved={load} showDialog={showDialog} />
      <BottomNav />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </div>
  );
}
