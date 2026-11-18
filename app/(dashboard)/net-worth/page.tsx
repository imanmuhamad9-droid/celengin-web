'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, parseRupiahInput, toLocalDateStr } from '@/lib/utils';
import { listWallets } from '@/lib/wallets';
import { NW_INCLUDE_DEFAULT, NetItem, NwAuto, monthKey, netWorthTotals, parseNwInclude } from '@/lib/finance';
import { createPref } from '@/lib/localPref';
import { useCatatAction } from '@/lib/catatAction';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import { Toggle } from '@/components/ui';
import { Sheet, SqlNotice, chipOff, chipOn, inputCls, labelCls } from '@/components/FinUI';

interface Snapshot { month: string; assets: number | string; debts: number | string; net: number | string }

// Hitungan otomatis mana yang ikut dijumlahkan (per perangkat)
const includePref = createPref('celengin:nw-include', parseNwInclude, NW_INCLUDE_DEFAULT);

const sumTx = (rows: { type: string; amount: number | string }[]) => rows.reduce((s, r) => s + (r.type === 'income' ? 1 : -1) * (Number(r.amount) || 0), 0);
const monthShort = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('id-ID', { month: 'short' });

function NetChart({ points }: { points: { label: string; value: number }[] }) {
  const W = 320, H = 130, padX = 22, padTop = 24, padBottom = 26;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? W / 2 : padX + (i * (W - padX * 2)) / (points.length - 1));
  const y = (v: number) => padTop + ((max - v) / span) * (H - padTop - padBottom);
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Grafik kekayaan bersih per bulan">
      {points.length > 1 && <polyline points={line} fill="none" stroke="var(--teal-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((p, i) => (
        <g key={p.label + i}>
          <circle cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3.5} fill={i === points.length - 1 ? 'var(--teal-primary)' : '#fff'} stroke="var(--teal-primary)" strokeWidth="2" />
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{p.label}</text>
        </g>
      ))}
      <text x={Math.min(Math.max(x(points.length - 1), 50), W - 50)} y={y(last.value) - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-main)">{formatRupiah(last.value)}</text>
    </svg>
  );
}

export default function NetWorthPage() {
  const router = useRouter();
  const include = includePref.useValue();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [tableOk, setTableOk] = useState(true);
  const [auto, setAuto] = useState<NwAuto>({ saldo: 0, darurat: 0, impian: 0 });
  const [items, setItems] = useState<NetItem[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [curMonth, setCurMonth] = useState('');      // YYYY-MM bulan berjalan, diisi saat data dimuat (bukan saat render)
  const [form, setForm] = useState<{ item: NetItem | null } | null>(null);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    const uid = session.user.id;
    setUserId(uid);
    setCurMonth(monthKey(toLocalDateStr(new Date())));

    // Aset otomatis (tabel yang belum ada dianggap kosong)
    const { data: tx } = await supabase.from('transactions').select('type,amount');
    const wallets = await listWallets(uid, false);
    const saldo = sumTx((tx || []) as { type: string; amount: number | string }[]) + wallets.reduce((s, w) => s + (Number(w.initial_balance) || 0), 0);
    const { data: em } = await supabase.from('emergency_entries').select('type,amount');
    const darurat = ((em || []) as { type: string; amount: number | string }[]).reduce((s, r) => s + (r.type === 'in' ? 1 : -1) * (Number(r.amount) || 0), 0);
    const { data: dg } = await supabase.from('dream_goals').select('current_amount');
    const impian = ((dg || []) as { current_amount: number | string }[]).reduce((s, r) => s + (Number(r.current_amount) || 0), 0);
    setAuto({ saldo, darurat, impian });

    const { data: it, error } = await supabase.from('net_worth_items').select('*').order('created_at', { ascending: true });
    setTableOk(!error);
    setItems((it || []) as NetItem[]);
    const { data: sn } = await supabase.from('net_worth_snapshots').select('*').order('month', { ascending: true });
    setSnapshots((sn || []) as Snapshot[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const totals = netWorthTotals(auto, include, items);
  // Simpan angka bulan ini (hanya bila berubah) supaya grafik terisi seiring waktu
  useEffect(() => {
    if (loading || !tableOk || !userId || !curMonth) return;
    const existing = snapshots.find((s) => s.month === curMonth);
    if (existing && Number(existing.assets) === totals.assets && Number(existing.debts) === totals.debts) return;
    const row = { user_id: userId, month: curMonth, assets: totals.assets, debts: totals.debts, net: totals.net, updated_at: new Date().toISOString() };
    (async () => {
      const { error } = await supabase.from('net_worth_snapshots').upsert(row, { onConflict: 'user_id,month' });
      if (!error) setSnapshots((prev) => [...prev.filter((s) => s.month !== curMonth), { month: curMonth, assets: row.assets, debts: row.debts, net: row.net }].sort((a, b) => a.month.localeCompare(b.month)));
    })();
  }, [loading, tableOk, userId, curMonth, totals.assets, totals.debts, totals.net, snapshots]);

  useCatatAction('Aset', 'Tambah aset atau utang', () => setForm({ item: null }));

  if (loading) return <div className="min-h-screen bg-[var(--page-bg)]"><SkeletonLoader /></div>;

  const points = [
    ...snapshots.filter((s) => s.month !== curMonth).slice(-5).map((s) => ({ label: monthShort(s.month), value: Number(s.net) || 0 })),
    { label: monthShort(curMonth), value: totals.net },
  ];
  const assetsList = items.filter((i) => i.kind === 'asset');
  const debtsList = items.filter((i) => i.kind === 'debt');

  const deleteItem = (i: NetItem) => {
    showDialog('Hapus Catatan?', `${i.name} akan dihapus dari perhitungan kekayaan bersih.`, 'danger', async () => {
      const { error } = await supabase.from('net_worth_items').delete().eq('id', i.id);
      if (error) showDialog('Gagal', error.message, 'danger');
      else load();
    });
  };

  const itemRow = (i: NetItem) => (
    <div key={i.id} className="rounded-2xl px-3.5 py-3 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{i.name}</p>
          {i.note && <p className="text-[11px] truncate text-[color:var(--text-muted)]">{i.note}</p>}
        </div>
        <p className="text-sm font-extrabold shrink-0" style={{ color: 'var(--text-main)' }}>{formatRupiah(Number(i.amount))}</p>
      </div>
      <div className="flex justify-end gap-2 mt-2.5">
        <GlassButton variant="teal" size="sm" onClick={() => setForm({ item: i })}>Ubah</GlassButton>
        <GlassButton variant="danger" size="sm" onClick={() => deleteItem(i)}>Hapus</GlassButton>
      </div>
    </div>
  );

  const autoRows: { key: keyof NwAuto; label: string; desc: string }[] = [
    { key: 'saldo', label: 'Saldo dompet', desc: 'Uang Sisa di Home' },
    { key: 'darurat', label: 'Dana Darurat', desc: 'Yang sudah kamu setor' },
    { key: 'impian', label: 'Tabungan Impian', desc: 'Terkumpul di semua Impian' },
  ];

  return (
    <div className="min-h-screen bg-[var(--page-bg)] pb-40 transition-colors">
      <AppHeader title="Kekayaan Bersih" />

      <main className="max-w-md mx-auto px-4 mt-3 space-y-4">
        {!tableOk && <SqlNotice file="sql/08_fitur_keuangan.sql" />}

        <GlassCard>
          <p className="text-xs font-semibold text-[color:var(--text-muted)]">Kekayaan bersih</p>
          <p className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: 'var(--text-main)' }}>{totals.net < 0 ? '-' : ''}{formatRupiah(Math.abs(totals.net))}</p>
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
              <p className="text-[11px] font-semibold text-[color:var(--text-muted)]">Total aset</p>
              <p className="text-sm font-extrabold mt-0.5" style={{ color: 'var(--text-main)' }}>{formatRupiah(totals.assets)}</p>
            </div>
            <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
              <p className="text-[11px] font-semibold text-[color:var(--text-muted)]">Total utang</p>
              <p className="text-sm font-extrabold mt-0.5" style={{ color: 'var(--text-main)' }}>{formatRupiah(totals.debts)}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <p className="text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>Per bulan</p>
          <NetChart points={points} />
          {points.length === 1 && <p className="text-[10px] mt-1 text-[color:var(--text-muted)]">Grafik terisi seiring berjalannya bulan: angka tiap bulan disimpan otomatis setiap kamu membuka halaman ini.</p>}
        </GlassCard>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2 px-1 text-[color:var(--text-muted)]">Aset otomatis</p>
          <div className="glass rounded-3xl divide-y divide-black/[0.07] dark:divide-white/10 overflow-hidden">
            {autoRows.map((r) => (
              <div key={r.key} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{r.label}</p>
                  <p className="text-[11px] text-[color:var(--text-muted)]">{r.desc}</p>
                </div>
                <p className="text-sm font-extrabold shrink-0" style={{ color: 'var(--text-main)' }}>{formatRupiah(auto[r.key])}</p>
                <Toggle checked={include[r.key]} onChange={(v) => includePref.set({ ...include, [r.key]: v })} label={`Hitung ${r.label}`} onText="Ya" offText="Tidak" />
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-2 px-1 leading-relaxed text-[color:var(--text-muted)]">Matikan salah satu kalau uangnya sudah terhitung di tempat lain, supaya tidak terhitung dua kali. Pilihan ini berlaku di perangkat ini.</p>
        </div>

        {tableOk && (
          <>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2 px-1 text-[color:var(--text-muted)]">Aset kamu</p>
              <div className="space-y-2.5">
                {assetsList.length === 0 && <p className="text-xs px-1 text-[color:var(--text-muted)]">Belum ada. Tambahkan investasi, emas, kendaraan, atau piutang.</p>}
                {assetsList.map(itemRow)}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2 px-1 text-[color:var(--text-muted)]">Utang kamu</p>
              <div className="space-y-2.5">
                {debtsList.length === 0 && <p className="text-xs px-1 text-[color:var(--text-muted)]">Belum ada. Tambahkan paylater, cicilan, atau pinjaman.</p>}
                {debtsList.map(itemRow)}
              </div>
            </div>
            <GlassButton variant="teal" size="lg" full className="border-dashed" onClick={() => setForm({ item: null })}>+ Tambah aset atau utang</GlassButton>
          </>
        )}
      </main>

      {form && <ItemForm key={form.item?.id || 'new'} item={form.item} userId={userId} onClose={() => setForm(null)} onSaved={load} showDialog={showDialog} />}
      <BottomNav />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </div>
  );
}

function ItemForm({ item, userId, onClose, onSaved, showDialog }: {
  item: NetItem | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
  showDialog: (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;
}) {
  const [kind, setKind] = useState<'asset' | 'debt'>(item?.kind ?? 'asset');
  const [name, setName] = useState(item?.name ?? '');
  const startAmount = item ? Math.round(Number(item.amount)) : 0;
  const [raw, setRaw] = useState(startAmount);
  const [display, setDisplay] = useState(startAmount > 0 ? parseRupiahInput(String(startAmount)).display : '');
  const [note, setNote] = useState(item?.note ?? '');
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) return showDialog('Data Belum Lengkap', 'Isi namanya.', 'danger');
    if (raw <= 0) return showDialog('Nominal Kosong', 'Isi nilainya.', 'danger');
    setBusy(true);
    const payload = { name: name.trim().slice(0, 60), kind, amount: raw, note: note.trim() || null };
    const { error } = item
      ? await supabase.from('net_worth_items').update(payload).eq('id', item.id)
      : await supabase.from('net_worth_items').insert({ user_id: userId, ...payload });
    setBusy(false);
    if (error) return showDialog('Gagal', error.message, 'danger');
    onSaved();
    onClose();
  };

  return (
    <form onSubmit={save}>
      <Sheet
        title={item ? 'Ubah Catatan' : 'Tambah Aset atau Utang'}
        onClose={onClose}
        footer={<GlassButton type="submit" variant="primary" size="lg" full disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</GlassButton>}
      >
        <div className="flex gap-2">
          <button type="button" onClick={() => setKind('asset')} className={`flex-1 py-2 rounded-full text-xs font-bold ${kind === 'asset' ? chipOn : chipOff}`}>Aset</button>
          <button type="button" onClick={() => setKind('debt')} className={`flex-1 py-2 rounded-full text-xs font-bold ${kind === 'debt' ? chipOn : chipOff}`}>Utang</button>
        </div>
        <div>
          <label className={labelCls}>Nama</label>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={kind === 'asset' ? 'Cth: Reksadana, emas 5 gram, motor' : 'Cth: SPayLater, cicilan HP, pinjam teman'} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{kind === 'asset' ? 'Nilai sekarang (Rp)' : 'Sisa utang (Rp)'}</label>
          <input inputMode="numeric" value={display} onChange={(e) => { const p = parseRupiahInput(e.target.value); setRaw(p.raw); setDisplay(p.display); }} placeholder="0" className={`${inputCls} font-bold`} />
          <p className="text-[10px] mt-1 text-[color:var(--text-muted)]">Perbarui angkanya sesekali lewat tombol Ubah supaya grafiknya akurat.</p>
        </div>
        <div>
          <label className={labelCls}>Catatan (opsional)</label>
          <input value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} placeholder="Cth: jatuh tempo tiap tanggal 5" className={inputCls} />
        </div>
      </Sheet>
    </form>
  );
}
