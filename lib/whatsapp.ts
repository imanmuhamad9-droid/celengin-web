// Pembuat pesan WhatsApp untuk Split Bill dan Gantian (murni: tanpa Supabase / browser, bisa diuji di Node).
// Format WhatsApp: *tebal*, _miring_. Angka rupiah ditulis "Rp25.000" tanpa spasi khusus supaya tidak terpotong.
import { computeReceipt } from '@/lib/splitReceipt';
import type { DebtLine } from '@/lib/splitbill';

export interface WaMember {
  id: string;
  name: string;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
  phone?: string | null;
}
export interface WaItem { name: string; price: number | string; qty: number; position?: number; split_item_assignees?: { member_id: string }[] }
export interface WaExpense {
  id: string;
  title: string;
  expense_date: string;
  paid_by: string;
  total_amount: number | string;
  split_type: 'equal' | 'custom' | 'items';
  subtotal?: number | string | null;
  discount_amount?: number | string | null;
  service_amount?: number | string | null;
  tax_amount?: number | string | null;
  split_shares?: { member_id: string; share_amount: number | string }[];
  split_expense_items?: WaItem[];
}

export const rp = (n: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function fmtDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** 0812-3456-7890 / +62 812... -> 628123456789. Tidak valid -> null. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  d = d.replace(/\D/g, '');
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function waLink(text: string, phone?: string | null): string {
  const p = normalizePhone(phone);
  return `https://wa.me/${p ?? ''}?text=${encodeURIComponent(text)}`;
}

const byId = (members: WaMember[]) => (id: string) => members.find((m) => m.id === id);
const nameOf = (members: WaMember[], id: string) => byId(members)(id)?.name || '?';

function bankLines(m: WaMember | undefined, label: string): string[] {
  if (!m) return [];
  if (m.account_number) {
    return [`*${label} ${m.name}*`, `${m.bank_name ? m.bank_name + ' ' : ''}${m.account_number}${m.account_holder ? ' a/n ' + m.account_holder : ''}`];
  }
  return [`${label} *${m.name}* (rekening belum diisi)`];
}

/** Hitung ulang bagian tiap orang per item (sama persis dengan yang dipakai saat menyimpan). */
function receiptFor(exp: WaExpense, members: WaMember[]) {
  const items = (exp.split_expense_items || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (exp.split_type !== 'items' || items.length === 0) return null;
  const res = computeReceipt(
    items.map((it, i) => ({ key: `k${i}`, name: it.name, unitPrice: Number(it.price), qty: it.qty, memberIds: (it.split_item_assignees || []).map((a) => a.member_id) })),
    { discount: Number(exp.discount_amount || 0), discountMode: 'nominal', service: Number(exp.service_amount || 0), serviceMode: 'nominal', tax: Number(exp.tax_amount || 0), taxMode: 'nominal' },
    members.map((m) => m.id),
  );
  return { items, res };
}

function adjustmentLines(exp: WaExpense): string[] {
  const out: string[] = [];
  const disc = Number(exp.discount_amount || 0), svc = Number(exp.service_amount || 0), tax = Number(exp.tax_amount || 0);
  if (exp.subtotal && (disc > 0 || svc > 0 || tax > 0)) out.push(`Subtotal ${rp(Number(exp.subtotal))}`);
  const parts: string[] = [];
  if (disc > 0) parts.push(`Diskon −${rp(disc)}`);
  if (svc > 0) parts.push(`Service +${rp(svc)}`);
  if (tax > 0) parts.push(`Pajak +${rp(tax)}`);
  if (parts.length) out.push(parts.join(' · '));
  return out;
}

/** Rincian lengkap satu pengeluaran untuk dikirim ke grup. */
export function buildExpenseMessage(groupName: string, emoji: string, exp: WaExpense, members: WaMember[]): string {
  const payer = byId(members)(exp.paid_by);
  const L: string[] = [];
  L.push(`${emoji} *${exp.title}*${groupName ? ` · ${groupName}` : ''}`);
  L.push(`📅 ${fmtDate(exp.expense_date)} · dibayar oleh *${payer?.name || '?'}*`);

  const r = receiptFor(exp, members);
  if (r) {
    L.push('', '*Pesanan*');
    r.items.forEach((it) => {
      const who = (it.split_item_assignees || []).map((a) => nameOf(members, a.member_id));
      const all = who.length === members.length && members.length > 1;
      L.push(`• ${it.name}${it.qty > 1 ? ` ${it.qty}x` : ''} — ${rp(Number(it.price) * it.qty)} (${all ? 'semua' : who.join(', ') || '-'})`);
    });
    const adj = adjustmentLines(exp);
    if (adj.length) L.push('', ...adj);
  }
  L.push(`*Total ${rp(Number(exp.total_amount))}*`);

  const shares = (exp.split_shares || []).filter((s) => Number(s.share_amount) > 0);
  if (shares.length) {
    L.push('', '*Bagian masing-masing*');
    shares.forEach((s) => L.push(`• ${nameOf(members, s.member_id)} ${rp(Number(s.share_amount))}${s.member_id === exp.paid_by ? ' (sudah bayar)' : ''}`));
  }
  const bank = bankLines(payer, 'Transfer ke');
  if (bank.length) L.push('', ...bank);
  L.push('', '_Dihitung dengan Celengin_');
  return L.join('\n');
}

/** Pesan pribadi untuk satu orang: hanya pesanan dan bagiannya. */
export function buildPersonMessage(groupName: string, exp: WaExpense, members: WaMember[], memberId: string): string {
  const me = byId(members)(memberId);
  const payer = byId(members)(exp.paid_by);
  const share = (exp.split_shares || []).find((s) => s.member_id === memberId);
  const amount = share ? Number(share.share_amount) : 0;
  const L: string[] = [];
  L.push(`Hai ${me?.name || ''} 👋`);
  L.push(`Bagianmu untuk *${exp.title}*${groupName ? ` (${groupName})` : ''}, ${fmtDate(exp.expense_date)}:`);
  L.push(`*${rp(amount)}*`);

  const r = receiptFor(exp, members);
  if (r) {
    const mine = r.res.perMember[memberId];
    if (mine && mine.lines.length) {
      L.push('', '*Pesananmu*');
      mine.lines.forEach((l) => {
        const item = r.items.find((_, i) => `k${i}` === l.key);
        const n = item ? (item.split_item_assignees || []).length : 1;
        L.push(`• ${l.name} — ${rp(l.amount)}${n > 1 ? ` (dibagi ${n})` : ''}`);
      });
      const extra: string[] = [];
      if (mine.discount > 0) extra.push(`Diskon −${rp(mine.discount)}`);
      if (mine.service > 0) extra.push(`Service +${rp(mine.service)}`);
      if (mine.tax > 0) extra.push(`Pajak +${rp(mine.tax)}`);
      if (extra.length) L.push(extra.join(' · '));
    }
  } else if (exp.split_type === 'equal') {
    const n = (exp.split_shares || []).length;
    if (n > 1) L.push(`_Dibagi rata untuk ${n} orang._`);
  }

  if (payer && payer.id !== memberId) {
    L.push('', ...bankLines(payer, 'Transfer ke'));
  }
  L.push('', '_Dihitung dengan Celengin_');
  return L.join('\n');
}

/** Ringkasan siapa bayar siapa untuk seluruh grup. */
export function buildDebtSummaryMessage(groupName: string, emoji: string, members: WaMember[], debts: DebtLine[]): string {
  const L: string[] = [];
  L.push(`${emoji} *Rekap ${groupName}*`);
  if (debts.length === 0) {
    L.push('', 'Semua sudah lunas 🎉');
  } else {
    L.push('', '*Siapa bayar siapa*');
    debts.forEach((d) => L.push(`• ${nameOf(members, d.from)} → ${nameOf(members, d.to)}: *${rp(d.amount)}*`));
    const receivers = Array.from(new Set(debts.map((d) => d.to)));
    const banks = receivers.map((id) => byId(members)(id)).filter((m): m is WaMember => !!m && !!m.account_number);
    if (banks.length) {
      L.push('', '*Rekening tujuan*');
      banks.forEach((m) => L.push(`• ${m.name}: ${m.bank_name ? m.bank_name + ' ' : ''}${m.account_number}${m.account_holder ? ' a/n ' + m.account_holder : ''}`));
    }
  }
  L.push('', '_Dihitung dengan Celengin_');
  return L.join('\n');
}

/** Rekap Bayarin: saldo sekarang + catatan pada periode yang dipilih (ym = "2026-11" atau null = semua). */
export function buildLedgerMessage(
  bookName: string,
  emoji: string,
  members: WaMember[],
  debts: DebtLine[],
  expenses: WaExpense[],
  ym: string | null,
): string {
  const L: string[] = [];
  L.push(`${emoji} *Bayarin · ${bookName}*`);
  L.push('');
  if (debts.length === 0) L.push('*Saldo:* impas, tidak ada yang perlu dibayar 🎉');
  else {
    L.push('*Saldo saat ini*');
    debts.forEach((d) => L.push(`• ${nameOf(members, d.from)} bayar ke ${nameOf(members, d.to)}: *${rp(d.amount)}*`));
  }

  const list = expenses
    .filter((e) => !ym || e.expense_date.startsWith(ym))
    .slice()
    .sort((a, b) => a.expense_date.localeCompare(b.expense_date));
  if (list.length) {
    L.push('', `*Catatan${ym ? ' ' + fmtMonth(ym) : ''}*`);
    list.forEach((e) => {
      const shares = (e.split_shares || []).filter((s) => Number(s.share_amount) > 0);
      const everyone = shares.length === members.length && members.length > 1;
      const forWho = everyone ? 'berdua/semua' : shares.map((s) => nameOf(members, s.member_id)).join(', ') || '-';
      L.push(`• ${fmtDate(e.expense_date)} · ${e.title} ${rp(Number(e.total_amount))} (dibayar ${nameOf(members, e.paid_by)}, untuk ${forWho})`);
    });
    L.push(`Total catatan: ${rp(list.reduce((s, e) => s + Number(e.total_amount), 0))}`);
  }

  const receivers = Array.from(new Set(debts.map((d) => d.to)));
  const banks = receivers.map((id) => byId(members)(id)).filter((m): m is WaMember => !!m && !!m.account_number);
  if (banks.length) {
    L.push('', '*Rekening tujuan*');
    banks.forEach((m) => L.push(`• ${m.name}: ${m.bank_name ? m.bank_name + ' ' : ''}${m.account_number}${m.account_holder ? ' a/n ' + m.account_holder : ''}`));
  }
  L.push('', '_Dihitung dengan Celengin_');
  return L.join('\n');
}
