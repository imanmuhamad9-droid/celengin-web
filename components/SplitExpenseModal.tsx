'use client';
import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Receipt, Calculator } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, parseRupiahInput, toLocalDateStr } from '@/lib/utils';
import { splitEqual } from '@/lib/splitbill';
import { AdjMode, ReceiptItem, computeReceipt } from '@/lib/splitReceipt';
import type { SplitMember } from '@/lib/splitTypes';
import DateField from '@/components/DateField';
import ReceiptScanner from '@/components/ReceiptScanner';
import type { ParsedAdj, ParsedReceipt } from '@/lib/receiptParser';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: SplitMember[];
  currentUserId: string;
  onSaved: () => void;
  showDialog: (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;
}

interface ItemDraft { key: string; name: string; priceDisplay: string; priceRaw: number; qtyText: string; memberIds: string[] }
interface AdjDraft { mode: AdjMode; display: string; raw: number }

const inputCls = 'w-full min-w-0 h-11 px-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500';
const labelCls = 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1';
let keySeq = 0;
const newItem = (): ItemDraft => ({ key: `i${++keySeq}`, name: '', priceDisplay: '', priceRaw: 0, qtyText: '1', memberIds: [] });
const emptyAdj = (mode: AdjMode): AdjDraft => ({ mode, display: '', raw: 0 });

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2 mb-2">
      <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</p>
        {hint && <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">{hint}</p>}
      </div>
    </div>
  );
}

function AdjRow({ label, adj, onChange }: { label: string; adj: AdjDraft; onChange: (a: AdjDraft) => void }) {
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
        <div className="flex shrink-0 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 h-11">
          {(['percent', 'nominal'] as AdjMode[]).map((m) => (
            <button key={m} type="button" onClick={() => onChange({ mode: m, display: '', raw: 0 })} className={`px-3 text-xs font-bold ${adj.mode === m ? 'bg-teal-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300'}`}>{m === 'percent' ? '%' : 'Rp'}</button>
          ))}
        </div>
        <input inputMode={adj.mode === 'percent' ? 'decimal' : 'numeric'} value={adj.display} onChange={(e) => setValue(e.target.value)} placeholder={adj.mode === 'percent' ? '0' : '0'} className={`${inputCls} flex-1`} />
      </div>
    </div>
  );
}

export default function SplitExpenseModal({ isOpen, onClose, groupId, members, currentUserId, onSaved, showDialog }: Props) {
  const [mode, setMode] = useState<'items' | 'quick'>('items');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [discount, setDiscount] = useState<AdjDraft>(emptyAdj('percent'));
  const [service, setService] = useState<AdjDraft>(emptyAdj('percent'));
  const [tax, setTax] = useState<AdjDraft>(emptyAdj('percent'));
  // Mode cepat
  const [qTotalDisplay, setQTotalDisplay] = useState('');
  const [qTotal, setQTotal] = useState(0);
  const [qSplit, setQSplit] = useState<'equal' | 'custom'>('equal');
  const [qSelected, setQSelected] = useState<Record<string, boolean>>({});
  const [qCustom, setQCustom] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  // Ringkasan hasil scan terakhir (untuk banner pencocokan total)
  const [scanInfo, setScanInfo] = useState<{ receiptTotal: number | null; count: number; warnings: string[]; dateFilled: boolean } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const mine = members.find((m) => m.user_id === currentUserId) || members[0];
    const sel: Record<string, boolean> = {};
    members.forEach((m) => { sel[m.id] = true; });
    setMode('items'); setTitle(''); setDate(toLocalDateStr(new Date())); setPaidBy(mine?.id || '');
    setItems([newItem()]);
    setDiscount(emptyAdj('percent')); setService(emptyAdj('percent')); setTax(emptyAdj('percent'));
    setQTotalDisplay(''); setQTotal(0); setQSplit('equal'); setQSelected(sel); setQCustom({});
    setSaving(false); setScanInfo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const memberIds = useMemo(() => members.map((m) => m.id), [members]);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name || '?';

  const receiptItems: ReceiptItem[] = items
    .filter((it) => it.name.trim() || it.priceRaw > 0)
    .map((it) => ({ key: it.key, name: it.name.trim() || 'Item', unitPrice: it.priceRaw, qty: Math.max(1, parseInt(it.qtyText, 10) || 1), memberIds: it.memberIds }));
  const result = useMemo(
    () => computeReceipt(receiptItems, { discount: discount.raw, discountMode: discount.mode, service: service.raw, serviceMode: service.mode, tax: tax.raw, taxMode: tax.mode }, memberIds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(receiptItems), discount, service, tax, memberIds],
  );

  if (!isOpen) return null;

  const updateItem = (key: string, patch: Partial<ItemDraft>) => setItems((p) => p.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const toggleMember = (key: string, id: string) => setItems((p) => p.map((it) => it.key === key ? { ...it, memberIds: it.memberIds.includes(id) ? it.memberIds.filter((x) => x !== id) : [...it.memberIds, id] } : it));
  const toggleAll = (key: string) => setItems((p) => p.map((it) => it.key === key ? { ...it, memberIds: it.memberIds.length === memberIds.length ? [] : [...memberIds] } : it));
  const assignAllItems = () => setItems((p) => p.map((it) => ({ ...it, memberIds: [...memberIds] })));

  // ---------- Hasil scan struk ----------
  const toAdjDraft = (a: ParsedAdj | null): AdjDraft => {
    if (!a) return emptyAdj('percent');
    if (a.amount > 0) { const p = parseRupiahInput(String(a.amount)); return { mode: 'nominal', display: p.display, raw: p.raw }; }
    if (a.percent) return { mode: 'percent', display: String(a.percent), raw: a.percent };
    return emptyAdj('percent');
  };
  const applyScan = (r: ParsedReceipt) => {
    const drafts: ItemDraft[] = r.items.map((it) => {
      const p = parseRupiahInput(String(it.unitPrice));
      return { key: `i${++keySeq}`, name: it.name, priceDisplay: p.display, priceRaw: p.raw, qtyText: String(it.qty), memberIds: [] };
    });
    setItems(drafts.length > 0 ? drafts : [newItem()]);
    setDiscount(toAdjDraft(r.discount));
    setService(toAdjDraft(r.service));
    setTax(toAdjDraft(r.tax));
    if (!title.trim() && r.merchant) setTitle(r.merchant);
    if (r.date) setDate(r.date);
    setScanInfo({ receiptTotal: r.total, count: r.items.length, warnings: r.warnings, dateFilled: !!r.date });
  };
  const handleScanResult = (r: ParsedReceipt) => {
    if (r.items.length === 0) {
      setScanInfo({ receiptTotal: r.total, count: 0, warnings: r.warnings, dateFilled: false });
      return showDialog('Struk Belum Terbaca', r.warnings[0] || 'Tidak ada item yang terbaca. Isi manual saja, atau foto ulang.', 'info');
    }
    const hasFilled = items.some((it) => it.name.trim() || it.priceRaw > 0);
    if (hasFilled) showDialog('Ganti Isi Struk?', 'Item, diskon, service, dan pajak yang sudah kamu isi akan diganti dengan hasil scan.', 'info', () => applyScan(r));
    else applyScan(r);
  };

  // ---------- Simpan ----------
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!title.trim()) return showDialog('Data Belum Lengkap', 'Isi keterangan, misalnya "Makan di Warung Bu Tini".', 'danger');
    if (!paidBy) return showDialog('Data Belum Lengkap', 'Pilih siapa yang membayar tagihan ini.', 'danger');

    let total = 0, subtotal = 0, discountAmt = 0, serviceAmt = 0, taxAmt = 0;
    let shares: Record<string, number> = {};
    let splitType: 'items' | 'equal' | 'custom' = 'items';
    const validItems = items.filter((it) => it.name.trim() || it.priceRaw > 0);

    if (mode === 'items') {
      if (validItems.length === 0) return showDialog('Belum Ada Pesanan', 'Tambahkan minimal satu item pesanan.', 'danger');
      const bad = validItems.find((it) => !it.name.trim() || it.priceRaw <= 0);
      if (bad) return showDialog('Item Belum Lengkap', 'Setiap item perlu nama dan harga.', 'danger');
      if (result.unassigned.length > 0) return showDialog('Pemilik Belum Dipilih', `${result.unassigned.length} item belum dipilih siapa yang memakainya.`, 'danger');
      total = result.total; subtotal = result.subtotal; discountAmt = result.discount; serviceAmt = result.service; taxAmt = result.tax;
      memberIds.forEach((id) => { if (result.perMember[id].total > 0) shares[id] = result.perMember[id].total; });
      if (total <= 0) return showDialog('Total Nol', 'Total tagihan harus lebih dari nol.', 'danger');
    } else {
      if (qTotal <= 0) return showDialog('Nominal Kosong', 'Isi total tagihan.', 'danger');
      const ids = members.filter((m) => qSelected[m.id]).map((m) => m.id);
      if (ids.length === 0) return showDialog('Data Belum Lengkap', 'Pilih minimal satu orang yang ikut menanggung.', 'danger');
      total = qTotal; subtotal = qTotal; splitType = qSplit;
      if (qSplit === 'equal') shares = splitEqual(qTotal, ids);
      else {
        ids.forEach((id) => { shares[id] = qCustom[id] || 0; });
        const sum = Object.values(shares).reduce((a, b) => a + b, 0);
        if (sum !== qTotal) {
          const diff = qTotal - sum;
          return showDialog('Pembagian Belum Pas', diff > 0 ? `Masih kurang ${formatRupiah(diff)} dari total tagihan.` : `Kelebihan ${formatRupiah(-diff)} dari total tagihan.`, 'danger');
        }
      }
    }

    setSaving(true);
    const { data: exp, error } = await supabase.from('split_expenses').insert({
      group_id: groupId, title: title.trim(), total_amount: total, paid_by: paidBy, expense_date: date, split_type: splitType,
      created_by: currentUserId, subtotal, discount_amount: discountAmt, service_amount: serviceAmt, tax_amount: taxAmt,
    }).select().single();
    if (error || !exp) { setSaving(false); return showDialog('Gagal', error?.message || 'Pengeluaran gagal disimpan.', 'danger'); }

    const rollback = async (msg: string) => {
      await supabase.from('split_expenses').delete().eq('id', exp.id);
      setSaving(false);
      showDialog('Gagal', msg, 'danger');
    };

    if (mode === 'items') {
      const { data: itemRows, error: iErr } = await supabase.from('split_expense_items').insert(
        validItems.map((it, idx) => ({ expense_id: exp.id, name: it.name.trim(), price: it.priceRaw, qty: Math.max(1, parseInt(it.qtyText, 10) || 1), position: idx })),
      ).select();
      if (iErr || !itemRows) return rollback(iErr?.message || 'Item gagal disimpan.');
      const byPos = new Map<number, string>(itemRows.map((r: any) => [r.position as number, r.id as string]));
      const assignees = validItems.flatMap((it, idx) => it.memberIds.map((mid) => ({ item_id: byPos.get(idx) as string, member_id: mid })));
      const { error: aErr } = await supabase.from('split_item_assignees').insert(assignees);
      if (aErr) return rollback(aErr.message);
    }
    const { error: sErr } = await supabase.from('split_shares').insert(Object.entries(shares).filter(([, v]) => v > 0).map(([member_id, share_amount]) => ({ expense_id: exp.id, member_id, share_amount })));
    if (sErr) return rollback(sErr.message);

    setSaving(false);
    onSaved();
    onClose();
  };

  const adjusted = result.discount > 0 || result.service > 0 || result.tax > 0;
  const participants = members.filter((m) => result.perMember[m.id]?.itemsTotal > 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[94vh] flex flex-col transition-colors">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Tambah Pengeluaran</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={save} className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
          {/* Mode */}
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
            <button type="button" onClick={() => setMode('items')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${mode === 'items' ? 'bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}><Receipt className="w-4 h-4" /> Struk per item</button>
            <button type="button" onClick={() => setMode('quick')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${mode === 'quick' ? 'bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}><Calculator className="w-4 h-4" /> Total saja</button>
          </div>

          {/* 1. Info */}
          <section>
            <StepTitle n={1} title="Info tagihan" />
            <div className="space-y-3">
              <div><label className={labelCls}>Keterangan</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cth: Makan malam di Warung Bu Tini" className={inputCls} /></div>
              <DateField label="Tanggal" value={date} onChange={setDate} />
              <div>
                <label className={labelCls}>Dibayar oleh</label>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <button type="button" key={m.id} onClick={() => setPaidBy(m.id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border-2 max-w-full truncate ${paidBy === m.id ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>{m.name}</button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {mode === 'items' ? (
            <>
              {/* 2. Pesanan */}
              <section>
                <StepTitle n={2} title="Isi struk" hint="Scan struknya, atau tulis tiap makanan/minuman sendiri. Lalu pilih siapa saja yang memakainya. Kalau dipakai bersama, harganya dibagi rata ke yang dipilih." />
                <div className="mb-3 space-y-2">
                  <ReceiptScanner onResult={handleScanResult} showDialog={showDialog} />
                  {scanInfo && scanInfo.count > 0 && (() => {
                    const diff = scanInfo.receiptTotal !== null ? result.total - scanInfo.receiptTotal : null;
                    const match = diff !== null && Math.abs(diff) <= 100;
                    return (
                      <div className={`rounded-xl px-3 py-2.5 text-[11px] leading-snug border ${diff === null || match ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300'}`}>
                        <p className="font-bold">{scanInfo.count} item terbaca{scanInfo.dateFilled ? ', tanggal ikut terisi' : ''}. Periksa lagi, lalu pilih siapa memakai apa.</p>
                        {scanInfo.receiptTotal !== null && (
                          <p className="mt-0.5">
                            Total di struk {formatRupiah(scanInfo.receiptTotal)} · hitungan di sini {formatRupiah(result.total)}
                            {match ? (diff === 0 ? ' · cocok ✓' : ` · selisih ${formatRupiah(Math.abs(diff as number))} (biasanya pembulatan)`) : ` · selisih ${formatRupiah(Math.abs(diff as number))}. Ada item, harga, atau pajak yang kemungkinan salah baca.`}
                          </p>
                        )}
                        {scanInfo.warnings.map((w, i) => <p key={i} className="mt-0.5">{w}</p>)}
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-3">
                  {items.map((it, idx) => {
                    const qty = Math.max(1, parseInt(it.qtyText, 10) || 1);
                    const line = it.priceRaw * qty;
                    const allOn = it.memberIds.length === memberIds.length;
                    return (
                      <div key={it.key} className={`rounded-2xl border p-3 space-y-2.5 ${it.memberIds.length === 0 && (it.name || it.priceRaw) ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/40 dark:bg-yellow-900/10' : 'border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/30'}`}>
                        <div className="flex gap-2">
                          <input value={it.name} onChange={(e) => updateItem(it.key, { name: e.target.value })} placeholder={`Item ${idx + 1} (cth: Nasi goreng)`} className={`${inputCls} flex-1`} />
                          {items.length > 1 && <button type="button" onClick={() => setItems((p) => p.filter((x) => x.key !== it.key))} className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/30 text-red-400 hover:text-red-600" aria-label="Hapus item"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                        <div className="flex gap-2">
                          <div className="w-20 shrink-0">
                            <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Jumlah</label>
                            <input inputMode="numeric" value={it.qtyText} onChange={(e) => updateItem(it.key, { qtyText: e.target.value.replace(/\D/g, '').slice(0, 3) })} className={`${inputCls} text-center`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Harga satuan (Rp)</label>
                            <input inputMode="numeric" value={it.priceDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); updateItem(it.key, { priceRaw: p.raw, priceDisplay: p.display }); }} placeholder="0" className={`${inputCls} font-bold`} />
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Dipakai oleh:</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => toggleAll(it.key)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${allOn ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300'}`}>Semua</button>
                            {members.map((m) => {
                              const on = it.memberIds.includes(m.id);
                              return <button type="button" key={m.id} onClick={() => toggleMember(it.key, m.id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border max-w-[120px] truncate ${on ? 'bg-teal-50 dark:bg-teal-900/40 border-teal-500 text-teal-700 dark:text-teal-300' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300'}`}>{on ? '✓ ' : ''}{m.name}</button>;
                            })}
                          </div>
                        </div>
                        {line > 0 && (
                          <p className="text-[11px] text-right text-gray-500 dark:text-gray-400">
                            {qty > 1 ? `${qty} x ${formatRupiah(it.priceRaw)} = ` : ''}<strong className="text-gray-800 dark:text-gray-100">{formatRupiah(line)}</strong>
                            {it.memberIds.length > 1 ? ` · ±${formatRupiah(Math.round(line / it.memberIds.length))}/orang` : ''}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => setItems((p) => [...p, newItem()])} className="flex-1 h-11 rounded-xl border-2 border-dashed border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 text-xs font-bold flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> Tambah item</button>
                  <button type="button" onClick={assignAllItems} className="h-11 px-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[11px] font-bold shrink-0">Bagi rata semua</button>
                </div>
              </section>

              {/* 3. Pajak, service, diskon */}
              <section>
                <StepTitle n={3} title="Diskon, service, dan pajak" hint="Isi seperti yang tertulis di struk (boleh % atau Rp). Dihitung berurutan: diskon, lalu service, lalu pajak. Dibagi sesuai jumlah pesanan masing-masing orang." />
                <div className="space-y-3">
                  <AdjRow label="Diskon" adj={discount} onChange={setDiscount} />
                  <AdjRow label="Service charge" adj={service} onChange={setService} />
                  <AdjRow label="Pajak (PB1/PPN)" adj={tax} onChange={setTax} />
                </div>
              </section>

              {/* 4. Hasil */}
              <section>
                <StepTitle n={4} title="Hasil hitungan" />
                <div className="rounded-2xl bg-teal-700 text-white p-4 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-teal-100">Subtotal</span><span>{formatRupiah(result.subtotal)}</span></div>
                  {result.discount > 0 && <div className="flex justify-between"><span className="text-teal-100">Diskon</span><span>-{formatRupiah(result.discount)}</span></div>}
                  {result.service > 0 && <div className="flex justify-between"><span className="text-teal-100">Service</span><span>+{formatRupiah(result.service)}</span></div>}
                  {result.tax > 0 && <div className="flex justify-between"><span className="text-teal-100">Pajak</span><span>+{formatRupiah(result.tax)}</span></div>}
                  <div className="flex justify-between pt-2 mt-1 border-t border-teal-500 text-sm font-bold"><span>Total tagihan</span><span>{formatRupiah(result.total)}</span></div>
                </div>
                {result.unassigned.length > 0 && (
                  <p className="mt-2 text-[11px] font-bold text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-2.5">{result.unassigned.length} item belum dipilih pemakainya (kotak berwarna kuning di atas).</p>
                )}
                <div className="space-y-2 mt-3">
                  {participants.length === 0 && <p className="text-center text-[11px] text-gray-400 py-3">Pilih pemakai tiap item untuk melihat bagian masing-masing.</p>}
                  {participants.map((m) => {
                    const b = result.perMember[m.id];
                    return (
                      <div key={m.id} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3">
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{m.name}</span>
                          <span className="font-bold text-sm text-teal-700 dark:text-teal-300 shrink-0">{formatRupiah(b.total)}</span>
                        </div>
                        <div className="mt-1.5 space-y-0.5">
                          {b.lines.map((l) => <p key={l.key} className="text-[10px] text-gray-500 dark:text-gray-400 flex justify-between gap-2"><span className="truncate">{l.name}</span><span className="shrink-0">{formatRupiah(l.amount)}</span></p>)}
                          {adjusted && b.discount > 0 && <p className="text-[10px] text-green-600 dark:text-green-400 flex justify-between"><span>Diskon</span><span>-{formatRupiah(b.discount)}</span></p>}
                          {adjusted && b.service > 0 && <p className="text-[10px] text-gray-500 dark:text-gray-400 flex justify-between"><span>Service</span><span>+{formatRupiah(b.service)}</span></p>}
                          {adjusted && b.tax > 0 && <p className="text-[10px] text-gray-500 dark:text-gray-400 flex justify-between"><span>Pajak</span><span>+{formatRupiah(b.tax)}</span></p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {paidBy && participants.length > 0 && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2">Dibayar dulu oleh <strong>{nameOf(paidBy)}</strong>. Yang lain nanti transfer ke dia.</p>}
              </section>
            </>
          ) : (
            <section>
              <StepTitle n={2} title="Total dan pembagian" />
              <div className="space-y-3">
                <div><label className={labelCls}>Total tagihan (Rp)</label><input inputMode="numeric" value={qTotalDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); setQTotal(p.raw); setQTotalDisplay(p.display); }} placeholder="0" className={`${inputCls} font-bold`} /></div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setQSplit('equal')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${qSplit === 'equal' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>Bagi rata</button>
                  <button type="button" onClick={() => setQSplit('custom')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${qSplit === 'custom' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>Atur sendiri</button>
                </div>
                <div className="space-y-2">
                  {members.map((m) => {
                    const on = !!qSelected[m.id];
                    const ids = members.filter((x) => qSelected[x.id]).map((x) => x.id);
                    const eq = qSplit === 'equal' && on && qTotal > 0 ? splitEqual(qTotal, ids)[m.id] : 0;
                    return (
                      <div key={m.id} className="flex items-center gap-2">
                        <button type="button" onClick={() => setQSelected((p) => ({ ...p, [m.id]: !p[m.id] }))} className={`flex-1 min-w-0 text-left px-3 h-10 rounded-xl text-xs font-bold border-2 truncate ${on ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>{on ? '✓ ' : ''}{m.name}</button>
                        {qSplit === 'equal' ? (
                          <span className="w-28 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0">{on && qTotal > 0 ? formatRupiah(eq) : '-'}</span>
                        ) : (
                          <input inputMode="numeric" disabled={!on} value={qCustom[m.id] ? new Intl.NumberFormat('id-ID').format(qCustom[m.id]) : ''} onChange={(e) => setQCustom((p) => ({ ...p, [m.id]: parseRupiahInput(e.target.value).raw }))} placeholder="Rp" className="w-28 shrink-0 h-10 px-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg text-xs text-right disabled:opacity-40" />
                        )}
                      </div>
                    );
                  })}
                </div>
                {qSplit === 'custom' && <p className="text-[10px] text-gray-500 dark:text-gray-400 text-right">Terisi {formatRupiah(members.filter((m) => qSelected[m.id]).reduce((s, m) => s + (qCustom[m.id] || 0), 0))} dari {formatRupiah(qTotal)}</p>}
              </div>
            </section>
          )}

          <button type="submit" disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all">{saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}</button>
        </form>
      </div>
    </div>
  );
}
