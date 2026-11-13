// Pencapaian (Badge). Definisi + penghitungan progres + sinkronisasi ke tabel user_badges.
// File ini memakai Supabase client -> hanya dipakai di komponen 'use client'.
import { supabase } from '@/lib/supabaseClient';
import { addDays } from '@/lib/recurring';
import { toLocalDateStr } from '@/lib/utils';

export interface BadgeDef {
  key: string;
  emoji: string;
  title: string;
  desc: string;
  target: number;      // nilai progres yang harus dicapai
  unit: string;        // satuan untuk teks progres
}

export const BADGES: BadgeDef[] = [
  { key: 'first_tx',    emoji: '🌱', title: 'Langkah Pertama',    desc: 'Catat transaksi pertamamu.',                 target: 1,   unit: 'transaksi' },
  { key: 'tx_50',       emoji: '📒', title: 'Rajin Mencatat',     desc: 'Catat 50 transaksi.',                        target: 50,  unit: 'transaksi' },
  { key: 'tx_250',      emoji: '📚', title: 'Pencatat Sejati',    desc: 'Catat 250 transaksi.',                       target: 250, unit: 'transaksi' },
  { key: 'log_7',       emoji: '📅', title: 'Konsisten 7 Hari',   desc: 'Mencatat 7 hari berturut-turut.',            target: 7,   unit: 'hari' },
  { key: 'log_30',      emoji: '🗓️', title: 'Konsisten 30 Hari',  desc: 'Mencatat 30 hari berturut-turut.',           target: 30,  unit: 'hari' },
  { key: 'streak_7',    emoji: '🔥', title: 'Hemat 7 Hari',       desc: 'Pengeluaran di bawah jatah harian 7 hari berturut-turut.', target: 7,  unit: 'hari' },
  { key: 'streak_30',   emoji: '🏆', title: 'Hemat 30 Hari',      desc: 'Pengeluaran di bawah jatah harian 30 hari berturut-turut.', target: 30, unit: 'hari' },
  { key: 'surplus_1',   emoji: '💰', title: 'Bulan Surplus',      desc: 'Pemasukan lebih besar dari pengeluaran dalam sebulan.', target: 1, unit: 'bulan' },
  { key: 'surplus_3',   emoji: '💎', title: 'Surplus 3 Bulan',    desc: 'Tiga bulan dengan pemasukan > pengeluaran.', target: 3,   unit: 'bulan' },
  { key: 'dream_first', emoji: '✨', title: 'Pemimpi',            desc: 'Buat impian pertamamu.',                     target: 1,   unit: 'impian' },
  { key: 'dream_done',  emoji: '🎯', title: 'Impian Tercapai',    desc: 'Capai target dana sebuah impian.',           target: 1,   unit: 'impian' },
  { key: 'income_goal', emoji: '🎉', title: 'Target Pemasukan',   desc: 'Capai target pemasukan pada sebuah Target.', target: 1,   unit: 'target' },
  { key: 'routine_1',   emoji: '🤖', title: 'Otomatis!',          desc: 'Aktifkan satu transaksi rutin otomatis.',    target: 1,   unit: 'aturan' },
  { key: 'bills_5',     emoji: '🧾', title: 'Tepat Waktu',        desc: 'Tandai lunas 5 tagihan.',                    target: 5,   unit: 'tagihan' },
  { key: 'wallets_3',   emoji: '👛', title: 'Multi Dompet',       desc: 'Punya 3 dompet atau lebih.',                 target: 3,   unit: 'dompet' },
  { key: 'bareng_1',    emoji: '👫', title: 'Bareng-bareng',      desc: 'Gabung target Bareng dengan minimal 2 anggota.', target: 1, unit: 'target' },
  { key: 'split_1',     emoji: '🤝', title: 'Patungan Pertama',   desc: 'Catat satu Split Bill.',           target: 1,   unit: 'split bill' },
];

export const LEVELS = [
  { min: 0,  name: 'Pemula',          emoji: '🐣' },
  { min: 3,  name: 'Penabung',        emoji: '🐷' },
  { min: 6,  name: 'Hemat Pro',       emoji: '💪' },
  { min: 10, name: 'Sultan Celengan', emoji: '👑' },
  { min: 14, name: 'Legenda',         emoji: '🌟' },
];

export function levelFor(earnedCount: number) {
  let current = LEVELS[0];
  LEVELS.forEach((l) => { if (earnedCount >= l.min) current = l; });
  const next = LEVELS.find((l) => l.min > earnedCount) || null;
  return { current, next };
}

export interface BadgeContext {
  transactions: { type: string; amount: number | string; transaction_date: string }[];
  targets: { is_primary?: boolean; start_date: string; end_date: string; target_expense: number | string; target_income: number | string }[];
  dreamCount: number;
  dreamDone: number;
  routineRules: number;
  billsPaid: number;
  walletCount: number;
  baregCount: number;     // jumlah target Bareng dengan >= 2 anggota
  splitCount: number;
}

/** Hitung beberapa hari berturut-turut terpanjang dari kumpulan tanggal. */
function longestRun(dates: string[]): number {
  const sorted = Array.from(new Set(dates)).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  sorted.forEach((d) => {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  });
  return best;
}

export function computeProgress(ctx: BadgeContext, today: string): Record<string, number> {
  const tx = ctx.transactions;
  const expenseByDay: Record<string, number> = {};
  tx.filter((t) => t.type === 'expense').forEach((t) => {
    expenseByDay[t.transaction_date] = (expenseByDay[t.transaction_date] || 0) + Number(t.amount);
  });

  // Streak hemat terpanjang 120 hari terakhir, berdasar Target Utama
  let streakBest = 0;
  const primary = ctx.targets.find((t) => t.is_primary);
  if (primary && Number(primary.target_expense) > 0) {
    const totalDays = Math.max(1, Math.round((Date.parse(primary.end_date) - Date.parse(primary.start_date)) / 86400000) + 1);
    const allowance = Number(primary.target_expense) / totalDays;
    // hari sebelum transaksi pertama tidak dihitung "hemat"
    const firstDay = tx.reduce((m, t) => (t.transaction_date < m ? t.transaction_date : m), today);
    let run = 0;
    for (let i = 119; i >= 0; i--) {
      const d = addDays(today, -i);
      if (d < firstDay) continue;
      if ((expenseByDay[d] || 0) <= allowance) { run += 1; streakBest = Math.max(streakBest, run); } else run = 0;
    }
  }

  // Bulan surplus
  const months: Record<string, { i: number; e: number }> = {};
  tx.forEach((t) => {
    const k = t.transaction_date.slice(0, 7);
    months[k] = months[k] || { i: 0, e: 0 };
    if (t.type === 'income') months[k].i += Number(t.amount); else months[k].e += Number(t.amount);
  });
  const surplusMonths = Object.values(months).filter((m) => m.i > 0 && m.i > m.e).length;

  // Target pemasukan tercapai
  const incomeGoal = ctx.targets.filter((tg) => {
    if (Number(tg.target_income) <= 0) return false;
    const got = tx.filter((t) => t.type === 'income' && t.transaction_date >= tg.start_date && t.transaction_date <= tg.end_date)
      .reduce((s, t) => s + Number(t.amount), 0);
    return got >= Number(tg.target_income);
  }).length;

  const logRun = longestRun(tx.map((t) => t.transaction_date));

  return {
    first_tx: tx.length,
    tx_50: tx.length,
    tx_250: tx.length,
    log_7: logRun,
    log_30: logRun,
    streak_7: streakBest,
    streak_30: streakBest,
    surplus_1: surplusMonths,
    surplus_3: surplusMonths,
    dream_first: ctx.dreamCount,
    dream_done: ctx.dreamDone,
    income_goal: incomeGoal,
    routine_1: ctx.routineRules,
    bills_5: ctx.billsPaid,
    wallets_3: ctx.walletCount,
    bareng_1: ctx.baregCount,
    split_1: ctx.splitCount,
  };
}

/** Kumpulkan data tambahan dari Supabase. Tabel yang belum ada dianggap kosong (tidak error). */
export async function fetchBadgeContext(
  userId: string,
  transactions: BadgeContext['transactions'],
  targets: BadgeContext['targets'],
): Promise<BadgeContext> {
  const safe = async <T,>(p: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> => {
    try { const r = await p; return r.error || r.data === null ? fallback : r.data; } catch { return fallback; }
  };

  const [dreams, rules, bills, wallets, myMemberships, splitExpenses] = await Promise.all([
    safe<any[]>(supabase.from('dream_goals').select('target_amount,current_amount,status').eq('user_id', userId), []),
    safe<any[]>(supabase.from('recurring_rules').select('id').eq('user_id', userId).eq('is_active', true), []),
    safe<any[]>(supabase.from('bills').select('paid_count').eq('user_id', userId), []),
    safe<any[]>(supabase.from('wallets').select('id').eq('user_id', userId), []),
    safe<any[]>(supabase.from('couple_members').select('goal_id').eq('user_id', userId).eq('status', 'accepted'), []),
    safe<any[]>(supabase.from('split_expenses').select('id').limit(1), []),
  ]);

  let baregCount = 0;
  const goalIds = myMemberships.map((m: any) => m.goal_id);
  if (goalIds.length > 0) {
    const members = await safe<any[]>(supabase.from('couple_members').select('goal_id').in('goal_id', goalIds).eq('status', 'accepted'), []);
    const counts: Record<string, number> = {};
    members.forEach((m: any) => { counts[m.goal_id] = (counts[m.goal_id] || 0) + 1; });
    baregCount = Object.values(counts).filter((c) => c >= 2).length;
  }

  return {
    transactions,
    targets,
    dreamCount: dreams.length,
    dreamDone: dreams.filter((d: any) => d.status === 'achieved' || (Number(d.target_amount) > 0 && Number(d.current_amount) >= Number(d.target_amount))).length,
    routineRules: rules.length,
    billsPaid: bills.reduce((s: number, b: any) => s + (Number(b.paid_count) || 0), 0),
    walletCount: wallets.length,
    baregCount,
    splitCount: splitExpenses.length,
  };
}

export interface EarnedBadge { badge_key: string; earned_at: string }

/** Hitung progres, simpan badge baru ke DB, kembalikan daftar badge yang BARU diraih sekarang. */
export async function syncBadges(userId: string, ctx: BadgeContext): Promise<{
  progress: Record<string, number>;
  earned: EarnedBadge[];
  fresh: BadgeDef[];
  ok: boolean;
}> {
  const today = toLocalDateStr(new Date());
  const progress = computeProgress(ctx, today);

  const { data: existing, error } = await supabase.from('user_badges').select('badge_key,earned_at').eq('user_id', userId);
  if (error) return { progress, earned: [], fresh: [], ok: false }; // tabel belum ada
  const have = new Set((existing || []).map((b: any) => b.badge_key));

  const shouldHave = BADGES.filter((b) => (progress[b.key] || 0) >= b.target);
  const toAdd = shouldHave.filter((b) => !have.has(b.key));
  let earned: EarnedBadge[] = (existing || []) as EarnedBadge[];

  if (toAdd.length > 0) {
    const nowIso = new Date().toISOString();
    const { error: insErr } = await supabase
      .from('user_badges')
      .upsert(toAdd.map((b) => ({ user_id: userId, badge_key: b.key })), { onConflict: 'user_id,badge_key', ignoreDuplicates: true });
    if (insErr) return { progress, earned, fresh: [], ok: false };
    earned = [...earned, ...toAdd.map((b) => ({ badge_key: b.key, earned_at: nowIso }))];
  }
  return { progress, earned, fresh: toAdd, ok: true };
}
