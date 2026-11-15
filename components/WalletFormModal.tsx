'use client';
import { useState } from 'react';
import { Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { parseRupiahInput } from '@/lib/utils';
import { Wallet, WALLET_TYPE_LABEL } from '@/lib/wallets';
import GlassButton from '@/components/GlassButton';
import { Sheet, chipOff, chipOn, inputCls, labelCls } from '@/components/FinUI';

type ShowDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;

const EMOJIS = ['💵', '🏦', '📱', '💳', '👛', '🐷', '💼', '🪙'];
const TYPES = Object.keys(WALLET_TYPE_LABEL) as Wallet['type'][];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  /** null = dompet baru */
  wallet: Wallet | null;
  /** Dompet utama saat ini (untuk dipulihkan bila penggantian gagal) */
  currentDefaultId: string | null;
  onSaved: () => void;
  showDialog: ShowDialog;
}

function Form({ onClose, userId, wallet, currentDefaultId, onSaved, showDialog }: Omit<Props, 'isOpen'>) {
  const [name, setName] = useState(wallet?.name ?? '');
  const [type, setType] = useState<Wallet['type']>(wallet?.type ?? 'ewallet');
  const [emoji, setEmoji] = useState(wallet?.emoji || '💵');
  const [balRaw, setBalRaw] = useState(Math.max(0, Math.round(Number(wallet?.initial_balance) || 0)));
  const [balDisplay, setBalDisplay] = useState(wallet && Number(wallet.initial_balance) > 0 ? parseRupiahInput(String(Math.round(Number(wallet.initial_balance)))).display : '');
  const [makeDefault, setMakeDefault] = useState(!!wallet?.is_default || (!wallet && !currentDefaultId));
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) return showDialog('Data Belum Lengkap', 'Isi nama dompetnya.', 'danger');
    setSaving(true);
    const base = { name: name.trim().slice(0, 30), type, emoji, initial_balance: balRaw };
    const becomingDefault = makeDefault && !wallet?.is_default;

    // Dompet utama hanya boleh satu: yang lama dilepas dulu, dan dipulihkan bila langkah berikutnya gagal
    if (becomingDefault) {
      const { error: e1 } = await supabase.from('wallets').update({ is_default: false }).eq('user_id', userId);
      if (e1) { setSaving(false); return showDialog('Gagal', e1.message, 'danger'); }
    }
    const restoreDefault = async () => {
      if (becomingDefault && currentDefaultId) await supabase.from('wallets').update({ is_default: true }).eq('id', currentDefaultId);
    };

    if (wallet) {
      const { error } = await supabase.from('wallets').update({ ...base, ...(becomingDefault ? { is_default: true } : {}) }).eq('id', wallet.id);
      if (error) { await restoreDefault(); setSaving(false); return showDialog('Gagal', error.message, 'danger'); }
    } else {
      const { error } = await supabase.from('wallets').insert({ user_id: userId, ...base, is_default: makeDefault });
      if (error) { await restoreDefault(); setSaving(false); return showDialog('Gagal', error.message, 'danger'); }
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <form onSubmit={save}>
      <Sheet
        title={wallet ? 'Ubah Dompet' : 'Tambah Dompet'}
        onClose={onClose}
        footer={<GlassButton type="submit" variant="primary" size="lg" full disabled={saving}><Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}</GlassButton>}
      >
        <div>
          <label className={labelCls}>Nama dompet</label>
          <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Cth: BCA, GoPay, Dompet tunai" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Jenis</label>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => <button type="button" key={t} onClick={() => setType(t)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${type === t ? chipOn : chipOff}`}>{WALLET_TYPE_LABEL[t]}</button>)}
          </div>
        </div>
        <div>
          <label className={labelCls}>Ikon</label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((em) => <button type="button" key={em} onClick={() => setEmoji(em)} aria-label={`Ikon ${em}`} className={`w-10 h-10 rounded-full text-lg ${emoji === em ? chipOn : chipOff}`}>{em}</button>)}
          </div>
        </div>
        <div>
          <label className={labelCls}>Saldo awal (Rp)</label>
          <input inputMode="numeric" value={balDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); setBalRaw(p.raw); setBalDisplay(p.display); }} placeholder="0" className={`${inputCls} font-bold`} />
          <p className="text-[10px] mt-1 text-[color:var(--text-muted)]">Uang yang sudah ada di dompet ini sebelum kamu mulai mencatat.</p>
        </div>
        <button
          type="button"
          disabled={!!wallet?.is_default}
          onClick={() => setMakeDefault((v) => !v)}
          className={`w-full px-4 py-3 rounded-2xl text-xs font-bold text-left ${makeDefault ? chipOn : chipOff} disabled:opacity-70`}
        >
          {makeDefault ? '✓ ' : ''}Jadikan dompet utama {wallet?.is_default ? '(sedang dipakai)' : ''}
          <span className="block font-normal mt-0.5">Transaksi yang tidak memilih dompet masuk ke dompet utama.</span>
        </button>
      </Sheet>
    </form>
  );
}

export default function WalletFormModal(props: Props) {
  if (!props.isOpen) return null;
  const { isOpen, ...rest } = props;
  void isOpen;
  return <Form key={props.wallet?.id || 'new'} {...rest} />;
}
