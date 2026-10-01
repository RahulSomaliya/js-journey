import { describe, it, expect } from 'vitest';
import { REACT_CURRICULUM, REACT_SECTION_ID_OFFSET } from '@/lib/curriculum';
import { coreContentMinutes, coreSections } from '@/lib/schedule';

describe('React 2023 curriculum seed', () => {
  it('has the 31 course folders, ids 101..131 = 100 + folder number', () => {
    expect(REACT_SECTION_ID_OFFSET).toBe(100);
    expect(REACT_CURRICULUM).toHaveLength(31);
    expect(REACT_CURRICULUM.map((s) => s.sortOrder)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    for (const s of REACT_CURRICULUM) expect(s.id).toBe(REACT_SECTION_ID_OFFSET + s.sortOrder);
  });
  it('ids never collide with the JS course ids (1..21)', () => {
    expect(Math.min(...REACT_CURRICULUM.map((s) => s.id))).toBeGreaterThan(21);
  });
  it('titles are the folder names without the "NN " prefix, "(Optional)" kept', () => {
    expect(REACT_CURRICULUM[0].title).toBe('Welcome, Welcome, Welcome!');
    expect(REACT_CURRICULUM[7].title).toBe("Practice Project - Eat-'N-Split (Optional)");
    expect(REACT_CURRICULUM[30].title).toBe('The End!');
  });
  it('section 04 (JS review) is the only skip; every other section — optional ones included — counts', () => {
    expect(REACT_CURRICULUM.filter((s) => s.kind === 'skip').map((s) => s.sortOrder)).toEqual([4]);
    expect(coreSections(REACT_CURRICULUM)).toHaveLength(30);
    expect(REACT_CURRICULUM.find((s) => s.sortOrder === 29)!.kind).toBe('core'); // 7.9h optional, still counted
  });
  it('video minutes are the folder seconds rounded to the minute', () => {
    expect(REACT_CURRICULUM.find((s) => s.sortOrder === 1)!.videoMinutes).toBe(31); // 1849.6 s
    expect(REACT_CURRICULUM.find((s) => s.sortOrder === 2)!.videoMinutes).toBe(1); // 55.6 s Part divider
    expect(REACT_CURRICULUM.find((s) => s.sortOrder === 29)!.videoMinutes).toBe(471); // 28266.6 s
  });
  it('counted watch time = 3916 min (65.3 h); whole course incl. §04 = 4028 min', () => {
    expect(coreContentMinutes(REACT_CURRICULUM)).toBe(3916);
    expect(REACT_CURRICULUM.reduce((n, s) => n + s.videoMinutes, 0)).toBe(4028);
  });
});
