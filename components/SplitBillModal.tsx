'use client';
import { useEffect, useState } from 'react';
import { X, Plus, Trash2, ArrowRight, Receipt, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, parseRupiahInput, toLocalDateStr, formatDateID } from '@/lib/utils';
import { SharedExpense, Settlement, computeNet, simplifyDebts, splitEqual, DebtLine } from '@/lib/splitbill';

type ShowDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => void;
interface Member { user_id: string; name: string }

const inputCls = 'w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500';

export default function SplitBillModal({ isOpen, onClose, goal, members, currentUserId, showDialog }: {
  isOpen: boolean;
  onClose: () => void;
  goal: { id: string; title: string; category: string } | null;
  members: Member[];
  currentUserId: string;
  showDialog: ShowDialog;
}) {
  const [view, setView] = useState<'main' | 'form'>('main');
  const [tab, setTab] = useState<'ringkasan' | 'daftar'>('ringkasan');
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [totalDisplay, setTotalDisplay] = useState('');
  const [totalRaw, setTotalRaw] = useState(0);
  const [paidBy, setPaidBy] = useState('');
  const [date, setDate] = useState('');
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [participants, setParticipants] = useState<string[]>([]);
  const [customRaw, setCustomRaw] = useState<Record<string, number>>({});
  const [customDisplay, setCustomDisplay] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isCouple = goal?.category === 'couple';
  const accentBtn = isCouple ? 'bg-pink-500 hover:bg-pink-600' : 'bg-blue-500 hover:bg-blue-600';
  const accentSoft = isCouple ? 'bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border-pink-500' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-500';
  const accentText = isCouple ? 'text-pink-600 dark:text-pink-400' : 'text-blue-600 dark:text-blue-400';

  const nameOf = (id: string) => (id === currentUserId ? 'Kamu' : members.find((m) => m.user_id === id)?.name || 'Mantan anggota');

  const load = async () => {
    if (!goal) return;
    setLoading(true);
    const [ex, st] = await Promise.all([
      supabase.from('shared_expenses').select('*, shared_expense_shares(*)').eq('goal_id', goal.id).order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('shared_settlements').select('*').eq('goal_id', goal.id).order('created_at', { ascending: false }),
    ]);
    if (ex.error || st.error) { setMissingTable(true); }
    else { setMissingTable(false); setExpenses((ex.data || []) as SharedExpense[]); setSettlements((st.data || []) as Settlement[]); }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && goal) { setView('main'); setTab('ringkasan'); load(); }
  }, [isOpen, goal?.id]);

  if (!isOpen || !goal) return null;

  const memberIds = members.map((m) => m.user_id);
  const net = computeNet(memberIds, expenses, settlements);
  const debts: DebtLine[] = simplifyDebts(net);
  const myNet = net[currentUserId] || 0;

  const openForm = () => {
    setTitle(''); setTotalDisplay(''); setTotalRaw(0);
    setPaidBy(currentUserId); setDate(toLocalDateStr(new Date()));
    setMode('equal'); setParticipants(memberIds); setCustomRaw({}); setCustomDisplay({});
    setView('form');
  };

  const toggleParticipant = (id: string) =>
    setParticipants((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleCustom = (id: string, v: string) => {
    const p = parseRupiahInput(v);
    setCustomRaw((prev) => ({ ...prev, [id]: p.raw }));
    setCustomDisplay((prev) => ({ ...prev, [id]: p.display }));
  };

  const customSum = Object.values(customRaw).reduce((a, b) => a + b, 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || totalRaw <= 0) return showDialog('Data Belum Lengkap', 'Isi nama pengeluaran dan total yang dibayar.', 'danger');

    let shares: Record<string, number> = {};
    if (mode === 'equal') {
      if (participants.length === 0) return showDialog('Pilih Peserta', 'Pilih minimal satu orang yang ikut membagi.', 'danger');
      shares = splitEqual(totalRaw, participants.filter((id) => memberIds.includes(id)));
    } else {
      memberIds.forEach((id) => { if ((customRaw[id] || 0) > 0) shares[id] = customRaw[id]; });
      if (customSum !== totalRaw) {
        return showDialog('Total Belum Pas', `Jumlah semua bagian ${formatRupiah(customSum)} harus sama dengan total ${formatRupiah(totalRaw)}.`, 'danger');
      }
    }

    setSaving(true);
    try {
      const { data: exp, error } = await supabase
        .from('shared_expenses')
        .insert({ goal_id: goal.id, title: title.trim(), total_amount: totalRaw, paid_by: paidBy, created_by: currentUserId, expense_date: date, split_type: mode })
        .select('id')
        .single();
      if (error || !exp) throw error || new Error('Gagal menyimpan.');

      const { error: shareErr } = await supabase
        .from('shared_expense_shares')
        .insert(Object.entries(shares).map(([user_id, share_amount]) => ({ expense_id: exp.id, user_id, share_amount })));
      if (shareErr) {
        await supabase.from('shared_expenses').delete().eq('id', exp.id);
        throw shareErr;
      }
      await load();
      setView('main'); setTab('daftar');
    } catch (err: any) {
      showDialog('Gagal', err?.message || 'Tidak bisa menyimpan split bill.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (exp: SharedExpense) => {
    showDialog('Hapus Pengeluaran?', `"${exp.title}" akan dihapus dan hitungan utang ikut berubah.`, 'danger', async () => {
      await supabase.from('shared_expenses').delete().eq('id', exp.id);
      load();
    });
  };

  const handleSettle = (line: DebtLine) => {
    showDialog('Tandai Sudah Dibayar?', `${nameOf(line.from)} membayar ${nameOf(line.to)} sebesar ${formatRupiah(line.amount)}.`, 'info', async () => {
      await supabase.from('shared_settlements').insert({ goal_id: goal.id, from_user: line.from, to_user: line.to, amount: line.amount });
      load();
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm relative max-h-[88vh] flex flex-col transition-colors">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white z-10"><X className="w-5 h-5" /></button>

        <div className="px-6 pt-6 pb-3">
          <h2 className="text-lg font-bold text-center text-gray-800 dark:text-white flex items-center justify-center gap-2"><Receipt className={`w-5 h-5 ${accentText}`} /> Split Bill</h2>
          <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 mt-0.5 truncate">{goal.title}</p>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {missingTable && <p className="text-center text-xs text-red-500 py-6">Tabel Split Bill belum ada. Jalankan 01_fitur_baru.sql di Supabase.</p>}

          {!missingTable && view === 'main' && (
            <>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setTab('ringkasan')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${tab === 'ringkasan' ? accentSoft : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>Ringkasan</button>
                <button onClick={() => setTab('daftar')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${tab === 'daftar' ? accentSoft : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>Pengeluaran ({expenses.length})</button>
              </div>

              {loading ? <p className="text-center text-xs text-gray-400 py-6">Memuat...</p> : tab === 'ringkasan' ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border text-center ${myNet > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : myNet < 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-700 border-gray-100 dark:border-gray-600'}`}>
                    {myNet === 0 ? (
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{expenses.length === 0 ? 'Belum ada pengeluaran bareng.' : 'Semua sudah impas 🎉'}</p>
                    ) : (
                      <>
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">{myNet > 0 ? 'Kamu akan menerima' : 'Kamu harus membayar'}</p>
                        <p className={`text-2xl font-extrabold mt-1 ${myNet > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{formatRupiah(Math.abs(myNet))}</p>
                      </>
                    )}
                  </div>

                  {debts.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Siapa bayar siapa</p>
                      <div className="space-y-2">
                        {debts.map((d, i) => {
                          const involved = d.from === currentUserId || d.to === currentUserId;
                          return (
                            <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-100 min-w-0">
                                  <span className="truncate">{nameOf(d.from)}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span className="truncate">{nameOf(d.to)}</span>
                                </div>
                                <span className="text-sm font-bold text-red-500 dark:text-red-400 shrink-0">{formatRupiah(d.amount)}</span>
                              </div>
                              {involved && (
                                <button onClick={() => handleSettle(d)} className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition-all"><CheckCircle2 className="w-3.5 h-3.5" /> Tandai Sudah Dibayar</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {settlements.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Riwayat pelunasan</p>
                      <div className="space-y-1.5">
                        {settlements.slice(0, 5).map((s) => (
                          <div key={s.id} className="flex justify-between items-center text-[11px] text-gray-600 dark:text-gray-300 px-1">
                            <span className="truncate pr-2">{nameOf(s.from_user)} → {nameOf(s.to_user)} · {formatDateID(s.created_at.slice(0, 10), false)}</span>
                            <span className="font-bold shrink-0">{formatRupiah(Number(s.amount))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.length === 0 && <p className="text-center text-xs text-gray-400 py-6">Belum ada pengeluaran.</p>}
                  {expenses.map((e) => {
                    const mine = (e.shared_expense_shares || []).find((s) => s.user_id === currentUserId);
                    const count = (e.shared_expense_shares || []).length;
                    return (
                      <div key={e.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-100 dark:border-gray-600">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{e.title}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Dibayar {nameOf(e.paid_by)} · {formatDateID(e.expense_date, false)}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">Dibagi ke {count} orang{mine ? ` · bagianmu ${formatRupiah(Number(mine.share_amount))}` : ''}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{formatRupiah(Number(e.total_amount))}</p>
                            {e.created_by === currentUserId && (
                              <button onClick={() => handleDelete(e)} className="text-gray-300 dark:text-gray-500 hover:text-red-500 mt-1"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={openForm} className={`w-full mt-4 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all ${accentBtn}`}><Plus className="w-4 h-4" /> Tambah Pengeluaran</button>
            </>
          )}

          {!missingTable && view === 'form' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Untuk apa?</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cth: Makan malam, Bensin" required className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Total yang dibayar</label>
                <input type="text" inputMode="numeric" value={totalDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); setTotalRaw(p.raw); setTotalDisplay(p.display); }} required placeholder="Total Rp" className={`${inputCls} font-bold`} />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Dibayar oleh</label>
                  <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={inputCls}>
                    {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === currentUserId ? 'Kamu' : m.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={`${inputCls} text-[12px]`} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Cara membagi</label>
                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => setMode('equal')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${mode === 'equal' ? accentSoft : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>Bagi Rata</button>
                  <button type="button" onClick={() => setMode('custom')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${mode === 'custom' ? accentSoft : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>Atur Sendiri</button>
                </div>

                {mode === 'equal' ? (
                  <div className="space-y-1.5">
                    {members.map((m) => {
                      const on = participants.includes(m.user_id);
                      const per = on && totalRaw > 0 ? splitEqual(totalRaw, participants)[m.user_id] : 0;
                      return (
                        <button key={m.user_id} type="button" onClick={() => toggleParticipant(m.user_id)} className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${on ? 'bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-500' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 opacity-60'}`}>
                          <span className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-100">
                            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] ${on ? `${isCouple ? 'bg-pink-500 border-pink-500' : 'bg-blue-500 border-blue-500'} text-white` : 'border-gray-300 dark:border-gray-500'}`}>{on ? '✓' : ''}</span>
                            {m.user_id === currentUserId ? 'Kamu' : m.name}
                          </span>
                          <span className="font-bold text-gray-600 dark:text-gray-300">{on ? formatRupiah(per) : '-'}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m.user_id} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{m.user_id === currentUserId ? 'Kamu' : m.name}</span>
                        <input type="text" inputMode="numeric" value={customDisplay[m.user_id] || ''} onChange={(e) => handleCustom(m.user_id, e.target.value)} placeholder="0" className={`${inputCls} py-2 font-bold`} />
                      </div>
                    ))}
                    <p className={`text-[11px] font-bold text-right ${customSum === totalRaw && totalRaw > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {customSum === totalRaw && totalRaw > 0 ? 'Pas ✓' : `Selisih ${formatRupiah(totalRaw - customSum)}`}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setView('main')} className="flex-1 py-3.5 rounded-xl font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm">Batal</button>
                <button type="submit" disabled={saving} className={`flex-1 py-3.5 rounded-xl font-bold text-white transition-all text-sm disabled:opacity-50 ${accentBtn}`}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
