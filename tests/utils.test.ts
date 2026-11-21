import { describe, expect, it } from 'vitest';
import { rupiahDisplay } from '@/lib/utils';

describe('rupiahDisplay', () => {
  it('membulatkan desimal, bukan membaca titik desimal sebagai digit', () => {
    expect(rupiahDisplay(3388134.01)).toBe('3.388.134');
    expect(rupiahDisplay(1234.5)).toBe('1.235');
    expect(rupiahDisplay(0)).toBe('0');
    expect(rupiahDisplay(NaN)).toBe('0');
  });
});
