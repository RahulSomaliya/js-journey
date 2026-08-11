import { describe, it, expect } from 'vitest';
import { logEmailSubject } from '@/lib/email';

describe('logEmailSubject', () => {
  it('first session of the day: plain subject', () => {
    expect(logEmailSubject(60, 60)).toBe('Mansi logged 1.0h today');
  });
  it('2nd+ session: subject carries the day total', () => {
    expect(logEmailSubject(60, 150)).toBe('Mansi logged 1.0h — 2.5h total today');
  });
  it('rounds to one decimal', () => {
    expect(logEmailSubject(105, 105)).toBe('Mansi logged 1.8h today');
  });
});
