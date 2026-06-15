import { describe, it, expect } from 'vitest';
import { CURRICULUM } from '@/lib/curriculum';
import { coreContentMinutes } from '@/lib/schedule';

describe('curriculum seed', () => {
  it('has 21 sections in order 1..21', () => {
    expect(CURRICULUM).toHaveLength(21);
    expect(CURRICULUM.map((s) => s.id)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(CURRICULUM.map((s) => s.sortOrder)).toEqual(CURRICULUM.map((s) => s.id));
  });
  it('marks section 6 (HTML/CSS crash course) as skip', () => {
    expect(CURRICULUM.find((s) => s.id === 6)!.kind).toBe('skip');
  });
  it('core content sums to 4092 minutes (68.2h)', () => {
    expect(coreContentMinutes(CURRICULUM)).toBe(4092);
  });
});
