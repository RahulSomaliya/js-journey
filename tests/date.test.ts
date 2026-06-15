import { describe, it, expect } from 'vitest';
import { addDays, diffDays, dayOfWeek, isWeekend, fridayOfWeek, todayInTZ } from '@/lib/date';

describe('date helpers', () => {
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-06-22', 4)).toBe('2026-06-26');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
  });
  it('diffDays is end minus start', () => {
    expect(diffDays('2026-06-22', '2026-06-26')).toBe(4);
    expect(diffDays('2026-06-26', '2026-06-22')).toBe(-4);
  });
  it('dayOfWeek: 2026-06-22 is Monday(1), 2026-06-26 is Friday(5)', () => {
    expect(dayOfWeek('2026-06-22')).toBe(1);
    expect(dayOfWeek('2026-06-26')).toBe(5);
  });
  it('isWeekend true for Sat/Sun', () => {
    expect(isWeekend('2026-06-27')).toBe(true);  // Sat
    expect(isWeekend('2026-06-28')).toBe(true);  // Sun
    expect(isWeekend('2026-06-26')).toBe(false); // Fri
  });
  it('fridayOfWeek returns the Friday of week N (1-based) from a Monday start', () => {
    expect(fridayOfWeek('2026-06-22', 1)).toBe('2026-06-26');
    expect(fridayOfWeek('2026-06-22', 14)).toBe('2026-09-25');
  });
  it('todayInTZ returns YYYY-MM-DD for a fixed instant', () => {
    // 2026-06-22T20:00:00Z == 2026-06-23 01:30 IST
    const d = new Date('2026-06-22T20:00:00Z');
    expect(todayInTZ('Asia/Kolkata', d)).toBe('2026-06-23');
  });
});
