import { describe, it, expect } from 'vitest';
import { fmtDur } from '@/lib/format';

describe('fmtDur', () => {
  it('formats durations as Xh Ym', () => {
    expect(fmtDur(0)).toBe('0m');
    expect(fmtDur(45)).toBe('45m');
    expect(fmtDur(60)).toBe('1h');
    expect(fmtDur(75)).toBe('1h 15m');
    expect(fmtDur(105)).toBe('1h 45m');
    expect(fmtDur(4092)).toBe('68h 12m');
  });
});
