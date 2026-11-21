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

import { backspaceAt, displayChars, insertNumberAt, pressKeyAt } from '@/lib/calc';

describe('edit di posisi kursor', () => {
  it('menyisipkan angka di tengah tanpa menghapus ekor', () => {
    expect(pressKeyAt('1203', 2, '5')).toEqual({ expr: '12503', caret: 3 });
    expect(pressKeyAt('12', 0, '9')).toEqual({ expr: '912', caret: 1 });
  });
  it('operator disisipkan di tengah angka; operator di kanan diganti, bukan dobel', () => {
    expect(pressKeyAt('123', 1, '+')).toEqual({ expr: '1+23', caret: 2 });
    expect(pressKeyAt('5+3', 2, '*')).toEqual({ expr: '5*3', caret: 2 });
    expect(pressKeyAt('5+3', 1, '*')).toEqual({ expr: '5*3', caret: 2 });
  });
  it('titik dan persen yang tidak valid diabaikan', () => {
    expect(pressKeyAt('1.5', 1, '.').expr).toBe('1.5');
    expect(pressKeyAt('153', 1, '.').expr).toBe('1.53');
    expect(pressKeyAt('53', 1, '%').expr).toBe('53');
  });
  it('backspace menghapus karakter di kiri kursor', () => {
    expect(backspaceAt('1253', 3)).toEqual({ expr: '123', caret: 2 });
    expect(backspaceAt('12', 0)).toEqual({ expr: '12', caret: 0 });
    expect(backspaceAt('5+3*2', 3)).toEqual({ expr: '5+*2'.replace('+*', '*'), caret: 2 });
  });
  it('angka dari data mengganti angka di kursor dan menyisakan ekor', () => {
    expect(insertNumberAt('8000000-5+2', 9, 600000)).toEqual({ expr: '8000000-600000+2', caret: 14 });
    expect(insertNumberAt('', 0, 7)).toEqual({ expr: '7', caret: 1 });
  });
  it('pemisah ribuan per karakter', () => {
    const d = displayChars('1234567-89');
    expect(d.filter((x) => x.sep).length).toBe(2);
    expect(d.map((x) => x.ch).join('')).toBe('1234567−89');
  });
});
