import { describe, expect, it } from 'vitest';
import { evaluate, formatExpr, insertNumber, numToExpr, pressKey } from '@/lib/calc';

const press = (keys: string[]) => keys.reduce((e, k) => pressKey(e, k), '');

describe('evaluate', () => {
  it('urutan operasi', () => {
    expect(evaluate('2+3*4')).toBe(14);
    expect(evaluate('10-2-3')).toBe(5);
    expect(evaluate('8/2/2')).toBe(2);
    expect(evaluate('1.5*4')).toBe(6);
  });
  it('persen seperti kalkulator HP', () => {
    expect(evaluate('100+10%')).toBe(110);
    expect(evaluate('200-25%')).toBe(150);
    expect(evaluate('200*10%')).toBe(20);
    expect(evaluate('50%')).toBe(0.5);
  });
  it('minus di depan, operator menggantung, kosong, bagi nol', () => {
    expect(evaluate('-5+2')).toBe(-3);
    expect(evaluate('5+')).toBe(5);
    expect(evaluate('')).toBeNull();
    expect(evaluate('5/0')).toBeNull();
  });
  it('tanpa pembulatan aneh', () => {
    expect(evaluate('0.1+0.2')).toBe(0.3);
  });
});

describe('tombol', () => {
  it('operator ganda diganti, satu titik per angka', () => {
    expect(press(['5', '+', '*', '3'])).toBe('5*3');
    expect(press(['1', '.', '.', '5', '.'])).toBe('1.5');
    expect(press(['.', '5'])).toBe('0.5');
    expect(press(['+'])).toBe('');
    expect(press(['-', '5'])).toBe('-5');
  });
  it('00 dan persen', () => {
    expect(press(['5', '00'])).toBe('500');
    expect(press(['%'])).toBe('');
    expect(press(['5', '%', '7'])).toBe('5%');
  });
});

describe('memasukkan angka dan menampilkan', () => {
  it('angka dari data mengganti angka di ujung', () => {
    expect(insertNumber('', 600000)).toBe('600000');
    expect(insertNumber('8000000-', 600000)).toBe('8000000-600000');
    expect(insertNumber('8000000-5', 600000)).toBe('8000000-600000');
  });
  it('format tampilan', () => {
    expect(formatExpr('8000000-600000.5*2')).toBe('8.000.000−600.000,5×2');
    expect(numToExpr(0.1 + 0.2)).toBe('0.3');
  });
});
