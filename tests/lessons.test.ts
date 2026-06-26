import { describe, it, expect } from 'vitest';
import { LESSONS } from '@/lib/lessons';
import { CURRICULUM } from '@/lib/curriculum';

const coreIds = CURRICULUM.filter((s) => s.kind === 'core').map((s) => s.id);
const validIds = new Set(CURRICULUM.map((s) => s.id));

describe('lessons data', () => {
  it('has at least one lesson for every core section', () => {
    for (const id of coreIds) {
      expect(LESSONS[id]?.length ?? 0, `section ${id}`).toBeGreaterThan(0);
    }
  });
  it('every lesson has a non-empty title', () => {
    for (const list of Object.values(LESSONS)) {
      for (const l of list) expect(l.title.trim().length).toBeGreaterThan(0);
    }
  });
  it('every key is a valid section id', () => {
    for (const k of Object.keys(LESSONS)) expect(validIds.has(Number(k))).toBe(true);
  });
  it('total lecture count is in the published range (~332)', () => {
    const total = Object.values(LESSONS).reduce((n, l) => n + l.length, 0);
    expect(total).toBeGreaterThan(280);
    expect(total).toBeLessThan(400);
  });
});
