'use client';
import { useState } from 'react';
import { X, Plus, Save } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, parseRupiahInput, toLocalDateStr } from '@/lib/utils';
import { splitEqual } from '@/lib/splitbill';
import type { AdjMode } from '@/lib/splitReceipt';
import type { SplitExpense, SplitMember } from '@/lib/splitTypes';
import type { ParsedReceipt } from '@/lib/receiptParser';
import { Adj, Calc, Catatan, calcCatatan, computeFor, fromExpense, fromScan, isBlank, newCatatan, newItem, totalOf } from '@/lib/bayarin';
import DateField from '@/components/DateField';
import ReceiptScanner from '@/components/ReceiptScanner';
import GlassButton from '@/components/GlassButton';

type ShowDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: SplitMember[];
  currentUserId: string;
  onSaved: () => void;
  showDialog: ShowDialog;
  /** Diisi bila dipakai untuk mengubah catatan yang sudah ada */
  editing?: SplitExpense | null;
}

const inputCls = 'glass w-full min-w-0 h-11 px-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[color:var(--teal-primary)] text-[color:var(--text-main)]';
const labelCls = 'block text-xs font-medium mb-1 text-[color:var(--text-muted)]';
const chipOn = 'glass glass-teal';
const chipOff = 'glass text-[color:var(--text-muted)]';

function AdjRow({ label, adj, onChange }: { label: string; adj: Adj; onChange: (a: Adj) => void }) {
  const setValue = (text: string) => {
    if (adj.mode === 'percent') {
      const cleaned = text.replace(',', '.').replace(/[^\d.]/g, '');
      const num = Math.min(100, Number(cleaned) || 0);
      onChange({ ...adj, raw: num, display: cleaned === '' ? '' : String(num === Number(cleaned) ? cleaned : num) });
    } else {
      const p = parseRupiahInput(text);
      onChange({ ...adj, raw: p.raw, display: p.display });
    }
  };
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <div className="flex shrink-0 rounded-xl overflow-hidden h-11">
          {(['percent', 'nominal'] as AdjMode[]).map((m) => (
            <button key={m} type="button" onClick={() => onChange({ mode: m, display: '', raw: 0 })} className={`px-3 text-xs font-bold ${adj.mode === m ? chipOn : chipOff}`}>{m === 'percent' ? '%' : 'Rp'}</button>
          ))}
        </div>
        <input inputMode={adj.mode === 'percent' ? 'decimal' : 'numeric'} value={adj.display} onChange={(e) => setValue(e.target.value)} placeholder="0" className={`${inputCls} flex-1`} />
      </div>
    </div>
  );
}

interface CardProps {
  c: Catatan;
  index: number;
  count: number;
  members: SplitMember[];
  currentUserId: string;
  update: (fn: (c: Catatan) => Catatan) => void;
  onRemove: () => void;
}

function CatatanCard({ c, index, count, members, currentUserId, update, onRemove }: CardProps) {
  const memberIds = members.map((m) => m.id);
  const set = (patch: Partial<Catatan>) => update((x) => ({ ...x, ...patch }));
  const setItem = (key: string, patch: Partial<Catatan['items'][number]>) => update((x) => ({ ...x, items: x.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
  const toggleMember = (key: string, id: string) => update((x) => ({ ...x, items: x.items.map((it) => it.key === key ? { ...it, memberIds: it.memberIds.includes(id) ? it.memberIds.filter((m) => m !== id) : [...it.memberIds, id] } : it) }));
  const toggleAll = (key: string) => update((x) => ({ ...x, items: x.items.map((it) => it.key === key ? { ...it, memberIds: it.memberIds.length === memberIds.length ? [] : [...memberIds] } : it) }));
  const nameLabel = (m: SplitMember) => `${m.name}${m.user_id === currentUserId ? ' (kamu)' : ''}`;

  const result = computeFor(c, memberIds);
  const participants = members.filter((m) => result.perMember[m.id]?.itemsTotal > 0);
  const adjusted = result.discount > 0 || result.service > 0 || result.tax > 0;
  const scanDiff = c.scan && c.scan.receiptTotal !== null ? result.total - c.scan.receiptTotal : null;
  const scanMatch = scanDiff !== null && Math.abs(scanDiff) <= 100;

  return (
    <section className="glass rounded-3xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[color:var(--text-main)]">
          Catatan {index + 1}
          {c.source === 'struk' && <span className="glass glass-teal ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold align-middle">Dari struk</span>}
        </p>
        {count > 1 && <GlassButton type="button" variant="danger" size="sm" onClick={onRemove}>Hapus</GlassButton>}
      </div>

      {/* Info catatan */}
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Toko / tempat (opsional)</label>
          <input value={c.store} maxLength={80} onChange={(e) => set({ store: e.target.value })} placeholder="Cth: Alfamart, Warung Bu Tini" className={inputCls} />
        </div>
        <DateField label="Tanggal" value={c.date} onChange={(v) => set({ date: v })} />
        <div>
          <label className={labelCls}>Dibayar oleh</label>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m) => (
              <button type="button" key={m.id} onClick={() => set({ paidBy: m.id })} className={`px-3 py-1.5 rounded-full text-[11px] font-bold max-w-full truncate ${c.paidBy === m.id ? chipOn : chipOff}`}>{nameLabel(m)}</button>
            ))}
          </div>
        </div>
      </div>

      {c.split === 'items' ? (
        <>
          {c.scan && c.scan.count > 0 && (
            <div className={`glass rounded-2xl px-3 py-2.5 text-[11px] leading-snug ${scanDiff === null || scanMatch ? 'glass-teal' : ''}`}>
              <p className="font-bold">{c.scan.count} barang terbaca. Periksa lagi, lalu pilih siapa memakai apa.</p>
              {c.scan.receiptTotal !== null && (
                <p className="mt-0.5 text-[color:var(--text-muted)]">
                  Total di struk {formatRupiah(c.scan.receiptTotal)} · hitungan di sini {formatRupiah(result.total)}
                  {scanMatch ? (scanDiff === 0 ? ' · cocok' : ` · selisih ${formatRupiah(Math.abs(scanDiff as number))} (biasanya pembulatan)`) : ` · selisih ${formatRupiah(Math.abs(scanDiff as number))}. Ada barang, harga, atau pajak yang kemungkinan salah baca.`}
                </p>
              )}
              {c.scan.warnings.map((w, i) => <p key={i} className="mt-0.5 text-[color:var(--text-muted)]">{w}</p>)}
            </div>
          )}

          <div className="space-y-3">
            {c.items.map((it, idx) => {
              const qty = Math.max(1, parseInt(it.qtyText, 10) || 1);
              const line = it.priceRaw * qty;
              const allOn = it.memberIds.length === memberIds.length;
              const unassigned = it.memberIds.length === 0 && (it.name || it.priceRaw);
              return (
                <div key={it.key} className={`rounded-2xl p-3 space-y-2.5 border ${unassigned ? 'border-yellow-400/70 bg-yellow-400/10' : 'border-black/[0.07] dark:border-white/10 bg-white/20 dark:bg-white/5'}`}>
                  <div className="flex gap-2">
                    <input value={it.name} onChange={(e) => setItem(it.key, { name: e.target.value })} placeholder={`Barang ${idx + 1} (cth: Galon)`} className={`${inputCls} flex-1`} />
                    {c.items.length > 1 && <GlassButton type="button" variant="danger" size="md" className="h-11 shrink-0" onClick={() => update((x) => ({ ...x, items: x.items.filter((i) => i.key !== it.key) }))}>Hapus</GlassButton>}
                  </div>
                  <div className="flex gap-2">
                    <div className="w-20 shrink-0">
                      <label className="block text-[10px] mb-0.5 text-[color:var(--text-muted)]">Jumlah</label>
                      <input inputMode="numeric" value={it.qtyText} onChange={(e) => setItem(it.key, { qtyText: e.target.value.replace(/\D/g, '').slice(0, 3) })} className={`${inputCls} text-center`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] mb-0.5 text-[color:var(--text-muted)]">Harga satuan (Rp)</label>
                      <input inputMode="numeric" value={it.priceDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); setItem(it.key, { priceRaw: p.raw, priceDisplay: p.display }); }} placeholder="0" className={`${inputCls} font-bold`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] mb-1 text-[color:var(--text-muted)]">Dipakai oleh:</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => toggleAll(it.key)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${allOn ? chipOn : chipOff}`}>Semua</button>
                      {members.map((m) => {
                        const on = it.memberIds.includes(m.id);
                        return <button type="button" key={m.id} onClick={() => toggleMember(it.key, m.id)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold max-w-[120px] truncate ${on ? chipOn : chipOff}`}>{on ? '✓ ' : ''}{m.name}</button>;
                      })}
                    </div>
                  </div>
                  {line > 0 && (
                    <p className="text-[11px] text-right text-[color:var(--text-muted)]">
                      {qty > 1 ? `${qty} x ${formatRupiah(it.priceRaw)} = ` : ''}<strong className="text-[color:var(--text-main)]">{formatRupiah(line)}</strong>
                      {it.memberIds.length > 1 ? ` · ±${formatRupiah(Math.round(line / it.memberIds.length))}/orang` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <GlassButton type="button" variant="teal" size="lg" className="flex-1 border-dashed" onClick={() => update((x) => ({ ...x, items: [...x.items, newItem()] }))}><Plus className="w-4 h-4" /> Tambah barang</GlassButton>
            {c.items.length > 1 && <GlassButton type="button" size="lg" className="shrink-0" onClick={() => update((x) => ({ ...x, items: x.items.map((it) => ({ ...it, memberIds: [...memberIds] })) }))}>Bagi rata semua</GlassButton>}
          </div>

          {/* Diskon, service, pajak (terlipat) */}
          {c.adjOpen ? (
            <div className="space-y-3">
              <p className="text-[10px] leading-snug text-[color:var(--text-muted)]">Isi seperti di struk (boleh % atau Rp). Dihitung berurutan: diskon, service, pajak. Dibagi sesuai jumlah pesanan masing-masing orang.</p>
              <AdjRow label="Diskon" adj={c.discount} onChange={(a) => set({ discount: a })} />
              <AdjRow label="Service charge" adj={c.service} onChange={(a) => set({ service: a })} />
              <AdjRow label="Pajak (PB1/PPN)" adj={c.tax} onChange={(a) => set({ tax: a })} />
            </div>
          ) : (
            <button type="button" onClick={() => set({ adjOpen: true })} className="text-xs font-bold underline underline-offset-2 text-[color:var(--teal-primary)]">+ Diskon, service, atau pajak</button>
          )}

          {/* Hasil */}
          <div className="glass glass-teal rounded-2xl p-3 text-xs space-y-1">
            {adjusted && <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(result.subtotal)}</span></div>}
            {result.discount > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{formatRupiah(result.discount)}</span></div>}
            {result.service > 0 && <div className="flex justify-between"><span>Service</span><span>+{formatRupiah(result.service)}</span></div>}
            {result.tax > 0 && <div className="flex justify-between"><span>Pajak</span><span>+{formatRupiah(result.tax)}</span></div>}
            <div className="flex justify-between text-sm font-bold"><span>Total catatan</span><span>{formatRupiah(result.total)}</span></div>
            {participants.length > 0 && (
              <div className="pt-1.5 mt-1 border-t border-current/20 space-y-0.5">
                {participants.map((m) => <div key={m.id} className="flex justify-between gap-2"><span className="truncate">{m.name}</span><span className="shrink-0 font-bold">{formatRupiah(result.perMember[m.id].total)}</span></div>)}
              </div>
            )}
          </div>
          {result.unassigned.length > 0 && <p className="text-[11px] font-bold text-yellow-700 dark:text-yellow-400">{result.unassigned.length} barang belum dipilih pemakainya (kotak kuning).</p>}

          {c.items.length === 1 && (
            <button type="button" onClick={() => update((x) => ({ ...x, split: 'nominal', nName: x.items[0].name, nTotal: x.items[0].priceRaw * Math.max(1, parseInt(x.items[0].qtyText, 10) || 1), nTotalDisplay: x.items[0].priceRaw ? parseRupiahInput(String(x.items[0].priceRaw * Math.max(1, parseInt(x.items[0].qtyText, 10) || 1))).display : '' }))} className="block text-[11px] font-bold underline underline-offset-2 text-[color:var(--text-muted)]">Bagi nominal per orang (tanpa rincian barang)</button>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div><label className={labelCls}>Nama barang</label><input value={c.nName} onChange={(e) => set({ nName: e.target.value })} placeholder="Cth: Galon, bensin, headset" className={inputCls} /></div>
          <div><label className={labelCls}>Total tagihan (Rp)</label><input inputMode="numeric" value={c.nTotalDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); set({ nTotal: p.raw, nTotalDisplay: p.display }); }} placeholder="0" className={`${inputCls} font-bold`} /></div>
          <div className="flex gap-2">
            <button type="button" onClick={() => set({ nMode: 'equal' })} className={`flex-1 py-2 rounded-full text-xs font-bold ${c.nMode === 'equal' ? chipOn : chipOff}`}>Bagi rata</button>
            <button type="button" onClick={() => set({ nMode: 'custom' })} className={`flex-1 py-2 rounded-full text-xs font-bold ${c.nMode === 'custom' ? chipOn : chipOff}`}>Atur sendiri</button>
          </div>
          {members.length > 1 && (
            <div>
              <label className={labelCls}>Untuk siapa</label>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => { const all: Record<string, boolean> = {}; members.forEach((m) => { all[m.id] = true; }); set({ nSelected: all, nMode: 'equal' }); }} className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${members.every((m) => c.nSelected[m.id]) ? chipOn : chipOff}`}>Semua (patungan)</button>
                {members.map((m) => {
                  const only = members.every((x) => !!c.nSelected[x.id] === (x.id === m.id));
                  return <button type="button" key={m.id} onClick={() => { const one: Record<string, boolean> = {}; members.forEach((x) => { one[x.id] = x.id === m.id; }); set({ nSelected: one, nMode: 'equal' }); }} className={`px-3 py-1.5 rounded-full text-[11px] font-bold max-w-full truncate ${only ? chipOn : chipOff}`}>{nameLabel(m)}</button>;
                })}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {members.map((m) => {
              const on = !!c.nSelected[m.id];
              const ids = members.filter((x) => c.nSelected[x.id]).map((x) => x.id);
              const eq = c.nMode === 'equal' && on && c.nTotal > 0 ? splitEqual(c.nTotal, ids)[m.id] : 0;
              return (
                <div key={m.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => set({ nSelected: { ...c.nSelected, [m.id]: !c.nSelected[m.id] } })} className={`flex-1 min-w-0 text-left px-3 h-10 rounded-full text-xs font-bold truncate ${on ? chipOn : chipOff}`}>{on ? '✓ ' : ''}{m.name}</button>
                  {c.nMode === 'equal' ? (
                    <span className="w-28 text-right text-[11px] font-bold shrink-0 text-[color:var(--text-muted)]">{on && c.nTotal > 0 ? formatRupiah(eq) : '-'}</span>
                  ) : (
                    <input inputMode="numeric" disabled={!on} value={c.nCustom[m.id] ? new Intl.NumberFormat('id-ID').format(c.nCustom[m.id]) : ''} onChange={(e) => set({ nCustom: { ...c.nCustom, [m.id]: parseRupiahInput(e.target.value).raw } })} placeholder="Rp" className="glass w-28 shrink-0 h-10 px-2 rounded-xl text-xs text-right outline-none text-[color:var(--text-main)] disabled:opacity-40" />
                  )}
                </div>
              );
            })}
          </div>
          {c.nMode === 'custom' && <p className="text-[10px] text-right text-[color:var(--text-muted)]">Terisi {formatRupiah(members.filter((m) => c.nSelected[m.id]).reduce((s, m) => s + (c.nCustom[m.id] || 0), 0))} dari {formatRupiah(c.nTotal)}</p>}
          <button type="button" onClick={() => set({ split: 'items', items: [{ ...newItem([...memberIds]), name: c.nName, priceRaw: c.nTotal, priceDisplay: c.nTotalDisplay }] })} className="block text-[11px] font-bold underline underline-offset-2 text-[color:var(--text-muted)]">Kembali ke rincian barang</button>
        </div>
      )}

      <div>
        <label className={labelCls}>Catatan (opsional)</label>
        <input value={c.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} placeholder="Cth: belanja bulanan, dibayar pakai OVO" className={inputCls} />
      </div>
    </section>
  );
}

// Form dipasang ulang tiap kali dibuka supaya isiannya selalu mulai bersih (tanpa effect reset).
function BayarinForm({ onClose, groupId, members, currentUserId, onSaved, showDialog, editing }: Omit<Props, 'isOpen'>) {
  const memberIds = members.map((m) => m.id);
  const mine = members.find((m) => m.user_id === currentUserId) || members[0];
  const today = toLocalDateStr(new Date());
  const [list, setList] = useState<Catatan[]>(() => (editing ? [fromExpense(editing, members)] : [newCatatan({ date: today, paidBy: mine?.id || '', memberIds })]));
  const [saving, setSaving] = useState(false);

  const update = (key: string, fn: (c: Catatan) => Catatan) => setList((p) => p.map((c) => (c.key === key ? fn(c) : c)));

  const addManual = () => setList((p) => {
    const last = p[p.length - 1];
    return [...p, newCatatan({ date: last?.date || today, paidBy: last?.paidBy || mine?.id || '', memberIds })];
  });

  // Tiap struk yang terbaca menjadi catatan baru (tidak menimpa catatan lain)
  const onScan = (r: ParsedReceipt) => {
    if (r.items.length === 0) return showDialog('Struk Belum Terbaca', r.warnings[0] || 'Tidak ada barang yang terbaca. Isi manual saja, atau foto ulang.', 'info');
    setList((p) => {
      const last = p[p.length - 1];
      const c = fromScan(r, { date: last?.date || today, paidBy: last?.paidBy || mine?.id || '', memberIds });
      if (p.length === 1 && isBlank(p[0])) return [{ ...c, paidBy: p[0].paidBy }];
      return [...p, c];
    });
  };

  const friendly = (msg: string) => (/store_name|'note'|"note"|column.*note/i.test(msg)
    ? 'Kolom Toko dan Catatan belum ada di database. Jalankan sql/06_catatan_toko.sql di Supabase SQL Editor, atau kosongkan dua isian itu.'
    : msg);

  // Simpan satu catatan: baris pengeluaran, barang, pemakai, lalu bagian tiap orang. Gagal di tengah = dibatalkan.
  const persist = async (c: Catatan, calc: Calc): Promise<{ ok: true; id: string } | { ok: false; msg: string }> => {
    const payload: Record<string, unknown> = {
      group_id: groupId, title: calc.title, total_amount: calc.total, paid_by: c.paidBy, expense_date: c.date, split_type: calc.splitType,
      created_by: currentUserId, subtotal: calc.subtotal, discount_amount: calc.discount, service_amount: calc.service, tax_amount: calc.tax,
    };
    if (c.store.trim()) payload.store_name = c.store.trim().slice(0, 80);
    if (c.note.trim()) payload.note = c.note.trim().slice(0, 300);
    const { data: exp, error } = await supabase.from('split_expenses').insert(payload).select().single();
    if (error || !exp) return { ok: false, msg: friendly(error?.message || 'Catatan gagal disimpan.') };

    const rollback = async (msg: string) => {
      await supabase.from('split_expenses').delete().eq('id', exp.id);
      return { ok: false as const, msg };
    };

    if (calc.splitType === 'items') {
      const { data: rows, error: iErr } = await supabase.from('split_expense_items').insert(
        calc.items.map((it, idx) => ({ expense_id: exp.id, name: it.name, price: it.price, qty: it.qty, position: idx })),
      ).select('id, position');
      if (iErr || !rows) return rollback(iErr?.message || 'Barang gagal disimpan.');
      const byPos = new Map<number, string>((rows as { id: string; position: number }[]).map((r) => [r.position, r.id]));
      const assignees = calc.items.flatMap((it, idx) => it.memberIds.map((mid) => ({ item_id: byPos.get(idx) as string, member_id: mid })));
      const { error: aErr } = await supabase.from('split_item_assignees').insert(assignees);
      if (aErr) return rollback(aErr.message);
    }
    const { error: sErr } = await supabase.from('split_shares').insert(Object.entries(calc.shares).filter(([, v]) => v > 0).map(([member_id, share_amount]) => ({ expense_id: exp.id, member_id, share_amount })));
    if (sErr) return rollback(sErr.message);
    return { ok: true, id: exp.id as string };
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    // 1) Periksa semua catatan dulu; tidak ada yang disimpan kalau masih ada yang kurang
    const ready: { c: Catatan; calc: Calc }[] = [];
    for (let i = 0; i < list.length; i++) {
      const r = calcCatatan(list[i], members);
      if ('error' in r) return showDialog(list.length > 1 ? `Catatan ${i + 1}: ${r.error.title}` : r.error.title, r.error.msg, 'danger');
      ready.push({ c: list[i], calc: r.ok });
    }

    // 2) Simpan berurutan
    setSaving(true);
    let savedAny = false;
    for (const { c, calc } of ready) {
      const res = await persist(c, calc);
      if (!res.ok) {
        setSaving(false);
        if (savedAny) onSaved();
        return showDialog('Gagal', res.msg + (savedAny ? ' Catatan sebelumnya sudah tersimpan, sisanya masih ada di form ini.' : ''), 'danger');
      }
      // Mengubah = simpan versi baru dulu, baru hapus yang lama (kalau gagal, data lama tetap utuh)
      if (editing) {
        const { error: dErr } = await supabase.from('split_expenses').delete().eq('id', editing.id);
        if (dErr) {
          await supabase.from('split_expenses').delete().eq('id', res.id);
          setSaving(false);
          return showDialog('Gagal', `Perubahan tidak bisa disimpan (${dErr.message}). Catatan lama tidak berubah.`, 'danger');
        }
      }
      savedAny = true;
      setList((p) => p.filter((x) => x.key !== c.key));
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const grandTotal = list.reduce((s, c) => s + totalOf(c, memberIds), 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="glass glass-sheet rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[94vh] flex flex-col transition-colors">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-[color:var(--text-main)]">{editing ? 'Ubah Catatan' : 'Catat Bayarin'}</h2>
          <button onClick={onClose} aria-label="Tutup" className="text-[color:var(--text-muted)]"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={save} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
            {list.map((c, i) => (
              <CatatanCard key={c.key} c={c} index={i} count={list.length} members={members} currentUserId={currentUserId}
                update={(fn) => update(c.key, fn)} onRemove={() => setList((p) => p.filter((x) => x.key !== c.key))} />
            ))}

            {!editing && (
              <div className="space-y-2">
                <GlassButton type="button" variant="teal" size="lg" full onClick={addManual}><Plus className="w-4 h-4" /> Catatan manual</GlassButton>
                <ReceiptScanner multiple onResult={onScan} showDialog={showDialog} />
              </div>
            )}
          </div>

          <div className="shrink-0 px-5 pt-3 pb-5 space-y-2 border-t border-black/[0.07] dark:border-white/10">
            {list.length > 1 && <p className="text-xs text-center text-[color:var(--text-muted)]">{list.length} catatan · total {formatRupiah(grandTotal)}</p>}
            <GlassButton type="submit" variant="primary" size="lg" full disabled={saving || list.length === 0}><Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : list.length > 1 ? `Simpan ${list.length} Catatan` : 'Simpan Catatan'}</GlassButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BayarinModal({ isOpen, onClose, groupId, members, currentUserId, onSaved, showDialog, editing }: Props) {
  if (!isOpen) return null;
  return <BayarinForm key={editing?.id || 'new'} onClose={onClose} groupId={groupId} members={members} currentUserId={currentUserId} onSaved={onSaved} showDialog={showDialog} editing={editing} />;
}
