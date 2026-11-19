// Cron harian (Vercel Cron memanggil GET ini sesuai vercel.json).
// 1) Membuat transaksi rutin yang jatuh tempo.  2) Mengirim push: tagihan, belum mencatat, ringkasan mingguan.
import { NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { computeNet, simplifyDebts } from '@/lib/splitbill';
import { addDays, dayOfWeek, diffDays, nextOccurrence, todayInJakarta, Frequency } from '@/lib/recurring';

type PushMsg = { title: string; body: string; url: string; tag: string };
type RuleRow = {
  id: string; user_id: string; merchant_name: string; amount: number; type: string;
  frequency: string; anchor_day: number; next_run_date: string; last_run_date: string | null;
  end_date: string | null; wallet_id: string | null;
};
type BookRow = { id: string; name: string; emoji: string | null };
type MemberRow = { id: string; group_id: string; name: string; user_id: string | null; status: string };
type ExpenseRow = {
  id: string; group_id: string; total_amount: number; paid_by: string;
  split_shares: { member_id: string; share_amount: number }[] | null;
};
type SettlementRow = { id: string; group_id: string; from_member: string; to_member: string; amount: number };
type SubRow = { user_id: string; endpoint: string; p256dh: string; auth: string };
type TxRow = { user_id: string; type: string; amount: number; transaction_date: string };
type BillRow = { user_id: string; name: string; amount: number; due_date: string; remind_days_before: number | null };

type QueuedMsg = PushMsg & { notifId?: string };

const rp = (n: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n));

// Batas waktu fungsi (detik). Push dikirim paralel per kelompok supaya muat.
export const maxDuration = 60;

const PUSH_BATCH = 20;
const PUSH_OPTIONS = { TTL: 24 * 60 * 60, timeout: 8000 };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const today = todayInJakarta();
  const report = { today, rulesProcessed: 0, txCreated: 0, pushSent: 0, pushFailed: 0, errors: [] as string[] };

  // ---------------------------------------------------------------- 1. TRANSAKSI RUTIN
  const createdByUser: Record<string, number> = {};
  const { data: rulesData, error: rulesErr } = await admin
    .from('recurring_rules')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_date', today)
    ;

  const rules = rulesData as RuleRow[] | null;
  if (rulesErr) {
    report.errors.push('rules: ' + rulesErr.message);
  } else {
    for (const rule of rules || []) {
      const rows: Record<string, unknown>[] = [];
      let next: string = rule.next_run_date;
      let last: string | null = rule.last_run_date;
      let active = true;
      let guard = 0;

      while (next <= today && guard < 400) {
        if (rule.end_date && next > rule.end_date) { active = false; break; }
        rows.push({
          user_id: rule.user_id,
          merchant_name: rule.merchant_name,
          amount: rule.amount,
          type: rule.type,
          transaction_date: next,
          is_routine: true,
          is_ai_scanned: false,
          recurring_rule_id: rule.id,
          ...(rule.wallet_id ? { wallet_id: rule.wallet_id } : {}),
        });
        last = next;
        next = nextOccurrence(next, rule.frequency as Frequency, rule.anchor_day);
        guard += 1;
      }
      if (rule.end_date && next > rule.end_date) active = false;

      if (rows.length > 0) {
        const { error } = await admin
          .from('transactions')
          .upsert(rows, { onConflict: 'recurring_rule_id,transaction_date', ignoreDuplicates: true });
        if (error) { report.errors.push(`tx ${rule.id}: ${error.message}`); continue; }
        report.txCreated += rows.length;
        createdByUser[rule.user_id] = (createdByUser[rule.user_id] || 0) + rows.length;
      }
      const { error: upErr } = await admin
        .from('recurring_rules')
        .update({ next_run_date: next, last_run_date: last, is_active: active })
        .eq('id', rule.id);
      if (upErr) report.errors.push(`rule ${rule.id}: ${upErr.message}`);
      report.rulesProcessed += 1;
    }
  }

  // ---------------------------------------------------------------- 1b. PENGINGAT AKHIR BULAN (Gantian)
  // Hari terakhir tiap bulan (waktu Jakarta): beri tahu anggota buku Gantian yang saldonya belum impas.
  const gantianPush: Record<string, QueuedMsg[]> = {};
  const isMonthEnd = addDays(today, 1).slice(0, 7) !== today.slice(0, 7);
  if (isMonthEnd) {
    try {
      const { data: booksData, error: bErr } = await admin.from('split_groups').select('id,name,emoji').eq('kind', 'running');
      if (bErr) throw new Error(bErr.message);
      const books = booksData as BookRow[] | null;
      const ids = (books || []).map((b) => b.id);
      if (ids.length > 0) {
        const [{ data: memData }, { data: expsData }, { data: setsData }] = await Promise.all([
          admin.from('split_members').select('id,group_id,name,user_id,status').in('group_id', ids),
          admin.from('split_expenses').select('id,group_id,total_amount,paid_by,split_shares(member_id,share_amount)').in('group_id', ids),
          admin.from('split_settlements').select('id,group_id,from_member,to_member,amount').in('group_id', ids),
        ]);
        const mem = memData as MemberRow[] | null;
        const exps = expsData as ExpenseRow[] | null;
        const sets = setsData as SettlementRow[] | null;
        const dayStart = `${today}T00:00:00+07:00`;
        for (const b of books || []) {
          const ms = (mem || []).filter((m) => m.group_id === b.id);
          const es = (exps || []).filter((e) => e.group_id === b.id);
          if (ms.length < 2 || es.length === 0) continue;
          const net = computeNet(
            ms.map((m) => m.id),
            es.map((e) => ({
              id: e.id, title: '', total_amount: e.total_amount, paid_by: e.paid_by, created_by: '', expense_date: today,
              split_type: 'custom' as const, created_at: '',
              shared_expense_shares: (e.split_shares || []).map((x) => ({ user_id: x.member_id, share_amount: x.share_amount })),
            })),
            (sets || []).filter((x) => x.group_id === b.id).map((x) => ({ id: x.id, from_user: x.from_member, to_user: x.to_member, amount: x.amount, created_at: '' })),
          );
          const debts = simplifyDebts(net).filter((d) => d.amount >= 1);
          if (debts.length === 0) continue;
          const nm = (id: string) => ms.find((m) => m.id === id)?.name || 'teman';
          for (const m of ms) {
            if (!m.user_id || m.status !== 'accepted') continue;
            const mine = debts.filter((d) => d.from === m.id || d.to === m.id);
            if (mine.length === 0) continue;
            const body = mine
              .map((d) => `${nm(d.from)} harus bayar ${rp(d.amount)} ke ${nm(d.to)}`)
              .join('; ');
            const link = `/gantian?book=${b.id}`;
            const { data: dup } = await admin.from('notifications').select('id,pushed_at').eq('user_id', m.user_id).eq('kind', 'gantian_reminder').eq('link', link).gte('created_at', dayStart).limit(1);
            const title = `Waktunya hitung Bayarin`;
            const text = `${b.name}: ${body}.`;
            let notifId: string | undefined;
            if (dup && dup.length > 0) {
              // Sudah dibuat hari ini. Kirim ulang push hanya bila run sebelumnya belum sempat mengirimnya.
              if (dup[0].pushed_at) continue;
              notifId = dup[0].id;
            } else {
              const { data: created, error: nErr } = await admin.from('notifications').insert({ user_id: m.user_id, kind: 'gantian_reminder', title, body: text, link }).select('id').single();
              if (nErr || !created) { report.errors.push('gantian notif: ' + (nErr?.message || 'insert gagal')); continue; }
              notifId = created.id;
            }
            (gantianPush[m.user_id] = gantianPush[m.user_id] || []).push({ title, body: text, url: link, tag: `gantian-${b.id}`, notifId });
          }
        }
      }
    } catch (e: unknown) {
      report.errors.push('gantian: ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  // ---------------------------------------------------------------- 2. PUSH
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    report.errors.push('Push dilewati: VAPID key belum diisi.');
    return NextResponse.json(report);
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);

  const { data: subsData, error: subsErr } = await admin.from('push_subscriptions').select('*');
  if (subsErr) {
    report.errors.push('subs: ' + subsErr.message);
    return NextResponse.json(report);
  }
  const subs = subsData as SubRow[] | null;
  const subsByUser: Record<string, SubRow[]> = {};
  (subs || []).forEach((s) => { (subsByUser[s.user_id] = subsByUser[s.user_id] || []).push(s); });
  const userIds = Object.keys(subsByUser);
  if (userIds.length === 0) return NextResponse.json(report);

  // Transaksi 7 hari terakhir milik user yang berlangganan (untuk "belum mencatat" + ringkasan Senin)
  const { data: recentTxData } = await admin
    .from('transactions')
    .select('user_id,type,amount,transaction_date')
    .in('user_id', userIds)
    .gte('transaction_date', addDays(today, -7))
    ;

  const recentTx = recentTxData as TxRow[] | null;

  // Tagihan aktif yang jatuh tempo dalam 14 hari ke depan atau telat <= 7 hari
  const { data: billsData } = await admin
    .from('bills')
    .select('user_id,name,amount,due_date,remind_days_before')
    .in('user_id', userIds)
    .eq('is_active', true)
    .lte('due_date', addDays(today, 14))
    .gte('due_date', addDays(today, -7))
    ;

  const bills = billsData as BillRow[] | null;
  const isMonday = dayOfWeek(today) === 1;

  const queue: { uid: string; msgs: QueuedMsg[] }[] = [];
  for (const uid of userIds) {
    const msgs: QueuedMsg[] = [];

    // a. Tagihan
    const dueBills = (bills || [])
      .filter((b) => b.user_id === uid && diffDays(today, b.due_date) <= (b.remind_days_before ?? 3))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (dueBills.length === 1) {
      const b = dueBills[0];
      const d = diffDays(today, b.due_date);
      const when = d < 0 ? `telat ${-d} hari` : d === 0 ? 'jatuh tempo HARI INI' : d === 1 ? 'jatuh tempo besok' : `jatuh tempo ${d} hari lagi`;
      msgs.push({ title: '🧾 Pengingat Tagihan', body: `${b.name} (${rp(b.amount)}) ${when}.`, url: '/bills', tag: 'bills' });
    } else if (dueBills.length > 1) {
      const total = dueBills.reduce((s, b) => s + Number(b.amount), 0);
      msgs.push({ title: '🧾 Pengingat Tagihan', body: `${dueBills.length} tagihan segera jatuh tempo, total ${rp(total)}.`, url: '/bills', tag: 'bills' });
    }

    // b. Transaksi rutin yang baru tercatat otomatis
    if (createdByUser[uid]) {
      msgs.push({ title: '🤖 Transaksi Rutin', body: `${createdByUser[uid]} transaksi rutin tercatat otomatis hari ini.`, url: '/transactions', tag: 'routine' });
    }

    // a2. Pengingat Gantian akhir bulan
    (gantianPush[uid] || []).forEach((g) => msgs.push(g));

    const mine = (recentTx || []).filter((t) => t.user_id === uid);

    // c. Belum mencatat hari ini (hanya untuk user yang aktif 7 hari terakhir)
    // transaksi hari ini yang BUKAN hasil otomatis dari aturan rutin
    const loggedToday = mine.filter((t) => t.transaction_date === today).length > (createdByUser[uid] || 0);
    const wasActive = mine.some((t) => t.transaction_date < today);
    if (!loggedToday && wasActive) {
      msgs.push({ title: '📝 Sudah catat hari ini?', body: 'Belum ada pengeluaran yang kamu catat hari ini. Yuk catat sebelum lupa!', url: '/dashboard', tag: 'daily' });
    }

    // d. Ringkasan mingguan (Senin)
    if (isMonday) {
      const week = mine.filter((t) => t.transaction_date >= addDays(today, -7) && t.transaction_date < today);
      const inc = week.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const exp = week.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      if (week.length > 0) {
        msgs.push({ title: '📊 Ringkasan Minggu Lalu', body: `Masuk ${rp(inc)}, keluar ${rp(exp)}. Lihat detailnya di Laporan.`, url: '/reports', tag: 'weekly' });
      }
    }

    if (msgs.length > 0) queue.push({ uid, msgs });
  }

  // Kirim paralel per kelompok user. Satu endpoint yang lambat/gagal tidak menahan yang lain.
  const deadEndpoints = new Set<string>();
  const pushedNotifIds: string[] = [];
  const sendOne = async (s: SubRow, m: QueuedMsg): Promise<boolean> => {
    const { title, body, url, tag } = m;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, url, tag }),
        PUSH_OPTIONS,
      );
      report.pushSent += 1;
      return true;
    } catch (e: unknown) {
      report.pushFailed += 1;
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) deadEndpoints.add(s.endpoint);
      return false;
    }
  };
  for (let i = 0; i < queue.length; i += PUSH_BATCH) {
    await Promise.all(queue.slice(i, i + PUSH_BATCH).map(async ({ uid, msgs }) => {
      for (const m of msgs) {
        const results = await Promise.all((subsByUser[uid] || []).map((s) => sendOne(s, m)));
        if (m.notifId && results.some(Boolean)) pushedNotifIds.push(m.notifId);
      }
    }));
  }

  // Tandai terkirim hanya untuk notifikasi yang benar-benar sampai ke minimal satu perangkat.
  if (pushedNotifIds.length > 0) {
    const { error } = await admin.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', pushedNotifIds);
    if (error) report.errors.push('pushed_at: ' + error.message);
  }
  if (deadEndpoints.size > 0) {
    const { error } = await admin.from('push_subscriptions').delete().in('endpoint', [...deadEndpoints]);
    if (error) report.errors.push('hapus subscription mati: ' + error.message);
  }

  return NextResponse.json(report);
}
