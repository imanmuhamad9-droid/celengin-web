'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Trash2, Users2, UserPlus, ArrowRight, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, formatDateID, parseRupiahInput, toLocalDateStr } from '@/lib/utils';
import { splitEqual, computeNet, simplifyDebts } from '@/lib/splitbill';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import SkeletonLoader from '@/components/SkeletonLoader';

interface Group { id: string; name: string; emoji: string; created_at: string }
interface Member { id: string; group_id: string; name: string; is_me: boolean }
interface Share { member_id: string; share_amount: number | string }
interface Expense { id: string; group_id: string; title: string; total_amount: number | string; paid_by: string; expense_date: string; split_type: 'equal' | 'custom'; created_at: string; split_shares?: Share[] }
interface Settlement { id: string; group_id: string; from_member: string; to_member: string; amount: number | string; created_at: string }
interface GroupCard extends Group { memberCount: number; total: number }

const EMOJIS = ['🍽️', '🏖️', '🏠', '🎬', '🚗', '🛒', '🎉', '☕'];
const inputCls = 'w-full p-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500';

export default function SplitBillPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [myName, setMyName] = useState('Saya');
  const [cards, setCards] = useState<GroupCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);

  // Detail grup
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [tab, setTab] = useState<'ringkasan' | 'pengeluaran'>('ringkasan');
  const [newMember, setNewMember] = useState('');

  // Form grup baru
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [gName, setGName] = useState('');
  const [gEmoji, setGEmoji] = useState('🍽️');
  const [gMembers, setGMembers] = useState<string[]>([]);
  const [gMemberInput, setGMemberInput] = useState('');

  // Form pengeluaran
  const [isExpOpen, setIsExpOpen] = useState(false);
  const [eTitle, setETitle] = useState('');
  const [eAmountDisplay, setEAmountDisplay] = useState('');
  const [eAmount, setEAmount] = useState(0);
  const [ePaidBy, setEPaidBy] = useState('');
  const [eDate, setEDate] = useState('');
  const [eSplit, setESplit] = useState<'equal' | 'custom'>('equal');
  const [eSelected, setESelected] = useState<Record<string, boolean>>({});
  const [eCustom, setECustom] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));
  // Dialog konfirmasi menutup dirinya setelah onConfirm, jadi dialog lanjutan ditunda sebentar
  const showLater = (title: string, msg: string, type: 'info' | 'success' | 'danger') => setTimeout(() => showDialog(title, msg, type), 300);

  const loadList = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');
    setUserId(session.user.id);

    const { data: prof } = await supabase.from('profiles').select('nickname, full_name').eq('id', session.user.id).maybeSingle();
    setMyName(prof?.nickname || prof?.full_name || 'Saya');

    const g = await supabase.from('split_groups').select('*').order('created_at', { ascending: false });
    if (g.error) { setMissingTable(true); setLoading(false); return; }
    const ids = (g.data || []).map((x: Group) => x.id);
    let mem: { group_id: string }[] = [];
    let exp: { group_id: string; total_amount: number | string }[] = [];
    if (ids.length > 0) {
      mem = (await supabase.from('split_members').select('group_id').in('group_id', ids)).data || [];
      exp = (await supabase.from('split_expenses').select('group_id,total_amount').in('group_id', ids)).data || [];
    }
    setCards((g.data || []).map((x: Group) => ({
      ...x,
      memberCount: mem.filter((m) => m.group_id === x.id).length,
      total: exp.filter((e) => e.group_id === x.id).reduce((s, e) => s + Number(e.total_amount), 0),
    })));
    setLoading(false);
  };

  const loadGroup = async (g: Group) => {
    const [m, e, s] = await Promise.all([
      supabase.from('split_members').select('*').eq('group_id', g.id).order('created_at', { ascending: true }),
      supabase.from('split_expenses').select('*, split_shares(*)').eq('group_id', g.id).order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('split_settlements').select('*').eq('group_id', g.id).order('created_at', { ascending: false }),
    ]);
    setGroup(g);
    setMembers((m.data || []) as Member[]);
    setExpenses((e.data || []) as Expense[]);
    setSettlements((s.data || []) as Settlement[]);
  };

  useEffect(() => { loadList(); }, []);

  if (loading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name || '?';

  // ---------- Hitungan saldo (memakai lib/splitbill.ts) ----------
  const net = computeNet(
    members.map((m) => m.id),
    expenses.map((e) => ({
      id: e.id, title: e.title, total_amount: e.total_amount, paid_by: e.paid_by, created_by: '',
      expense_date: e.expense_date, split_type: e.split_type, created_at: e.created_at,
      shared_expense_shares: (e.split_shares || []).map((s) => ({ user_id: s.member_id, share_amount: s.share_amount })),
    })),
    settlements.map((s) => ({ id: s.id, from_user: s.from_member, to_user: s.to_member, amount: s.amount, created_at: s.created_at })),
  );
  const debts = simplifyDebts(net);
  const totalSpent = expenses.reduce((s, e) => s + Number(e.total_amount), 0);

  // ---------- Aksi grup ----------
  const openNewGroup = () => {
    setGName(''); setGEmoji('🍽️'); setGMembers([]); setGMemberInput('');
    setIsGroupOpen(true);
  };
  const addGroupMemberChip = () => {
    const n = gMemberInput.trim();
    if (!n) return;
    setGMembers((p) => [...p, n]);
    setGMemberInput('');
  };
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gName.trim()) return showDialog('Data Belum Lengkap', 'Isi nama grup, misalnya "Makan Malam Sabtu".', 'danger');
    const pending = gMemberInput.trim() ? [...gMembers, gMemberInput.trim()] : gMembers;
    if (pending.length === 0) return showDialog('Belum Ada Teman', 'Tambahkan minimal satu teman yang ikut patungan.', 'danger');

    const { data: g, error } = await supabase.from('split_groups').insert({ user_id: userId, name: gName.trim(), emoji: gEmoji }).select().single();
    if (error || !g) return showDialog('Gagal', error?.message || 'Grup gagal dibuat.', 'danger');
    const rows = [{ group_id: g.id, name: myName, is_me: true }, ...pending.map((n) => ({ group_id: g.id, name: n, is_me: false }))];
    const { error: mErr } = await supabase.from('split_members').insert(rows);
    if (mErr) {
      await supabase.from('split_groups').delete().eq('id', g.id);
      return showDialog('Gagal', mErr.message, 'danger');
    }
    setIsGroupOpen(false);
    await loadList();
    setTab('ringkasan');
    await loadGroup(g as Group);
  };

  const handleDeleteGroup = () => {
    if (!group) return;
    showDialog('Hapus Grup?', `Grup "${group.name}" beserta seluruh pengeluaran dan pelunasannya akan dihapus permanen.`, 'danger', async () => {
      const { error } = await supabase.from('split_groups').delete().eq('id', group.id);
      if (error) return showLater('Gagal', error.message, 'danger');
      setGroup(null);
      loadList();
      showLater('Berhasil', 'Grup telah dihapus.', 'success');
    });
  };

  const handleAddMember = async () => {
    const n = newMember.trim();
    if (!n || !group) return;
    const { error } = await supabase.from('split_members').insert({ group_id: group.id, name: n, is_me: false });
    if (error) return showDialog('Gagal', error.message, 'danger');
    setNewMember('');
    loadGroup(group);
  };

  // ---------- Pengeluaran ----------
  const openExpense = () => {
    const sel: Record<string, boolean> = {};
    members.forEach((m) => { sel[m.id] = true; });
    setETitle(''); setEAmountDisplay(''); setEAmount(0);
    setEPaidBy(members.find((m) => m.is_me)?.id || members[0]?.id || '');
    setEDate(toLocalDateStr(new Date()));
    setESplit('equal'); setESelected(sel); setECustom({});
    setIsExpOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || saving) return;
    if (!eTitle.trim()) return showDialog('Data Belum Lengkap', 'Isi keterangan, misalnya "Makan di warung".', 'danger');
    if (eAmount <= 0) return showDialog('Nominal Kosong', 'Isi total tagihan.', 'danger');
    if (!ePaidBy) return showDialog('Data Belum Lengkap', 'Pilih siapa yang membayar dulu.', 'danger');

    const participants = members.filter((m) => eSelected[m.id]).map((m) => m.id);
    if (participants.length === 0) return showDialog('Data Belum Lengkap', 'Pilih minimal satu orang yang ikut menanggung.', 'danger');

    let shares: Record<string, number>;
    if (eSplit === 'equal') {
      shares = splitEqual(eAmount, participants);
    } else {
      shares = {};
      participants.forEach((id) => { shares[id] = eCustom[id] || 0; });
      const sum = Object.values(shares).reduce((a, b) => a + b, 0);
      if (sum !== eAmount) {
        const diff = eAmount - sum;
        return showDialog('Pembagian Belum Pas', diff > 0 ? `Masih kurang ${formatRupiah(diff)} dari total tagihan.` : `Kelebihan ${formatRupiah(-diff)} dari total tagihan.`, 'danger');
      }
    }

    setSaving(true);
    const { data: exp, error } = await supabase.from('split_expenses').insert({
      group_id: group.id, title: eTitle.trim(), total_amount: eAmount, paid_by: ePaidBy, expense_date: eDate, split_type: eSplit,
    }).select().single();
    if (error || !exp) { setSaving(false); return showDialog('Gagal', error?.message || 'Pengeluaran gagal disimpan.', 'danger'); }

    const rows = participants.filter((id) => shares[id] > 0).map((id) => ({ expense_id: exp.id, member_id: id, share_amount: shares[id] }));
    const { error: sErr } = await supabase.from('split_shares').insert(rows);
    if (sErr) {
      await supabase.from('split_expenses').delete().eq('id', exp.id);
      setSaving(false);
      return showDialog('Gagal', sErr.message, 'danger');
    }
    setSaving(false);
    setIsExpOpen(false);
    setTab('pengeluaran');
    await loadGroup(group);
    loadList();
  };

  const handleDeleteExpense = (exp: Expense) => {
    if (!group) return;
    showDialog('Hapus Pengeluaran?', `"${exp.title}" (${formatRupiah(Number(exp.total_amount))}) akan dihapus dan saldo dihitung ulang.`, 'danger', async () => {
      const { error } = await supabase.from('split_expenses').delete().eq('id', exp.id);
      if (error) return showLater('Gagal', error.message, 'danger');
      loadGroup(group);
      loadList();
    });
  };

  const handleSettle = (line: { from: string; to: string; amount: number }) => {
    if (!group) return;
    showDialog('Tandai Lunas?', `${nameOf(line.from)} sudah membayar ${formatRupiah(line.amount)} ke ${nameOf(line.to)}.`, 'info', async () => {
      const { error } = await supabase.from('split_settlements').insert({ group_id: group.id, from_member: line.from, to_member: line.to, amount: line.amount });
      if (error) return showLater('Gagal', error.message, 'danger');
      loadGroup(group);
      showLater('Berhasil', 'Pelunasan tercatat.', 'success');
    });
  };

  // ---------- Tampilan ----------
  const goBack = () => { if (group) { setGroup(null); loadList(); } else router.push('/dashboard'); };

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-32 transition-colors">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-5 py-4 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 transition-colors">
        <button onClick={goBack} className="text-gray-500 dark:text-gray-400 hover:text-teal-600"><ArrowLeft className="w-6 h-6" /></button>
        <span className="font-bold text-xl text-gray-800 dark:text-white truncate flex-1">{group ? `${group.emoji} ${group.name}` : 'Split Bill'}</span>
        {group && <button onClick={handleDeleteGroup} className="text-gray-400 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>}
      </header>

      <main className="px-5 mt-4 space-y-4">
        {missingTable && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-2xl text-xs text-yellow-800 dark:text-yellow-300">
            Tabel Split Bill belum ada. Jalankan <strong>sql/03_splitbill.sql</strong> di Supabase SQL Editor, lalu muat ulang halaman ini.
          </div>
        )}

        {/* ===== DAFTAR GRUP ===== */}
        {!group && !missingTable && (
          <>
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-2xl p-4">
              <p className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">Patungan tanpa ribet</p>
              <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80 leading-relaxed">Buat grup, catat siapa yang bayar dan siapa yang ikut makan. Celengin menghitung siapa harus transfer ke siapa dengan jumlah transfer paling sedikit. Temanmu cukup ditulis namanya.</p>
            </div>

            <button onClick={openNewGroup} className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"><Plus className="w-5 h-5" /> Buat Grup Split Bill</button>

            {cards.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
                <Receipt className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-gray-500 text-sm">Belum ada grup. Buat satu untuk mulai patungan.</p>
              </div>
            ) : cards.map((c) => (
              <button key={c.id} onClick={() => { setTab('ringkasan'); loadGroup(c); }} className="w-full text-left bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-3 transition-colors active:scale-[0.99]">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-2xl shrink-0">{c.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 dark:text-gray-100 truncate">{c.name}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{c.memberCount} orang · total {formatRupiah(c.total)}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300" />
              </button>
            ))}
          </>
        )}

        {/* ===== DETAIL GRUP ===== */}
        {group && (
          <>
            <div className="bg-teal-700 text-white rounded-3xl p-5 shadow-lg">
              <p className="text-[11px] text-teal-100">Total pengeluaran grup</p>
              <p className="text-2xl font-bold">{formatRupiah(totalSpent)}</p>
              <p className="text-[11px] text-teal-100 mt-1">{members.length} orang · {expenses.length} pengeluaran</p>
            </div>

            <button onClick={openExpense} className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"><Plus className="w-5 h-5" /> Tambah Pengeluaran</button>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              {(['ringkasan', 'pengeluaran'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${tab === t ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{t}</button>
              ))}
            </div>

            {tab === 'ringkasan' && (
              <>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-3">Siapa bayar siapa</h3>
                  {debts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">{expenses.length === 0 ? 'Belum ada pengeluaran.' : 'Semua sudah lunas 🎉'}</p>
                  ) : (
                    <div className="space-y-2">
                      {debts.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                          <div className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-200">
                            <strong>{nameOf(d.from)}</strong> <ArrowRight className="w-3 h-3 inline mx-0.5" /> <strong>{nameOf(d.to)}</strong>
                            <p className="font-bold text-red-500 dark:text-red-400 text-sm">{formatRupiah(d.amount)}</p>
                          </div>
                          <button onClick={() => handleSettle(d)} className="bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold px-3 py-2 rounded-lg shrink-0">Tandai Lunas</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-3">Saldo tiap orang</h3>
                  <div className="space-y-2">
                    {members.map((m) => {
                      const v = Math.round(net[m.id] || 0);
                      return (
                        <div key={m.id} className="flex justify-between items-center text-xs">
                          <span className="text-gray-700 dark:text-gray-200 font-medium">{m.name}{m.is_me ? ' (kamu)' : ''}</span>
                          <span className={`font-bold ${v > 0 ? 'text-green-600 dark:text-green-400' : v < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
                            {v > 0 ? `menerima ${formatRupiah(v)}` : v < 0 ? `berutang ${formatRupiah(-v)}` : 'lunas'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <input value={newMember} onChange={(e) => setNewMember(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMember(); } }} placeholder="Tambah teman (nama)" className={`${inputCls} !py-2.5`} />
                    <button onClick={handleAddMember} className="bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-3 rounded-xl shrink-0"><UserPlus className="w-5 h-5" /></button>
                  </div>
                </div>

                {settlements.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-3">Riwayat pelunasan</h3>
                    <div className="space-y-2">
                      {settlements.map((s) => (
                        <p key={s.id} className="text-[11px] text-gray-600 dark:text-gray-300 flex justify-between gap-2">
                          <span><strong>{nameOf(s.from_member)}</strong> → <strong>{nameOf(s.to_member)}</strong></span>
                          <span className="font-bold">{formatRupiah(Number(s.amount))}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'pengeluaran' && (
              <div className="space-y-3">
                {expenses.length === 0 && <p className="text-center text-xs text-gray-400 py-8">Belum ada pengeluaran.</p>}
                {expenses.map((x) => (
                  <div key={x.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{x.title}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatDateID(x.expense_date)} · dibayar {nameOf(x.paid_by)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{formatRupiah(Number(x.total_amount))}</p>
                        <button onClick={() => handleDeleteExpense(x)} className="text-gray-300 hover:text-red-500 mt-1"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(x.split_shares || []).map((s) => (
                        <span key={s.member_id} className="text-[10px] bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md">{nameOf(s.member_id)} {formatRupiah(Number(s.share_amount))}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== MODAL GRUP BARU ===== */}
      {isGroupOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[90vh] overflow-y-auto transition-colors">
            <button onClick={() => setIsGroupOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">Grup Split Bill Baru</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Nama grup</label>
                <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Makan malam Sabtu" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Ikon</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((em) => (
                    <button type="button" key={em} onClick={() => setGEmoji(em)} className={`w-10 h-10 rounded-xl text-xl border-2 ${gEmoji === em ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30' : 'border-gray-100 dark:border-gray-700'}`}>{em}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Teman yang ikut</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[11px] bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2.5 py-1 rounded-lg font-bold">{myName} (kamu)</span>
                  {gMembers.map((n, i) => (
                    <span key={i} className="text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      {n}<button type="button" onClick={() => setGMembers((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={gMemberInput} onChange={(e) => setGMemberInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroupMemberChip(); } }} placeholder="Nama teman" className={`${inputCls} !py-2.5`} />
                  <button type="button" onClick={addGroupMemberChip} className="bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-3 rounded-xl shrink-0"><Plus className="w-5 h-5" /></button>
                </div>
              </div>
              <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all">Buat Grup</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL PENGELUARAN ===== */}
      {isExpOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative max-h-[90vh] overflow-y-auto transition-colors">
            <button onClick={() => setIsExpOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">Tambah Pengeluaran</h2>
            <form onSubmit={handleSaveExpense} className="space-y-4">
              <input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="Keterangan (mis. Makan di warung)" className={inputCls} />
              <input inputMode="numeric" value={eAmountDisplay} onChange={(e) => { const p = parseRupiahInput(e.target.value); setEAmount(p.raw); setEAmountDisplay(p.display); }} placeholder="Total tagihan (Rp)" className={`${inputCls} font-bold`} />

              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Dibayar oleh</label>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <button type="button" key={m.id} onClick={() => setEPaidBy(m.id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border-2 ${ePaidBy === m.id ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>{m.name}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Tanggal</label>
                <input type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} className={`${inputCls} min-w-0`} />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 block">Cara membagi</label>
                <div className="flex gap-2 mb-3">
                  <button type="button" onClick={() => setESplit('equal')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${eSplit === 'equal' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>Bagi rata</button>
                  <button type="button" onClick={() => setESplit('custom')} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 ${eSplit === 'custom' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>Atur sendiri</button>
                </div>
                <div className="space-y-2">
                  {members.map((m) => {
                    const on = !!eSelected[m.id];
                    const ids = members.filter((x) => eSelected[x.id]).map((x) => x.id);
                    const eq = eSplit === 'equal' && on && eAmount > 0 ? splitEqual(eAmount, ids)[m.id] : 0;
                    return (
                      <div key={m.id} className="flex items-center gap-2">
                        <button type="button" onClick={() => setESelected((p) => ({ ...p, [m.id]: !p[m.id] }))} className={`flex-1 text-left px-3 py-2 rounded-xl text-xs font-bold border-2 min-w-0 truncate ${on ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' : 'border-gray-100 dark:border-gray-700 text-gray-400'}`}>{on ? '✓ ' : ''}{m.name}</button>
                        {eSplit === 'equal' ? (
                          <span className="w-24 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400">{on && eAmount > 0 ? formatRupiah(eq) : '-'}</span>
                        ) : (
                          <input inputMode="numeric" disabled={!on} value={eCustom[m.id] ? new Intl.NumberFormat('id-ID').format(eCustom[m.id]) : ''} onChange={(e) => setECustom((p) => ({ ...p, [m.id]: parseRupiahInput(e.target.value).raw }))} placeholder="Rp" className="w-24 p-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg text-xs text-right disabled:opacity-40" />
                        )}
                      </div>
                    );
                  })}
                </div>
                {eSplit === 'custom' && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 text-right">
                    Terisi {formatRupiah(members.filter((m) => eSelected[m.id]).reduce((s, m) => s + (eCustom[m.id] || 0), 0))} dari {formatRupiah(eAmount)}
                  </p>
                )}
              </div>

              <button type="submit" disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all">{saving ? 'Menyimpan...' : 'Simpan Pengeluaran'}</button>
            </form>
          </div>
        </div>
      )}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
