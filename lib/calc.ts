// Kalkulator biasa yang MURNI (tanpa eval). Ekspresi memakai karakter: angka, ".", "+", "-", "*", "/", "%".
// Persen mengikuti kalkulator HP: "100+10%" = 110 (10% dari 100), "200*10%" = 20.

const OPS = new Set(['+', '-', '*', '/']);
export const isOp = (c: string) => OPS.has(c);

interface Factor { n: number; pct: boolean; op: '*' | '/' | null }
interface Term { sign: 1 | -1; factors: Factor[] }

/** Hasil ekspresi, atau null bila belum lengkap / tidak valid (mis. dibagi nol). Operator di ujung diabaikan. */
export function evaluate(expr: string): number | null {
  const s = expr.replace(/[+\-*/.]+$/, '');
  if (s === '') return null;
  const terms: Term[] = [];
  let i = 0;
  let sign: 1 | -1 = 1;
  if (s[0] === '-') { sign = -1; i = 1; } else if (s[0] === '+') i = 1;
  let cur: Term = { sign, factors: [] };
  let pendingOp: '*' | '/' | null = null;
  while (i < s.length) {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(s.slice(i));
    if (!m) return null;
    const n = Number(m[0]);
    if (!Number.isFinite(n)) return null;
    i += m[0].length;
    let pct = false;
    if (s[i] === '%') { pct = true; i++; }
    cur.factors.push({ n, pct, op: pendingOp });
    pendingOp = null;
    if (i >= s.length) break;
    const c = s[i];
    if (c === '*' || c === '/') { pendingOp = c; i++; }
    else if (c === '+' || c === '-') { terms.push(cur); cur = { sign: c === '+' ? 1 : -1, factors: [] }; i++; }
    else return null;
  }
  terms.push(cur);

  let acc = 0;
  for (let t = 0; t < terms.length; t++) {
    const term = terms[t];
    if (term.factors.length === 0) return null;
    let v: number;
    if (t > 0 && term.factors.length === 1 && term.factors[0].pct) {
      v = acc * (term.factors[0].n / 100); // "a + b%" = b persen dari a
    } else {
      v = term.factors[0].pct ? term.factors[0].n / 100 : term.factors[0].n;
      for (const f of term.factors.slice(1)) {
        const x = f.pct ? f.n / 100 : f.n;
        if (f.op === '/') { if (x === 0) return null; v /= x; } else v *= x;
      }
    }
    acc += term.sign * v;
  }
  return Number.isFinite(acc) ? Math.round(acc * 1e9) / 1e9 : null;
}

/** Angka -> teks ekspresi ("." desimal), tanpa notasi ilmiah. */
export function numToExpr(n: number): string {
  const r = Math.round(n * 1e9) / 1e9;
  return Number.isInteger(r) ? String(r) : r.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
}

/** Menambah satu tombol ke ekspresi dengan aturan yang wajar (operator ganda diganti, satu titik per angka). */
export function pressKey(expr: string, key: string): string {
  if (/^\d$/.test(key)) return expr.endsWith('%') ? expr : expr + key;
  if (key === '00') return /\d$/.test(expr) ? expr + '00' : expr === '' || isOp(expr.slice(-1)) ? expr + '0' : expr;
  if (key === '.') {
    const last = expr.split(/[+\-*/]/).pop() ?? '';
    if (last.includes('.') || last.endsWith('%')) return expr;
    return last === '' ? expr + '0.' : expr + '.';
  }
  if (isOp(key)) {
    if (expr === '') return key === '-' ? '-' : expr;
    const last = expr.slice(-1);
    if (isOp(last)) return expr.length === 1 ? (key === '-' ? '-' : expr) : expr.slice(0, -1) + key;
    if (last === '.') return expr.slice(0, -1) + key;
    return expr + key;
  }
  if (key === '%') return /\d$/.test(expr) ? expr + '%' : expr;
  return expr;
}

/** Memasukkan sebuah angka dari data: bila ekspresi berakhir di angka, angka itu diganti. */
export function insertNumber(expr: string, n: number): string {
  const text = numToExpr(n);
  const base = expr.replace(/\d*\.?\d+%?$|\d+\.$/, '');
  return base + text;
}

const fmtInt = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** Tampilan ekspresi: pemisah ribuan titik, desimal koma, simbol × ÷ −. */
export function formatExpr(expr: string): string {
  return expr
    .replace(/\d+(\.\d*)?/g, (m) => { const [i, d] = m.split('.'); return fmtInt(i) + (d !== undefined ? ',' + d : ''); })
    .replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
}
