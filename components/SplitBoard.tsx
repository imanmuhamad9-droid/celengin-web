'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Trash2, UserPlus, ArrowRight, Receipt, Copy, CreditCard, Pencil, Mail, Check, ChevronDown, ChevronUp, UserCheck, MessageCircle, Info } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { formatRupiah, formatDateID, parseRupiahInput, toLocalDateStr } from '@/lib/utils';
import { computeNet, simplifyDebts } from '@/lib/splitbill';
import { pushInviteNow } from '@/lib/notifications';
import { BANKS, SplitGroup, SplitMember, SplitExpense, SplitSettlement } from '@/lib/splitTypes';
import SplitExpenseModal from '@/components/SplitExpenseModal';
import WaShareSheet, { WaOption } from '@/components/WaShareSheet';
import { buildExpenseMessage, buildPersonMessage, buildDebtSummaryMessage, buildLedgerMessage, fmtMonth, WaExpense, WaMember } from '@/lib/whatsapp';
import CustomDialog from '@/components/CustomDialog';
import BottomNav from '@/components/BottomNav';
import AppHeader from '@/components/AppHeader';
import SubTabs, { BARENG_TABS, PATUNGAN_TABS } from '@/components/SubTabs';
import SkeletonLoader from '@/components/SkeletonLoader';

interface GroupCard extends SplitGroup { memberCount: number; total: number }
interface Invite { memberId: string; group: SplitGroup }

const EMOJIS = ['🍽️', '🏖️', '🏠', '🎬', '🚗', '🛒', '🎉', '☕'];
const EMOJIS_RUNNING = ['🤝', '🏠', '👫', '👨‍👩‍👧', '🛒', '🍜', '🚗', '💸'];
const INTRO_KEY = 'celengin:gantian-intro-hidden';

function labelsFor(running: boolean) {
  return running ? {
    title: 'Bayarin',
    menu: 'Bayarin',
    create: 'Buat Bayarin Baru',
    modalTitle: 'Bayarin Baru',
    nameLabel: 'Nama',
    namePh: 'Rina & Dito',
    friends: 'Siapa saja yang ikut',
    empty: 'Belum ada. Buat satu, misalnya "Rina & Dito".',
    inviteLabel: 'Undangan Bayarin',
    entity: 'daftar',
    addExp: 'Catat Bayarin',
    tabs: { ringkasan: 'Saldo', pengeluaran: 'Catatan', anggota: 'Anggota' },
    nameEmpty: 'Isi namanya dulu, misalnya "Rina & Dito".',
    created: 'Berhasil Dibuat',
    deleteTitle: 'Hapus Bayarin?',
    deleteMsg: (n: string) => `"${n}" beserta semua catatan dan pembayarannya akan dihapus permanen untuk semua anggota.`,
    noExp: 'Belum ada catatan.',
    delExpTitle: 'Hapus Catatan?',
    delExp: 'Hapus catatan',
    sqlFile: 'sql/05_gantian.sql',
  } : {
    title: 'Patungan',
    menu: 'Patungan',
    create: 'Buat Grup Patungan',
    modalTitle: 'Grup Patungan Baru',
    nameLabel: 'Nama grup',
    namePh: 'Makan malam Sabtu',
    friends: 'Teman yang ikut',
    empty: 'Belum ada grup. Buat satu untuk mulai patungan.',
    inviteLabel: 'Kamu diundang ke grup Patungan',
    entity: 'grup',
    addExp: 'Tambah Pengeluaran',
    tabs: { ringkasan: 'ringkasan', pengeluaran: 'pengeluaran', anggota: 'anggota' },
    nameEmpty: 'Isi nama grup, misalnya "Makan Malam Sabtu".',
    created: 'Grup Dibuat',
    deleteTitle: 'Hapus Grup?',
    deleteMsg: (n: string) => `Grup "${n}" beserta seluruh pengeluaran dan pelunasannya akan dihapus permanen untuk semua anggota.`,
    noExp: 'Belum ada pengeluaran.',
    delExpTitle: 'Hapus Pengeluaran?',
    delExp: 'Hapus pengeluaran',
    sqlFile: 'sql/03_splitbill.sql',
  };
}
const inputCls = 'w-full min-w-0 h-11 px-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-500';

export default function SplitBoard({ kind }: { kind: 'event' | 'running' }) {
  const router = useRouter();
  const isRunning = kind === 'running';
  const L = labelsFor(isRunning);
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

  // Gantian + WhatsApp
  const [introHidden, setIntroHidden] = useState(true); // true dulu agar tidak berkedip; nilai aslinya dibaca di effect
  const [curMonth, setCurMonth] = useState('');
  const [monthFilter, setMonthFilter] = useState('all');
  const [bankPhone, setBankPhone] = useState('');
  const [settleLine, setSettleLine] = useState<{ from: string; to: string; amount: number } | null>(null);
  const [settleDisplay, setSettleDisplay] = useState('');
  const [settleRaw, setSettleRaw] = useState(0);
  const [settleBusy, setSettleBusy] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waTitle, setWaTitle] = useState('Kirim ke WhatsApp');
  const [waOptions, setWaOptions] = useState<WaOption[]>([]);
  const openedFromQuery = useRef(false);

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
    const allGroups = (g.data || []) as SplitGroup[];
    // Split Bill menampilkan grup 'event' (termasuk semua grup lama); Gantian menampilkan 'running'
    const groups = allGroups.filter((x) => (x.kind ?? 'event') === kind);
    const needs05 = isRunning && allGroups.length > 0 && !('kind' in allGroups[0]);
    const ids = groups.map((x) => x.id);

    let mem: SplitMember[] = [];
    let exp: { group_id: string; total_amount: number | string }[] = [];
    if (ids.length > 0) {
      mem = ((await supabase.from('split_members').select('*').in('group_id', ids)).data || []) as SplitMember[];
      exp = (await supabase.from('split_expenses').select('group_id,total_amount').in('group_id', ids)).data || [];
    }
    // Versi SQL lama belum punya kolom user_id: minta jalankan ulang 03_splitbill.sql
    if (needs05 || (mem.length > 0 && !('user_id' in mem[0]))) setMissingTable(true); else setMissingTable(false);

    const pendingIds = new Set(mem.filter((m) => m.user_id === uid && m.status === 'pending').map((m) => m.group_id));
    setInvites(groups.filter((x) => pendingIds.has(x.id)).map((x) => ({ memberId: mem.find((m) => m.group_id === x.id && m.user_id === uid)!.id, group: x })));
    setCards(groups.filter((x) => !pendingIds.has(x.id)).map((x) => ({
      ...x,
      memberCount: mem.filter((m) => m.group_id === x.id).length,
      total: exp.filter((e) => e.group_id === x.id).reduce((s, e) => s + Number(e.total_amount), 0),
    })));
    setLoading(false);

    // Notifikasi pengingat membuka buku tertentu lewat /gantian?book=<id>
    const wanted = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('book') : null;
    if (wanted && !openedFromQuery.current) {
      const target = groups.find((x) => x.id === wanted && !pendingIds.has(x.id));
      if (target) { openedFromQuery.current = true; setTab('ringkasan'); loadGroup(target); }
    }
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
  useEffect(() => {
    try { setIntroHidden(localStorage.getItem(INTRO_KEY) === '1'); } catch (_) { setIntroHidden(false); }
    setCurMonth(toLocalDateStr(new Date()).slice(0, 7));
  }, []);

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

  // Khusus Gantian: saldo milikku, total bulan ini, daftar bulan untuk filter
  const myMember = members.find((m) => isMine(m));
  const myDebts = myMember ? debts.filter((d) => d.from === myMember.id || d.to === myMember.id) : [];
  const monthTotal = curMonth ? expenses.filter((e) => e.expense_date.startsWith(curMonth)).reduce((s, e) => s + Number(e.total_amount), 0) : 0;
  const monthList = Array.from(new Set(expenses.map((e) => e.expense_date.slice(0, 7)))).sort().reverse();
  const shownExpenses = isRunning && monthFilter !== 'all' ? expenses.filter((e) => e.expense_date.startsWith(monthFilter)) : expenses;
  const hideIntro = () => { setIntroHidden(true); try { localStorage.setItem(INTRO_KEY, '1'); } catch (_) { /* abaikan */ } };
  const showIntro = () => { setIntroHidden(false); try { localStorage.removeItem(INTRO_KEY); } catch (_) { /* abaikan */ } };

  // ---------- Grup ----------
  const openNewGroup = () => { setGName(''); setGEmoji(isRunning ? '🤝' : '🍽️'); setGMembers([]); setGMemberInput(''); setGInviteMode(false); setIsGroupOpen(true); };

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
    if (!gName.trim()) return showDialog('Data Belum Lengkap', L.nameEmpty, 'danger');
    // Teks yang masih tertulis di kolom teman ikut ditambahkan
    if (gAdding) return;
    if (gMemberInput.trim()) { const ok = await addGroupMemberChip(); if (!ok) return; }
    const pending = gMembers;

    const { data: g, error } = await supabase.from('split_groups').insert({ user_id: userId, name: gName.trim(), emoji: gEmoji, ...(isRunning ? { kind: 'running' } : {}) }).select().single();
    if (error || !g) {
      if (isRunning && /kind/i.test(error?.message || '')) return showDialog('Database Belum Siap', 'Jalankan sql/05_gantian.sql di Supabase SQL Editor dulu, lalu coba lagi.', 'danger');
      return showDialog('Gagal', error?.message || 'Gagal dibuat.', 'danger');
    }
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
    if (invited > 0) showDialog(L.created, `${invited} undangan terkirim. Mereka akan melihat ${L.entity} ini di menu ${L.menu}-nya setelah menerima.`, 'success');
  };

  const handleDeleteGroup = () => {
    if (!group) return;
    showDialog(L.deleteTitle, L.deleteMsg(group.name), 'danger', async () => {
      const { error } = await supabase.from('split_groups').delete().eq('id', group.id);
      if (error) return showLater('Gagal', error.message, 'danger');
      setGroup(null);
      loadList();
      showLater('Berhasil', isRunning ? 'Buku telah dihapus.' : 'Grup telah dihapus.', 'success');
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
    showDialog('Undangan Terkirim', `${name} akan melihat ${L.entity} ini di menu ${L.menu} miliknya. Setelah menerima, dia bisa ikut mencatat pengeluaran dan melihat siapa harus bayar siapa.`, 'success');
  };

  const openBank = (m: SplitMember) => {
    setBankMember(m);
    setBankName(m.bank_name || ''); setBankNumber(m.account_number || ''); setBankHolder(m.account_holder || ''); setBankPhone(m.phone || '');
  };
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankMember || !group) return;
    const patch: Record<string, string | null> = {
      bank_name: bankName || null, account_number: bankNumber.trim() || null, account_holder: bankHolder.trim() || null,
    };
    // Kolom phone baru ada setelah sql/05_gantian.sql; jangan dikirim kalau kosong supaya tidak error di database lama
    if (bankPhone.trim() || bankMember.phone) patch.phone = bankPhone.trim() || null;
    const { error } = await supabase.from('split_members').update(patch).eq('id', bankMember.id);
    if (error) return showDialog('Gagal', /phone/i.test(error.message) ? 'Jalankan sql/05_gantian.sql dulu agar nomor WhatsApp bisa disimpan.' : error.message, 'danger');
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
    showDialog(L.delExpTitle, `"${exp.title}" (${formatRupiah(Number(exp.total_amount))}) akan dihapus dan saldo dihitung ulang.`, 'danger', async () => {
      const { error } = await supabase.from('split_expenses').delete().eq('id', exp.id);
      if (error) return showLater('Gagal', error.message, 'danger');
      loadGroup(group);
      loadList();
    });
  };

  // Lunas penuh: tanya dulu, lalu dicatat dengan waktu saat itu. Tagihan pasangan ini kembali Rp0.
  const handleSettle = (line: { from: string; to: string; amount: number }) => {
    if (!group) return;
    showDialog('Sudah Bayar?', `Yakin ${nameOf(line.from)} sudah bayar ke ${nameOf(line.to)} sebesar ${formatRupiah(line.amount)}? Pembayaran dicatat di riwayat dengan tanggal hari ini, dan tagihan ini kembali Rp0.`, 'info', async () => {
      const { error } = await supabase.from('split_settlements').insert({ group_id: group.id, from_member: line.from, to_member: line.to, amount: line.amount, created_by: userId });
      if (error) return showLater('Gagal', error.message, 'danger');
      loadGroup(group);
      loadList();
      showLater('Lunas 🎉', `${nameOf(line.from)} sudah bayar ke ${nameOf(line.to)} sebesar ${formatRupiah(line.amount)}. Tercatat di riwayat.`, 'success');
    });
  };

  // Bayar sebagian: nominal bisa diubah, sisanya tetap tercatat.
  const handlePartial = (line: { from: string; to: string; amount: number }) => {
    if (!group) return;
    setSettleLine(line); setSettleRaw(line.amount); setSettleDisplay(new Intl.NumberFormat('id-ID').format(line.amount));
  };

  const submitSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !settleLine || settleBusy) return;
    if (settleRaw <= 0) return showDialog('Nominal Kosong', 'Isi nominal yang dibayarkan.', 'danger');
    if (settleRaw > settleLine.amount) return showDialog('Melebihi Saldo', `Nominal tidak boleh lebih dari ${formatRupiah(settleLine.amount)} yang masih harus dibayar.`, 'danger');
    setSettleBusy(true);
    const { error } = await supabase.from('split_settlements').insert({ group_id: group.id, from_member: settleLine.from, to_member: settleLine.to, amount: settleRaw, created_by: userId });
    setSettleBusy(false);
    if (error) return showDialog('Gagal', error.message, 'danger');
    const left = settleLine.amount - settleRaw;
    setSettleLine(null);
    loadGroup(group);
    showDialog('Pembayaran Tercatat', left > 0 ? `Sisa ${formatRupiah(left)} masih tercatat dan terbawa ke hitungan berikutnya.` : 'Lunas. Saldo sekarang impas 🎉', 'success');
  };

  const fmtWhen = (iso: string) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Salah catat? Pembayaran bisa dibatalkan oleh yang mencatat atau pembuatnya.
  const handleUndoSettlement = (st: SplitSettlement) => {
    if (!group) return;
    showDialog('Batalkan Pembayaran?', `Pembayaran ${nameOf(st.from_member)} ke ${nameOf(st.to_member)} sebesar ${formatRupiah(Number(st.amount))} (${fmtWhen(st.created_at as string)}) dihapus dari riwayat dan saldo dihitung ulang.`, 'danger', async () => {
      const { error } = await supabase.from('split_settlements').delete().eq('id', st.id);
      if (error) return showLater('Gagal', error.message, 'danger');
      loadGroup(group);
      loadList();
    });
  };

  // Hanya pembuat yang bisa mengeluarkan anggota (atau membatalkan undangan yang belum diterima).
  const handleDeleteMember = (m: SplitMember) => {
    if (!group || !isOwner) return;
    const hasHistory = expenses.some((e) => e.paid_by === m.id || (e.split_shares || []).some((x) => x.member_id === m.id))
      || settlements.some((x) => x.from_member === m.id || x.to_member === m.id);
    if (hasHistory) return showDialog('Belum Bisa Dikeluarkan', `${m.name} masih tercatat di catatan atau pembayaran. Hapus dulu catatan yang melibatkan ${m.name}, baru bisa dikeluarkan.`, 'info');
    const pending = m.status === 'pending';
    showDialog(pending ? 'Batalkan Undangan?' : `Keluarkan ${m.name}?`, pending ? `Undangan untuk ${m.name} dibatalkan.` : `${m.name} dihapus dari ${L.entity} ini.`, 'danger', async () => {
      const { error } = await supabase.from('split_members').delete().eq('id', m.id);
      if (error) return showLater('Gagal', error.message, 'danger');
      loadGroup(group);
      loadList();
    });
  };

  // ---------- Kirim ke WhatsApp ----------
  const waMembers: WaMember[] = members.map((m) => ({ id: m.id, name: m.name, bank_name: m.bank_name, account_number: m.account_number, account_holder: m.account_holder, phone: m.phone }));
  const asWaExpense = (x: SplitExpense): WaExpense => ({
    id: x.id, title: x.title, expense_date: x.expense_date, paid_by: x.paid_by, total_amount: x.total_amount, split_type: x.split_type,
    subtotal: x.subtotal, discount_amount: x.discount_amount, service_amount: x.service_amount, tax_amount: x.tax_amount,
    split_shares: x.split_shares, split_expense_items: x.split_expense_items,
  });
  const openExpenseWa = (x: SplitExpense) => {
    if (!group) return;
    const e = asWaExpense(x);
    const opts: WaOption[] = [{ key: 'all', label: 'Rincian lengkap', hint: 'Satu pesan berisi seluruh rincian. Cocok dikirim ke grup WhatsApp.', text: buildExpenseMessage(group.name, group.emoji, e, waMembers) }];
    members.forEach((m) => {
      const share = (x.split_shares || []).find((s) => s.member_id === m.id);
      if (!share || Number(share.share_amount) <= 0 || m.id === x.paid_by) return;
      opts.push({ key: m.id, label: m.name, hint: `Pesan pribadi untuk ${m.name}: hanya pesanan dan bagiannya.`, text: buildPersonMessage(group.name, e, waMembers, m.id), phone: m.phone });
    });
    setWaTitle('Kirim rincian ke WhatsApp');
    setWaOptions(opts);
    setWaOpen(true);
  };
  const openSummaryWa = () => {
    if (!group) return;
    const opts: WaOption[] = [];
    if (isRunning) {
      const ym = monthFilter !== 'all' ? monthFilter : curMonth;
      const exps = expenses.map(asWaExpense);
      opts.push({ key: 'month', label: ym ? `Saldo + catatan ${fmtMonth(ym)}` : 'Saldo + catatan', hint: 'Saldo terkini dan daftar catatan bulan itu.', text: buildLedgerMessage(group.name, group.emoji, waMembers, debts, exps, ym || null) });
      opts.push({ key: 'all', label: 'Saldo + semua catatan', text: buildLedgerMessage(group.name, group.emoji, waMembers, debts, exps, null) });
      opts.push({ key: 'saldo', label: 'Saldo saja', text: buildDebtSummaryMessage(group.name, group.emoji, waMembers, debts) });
    } else {
      opts.push({ key: 'summary', label: 'Siapa bayar siapa', text: buildDebtSummaryMessage(group.name, group.emoji, waMembers, debts) });
    }
    setWaTitle('Kirim rekap ke WhatsApp');
    setWaOptions(opts);
    setWaOpen(true);
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
    <div className="min-h-screen bg-[#faf8ff] dark:bg-gray-950 pb-40 transition-colors">
      <AppHeader
        z="z-40"
        title={group ? (isRunning ? group.name : `${group.emoji} ${group.name}`) : L.title}
        onBack={group ? goBack : undefined}
        action={<>
          {!group && isRunning && introHidden && <button onClick={showIntro} className="text-gray-400 hover:text-teal-600" aria-label="Menu ini untuk apa?"><Info className="w-5 h-5" /></button>}
          {group && isOwner && <button onClick={handleDeleteGroup} className="text-gray-400 hover:text-red-500" aria-label="Hapus grup"><Trash2 className="w-5 h-5" /></button>}
        </>}
      />

      <main className="px-5 mt-4 space-y-4">
        {/* Di daftar (bukan di dalam sebuah grup): tab Bareng + pilihan Patungan / Bayarin */}
        {!group && (
          <div className="space-y-3">
            <SubTabs items={BARENG_TABS} />
            <SubTabs items={PATUNGAN_TABS} size="sub" />
          </div>
        )}
        {missingTable && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-2xl text-xs text-yellow-800 dark:text-yellow-300">
            Database {L.menu} belum siap. Jalankan <strong>{L.sqlFile}</strong> (versi terbaru) di Supabase SQL Editor, lalu muat ulang halaman ini.
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
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-xl shrink-0">{isRunning ? <img src="/menu-icons/gantian.png" alt="" className="w-9 h-9 object-contain" /> : inv.group.emoji}</div>
                      <div className="min-w-0"><p className="text-[11px] text-gray-500 dark:text-gray-400">{L.inviteLabel}</p><p className="font-bold text-sm text-gray-800 dark:text-white truncate">{inv.group.name}</p></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => respondInvite(inv, true)} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1"><Check className="w-4 h-4" /> Terima</button>
                      <button onClick={() => respondInvite(inv, false)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1"><X className="w-4 h-4" /> Tolak</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isRunning ? (
              !introHidden && (
                <div className="relative bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-2xl p-4">
                  <button onClick={hideIntro} aria-label="Sembunyikan" className="absolute top-3 right-3 text-teal-600/60 hover:text-teal-700 dark:text-teal-300/60"><X className="w-4 h-4" /></button>
                  <p className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-1 pr-6">Bayarin: untuk apa menu ini?</p>
                  <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80 leading-relaxed mb-2">Untuk adik, teman, atau pasangan yang sering saling membayarkan dan baru hitung-hitungan belakangan. Catat siapa yang bayar dan untuk siapa. Saldonya otomatis saling mengurangi, jadi tinggal satu angka: siapa bayar ke siapa.</p>
                  <ul className="text-[11px] text-teal-700/80 dark:text-teal-400/80 leading-relaxed space-y-1 list-disc pl-4">
                    <li>Catat satu barang, atau banyak barang dari satu struk (bisa scan struk).</li>
                    <li>Sudah bayar? Tekan Lunas, atau Bayar sebagian. Semuanya tercatat di riwayat lengkap dengan tanggalnya.</li>
                    <li>Berdiri sendiri: tidak mengubah transaksi atau saldo dompet.</li>
                  </ul>
                  <button onClick={hideIntro} className="mt-3 text-[11px] font-bold text-teal-700 dark:text-teal-300 underline underline-offset-2">Mengerti, sembunyikan</button>
                  <p className="text-[10px] text-teal-700/60 dark:text-teal-400/60 mt-1">Bisa dibuka lagi lewat ikon ⓘ di pojok atas.</p>
                </div>
              )
            ) : (
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800 rounded-2xl p-4">
                <p className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-1">Patungan tanpa ribet</p>
                <p className="text-[11px] text-teal-700/80 dark:text-teal-400/80 leading-relaxed">Foto struk dalam bentuk daftar: isi tiap pesanan, pajak, dan diskon, lalu pilih siapa memakai apa. Celengin menghitung bagian tiap orang dan siapa harus transfer ke siapa. Teman bisa ditulis namanya saja, atau diundang lewat email agar melihat grup yang sama dari akunnya.</p>
              </div>
            )}

            <button onClick={openNewGroup} className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"><Plus className="w-5 h-5" /> {L.create}</button>

            {cards.length === 0 && invites.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
                <Receipt className="w-12 h-12 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-gray-500 text-sm">{L.empty}</p>
              </div>
            ) : cards.map((c) => (
              <button key={c.id} onClick={() => { setTab('ringkasan'); loadGroup(c); }} className="w-full text-left bg-white dark:bg-gray-800 p-4 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-3 transition-colors active:scale-[0.99]">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-2xl shrink-0">{isRunning ? <img src="/menu-icons/gantian.png" alt="" className="w-11 h-11 object-contain" /> : c.emoji}</div>
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
            {isRunning ? (
              <div className="bg-teal-700 text-white rounded-3xl p-5 shadow-lg">
                {expenses.length === 0 ? (
                  <><p className="text-[11px] text-teal-100">Saldo</p><p className="text-lg font-bold">Belum ada catatan</p></>
                ) : debts.length === 0 ? (
                  <><p className="text-[11px] text-teal-100">Saldo</p><p className="text-2xl font-bold">Impas 🎉</p><p className="text-[11px] text-teal-100 mt-0.5">Tidak ada yang perlu dibayar.</p></>
                ) : (
                  (myDebts.length > 0 ? myDebts : debts.slice(0, 1)).map((d, i) => (
                    <div key={i} className={i > 0 ? 'mt-3' : ''}>
                      <p className="text-[11px] text-teal-100">
                        {`${nameOf(d.from)} harus bayar ke ${nameOf(d.to)}`}
                      </p>
                      <p className="text-3xl font-bold">{formatRupiah(d.amount)}</p>
                    </div>
                  ))
                )}
                <p className="text-[11px] text-teal-100 mt-3">{members.length} orang · {expenses.length} catatan · bulan ini {formatRupiah(monthTotal)}</p>
                <div className="mt-3 space-y-2">
                  {debts.length > 0 && (myDebts.length > 0 ? myDebts : debts.slice(0, 1)).length === 1 && (
                    <div className="flex gap-2">
                      <button onClick={() => handleSettle(myDebts.length > 0 ? myDebts[0] : debts[0])} className="flex-1 h-10 rounded-xl bg-white text-teal-700 text-xs font-bold active:scale-95 transition-transform">Lunas</button>
                      <button onClick={() => handlePartial(myDebts.length > 0 ? myDebts[0] : debts[0])} className="flex-1 h-10 rounded-xl border border-teal-400 text-white text-xs font-bold active:scale-95 transition-transform">Bayar sebagian</button>
                    </div>
                  )}
                  {expenses.length > 0 && (
                    <button onClick={openSummaryWa} className="w-full h-10 rounded-xl border border-teal-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"><MessageCircle className="w-4 h-4" /> Kirim ke WA</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-teal-700 text-white rounded-3xl p-5 shadow-lg">
                <p className="text-[11px] text-teal-100">Total pengeluaran grup</p>
                <p className="text-2xl font-bold">{formatRupiah(totalSpent)}</p>
                <p className="text-[11px] text-teal-100 mt-1">{members.length} orang · {expenses.length} pengeluaran</p>
              </div>
            )}

            <button onClick={() => setIsExpOpen(true)} className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all"><Plus className="w-5 h-5" /> {L.addExp}</button>

            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              {(['ringkasan', 'pengeluaran', 'anggota'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${tab === t ? 'bg-white dark:bg-gray-700 text-teal-700 dark:text-teal-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>{L.tabs[t]}</button>
              ))}
            </div>

            {/* --- Ringkasan --- */}
            {tab === 'ringkasan' && (
              <>
                <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100">Siapa bayar siapa</h3>
                    {expenses.length > 0 && <button onClick={openSummaryWa} className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-full"><MessageCircle className="w-3.5 h-3.5" /> Kirim ke WA</button>}
                  </div>
                  {debts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">{expenses.length === 0 ? L.noExp : 'Semua sudah lunas 🎉'}</p>
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
                              <div className="flex flex-col gap-1.5 shrink-0">
                                <button onClick={() => handleSettle(d)} className="bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold px-3 py-2 rounded-lg">Lunas</button>
                                {isRunning && <button onClick={() => handlePartial(d)} className="bg-white dark:bg-gray-700 border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 text-[10px] font-bold px-3 py-1.5 rounded-lg">Bayar sebagian</button>}
                              </div>
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
                          <span className="text-gray-700 dark:text-gray-200 font-medium truncate">{m.name}{!isRunning && isMine(m) ? ' (kamu)' : ''}</span>
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
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-3">Riwayat pembayaran</h3>
                    <div className="space-y-3">
                      {settlements.map((st) => (
                        <div key={st.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-700 dark:text-gray-200 truncate"><strong>{nameOf(st.from_member)}</strong> bayar ke <strong>{nameOf(st.to_member)}</strong></p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{st.created_at ? fmtWhen(st.created_at as string) : ''}{(st.created_by === userId || isOwner) && <button onClick={() => handleUndoSettlement(st)} className="ml-2 font-bold text-red-400 hover:text-red-500">Batalkan</button>}</p>
                          </div>
                          <span className="font-bold text-sm text-green-600 dark:text-green-400 shrink-0">{formatRupiah(Number(st.amount))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* --- Pengeluaran --- */}
            {tab === 'pengeluaran' && (
              <div className="space-y-3">
                {isRunning && monthList.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                    {['all', ...monthList].map((ym) => (
                      <button key={ym} onClick={() => setMonthFilter(ym)} className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border-2 ${monthFilter === ym ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' : 'border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>{ym === 'all' ? 'Semua' : fmtMonth(ym)}</button>
                    ))}
                  </div>
                )}
                {isRunning && monthFilter !== 'all' && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 px-1">{shownExpenses.length} catatan · total {formatRupiah(shownExpenses.reduce((s, e) => s + Number(e.total_amount), 0))}</p>
                )}
                {shownExpenses.length === 0 && <p className="text-center text-xs text-gray-400 py-8">{L.noExp}</p>}
                {shownExpenses.map((x) => {
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
                          <button onClick={() => openExpenseWa(x)} className="w-full text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Kirim ke WhatsApp</button>
                          {canDelete && <button onClick={() => handleDeleteExpense(x)} className="w-full text-red-500 bg-red-50 dark:bg-red-900/20 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> {L.delExp}</button>}
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
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{m.name}{!isRunning && isMine(m) ? ' (kamu)' : ''}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.user_id === group.user_id && <span className="text-[9px] font-bold bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded">Pembuat</span>}
                          {m.user_id && m.status === 'accepted' && m.user_id !== group.user_id && <span className="text-[9px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded flex items-center gap-0.5"><UserCheck className="w-3 h-3" /> Pengguna Celengin</span>}
                          {m.status === 'pending' && <span className="text-[9px] font-bold bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">Menunggu persetujuan</span>}
                          {!m.user_id && <span className="text-[9px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded">Nama saja</span>}
                        </div>
                        {m.phone && <p className="text-[10px] text-gray-400 mt-1">WhatsApp: {m.phone}</p>}
                      </div>
                      {(isOwner || isMine(m)) && <button onClick={() => openBank(m)} className="shrink-0 p-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 hover:text-teal-600" aria-label="Ubah info rekening"><Pencil className="w-3.5 h-3.5" /></button>}
                      {isOwner && m.user_id !== group.user_id && <button onClick={() => handleDeleteMember(m)} className="shrink-0 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-500" aria-label={m.status === 'pending' ? 'Batalkan undangan' : 'Keluarkan anggota'}><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                    <BankLine m={m} />
                  </div>
                ))}

                {!isOwner && <p className="text-[11px] text-gray-400 text-center px-2">Hanya pembuat {L.entity} ini yang bisa mengeluarkan anggota.</p>}

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
            <h2 className="text-lg font-bold text-center mb-4 text-gray-800 dark:text-white">{L.modalTitle}</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{L.nameLabel}</label>
                <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder={L.namePh} className={inputCls} />
              </div>
              {!isRunning && <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Ikon</label>
                <div className="flex flex-wrap gap-2">
                  {(isRunning ? EMOJIS_RUNNING : EMOJIS).map((em) => (
                    <button type="button" key={em} onClick={() => setGEmoji(em)} className={`w-10 h-10 rounded-xl text-xl border-2 ${gEmoji === em ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30' : 'border-gray-100 dark:border-gray-700'}`}>{em}</button>
                  ))}
                </div>
              </div>}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{L.friends}</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[11px] bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-2.5 py-1 rounded-lg font-bold max-w-full truncate">{myName}{isRunning ? '' : ' (kamu)'}</span>
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
                <p className="text-[10px] text-gray-400 mt-1.5">{gInviteMode ? `Pengguna yang diundang melihat ${L.entity} ini dari akunnya setelah menerima.` : 'Teman tidak perlu punya akun, cukup ditulis namanya.'} Bisa ditambah lagi nanti di tab Anggota.</p>
              </div>
              <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all">{isRunning ? 'Buat Bayarin' : 'Buat Grup'}</button>
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
              <input type="tel" inputMode="tel" value={bankPhone} onChange={(e) => setBankPhone(e.target.value)} placeholder="Nomor WhatsApp (opsional), cth 0812..." className={inputCls} />
              <p className="text-[10px] text-gray-400">Rekening dipakai agar yang berutang langsung tahu harus transfer ke mana. Nomor WhatsApp membuat tombol Kirim ke WhatsApp langsung membuka chat orang ini.</p>
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
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-4">Masukkan email akun Celengin temanmu. Dia akan melihat {L.entity} ini di menu {L.menu}-nya.</p>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="relative"><Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" /><input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@contoh.com" className={`${inputCls} pl-9`} /></div>
              <button type="submit" disabled={inviteBusy} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all">{inviteBusy ? 'Mengundang...' : 'Kirim Undangan'}</button>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL CATAT PEMBAYARAN (Gantian) ===== */}
      {settleLine && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm p-6 relative transition-colors">
            <button onClick={() => setSettleLine(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-center mb-1 text-gray-800 dark:text-white">Catat Pembayaran</h2>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-4"><strong>{nameOf(settleLine.from)}</strong> membayar ke <strong>{nameOf(settleLine.to)}</strong>. Masih harus dibayar {formatRupiah(settleLine.amount)}.</p>
            <form onSubmit={submitSettle} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">Nominal yang dibayarkan (Rp)</label>
                <input inputMode="numeric" value={settleDisplay} onChange={(e) => { const v = parseRupiahInput(e.target.value); setSettleRaw(v.raw); setSettleDisplay(v.display); }} placeholder="0" className={`${inputCls} font-bold`} />
              </div>
              <p className="text-[10px] text-gray-400">Dibayar sebagian? Ubah nominalnya. Sisanya tetap tercatat dan terbawa ke hitungan berikutnya.</p>
              <button type="submit" disabled={settleBusy} className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-all">{settleBusy ? 'Menyimpan...' : 'Simpan Pembayaran'}</button>
            </form>
          </div>
        </div>
      )}

      <WaShareSheet isOpen={waOpen} onClose={() => setWaOpen(false)} title={waTitle} options={waOptions} showDialog={showDialog} />

      {group && (
        <SplitExpenseModal
          isOpen={isExpOpen}
          onClose={() => setIsExpOpen(false)}
          groupId={group.id}
          members={members}
          currentUserId={userId}
          variant={isRunning ? 'gantian' : 'split'}
          showDialog={showDialog}
          onSaved={async () => { setTab('pengeluaran'); await loadGroup(group); loadList(); }}
        />
      )}

      <CustomDialog isOpen={dialog.isOpen} onClose={closeDialog} title={dialog.title} message={dialog.msg} type={dialog.type} onConfirm={dialog.onConfirm} />
      <BottomNav />
    </div>
  );
}
