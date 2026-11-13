'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Trash2, UserPlus, ArrowRight, Receipt, Copy, CreditCard, Pencil, Mail, Check, ChevronDown, ChevronUp, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, formatDateID } from '@/lib/utils';
import { computeNet, simplifyDebts } from '@/lib/splitbill';
import { pushInviteNow } from '@/lib/notifications';
import { BANKS, SplitGroup, SplitMember, SplitExpense, SplitSettlement } from '@/lib/splitTypes';
import SplitExpenseModal from '@/components/SplitExpenseModal';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import SkeletonLoader from '@/components/SkeletonLoader';

interface GroupCard extends SplitGroup { memberCount: number; total: number }
interface Invite { memberId: string; group: SplitGroup }

const EMOJIS = ['🍽️', '🏖️', '🏠', '🎬', '🚗', '🛒', '🎉', '☕'];
const inputCls = 'w-full min-w-0 h-11 px-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500';

export default function SplitBillPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [myName, setMyName] = useState('Saya');
  const [cards, setCards] = useState<GroupCard[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);

  // Detail grup
  const [group, setGroup] = useState<SplitGroup | null>(null);
  const [members, setMembers] = useState<SplitMember[]>([]);
  const [expenses, setExpenses] = useState<SplitExpense[]>([]);
  const [settlements, setSettlements] = useState<SplitSettlement[]>([]);
  const [tab, setTab] = useState<'ringkasan' | 'pengeluaran' | 'anggota'>('ringkasan');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newMember, setNewMember] = useState('');

  // Form grup baru
  const [isGroupOpen, setIsGroupOpen] = useState(false);
  const [gName, setGName] = useState('');
  const [gEmoji, setGEmoji] = useState('🍽️');
  const [gMembers, setGMembers] = useState<{ name: string; userId?: string }[]>([]);
  const [gMemberInput, setGMemberInput] = useState('');
  const [gInviteMode, setGInviteMode] = useState(false); // false = nama saja, true = undang lewat email
  const [gAdding, setGAdding] = useState(false);

  // Pengeluaran, rekening, undangan
  const [isExpOpen, setIsExpOpen] = useState(false);
  const [bankMember, setBankMember] = useState<SplitMember | null>(null);
  const [bankName, setBankName] = useState('');
  const [bankNumber, setBankNumber] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  const [dialog, setDialog] = useState({ isOpen: false, title: '', msg: '', type: 'info' as 'info' | 'success' | 'danger', onConfirm: undefined as (() => void) | undefined });
  const showDialog = (title: string, msg: string, type: 'info' | 'success' | 'danger', onConfirm?: () => void) => setDialog({ isOpen: true, title, msg, type, onConfirm });
  const closeDialog = () => setDialog((prev) => ({ ...prev, isOpen: false }));
  // Dialog konfirmasi menutup dirinya setelah onConfirm, jadi dialog lanjutan ditunda sebentar
  const showLater = (title: string, msg: string, type: 'info' | 'success' | 'danger') => setTimeout(() => showDialog(title, msg, type), 300);

  const loadList = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push('/login');
    const uid = session.user.id;
    setUserId(uid);

    const { data: prof } = await supabase.from('profiles').select('nickname, full_name').eq('id', uid).maybeSingle();
    setMyName(prof?.nickname || prof?.full_name || 'Saya');

    const g = await supabase.from('split_groups').select('*').order('created_at', { ascending: false });
    if (g.error) { setMissingTable(true); setLoading(false); return; }
    const groups = (g.data || []) as SplitGroup[];
    const ids = groups.map((x) => x.id);

    let mem: SplitMember[] = [];
    let exp: { group_id: string; total_amount: number | string }[] = [];
    if (ids.length > 0) {
      mem = ((await supabase.from('split_members').select('*').in('group_id', ids)).data || []) as SplitMember[];
      exp = (await supabase.from('split_expenses').select('group_id,total_amount').in('group_id', ids)).data || [];
    }
    // Versi SQL lama belum punya kolom user_id: minta jalankan ulang 03_splitbill.sql
    if (mem.length > 0 && !('user_id' in mem[0])) setMissingTable(true); else setMissingTable(false);

    const pendingIds = new Set(mem.filter((m) => m.user_id === uid && m.status === 'pending').map((m) => m.group_id));
    setInvites(groups.filter((x) => pendingIds.has(x.id)).map((x) => ({ memberId: mem.find((m) => m.group_id === x.id && m.user_id === uid)!.id, group: x })));
    setCards(groups.filter((x) => !pendingIds.has(x.id)).map((x) => ({
      ...x,
      memberCount: mem.filter((m) => m.group_id === x.id).length,
      total: exp.filter((e) => e.group_id === x.id).reduce((s, e) => s + Number(e.total_amount), 0),
    })));
    setLoading(false);
  };

  const loadGroup = async (g: SplitGroup) => {
    const [m, e, s] = await Promise.all([
      supabase.from('split_members').select('*').eq('group_id', g.id).order('created_at', { ascending: true }),
      supabase.from('split_expenses').select('*, split_shares(*), split_expense_items(*, split_item_assignees(*))').eq('group_id', g.id).order('expense_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('split_settlements').select('*').eq('group_id', g.id).order('created_at', { ascending: false }),
    ]);
    setGroup(g);
    setMembers((m.data || []) as SplitMember[]);
    setExpenses((e.data || []) as SplitExpense[]);
    setSettlements((s.data || []) as SplitSettlement[]);
  };

  useEffect(() => { loadList(); }, []);

  if (loading) return <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950"><SkeletonLoader /></div>;

  const isOwner = !!group && group.user_id === userId;
  const memberById = (id: string) => members.find((m) => m.id === id);
  const nameOf = (id: string) => memberById(id)?.name || '?';
  const isMine = (m: SplitMember) => m.user_id === userId;

  // ---------- Hitungan saldo (memakai lib/splitbill.ts) ----------
  const net = computeNet(
    members.map((m) => m.id),
    expenses.map((e) => ({
      id: e.id, title: e.title, total_amount: e.total_amount, paid_by: e.paid_by, created_by: e.created_by || '',
      expense_date: e.expense_date, split_type: e.split_type === 'items' ? 'custom' : e.split_type, created_at: e.created_at,
      shared_expense_shares: (e.split_shares || []).map((s) => ({ user_id: s.member_id, share_amount: s.share_amount })),
    })),
    settlements.map((s) => ({ id: s.id, from_user: s.from_member, to_user: s.to_member, amount: s.amount, created_at: s.created_at })),
  );
  const debts = simplifyDebts(net);
  const totalSpent = expenses.reduce((s, e) => s + Number(e.total_amount), 0);

  // ---------- Grup ----------
  const openNewGroup = () => { setGName(''); setGEmoji('🍽️'); setGMembers([]); setGMemberInput(''); setGInviteMode(false); setIsGroupOpen(true); };

  // Menambah teman ke daftar sebelum grup dibuat. Mode email: cek dulu apakah akunnya ada.
  const addGroupMemberChip = async (): Promise<boolean> => {
    const text = gMemberInput.trim();
    if (!text) return true;
    if (!gInviteMode) {
      setGMembers((p) => [...p, { name: text }]);
      setGMemberInput('');
      return true;
    }
    setGAdding(true);
    const { data: targetId } = await supabase.rpc('get_user_id_by_email', { email_input: text });
    if (!targetId) { setGAdding(false); showDialog('Tidak Ditemukan', 'Email itu belum terdaftar di Celengin. Pilih "Nama saja" untuk menambahkannya tanpa akun.', 'danger'); return false; }
    if (targetId === userId) { setGAdding(false); showDialog('Itu Kamu', 'Kamu otomatis sudah ada di grup.', 'info'); return false; }
    if (gMembers.some((m) => m.userId === targetId)) { setGAdding(false); showDialog('Sudah Ada', 'Pengguna ini sudah ditambahkan.', 'info'); return false; }
    const { data: prof } = await supabase.from('profiles').select('nickname, full_name').eq('id', targetId).maybeSingle();
    setGAdding(false);
    setGMembers((p) => [...p, { name: prof?.nickname || prof?.full_name || text.split('@')[0], userId: targetId as string }]);
    setGMemberInput('');
    return true;
  };
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gName.trim()) return showDialog('Data Belum Lengkap', 'Isi nama grup, misalnya "Makan Malam Sabtu".', 'danger');
    // Teks yang masih tertulis di kolom teman ikut ditambahkan
    if (gAdding) return;
    if (gMemberInput.trim()) { const ok = await addGroupMemberChip(); if (!ok) return; }
    const pending = gMembers;

    const { data: g, error } = await supabase.from('split_groups').insert({ user_id: userId, name: gName.trim(), emoji: gEmoji }).select().single();
    if (error || !g) return showDialog('Gagal', error?.message || 'Grup gagal dibuat.', 'danger');
    const rows = [
      { group_id: g.id, name: myName, is_me: true, user_id: userId, status: 'accepted' },
      // Semua baris harus punya kolom yang sama, kalau tidak kolom yang hilang dikirim sebagai NULL
      ...pending.map((m) => ({ group_id: g.id, name: m.name, is_me: false, user_id: m.userId ?? null, status: m.userId ? 'pending' : 'accepted' })),
    ];
    const { error: mErr } = await supabase.from('split_members').insert(rows);
    if (mErr) {
      await supabase.from('split_groups').delete().eq('id', g.id);
      return showDialog('Gagal', mErr.message, 'danger');
    }
    // Beri tahu orang yang diundang lewat push (lonceng mereka sudah terisi otomatis oleh database)
    pending.filter((m) => m.userId).forEach((m) => { pushInviteNow(m.userId as string); });
    setIsGroupOpen(false);
    await loadList();
    setTab('ringkasan');
    await loadGroup(g as SplitGroup);
    const invited = pending.filter((m) => m.userId).length;
    if (invited > 0) showDialog('Grup Dibuat', `${invited} undangan terkirim. Mereka akan melihat grup ini di menu Split Bill-nya setelah menerima.`, 'success');
  };

  const handleDeleteGroup = () => {
    if (!group) return;
    showDialog('Hapus Grup?', `Grup "${group.name}" beserta seluruh pengeluaran dan pelunasannya akan dihapus permanen untuk semua anggota.`, 'danger', async () => {
      const { error } = await supabase.from('split_groups').delete().eq('id', group.id);
      if (error) return showLater('Gagal', error.message, 'danger');
      setGroup(null);
      loadList();
      showLater('Berhasil', 'Grup telah dihapus.', 'success');
    });
  };

  const respondInvite = async (inv: Invite, accept: boolean) => {
    const { error } = await supabase.rpc('split_respond_invite', { p_member_id: inv.memberId, p_accept: accept });
    if (error) return showDialog('Gagal', error.message, 'danger');
    await loadList();
    if (accept) { showDialog('Berhasil', `Kamu bergabung ke grup "${inv.group.name}".`, 'success'); }
  };

  // ---------- Anggota ----------
  const handleAddMember = async () => {
    const n = newMember.trim();
    if (!n || !group) return;
    const { error } = await supabase.from('split_members').insert({ group_id: group.id, name: n, is_me: false, user_id: null, status: 'accepted' });
    if (error) return showDialog('Gagal', error.message, 'danger');
    setNewMember('');
    loadGroup(group);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || inviteBusy) return;
    setInviteBusy(true);
    const email = inviteEmail.trim();
    const { data: targetId } = await supabase.rpc('get_user_id_by_email', { email_input: email });
    if (!targetId) { setInviteBusy(false); return showDialog('Tidak Ditemukan', 'Email itu belum terdaftar di Celengin. Kamu tetap bisa menambahkannya sebagai teman dengan nama saja.', 'danger'); }
    if (targetId === userId) { setInviteBusy(false); return showDialog('Itu Kamu', 'Kamu sudah ada di grup ini.', 'info'); }
    if (members.some((m) => m.user_id === targetId)) { setInviteBusy(false); return showDialog('Sudah Ada', 'Pengguna ini sudah ada di grup.', 'info'); }
    const { data: prof } = await supabase.from('profiles').select('nickname, full_name').eq('id', targetId).maybeSingle();
    const name = prof?.nickname || prof?.full_name || email.split('@')[0];
    const { error } = await supabase.from('split_members').insert({ group_id: group.id, name, is_me: false, user_id: targetId, status: 'pending' });
    setInviteBusy(false);
    if (error) return showDialog('Gagal', error.message, 'danger');
    pushInviteNow(targetId as string);
    setIsInviteOpen(false); setInviteEmail('');
    loadGroup(group);
    showDialog('Undangan Terkirim', `${name} akan melihat grup ini di menu Split Bill miliknya. Setelah menerima, dia bisa ikut mencatat pengeluaran dan melihat siapa harus bayar siapa.`, 'success');
  };

  const openBank = (m: SplitMember) => {
    setBankMember(m);
    setBankName(m.bank_name || ''); setBankNumber(m.account_number || ''); setBankHolder(m.account_holder || '');
  };
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankMember || !group) return;
    const { error } = await supabase.from('split_members').update({
      bank_name: bankName || null, account_number: bankNumber.trim() || null, account_holder: bankHolder.trim() || null,
    }).eq('id', bankMember.id);
    if (error) return showDialog('Gagal', error.message, 'danger');
    setBankMember(null);
    loadGroup(group);
  };

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); showDialog('Berhasil', 'Nomor rekening berhasil disalin!', 'success'); }
    catch { showDialog('Salin Manual', `Nomor rekening: ${text}`, 'info'); }
  };

  // ---------- Pengeluaran & pelunasan ----------
  const handleDeleteExpense = (exp: SplitExpense) => {
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
      const { error } = await supabase.from('split_settlements').insert({ group_id: group.id, from_member: line.from, to_member: line.to, amount: line.amount, created_by: userId });
      if (error) return showLater('Gagal', error.message, 'danger');
      loadGroup(group);
      showLater('Berhasil', 'Pelunasan tercatat.', 'success');
    });
  };

  // ---------- Tampilan ----------
  const goBack = () => { if (group) { setGroup(null); setExpandedId(null); loadList(); } else router.push('/dashboard'); };

  const BankLine = ({ m }: { m: SplitMember }) => (
    m.account_number ? (
      <div className="mt-2 flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-600 rounded-lg p-2">
        <CreditCard className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-gray-700 dark:text-gray-200 truncate">{m.bank_name || 'Rekening'}</p>
          <p className="text-[11px] font-mono text-gray-600 dark:text-gray-300 truncate">{m.account_number}{m.account_holder ? ` · a/n ${m.account_holder}` : ''}</p>
        </div>
        <button onClick={() => copyText(m.account_number!)} className="shrink-0 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-teal-600 dark:text-teal-400" aria-label="Salin nomor rekening"><Copy className="w-3.5 h-3.5" /></button>
      </div>
    ) : (
      <p className="mt-1.5 text-[10px] text-gray-400">Belum ada info rekening {m.name}.{(isOwner || isMine(m)) && <button onClick={() => openBank(m)} className="ml-1 font-bold text-teal-600 dark:text-teal-400">Isi sekarang</button>}</p>
    )
  );

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-32 transition-colors">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md px-5 py-4 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 transition-colors">
        <button onClick={goBack} className="text-gray-500 dark:text-gray-400 hover:text-teal-600"><ArrowLeft className="w-6 h-6" /></button>
        <span className="font-bold text-xl text-gray-800 dark:text-white truncate flex-1">{group ? `${group.emoji} ${group.name}` : 'Split Bill'}</span>
        {group && isOwner && <button onClick={handleDeleteGroup} className="text-gray-400 hover:text-red-500" aria-label="Hapus grup"><Trash2 className="w-5 h-5" /></button>}
      </header>

      <main className="px-5 mt-4 space-y-4">
        {missingTable && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-2xl text-xs text-yellow-800 dark:text-yellow-300">
            Database Split Bill belum siap. Jalankan <strong>sql/03_splitbill.sql</strong> (versi terbaru) di Supabase SQL Editor, lalu muat ulang halaman ini.
          </div>
        )}

        {/* ===== DAFTAR GRUP ===== */}
        {!group && !loading && (
          <>
            {invites.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Undangan Masuk</p>
                {invites.map((inv) => (
                  <div key={inv.memberId} className="bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-800 p-4 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-xl shrink-0">{inv.group.emoji}</div>
                      <div className="min-w-0"><p className="text-[11px] text-gray-500 dark:text-gray-400">Kamu diundang ke grup Split Bill</p><p className="font-bold text-sm text-gray-800 dark:text-white truncate">{inv.group.name}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => respondInvite(inv, true)} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Terima</button>
                      <button onClick={() => respondInvite(inv, false)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1"><X className="w-4 h-4" /> Tolak</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-2xl p-4">
              <p className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">Patungan tanpa ribet</p>
              <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80 leading-relaxed">Foto struk dalam bentuk daftar: isi tiap pesanan, pajak, dan diskon, lalu pilih siapa memakai apa. Celengin menghitung bagian tiap orang dan siapa harus transfer ke siapa. Teman bisa ditulis namanya saja, atau diundang lewat email agar melihat grup yang sama dari akunnya.</p>
            </div>

            <button onClick={openNewGroup} className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"><Plus className="w-5 h-5" /> Buat Grup Split Bill</button>

            {cards.length === 0 && invites.length === 0 ? (
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
                <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
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

            <button onClick={() => setIsExpOpen(true)} className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"><Plus className="w-5 h-5" /> Tambah Pengeluaran</button>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              {(['ringkasan', 'pengeluaran', 'anggota'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${tab === t ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{t}</button>
              ))}
            </div>

            {/* --- Ringkasan --- */}
            {tab === 'ringkasan' && (
              <>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-3">Siapa bayar siapa</h3>
                  {debts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">{expenses.length === 0 ? 'Belum ada pengeluaran.' : 'Semua sudah lunas 🎉'}</p>
                  ) : (
                    <div className="space-y-3">
                      {debts.map((d, i) => {
                        const receiver = memberById(d.to);
                        const involvesMe = (memberById(d.from) && isMine(memberById(d.from)!)) || (receiver && isMine(receiver));
                        return (
                          <div key={i} className={`p-3 rounded-xl ${involvesMe ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0 text-xs text-gray-700 dark:text-gray-200">
                                <span className="font-bold">{nameOf(d.from)}</span> <ArrowRight className="w-3 h-3 inline mx-0.5" /> <span className="font-bold">{nameOf(d.to)}</span>
                                <p className="font-bold text-red-500 dark:text-red-400 text-base">{formatRupiah(d.amount)}</p>
                              </div>
                              <button onClick={() => handleSettle(d)} className="bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold px-3 py-2 rounded-lg shrink-0">Tandai Lunas</button>
                            </div>
                            {receiver && <BankLine m={receiver} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-3">Saldo tiap orang</h3>
                  <div className="space-y-2">
                    {members.map((m) => {
                      const v = Math.round(net[m.id] || 0);
                      return (
                        <div key={m.id} className="flex justify-between items-center gap-2 text-xs">
                          <span className="text-gray-700 dark:text-gray-200 font-medium truncate">{m.name}{isMine(m) ? ' (kamu)' : ''}</span>
                          <span className={`font-bold shrink-0 ${v > 0 ? 'text-green-600 dark:text-green-400' : v < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
                            {v > 0 ? `menerima ${formatRupiah(v)}` : v < 0 ? `berutang ${formatRupiah(-v)}` : 'lunas'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {settlements.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-3">Riwayat pelunasan</h3>
                    <div className="space-y-2">
                      {settlements.map((s) => (
                        <p key={s.id} className="text-[11px] text-gray-600 dark:text-gray-300 flex justify-between gap-2">
                          <span className="min-w-0 truncate"><strong>{nameOf(s.from_member)}</strong> → <strong>{nameOf(s.to_member)}</strong></span>
                          <span className="font-bold shrink-0">{formatRupiah(Number(s.amount))}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* --- Pengeluaran --- */}
            {tab === 'pengeluaran' && (
              <div className="space-y-3">
                {expenses.length === 0 && <p className="text-center text-xs text-gray-400 py-8">Belum ada pengeluaran.</p>}
                {expenses.map((x) => {
                  const open = expandedId === x.id;
                  const canDelete = x.created_by === userId || isOwner;
                  const items = (x.split_expense_items || []).slice().sort((a, b) => a.position - b.position);
                  return (
                    <div key={x.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                      <button onClick={() => setExpandedId(open ? null : x.id)} className="w-full text-left p-4 flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{x.title}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatDateID(x.expense_date)} · dibayar {nameOf(x.paid_by)}{x.split_type === 'items' ? ` · ${items.length} item` : ''}</p>
                        </div>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100 shrink-0">{formatRupiah(Number(x.total_amount))}</p>
                        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />}
                      </button>
                      {open && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 dark:border-gray-700 pt-3">
                          {items.length > 0 && (
                            <div className="space-y-1.5">
                              {items.map((it) => (
                                <div key={it.id} className="text-[11px]">
                                  <p className="flex justify-between gap-2 text-gray-700 dark:text-gray-200"><span className="truncate">{it.name}{it.qty > 1 ? ` x${it.qty}` : ''}</span><span className="shrink-0 font-medium">{formatRupiah(Number(it.price) * it.qty)}</span></p>
                                  <p className="text-[10px] text-gray-400 truncate">{(it.split_item_assignees || []).map((a) => nameOf(a.member_id)).join(', ') || '-'}</p>
                                </div>
                              ))}
                              <div className="pt-1.5 border-t border-dashed border-gray-200 dark:border-gray-600 text-[10px] text-gray-500 dark:text-gray-400 space-y-0.5">
                                <p className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(Number(x.subtotal || 0))}</span></p>
                                {Number(x.discount_amount) > 0 && <p className="flex justify-between"><span>Diskon</span><span>-{formatRupiah(Number(x.discount_amount))}</span></p>}
                                {Number(x.service_amount) > 0 && <p className="flex justify-between"><span>Service</span><span>+{formatRupiah(Number(x.service_amount))}</span></p>}
                                {Number(x.tax_amount) > 0 && <p className="flex justify-between"><span>Pajak</span><span>+{formatRupiah(Number(x.tax_amount))}</span></p>}
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Bagian tiap orang</p>
                            <div className="space-y-1">
                              {(x.split_shares || []).map((s) => (
                                <p key={s.member_id} className="text-[11px] flex justify-between gap-2 text-gray-700 dark:text-gray-200"><span className="truncate">{nameOf(s.member_id)}</span><span className="font-bold shrink-0">{formatRupiah(Number(s.share_amount))}</span></p>
                              ))}
                            </div>
                          </div>
                          {canDelete && <button onClick={() => handleDeleteExpense(x)} className="w-full text-red-500 bg-red-50 dark:bg-red-900/20 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Hapus pengeluaran</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* --- Anggota --- */}
            {tab === 'anggota' && (
              <div className="space-y-3">
                {members.map((m) => (
                  <div key={m.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{m.name}{isMine(m) ? ' (kamu)' : ''}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.user_id === group.user_id && <span className="text-[9px] font-bold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded">Pembuat</span>}
                          {m.user_id && m.status === 'accepted' && m.user_id !== group.user_id && <span className="text-[9px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded flex items-center gap-0.5"><UserCheck className="w-3 h-3" /> Pengguna Celengin</span>}
                          {m.status === 'pending' && <span className="text-[9px] font-bold bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">Menunggu persetujuan</span>}
                          {!m.user_id && <span className="text-[9px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded">Nama saja</span>}
                        </div>
                      </div>
                      {(isOwner || isMine(m)) && <button onClick={() => openBank(m)} className="shrink-0 p-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 hover:text-teal-600" aria-label="Ubah info rekening"><Pencil className="w-3.5 h-3.5" /></button>}
                    </div>
                    <BankLine m={m} />
                  </div>
                ))}

                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-3">
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-100">Tambah teman</p>
                  <div className="flex gap-2">
                    <input value={newMember} onChange={(e) => setNewMember(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMember(); } }} placeholder="Nama teman (tanpa akun)" className={inputCls} />
                    <button onClick={handleAddMember} className="bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 w-11 h-11 rounded-xl shrink-0 flex items-center justify-center" aria-label="Tambah"><Plus className="w-5 h-5" /></button>
                  </div>
                  <button onClick={() => setIsInviteOpen(true)} className="w-full h-11 rounded-xl border-2 border-dashed border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 text-xs font-bold flex items-center justify-center gap-1.5"><UserPlus className="w-4 h-4" /> Undang pengguna Celengin (lewat email)</button>
                </div>
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
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nama grup</label>
                <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Makan malam Sabtu" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Ikon</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map((em) => (
                    <button type="button" key={em} onClick={() => setGEmoji(em)} className={`w-10 h-10 rounded-xl text-xl border-2 ${gEmoji === em ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30' : 'border-gray-100 dark:border-gray-700'}`}>{em}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Teman yang ikut</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[11px] bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2.5 py-1 rounded-lg font-bold max-w-full truncate">{myName} (kamu)</span>
                  {gMembers.map((m, i) => (
                    <span key={i} className={`text-[11px] border px-2.5 py-1 rounded-lg flex items-center gap-1 max-w-full ${m.userId ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200'}`}>
                      <span className="truncate">{m.userId ? '✉ ' : ''}{m.name}</span><button type="button" onClick={() => setGMembers((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 shrink-0"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-2">
                  <button type="button" onClick={() => { setGInviteMode(false); setGMemberInput(''); }} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold ${!gInviteMode ? 'bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>Nama saja</button>
                  <button type="button" onClick={() => { setGInviteMode(true); setGMemberInput(''); }} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold ${gInviteMode ? 'bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>Undang pengguna (email)</button>
                </div>
                <div className="flex gap-2">
                  <input type={gInviteMode ? 'email' : 'text'} value={gMemberInput} onChange={(e) => setGMemberInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroupMemberChip(); } }} placeholder={gInviteMode ? 'email@contoh.com' : 'Nama teman'} className={inputCls} />
                  <button type="button" onClick={() => addGroupMemberChip()} disabled={gAdding} className="bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 w-11 h-11 rounded-xl shrink-0 flex items-center justify-center disabled:opacity-50"><Plus className="w-5 h-5" /></button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">{gInviteMode ? 'Pengguna yang diundang melihat grup ini dari akunnya setelah menerima.' : 'Teman tidak perlu punya akun, cukup ditulis namanya.'} Bisa ditambah lagi nanti di tab Anggota.</p>
              </div>
              <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all">Buat Grup</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL REKENING ===== */}
      {bankMember && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setBankMember(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-1 text-gray-800 dark:text-white">Info Rekening</h2>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-4 truncate">{bankMember.name}</p>
            <form onSubmit={handleSaveBank} className="space-y-3">
              <select value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputCls}>
                <option value="">Pilih Bank / E-Wallet</option>
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <input inputMode="numeric" value={bankNumber} onChange={(e) => setBankNumber(e.target.value)} placeholder="Nomor rekening / nomor HP" className={inputCls} />
              <input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} placeholder="Nama pemilik rekening" className={inputCls} />
              <p className="text-[10px] text-gray-400">Dipakai agar teman yang berutang langsung tahu harus transfer ke mana.</p>
              <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all">Simpan</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL UNDANG ===== */}
      {isInviteOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setIsInviteOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-1 text-gray-800 dark:text-white">Undang Pengguna</h2>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-4">Masukkan email akun Celengin temanmu. Dia akan melihat grup ini di menu Split Bill-nya.</p>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="relative"><Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" /><input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@contoh.com" className={`${inputCls} pl-9`} /></div>
              <button type="submit" disabled={inviteBusy} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all">{inviteBusy ? 'Mengundang...' : 'Kirim Undangan'}</button>
            </form>
          </div>
        </div>
      )}

      {group && (
        <SplitExpenseModal
          isOpen={isExpOpen}
          onClose={() => setIsExpOpen(false)}
          groupId={group.id}
          members={members}
          currentUserId={userId}
          showDialog={showDialog}
          onSaved={async () => { setTab('pengeluaran'); await loadGroup(group); loadList(); }}
        />
      )}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
