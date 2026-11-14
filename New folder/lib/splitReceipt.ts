// Hitungan Split Bill per struk (murni, tanpa Supabase).
// Urutan: subtotal -> diskon -> service charge -> pajak.
//   dasar   = subtotal - diskon
//   service = % dari dasar (atau nominal)
//   pajak   = % dari (dasar + service) (atau nominal)
// Tiap orang menanggung porsi diskon/service/pajak sebanding dengan jumlah pesanannya.

export type AdjMode = 'nominal' | 'percent';

export interface ReceiptItem { key: string; name: string; unitPrice: number; qty: number; memberIds: string[] }
export interface Adjustments {
  discount: number; discountMode: AdjMode;
  service: number; serviceMode: AdjMode;
  tax: number; taxMode: AdjMode;
}
export interface MemberBreakdown {
  itemsTotal: number; discount: number; service: number; tax: number; total: number;
  lines: { key: string; name: string; amount: number }[];
}
export interface ReceiptResult {
  subtotal: number; discount: number; service: number; tax: number; total: number;
  perMember: Record<string, MemberBreakdown>;
  unassigned: string[];             // key item yang belum dipilih pemiliknya
}

/** Bagi bilangan bulat `total` sesuai bobot; hasilnya bulat dan jumlahnya persis `total`. */
export function allocate(total: number, weights: number[]): number[] {
  const n = weights.length;
  const out: number[] = new Array(n).fill(0);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (n === 0 || total <= 0 || sum <= 0) return out;
  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map((x) => Math.floor(x));
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && left > 0; k++, left--) floors[order[k].i] += 1;
  floors.forEach((v, i) => { out[i] = v; });
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function computeReceipt(items: ReceiptItem[], adj: Adjustments, memberIds: string[]): ReceiptResult {
  const lineTotal = (it: ReceiptItem) => Math.max(0, Math.round(it.unitPrice)) * Math.max(1, Math.round(it.qty || 1));
  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);

  const discount = adj.discountMode === 'percent'
    ? Math.round((subtotal * clamp(adj.discount, 0, 100)) / 100)
    : clamp(Math.round(adj.discount), 0, subtotal);
  const base = subtotal - discount;
  const service = adj.serviceMode === 'percent' ? Math.round((base * clamp(adj.service, 0, 100)) / 100) : Math.max(0, Math.round(adj.service));
  const tax = adj.taxMode === 'percent' ? Math.round(((base + service) * clamp(adj.tax, 0, 100)) / 100) : Math.max(0, Math.round(adj.tax));
  const total = base + service + tax;

  const perMember: Record<string, MemberBreakdown> = {};
  memberIds.forEach((id) => { perMember[id] = { itemsTotal: 0, discount: 0, service: 0, tax: 0, total: 0, lines: [] }; });
  const unassigned: string[] = [];

  items.forEach((it) => {
    const ids = it.memberIds.filter((id) => id in perMember);
    const amount = lineTotal(it);
    if (ids.length === 0) { if (amount > 0) unassigned.push(it.key); return; }
    const parts = allocate(amount, ids.map(() => 1));
    ids.forEach((id, i) => {
      perMember[id].itemsTotal += parts[i];
      perMember[id].lines.push({ key: it.key, name: it.name, amount: parts[i] });
    });
  });

  const w = memberIds.map((id) => perMember[id].itemsTotal);
  const disc = allocate(discount, w);
  const net = w.map((x, i) => x - disc[i]);
  const svc = allocate(service, net);
  const tx = allocate(tax, net.map((x, i) => x + svc[i]));
  memberIds.forEach((id, i) => {
    perMember[id].discount = disc[i];
    perMember[id].service = svc[i];
    perMember[id].tax = tx[i];
    perMember[id].total = net[i] + svc[i] + tx[i];
  });

  return { subtotal, discount, service, tax, total, perMember, unassigned };
}
