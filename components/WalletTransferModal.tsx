'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, parseRupiahInput, toLocalDateStr } from '@/lib/utils';
import type { Wallet } from '@/lib/wallets';
import DateField from '@/components/DateField';
import GlassButton from '@/components/GlassButton';
import { Sheet, chipOff, chipOn, inputCls, labelCls } from '@/components/FinUI';

type ShowDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  wallets: Wallet[];
  balances: Record<string, number>;
  onSaved: () => void;
  showDialog: ShowDialog;
}

function Form({ onClose, userId, wallets, balances, onSaved, showDialog }: Omit<Props, 'isOpen'>) {
  const def = wallets.find((w) => w.is_default) || wallets[0];
  const [from, setFrom] = useState(def?.id || '');
  const [to, setTo] = useState(wallets.find((w) => w.id !== def?.id)?.id || '');
  const [raw, setRaw] = useState(0);
  const [display, setDisplay] = useState('');
  const [date, setDate] = useState(toLocalDateStr(new Date()));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!from || !to) return showDialog('Data Belum Lengkap', 'Pilih dompet asal dan tujuan.', 'danger');
    if (from === to) return showDialog('Dompet Sama', 'Dompet asal dan tujuan harus berbeda.', 'danger');
    if (raw <= 0) return showDialog('Nominal Kosong', 'Isi jumlah yang dipindahkan.', 'danger');
    if (!date) return showDialog('Data Belum Lengkap', 'Pilih tanggalnya.', 'danger');
    setSaving(true);
    const row = { from_wallet_id: from, to_wallet_id: to, amount: raw, note: note.trim() || null, transfer_date: date };
    let { error } = await supabase.from('wallet_transfers').insert({ user_id: userId, ...row });
    // Kalau tabel tidak punya kolom user_id, coba lagi tanpa kolom itu
    if (error && /user_id/i.test(error.message)) ({ error } = await supabase.from('wallet_transfers').insert(row));
    setSaving(false);
    if (error) return showDialog('Gagal', error.message, 'danger');
    onSaved();
    onClose();
  };

  const picker = (value: string, onPick: (id: string) => void, exclude?: string) => (
    <div className="flex flex-wrap gap-1.5">
      {wallets.filter((w) => w.id !== exclude).map((w) => (
        <button type="button" key={w.id} onClick={() => onPick(w.id)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold max-w-full truncate ${value === w.id ? chipOn : chipOff}`}>{w.emoji} {w.name}</button>
      ))}
    </div>
  );

  return (
    <form onSubmit={save}>
      <Sheet
        title="Transfer Antar Dompet"
        onClose={onClose}
        footer={<GlassButton type="submit" variant="primary" size="lg" full disabled={saving}><ArrowRight className="w-4 h-4" /> {saving ? 'Memindahkan...' : 'Pindahkan'}</GlassButton>}
      >
        <div>
          <label className={labelCls}>Dari {from && balances[from] !== undefined ? `(saldo ${formatRupiah(balances[from])})` : ''}</label>
          {picker(from, (id) => { setFrom(id); if (id === to) setTo(''); })}
        </div>
        <div>
          <label className={labelCls}>Ke</label>
          {picker(to, setTo, from)}
        </div>
        <div>
          <label className={labelCls}>Jumlah (Rp)</label>
          <input inputMode="numeric" value={display} onChange={(e) => { const p = parseRupiahInput(e.target.value); setRaw(p.raw); setDisplay(p.display); }} placeholder="0" className={`${inputCls} font-bold`} />
        </div>
        <DateField label="Tanggal" value={date} onChange={setDate} />
        <div>
          <label className={labelCls}>Catatan (opsional)</label>
          <input value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} placeholder="Cth: isi saldo GoPay" className={inputCls} />
        </div>
        <p className="text-[10px] text-[color:var(--text-muted)]">Transfer tidak dihitung sebagai pemasukan atau pengeluaran; hanya memindahkan saldo antar dompet.</p>
      </Sheet>
    </form>
  );
}

export default function WalletTransferModal(props: Props) {
  if (!props.isOpen) return null;
  const { isOpen, ...rest } = props;
  void isOpen;
  return <Form {...rest} />;
}
