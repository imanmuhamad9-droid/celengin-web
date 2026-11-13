// Cron harian (Vercel Cron memanggil GET ini sesuai vercel.json).
// 1) Membuat transaksi rutin yang jatuh tempo.  2) Mengirim push: tagihan, belum mencatat, ringkasan mingguan.
import { NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { addDays, dayOfWeek, diffDays, nextOccurrence, todayInJakarta, Frequency } from '@/lib/recurring';

const rp = (n: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n));

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
  const { data: rules, error: rulesErr } = await admin
    .from('recurring_rules')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_date', today);

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

  // ---------------------------------------------------------------- 2. PUSH
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    report.errors.push('Push dilewati: VAPID key belum diisi.');
    return NextResponse.json(report);
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);

  const { data: subs, error: subsErr } = await admin.from('push_subscriptions').select('*');
  if (subsErr) {
    report.errors.push('subs: ' + subsErr.message);
    return NextResponse.json(report);
  }
  
  const subsByUser: Record<string, any[]> = {};
  (subs || []).forEach((s: any) => { (subsByUser[s.user_id] = subsByUser[s.user_id] || []).push(s); });
  
  const userIds = Object.keys(subsByUser);
  if (userIds.length === 0) return NextResponse.json(report);

  // Transaksi 7 hari terakhir milik user yang berlangganan (untuk "belum mencatat" + ringkasan Senin)
  const { data: recentTx } = await admin
    .from('transactions')
    .select('user_id,type,amount,transaction_date')
    .in('user_id', userIds)
    .gte('transaction_date', addDays(today, -7));

  // Tagihan aktif yang jatuh tempo dalam 14 hari ke depan atau telat <= 7 hari
  const { data: bills } = await admin
    .from('bills')
    .select('user_id,name,amount,due_date,remind_days_before')
    .in('user_id', userIds)
    .eq('is_active', true)
    .lte('due_date', addDays(today, 14))
    .gte('due_date', addDays(today, -7));

  const isMonday = dayOfWeek(today) === 1;

  for (const uid of userIds) {
    const msgs: { title: string; body: string; url: string; tag: string }[] = [];

    // a. Tagihan
    const dueBills = (bills || [])
      .filter((b: any) => b.user_id === uid && diffDays(today, b.due_date) <= (b.remind_days_before ?? 3))
      .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));
    
    if (dueBills.length === 1) {
      const b = dueBills[0];
      const d = diffDays(today, b.due_date);
      const when = d < 0 ? `telat ${-d} hari` : d === 0 ? 'jatuh tempo HARI INI' : d === 1 ? 'jatuh tempo besok' : `jatuh tempo ${d} hari lagi`;
      msgs.push({ title: '🧾 Pengingat Tagihan', body: `${b.name} (${rp(b.amount)}) ${when}.`, url: '/bills', tag: 'bills' });
    } else if (dueBills.length > 1) {
      const total = dueBills.reduce((s: number, b: any) => s + Number(b.amount), 0);
      msgs.push({ title: '🧾 Pengingat Tagihan', body: `${dueBills.length} tagihan segera jatuh tempo, total ${rp(total)}.`, url: '/bills', tag: 'bills' });
    }

    // b. Transaksi rutin yang baru tercatat otomatis
    if (createdByUser[uid]) {
      msgs.push({ title: '🤖 Transaksi Rutin', body: `${createdByUser[uid]} transaksi rutin tercatat otomatis hari ini.`, url: '/transactions', tag: 'routine' });
    }

    const mine = (recentTx || []).filter((t: any) => t.user_id === uid);

    // c. Belum mencatat hari ini (hanya untuk user yang aktif 7 hari terakhir)
    const loggedToday = mine.filter((t: any) => t.transaction_date === today).length > (createdByUser[uid] || 0);
    const wasActive = mine.some((t: any) => t.transaction_date < today);
    if (!loggedToday && wasActive) {
      msgs.push({ title: '📝 Sudah catat hari ini?', body: 'Belum ada pengeluaran yang kamu catat hari ini. Yuk catat sebelum lupa!', url: '/dashboard', tag: 'daily' });
    }

    // d. Ringkasan mingguan (Senin)
    if (isMonday) {
      const week = mine.filter((t: any) => t.transaction_date >= addDays(today, -7) && t.transaction_date < today);
      const inc = week.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0);
      const exp = week.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0);
      if (week.length > 0) {
        msgs.push({ title: '📊 Ringkasan Minggu Lalu', body: `Masuk ${rp(inc)}, keluar ${rp(exp)}. Lihat detailnya di Laporan.`, url: '/reports', tag: 'weekly' });
      }
    }

    for (const m of msgs) {
      for (const s of subsByUser[uid] || []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(m),
          );
          report.pushSent += 1;
        } catch (e: unknown) {
          report.pushFailed += 1;
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          }
        }
      }
    }
  }

  return NextResponse.json(report);
}