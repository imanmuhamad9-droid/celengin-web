'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, parseRupiahInput, rupiahDisplay, toLocalDateStr, formatDateID } from '@/lib/utils';
import {
  InstGroup, InstItem, InstKind, InstPayment, KIND_LABEL,
  BANK_PRESETS, NextProjection, activeMonth,
  addMonthKey, calcMonthly, defaultTrackFrom, dueDateOf, forecast, groupStatus, installmentNo, lastMonth, projectNext, upcomingTotals,
} from '@/lib/installments';
import { diffDays } from '@/lib/recurring';
import { useCatatAction } from '@/lib/catatAction';
import { triggerMoneyRain } from '@/components/MoneyRain';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';
import GlassCard from '@/components/GlassCard';
import GlassButton from '@/components/GlassButton';
import SegmentedControl from '@/components/SegmentedControl';
import { Sheet, SqlNotice, StatusBadge, chipOff, chipOn, inputCls, labelCls } from '@/components/FinUI';

type BucketTab = 'isi' | 'bayar' | 'jadwal';
type ShowDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;

const monthLabel = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const monthShort = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
const KINDS = Object.keys(KIND_LABEL) as InstKind[];

function MoneyInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      inputMode="numeric"
      value={value > 0 ? rupiahDisplay(value) : ''}
      onChange={(e) => onChange(parseRupiahInput(e.target.value).raw)}
      className={`${inputCls} font-bold`}
    />
  );
}

export default function InstallmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [tableOk, setTableOk] = useState(true);
  const [groups, setGroups] = useState<InstGroup[]>([]);
  const [items, setItems] = useState<InstItem[]>([]);
  const [payments, setPayments] = useState<InstPayment[]>([]);
  const [today, setToday] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<BucketTab>('bayar');
  const [groupForm, setGroupForm] = useState<{ group: InstGroup | null } | null>(null);
  const [itemForm, setItemForm] = useState<{ groupId: string; item: InstItem | null } | null>(null);
  const [payForm, setPayForm] = useState<{ group: InstGroup } | null>(null);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog: ShowDialog = (title, msg, type, onConfirm) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); return; }
    setUserId(session.user.id);
    setToday(toLocalDateStr(new Date()));
    const g = await supabase.from('installment_groups').select('*').order('created_at', { ascending: true });
    setTableOk(!g.error);
    if (!g.error) {
      setGroups((g.data || []) as InstGroup[]);
      const it = await supabase.from('installments').select('*').order('created_at', { ascending: true });
      setItems((it.data || []) as InstItem[]);
      const pm = await supabase.from('installment_payments').select('*').order('paid_on', { ascending: true });
      setPayments((pm.data || []) as InstPayment[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);
  useCatatAction('Cicilan', 'Tambah kartu / pinjaman', () => setGroupForm({ group: null }));

  // Kartu dibuka sebagai tampilan tersendiri; tombol Kembali (termasuk di HP) menutupnya
  useEffect(() => {
    const onPop = () => setOpenId(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openGroup = (id: string) => { setOpenId(id); setTab('bayar'); window.history.pushState({ cicilan: id }, ''); window.scrollTo(0, 0); };

  if (loading) return <div className="min-h-screen bg-[var(--page-bg)]"><SkeletonLoader /></div>;

  const cur = today.slice(0, 7);
  const itemsOf = (gid: string) => items.filter((i) => i.group_id === gid);
  const paysOf = (gid: string) => payments.filter((p) => p.group_id === gid);

  const { months: upMonths, totals: upTotals } = upcomingTotals(groups, itemsOf, paysOf, cur);
  const upName = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)
    .toLocaleDateString('id-ID', ym.slice(0, 4) === upMonths[0].slice(0, 4) ? { month: 'long' } : { month: 'long', year: 'numeric' });

  const remove = (table: 'installment_groups' | 'installments' | 'installment_payments', id: string, title: string, msg: string) =>
    showDialog(title, msg, 'danger', async () => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) showDialog('Gagal', error.message, 'danger');
      else { if (table === 'installment_groups') setOpenId(null); load(); }
    });

  return (
    <div className="min-h-screen bg-[var(--page-bg)] pb-40 transition-colors">
      <AppHeader title={groups.find((x) => x.id === openId)?.name ?? 'Cicilan'} infoKey="Cicilan" onBack={openId ? () => window.history.back() : undefined} />

      <main className="max-w-md mx-auto px-4 mt-3 space-y-4">
        {!tableOk && <SqlNotice file="sql/07_cicilan.sql" />}

        {tableOk && !openId && (
          <GlassCard>
            <p className="text-xs font-semibold text-[color:var(--text-muted)]">Tagihan {upName(upMonths[0])} (belum dibayar)</p>
            <p className="text-3xl font-extrabold tracking-tight mt-1" style={{ color: 'var(--text-main)' }}>{formatRupiah(upTotals[0])}</p>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <p className="text-[11px] font-semibold text-[color:var(--text-muted)]">Tagihan {upName(upMonths[1])}</p>
                <p className="text-sm font-extrabold mt-0.5" style={{ color: 'var(--text-main)' }}>{formatRupiah(upTotals[1])}</p>
              </div>
              <div className="rounded-2xl px-3.5 py-2.5 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10">
                <p className="text-[11px] font-semibold text-[color:var(--text-muted)]">Tagihan {upName(upMonths[2])}</p>
                <p className="text-sm font-extrabold mt-0.5" style={{ color: 'var(--text-main)' }}>{formatRupiah(upTotals[2])}</p>
              </div>
            </div>
          </GlassCard>
        )}

        {tableOk && !openId && groups.length === 0 && (
          <p className="text-xs px-1 text-[color:var(--text-muted)]">Belum ada. Ketuk + untuk tambah kartu kredit, paylater, atau pinjaman.</p>
        )}

        {groups.filter((g) => !openId || g.id === openId).map((g) => {
          const gi = itemsOf(g.id);
          const gp = paysOf(g.id);
          const gm = activeMonth(g, cur); // bulan tagihan yang sedang ditunggu
          const gNext = addMonthKey(gm, 1);
          const st = groupStatus(g, gi, gp, gm);
          const proj = projectNext(g, gi, gp, gm);
          const dueDate = dueDateOf(g, gm);
          const days = today ? diffDays(today, dueDate) : 0;
          const isOpen = openId === g.id;
          const done = (gi.length > 0 || st.fromStatement) && st.remaining === 0;
          const tone = done ? 'ok' : st.remaining > 0 && days < 0 ? 'bad' : 'warn';
          const badge = gi.length === 0 && !st.fromStatement ? 'Kosong' : done ? 'Lunas bulan ini' : days < 0 ? `Telat ${-days} hari` : days === 0 ? 'Hari ini' : `${days} hari lagi`;
          const last = lastMonth(gi);
          const activeCount = gi.filter((i) => addMonthKey(i.start_month, i.tenor - 1) >= gm).length; // belum lewat bulan terakhirnya
          const thisMonthPays = gp.filter((p) => p.month === gm);

          return (
            <GlassCard key={g.id}>
              <button type="button" className="w-full text-left" onClick={() => { if (!isOpen) openGroup(g.id); }} disabled={isOpen}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{g.name}</p>
                    <p className="text-[11px] text-[color:var(--text-muted)]">{KIND_LABEL[g.kind]} · {activeCount} cicilan · tempo tgl {g.due_day}</p>
                  </div>
                  <StatusBadge tone={tone}>{badge}</StatusBadge>
                </div>
                <div className="flex items-end justify-between gap-3 mt-3">
                  <div>
                    <p className="text-[11px] text-[color:var(--text-muted)]">Sisa bulan ini</p>
                    <p className="text-xl font-extrabold" style={{ color: 'var(--text-main)' }}>{formatRupiah(st.remaining)}</p>
                    {st.fromStatement && <p className="text-[10px] text-[color:var(--text-muted)]">dari tagihan {formatRupiah(st.bill)}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-[color:var(--text-muted)]">Tagihan {monthShort(gNext)}</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{formatRupiah(proj.total)}</p>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-4">
                  <SegmentedControl<BucketTab>
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: 'bayar', label: 'Pembayaran' },
                      { value: 'isi', label: 'Cicilan' },
                      { value: 'jadwal', label: 'Jadwal' },
                    ]}
                  />

                  {tab === 'isi' && (
                    <div className="space-y-2.5">
                      {gi.length === 0 && <p className="text-xs text-[color:var(--text-muted)]">Belum ada cicilan.</p>}
                      {gi.length > 0 && (
                        <div className="rounded-2xl divide-y divide-black/[0.07] dark:divide-white/10 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10 overflow-hidden">
                          {gi.map((i) => {
                            const no = installmentNo(i, gm);
                            const status = no ? `${no}/${i.tenor}` : gm < i.start_month ? `mulai ${monthShort(i.start_month)}` : 'selesai';
                            const rate = Number(i.rate_pct) > 0 ? ` · ${Number(i.rate_pct)}%/bln` : '';
                            return (
                              <div key={i.id} className="flex items-center gap-2 pl-3.5 pr-2 py-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>{i.name}</p>
                                  <p className="text-[11px] text-[color:var(--text-muted)]">{status} · {i.tenor} bln{rate}</p>
                                </div>
                                <p className="text-sm font-extrabold shrink-0" style={{ color: 'var(--text-main)' }}>{formatRupiah(Number(i.monthly_amount))}</p>
                                <button type="button" aria-label={`Ubah ${i.name}`} onClick={() => setItemForm({ groupId: g.id, item: i })} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[color:var(--text-muted)] active:scale-90"><Pencil className="w-4 h-4" /></button>
                                <button type="button" aria-label={`Hapus ${i.name}`} onClick={() => remove('installments', i.id, 'Hapus Cicilan?', `${i.name} akan dihapus.`)} className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-red-500 active:scale-90"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <GlassButton variant="teal" size="sm" full className="border-dashed" onClick={() => setItemForm({ groupId: g.id, item: null })}>+ Cicilan</GlassButton>
                    </div>
                  )}

                  {tab === 'bayar' && (
                    <div className="space-y-3">
                      <div className="rounded-2xl divide-y divide-black/[0.07] dark:divide-white/10 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10 overflow-hidden">
                        {([
                          [`Tagihan ${monthLabel(gm)}`, formatRupiah(st.bill)],
                          ['Sudah dibayar', formatRupiah(st.paid)],
                          ['Sisa', formatRupiah(st.remaining)],
                          ['Jatuh tempo', formatDateID(dueDate)],
                          ...(st.minDue > 0 ? [['Pembayaran minimum', `${formatRupiah(st.minDue)}${st.remaining === 0 || !proj.belowMin ? ' (terpenuhi)' : ''}`]] : []),
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs">
                            <span className="text-[color:var(--text-muted)]">{k}</span>
                            <span className="font-bold" style={{ color: 'var(--text-main)' }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      <div className="glass glass-teal rounded-2xl px-3.5 py-3">
                        <p className="text-[11px] font-semibold">Tagihan {monthLabel(gNext)}</p>
                        <ProjectionLines p={proj} />
                        {!proj.hasPayment && st.remaining > 0 && (
                          <p className="text-[10px] mt-1.5">Belum ada pembayaran bulan ini, jadi angkanya murni cicilan baru. Bayar sebagian dan sisanya otomatis ikut.</p>
                        )}
                        {proj.belowMin && <p className="text-[11px] mt-1.5 font-bold">Pembayaran masih di bawah minimum: kena denda dan kolektibilitas bisa turun.</p>}
                      </div>

                      {st.remaining > 0 && <GlassButton variant="primary" size="md" full onClick={() => setPayForm({ group: g })}>Bayar</GlassButton>}

                      {thisMonthPays.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5 text-[color:var(--text-muted)]">Riwayat pembayaran</p>
                          <div className="space-y-1.5">
                            {thisMonthPays.map((p) => (
                              <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-[color:var(--text-muted)]">{formatDateID(p.paid_on)}</span>
                                <span className="font-bold ml-auto" style={{ color: 'var(--text-main)' }}>{formatRupiah(Number(p.amount))}</span>
                                <button type="button" className="text-[color:var(--text-muted)] underline" onClick={() => remove('installment_payments', p.id, 'Hapus Pembayaran?', `Pembayaran ${formatRupiah(Number(p.amount))} akan dihapus dari catatan cicilan. Transaksi pengeluarannya (kalau ada) tidak ikut terhapus.`)}>Hapus</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'jadwal' && (
                    <div>
                      {gi.length === 0 && <p className="text-xs text-[color:var(--text-muted)]">Belum ada cicilan.</p>}
                      {gi.length > 0 && (
                        <>
                          <div className="rounded-2xl divide-y divide-black/[0.07] dark:divide-white/10 bg-white/30 dark:bg-white/5 border border-white/40 dark:border-white/10 overflow-hidden">
                            {forecast(gi, gp, gm, 13).filter((m, i) => i === 0 || m.due > 0).map((m, i) => (
                              <div key={m.month} className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs">
                                <span className="text-[color:var(--text-muted)]">{monthLabel(m.month)}{i === 0 ? ' (sisa belum dibayar)' : ''}</span>
                                <span className="font-bold" style={{ color: 'var(--text-main)' }}>{formatRupiah(i === 0 ? st.remaining : m.due)}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] mt-1.5 text-[color:var(--text-muted)]">Bulan setelahnya = cicilan yang jatuh di bulan itu saja, belum termasuk sisa, bunga, atau belanja lain.{last ? ` Cicilan terakhir selesai ${monthLabel(last)}.` : ''}</p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <GlassButton variant="teal" size="sm" onClick={() => setGroupForm({ group: g })}>Ubah</GlassButton>
                    <GlassButton variant="danger" size="sm" onClick={() => remove('installment_groups', g.id, 'Hapus?', `${g.name} beserta semua cicilan dan riwayat pembayarannya akan dihapus.`)}>Hapus</GlassButton>
                  </div>
                </div>
              )}
            </GlassCard>
          );
        })}

        {tableOk && !openId && <GlassButton variant="teal" size="lg" full className="border-dashed" onClick={() => setGroupForm({ group: null })}>+ Tambah kartu / pinjaman</GlassButton>}
      </main>

      {groupForm && <GroupForm key={groupForm.group?.id || 'new'} group={groupForm.group} userId={userId} onClose={() => setGroupForm(null)} onSaved={load} showDialog={showDialog} />}
      {itemForm && <ItemForm key={itemForm.item?.id || 'new'} groupId={itemForm.groupId} item={itemForm.item} userId={userId} defaultMonth={cur} onClose={() => setItemForm(null)} onSaved={load} showDialog={showDialog} />}
      {payForm && <PayForm group={payForm.group} items={itemsOf(payForm.group.id)} payments={paysOf(payForm.group.id)} month={activeMonth(payForm.group, cur)} today={today} userId={userId} onClose={() => setPayForm(null)} onSaved={load} showDialog={showDialog} />}
      <BottomNav />
      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
    </div>
  );
}

/** Rincian perkiraan tagihan bulan berikutnya: satu baris per komponen, lalu total. */
function ProjectionLines({ p }: { p: NextProjection }) {
  const rows: [string, number, string?][] = [];
  if (p.remaining > 0) rows.push(['Sisa belum dibayar', p.remaining]);
  if (p.interest > 0) rows.push(['Bunga (perkiraan)', p.interest]);
  if (p.lateFee > 0) rows.push(['Denda keterlambatan', p.lateFee]);
  rows.push([`Cicilan baru ${monthShort(p.month)}`, p.newInstallments]);
  return (
    <div className="mt-2 text-xs">
      {rows.map(([label, amount]) => (
        <div key={label} className="flex items-center justify-between gap-3 py-1">
          <span className="flex items-center gap-2"><span aria-hidden="true">•</span>{label}</span>
          <span className="font-semibold">{formatRupiah(amount)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-current/20 text-sm font-extrabold">
        <span>Total</span>
        <span>{formatRupiah(p.total)}</span>
      </div>
    </div>
  );
}

const numStr = (v: number | string | null | undefined) => (v == null || Number(v) === 0 ? '' : String(Number(v)));
const toNum = (s: string) => Number(s.replace(',', '.')) || 0;

function GroupForm({ group, userId, onClose, onSaved, showDialog }: {
  group: InstGroup | null; userId: string; onClose: () => void; onSaved: () => void; showDialog: ShowDialog;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [kind, setKind] = useState<InstKind>(group?.kind ?? 'cc');
  const [dueDay, setDueDay] = useState(String(group?.due_day ?? ''));
  const [interest, setInterest] = useState(numStr(group?.interest_pct));
  const [minPct, setMinPct] = useState(numStr(group?.min_pct));
  const [minFloor, setMinFloor] = useState(Math.round(Number(group?.min_floor ?? 0)));
  const [minWithInst, setMinWithInst] = useState(!!group?.min_with_installments);
  const [feePct, setFeePct] = useState(numStr(group?.late_fee_pct));
  const [feeMin, setFeeMin] = useState(Math.round(Number(group?.late_fee_min ?? 0)));
  const [feeMax, setFeeMax] = useState(Math.round(Number(group?.late_fee_max ?? 0)));
  const [stmtMonth, setStmtMonth] = useState(group?.statement_month ?? '');
  const [stmtTotal, setStmtTotal] = useState(Math.round(Number(group?.statement_total ?? 0)));
  const [minPayment, setMinPayment] = useState(Math.round(Number(group?.min_payment ?? 0)));
  const [busy, setBusy] = useState(false);

  const applyPreset = (key: keyof typeof BANK_PRESETS) => {
    const r = BANK_PRESETS[key].rules;
    setInterest(numStr(r.interest_pct)); setMinPct(numStr(r.min_pct)); setMinFloor(Number(r.min_floor));
    setMinWithInst(!!r.min_with_installments); setFeePct(numStr(r.late_fee_pct));
    setFeeMin(Number(r.late_fee_min)); setFeeMax(Number(r.late_fee_max));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const day = Number(dueDay);
    if (!name.trim()) return showDialog('Data Belum Lengkap', 'Isi namanya dulu.', 'danger');
    if (!Number.isInteger(day) || day < 1 || day > 31) return showDialog('Tanggal Tidak Valid', 'Tanggal jatuh tempo harus 1 sampai 31.', 'danger');
    if (stmtTotal > 0 && !/^\d{4}-(0[1-9]|1[0-2])$/.test(stmtMonth)) return showDialog('Bulan Lembar Tagihan', 'Pilih bulan jatuh tempo lembar tagihan itu.', 'danger');
    setBusy(true);
    const payload = {
      name: name.trim().slice(0, 60), kind, due_day: day,
      interest_pct: toNum(interest), min_pct: toNum(minPct), min_floor: minFloor, min_with_installments: minWithInst,
      late_fee_pct: toNum(feePct), late_fee_min: feeMin, late_fee_max: feeMax,
      statement_month: stmtTotal > 0 ? stmtMonth : null, statement_total: stmtTotal > 0 ? stmtTotal : null, min_payment: minPayment > 0 ? minPayment : null,
    };
    const { error } = group
      ? await supabase.from('installment_groups').update(payload).eq('id', group.id)
      : await supabase.from('installment_groups').insert({ user_id: userId, ...payload });
    setBusy(false);
    if (error) return showDialog('Gagal', error.message, 'danger');
    onSaved();
    onClose();
  };

  return (
    <form onSubmit={save}>
      <Sheet title={group ? 'Ubah' : 'Tambah Kartu / Pinjaman'} onClose={onClose}
        footer={<GlassButton type="submit" variant="primary" size="lg" full disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</GlassButton>}>
        <div>
          <label className={labelCls}>Nama</label>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Jenis</label>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`py-2 rounded-full text-xs font-bold ${kind === k ? chipOn : chipOff}`}>{KIND_LABEL[k]}</button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Tanggal jatuh tempo (1-31)</label>
          <input inputMode="numeric" value={dueDay} maxLength={2} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ''))} className={inputCls} />
        </div>

        <details className="glass rounded-2xl p-3.5">
          <summary className="text-xs font-bold cursor-pointer" style={{ color: 'var(--text-main)' }}>Isi dari tagihan bank (opsional)</summary>
          <div className="space-y-3 mt-3">
          <div>
            <label className={labelCls}>Total tagihan</label>
            <MoneyInput value={stmtTotal} onChange={setStmtTotal} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Jatuh tempo (bulan)</label>
              <input type="month" value={stmtMonth} onChange={(e) => setStmtMonth(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bayar minimum (Rp)</label>
              <MoneyInput value={minPayment} onChange={setMinPayment} />
            </div>
          </div>
          </div>
        </details>

        <details className="glass rounded-2xl p-3.5">
          <summary className="text-xs font-bold cursor-pointer" style={{ color: 'var(--text-main)' }}>Bunga dan denda (opsional)</summary>
          <div className="space-y-3 mt-3">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BANK_PRESETS) as (keyof typeof BANK_PRESETS)[]).map((k) => (
                <button key={k} type="button" onClick={() => applyPreset(k)} className={`px-3 py-1.5 rounded-full text-xs font-bold ${chipOff}`}>{BANK_PRESETS[k].label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bunga/bulan (%)</label>
                <input inputMode="decimal" value={interest} maxLength={5} onChange={(e) => setInterest(e.target.value.replace(/[^0-9.,]/g, ''))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Minimum bayar (%)</label>
                <input inputMode="decimal" value={minPct} maxLength={5} onChange={(e) => setMinPct(e.target.value.replace(/[^0-9.,]/g, ''))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Minimum terendah</label>
              <MoneyInput value={minFloor} onChange={setMinFloor} />
            </div>
            <label className="flex items-center gap-2 text-xs text-[color:var(--text-main)]">
              <input type="checkbox" checked={minWithInst} onChange={(e) => setMinWithInst(e.target.checked)} />
              Minimum = cicilan + persen sisa (gaya BCA)
            </label>
            <div>
              <label className={labelCls}>Denda telat (%)</label>
              <input inputMode="decimal" value={feePct} maxLength={5} onChange={(e) => setFeePct(e.target.value.replace(/[^0-9.,]/g, ''))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Denda terendah</label>
                <MoneyInput value={feeMin} onChange={setFeeMin} />
              </div>
              <div>
                <label className={labelCls}>Denda tertinggi</label>
                <MoneyInput value={feeMax} onChange={setFeeMax} />
              </div>
            </div>
          </div>
        </details>
      </Sheet>
    </form>
  );
}

function ItemForm({ groupId, item, userId, defaultMonth, onClose, onSaved, showDialog }: {
  groupId: string; item: InstItem | null; userId: string; defaultMonth: string; onClose: () => void; onSaved: () => void; showDialog: ShowDialog;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [principal, setPrincipal] = useState(Math.round(Number(item?.principal ?? 0)));
  const [tenor, setTenor] = useState(String(item?.tenor ?? ''));
  const [rate, setRate] = useState(item ? String(Number(item.rate_pct)) : '0');
  const [monthly, setMonthly] = useState(Math.round(Number(item?.monthly_amount ?? 0)));
  // Selama cicilan per bulan belum diubah manual, ia ikut dihitung dari harga, tenor, dan bunga
  const [manual, setManual] = useState(!!item && Number(item.principal) === 0);
  const [startMonth, setStartMonth] = useState(item?.start_month ?? defaultMonth);
  const [note, setNote] = useState(item?.note ?? '');
  const [busy, setBusy] = useState(false);

  const recalc = (p: number, t: string, r: string) => {
    if (manual) return;
    setMonthly(calcMonthly(p, Number(t) || 0, Number(r.replace(',', '.')) || 0));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const t = Number(tenor);
    if (!name.trim()) return showDialog('Data Belum Lengkap', 'Isi nama barang atau cicilannya.', 'danger');
    if (!Number.isInteger(t) || t < 1 || t > 360) return showDialog('Tenor Tidak Valid', 'Tenor adalah jumlah bulan, 1 sampai 360.', 'danger');
    if (monthly <= 0) return showDialog('Nominal Kosong', 'Isi harga dan tenor, atau isi cicilan per bulan langsung.', 'danger');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) return showDialog('Bulan Pertama', 'Pilih bulan cicilan pertama.', 'danger');
    setBusy(true);
    const payload = {
      name: name.trim().slice(0, 60), principal, rate_pct: Number(rate.replace(',', '.')) || 0, tenor: t,
      monthly_amount: monthly, start_month: startMonth, note: note.trim() || null,
      // Cicilan yang sudah berjalan: yang lewat sebelum hari ini dianggap sudah dibayar
      track_from: item?.track_from && item.track_from > startMonth ? item.track_from : defaultTrackFrom(startMonth, defaultMonth),
    };
    const { error } = item
      ? await supabase.from('installments').update(payload).eq('id', item.id)
      : await supabase.from('installments').insert({ user_id: userId, group_id: groupId, ...payload });
    setBusy(false);
    if (error) return showDialog('Gagal', error.message, 'danger');
    onSaved();
    onClose();
  };

  return (
    <form onSubmit={save}>
      <Sheet title={item ? 'Ubah Cicilan' : 'Tambah Cicilan'} onClose={onClose}
        footer={<GlassButton type="submit" variant="primary" size="lg" full disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</GlassButton>}>
        <div>
          <label className={labelCls}>Cicilan apa</label>
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Harga</label>
          <MoneyInput value={principal} onChange={(n) => { setPrincipal(n); recalc(n, tenor, rate); }} />
        </div>
        <div>
          <label className={labelCls}>Berapa bulan</label>
          <input inputMode="numeric" value={tenor} maxLength={3} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setTenor(v); recalc(principal, v, rate); }} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Per bulan</label>
          <MoneyInput value={monthly} onChange={(n) => { setMonthly(n); setManual(true); }} />
          {manual && <button type="button" className="text-[10px] mt-1 underline text-[color:var(--text-muted)]" onClick={() => { setManual(false); setMonthly(calcMonthly(principal, Number(tenor) || 0, Number(rate.replace(',', '.')) || 0)); }}>Hitung otomatis</button>}
        </div>
        <details className="glass rounded-2xl p-3.5">
          <summary className="text-xs font-bold cursor-pointer" style={{ color: 'var(--text-main)' }}>Bunga, bulan mulai, catatan</summary>
          <div className="space-y-3 mt-3">
            <div>
              <label className={labelCls}>Bunga flat/bulan (%)</label>
              <input inputMode="decimal" value={rate} maxLength={5} onChange={(e) => { const v = e.target.value.replace(/[^0-9.,]/g, ''); setRate(v); recalc(principal, tenor, v); }} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mulai bulan</label>
              <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Catatan</label>
              <input value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} className={inputCls} />
            </div>
          </div>
        </details>
      </Sheet>
    </form>
  );
}

function PayForm({ group, items, payments, month, today, userId, onClose, onSaved, showDialog }: {
  group: InstGroup; items: InstItem[]; payments: InstPayment[]; month: string; today: string; userId: string; onClose: () => void; onSaved: () => void; showDialog: ShowDialog;
}) {
  const st = groupStatus(group, items, payments, month);
  const payable = Math.round(st.remaining);
  const [amount, setAmount] = useState(payable);
  const [paidOn, setPaidOn] = useState(today);
  const [asExpense, setAsExpense] = useState(true);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (amount <= 0) return showDialog('Nominal Kosong', 'Isi jumlah yang kamu bayar.', 'danger');
    if (!paidOn) return showDialog('Tanggal Kosong', 'Pilih tanggal bayar.', 'danger');
    setBusy(true);
    const { error } = await supabase.from('installment_payments').insert({ user_id: userId, group_id: group.id, month, amount, paid_on: paidOn });
    if (error) { setBusy(false); return showDialog('Gagal', error.message, 'danger'); }
    if (asExpense) {
      const { error: txErr } = await supabase.from('transactions').insert({
        user_id: userId, merchant_name: group.name, amount, type: 'expense',
        transaction_date: paidOn, is_routine: false, is_ai_scanned: false, notes: `Cicilan ${monthLabel(month)}`,
      });
      if (txErr) showDialog('Pembayaran Tersimpan', `Tapi gagal dicatat sebagai pengeluaran: ${txErr.message}`, 'info');
    }
    setBusy(false);
    triggerMoneyRain('expense', amount);
    onSaved();
    onClose();
  };

  const proj = projectNext(group, items, payments, month, amount);
  return (
    <form onSubmit={save}>
      <Sheet title={`Bayar ${group.name}`} onClose={onClose}
        footer={<GlassButton type="submit" variant="primary" size="lg" full disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</GlassButton>}>
        <div className="glass rounded-2xl px-3.5 py-3">
          <p className="text-[11px] text-[color:var(--text-muted)]">Sisa tagihan {monthLabel(month)}</p>
          <p className="text-lg font-extrabold" style={{ color: 'var(--text-main)' }}>{formatRupiah(payable)}</p>
        </div>
        <div>
          <label className={labelCls}>Bayar berapa</label>
          <MoneyInput value={amount} onChange={setAmount} />
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setAmount(Math.round(payable))} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${chipOff}`}>Lunas</button>
            <button type="button" onClick={() => setAmount(Math.round(payable / 2))} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${chipOff}`}>Setengah</button>
            {st.minDue > 0 && (
              <button type="button" onClick={() => setAmount(Math.min(payable, st.minDue))} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${chipOff}`}>Minimum {formatRupiah(st.minDue)}</button>
            )}
          </div>
        </div>
        <div className="glass glass-teal rounded-2xl px-3.5 py-3">
          <p className="text-[11px] font-semibold">Kalau kamu bayar {formatRupiah(amount)}, perkiraan {monthLabel(proj.month)}</p>
          <ProjectionLines p={proj} />
          {proj.belowMin && <p className="text-[11px] mt-1.5 font-bold">Di bawah minimum {formatRupiah(proj.minDue)}: kena denda dan kolektibilitas bisa turun.</p>}
        </div>
        <div>
          <label className={labelCls}>Tanggal bayar</label>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-xs text-[color:var(--text-main)]">
          <input type="checkbox" checked={asExpense} onChange={(e) => setAsExpense(e.target.checked)} />
          Catat sebagai pengeluaran
        </label>
      </Sheet>
    </form>
  );
}
