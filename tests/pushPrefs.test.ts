import { describe, expect, it } from 'vitest';
import { parsePushPrefs, wantsPush } from '@/lib/pushPrefs';

describe('pushPrefs', () => {
  it('jenis yang belum diatur dianggap aktif (pengguna lama tetap menerima semuanya)', () => {
    expect(wantsPush({}, 'bills')).toBe(true);
    expect(wantsPush(undefined, 'daily')).toBe(true);
  });
  it('hanya false eksplisit yang mematikan, dan hanya untuk jenis itu', () => {
    const p = { daily: false };
    expect(wantsPush(p, 'daily')).toBe(false);
    expect(wantsPush(p, 'weekly')).toBe(true);
  });
  it('parsePushPrefs membuang kunci tak dikenal dan nilai bukan boolean', () => {
    expect(parsePushPrefs({ daily: false, bills: 'no', hacker: false, weekly: true })).toEqual({ daily: false, weekly: true });
  });
  it('parsePushPrefs aman untuk null, array, dan string', () => {
    for (const v of [null, undefined, [], 'x', 5]) expect(parsePushPrefs(v)).toEqual({});
  });
});
