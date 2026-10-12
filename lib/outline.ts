import reactOutlineJson from '@/lib/outline/react-2023.json';
import { doneSectionIds, planWeeks, type LogEntry, type ScheduleConfig, type Section } from '@/lib/schedule';
import type { ProgressSnapshot } from '@/lib/player';

// A course's lecture-level outline: every section's lectures with their kind and exact seconds — what the
// coach page's plan accordion lists (v4, Rahul 2026-10-12: "the same Part → section → lecture view she has
// on her home") and what the pace counts her content in (lib/status.ts countedContent, with
// ProgressSnapshot.doneLectures). lib/outline/react-2023.json is GENERATED from the course folder on the
// SSD (the same scan the Course Player's course index makes): regenerate it, never hand-edit it — its
// numbers must stay the player's, or a lecture she ticked lands on the wrong row.
// Only React has one: the finished JS course predates the player's lecture data (outlineFor → null).

export type LectureKind = 'video' | 'article';
export interface OutlineLecture { number: number; title: string; kind: LectureKind; seconds: number; }
export interface OutlineSection {
  number: number;
  /** without the "Part N - … (K Projects)" wrapper for a Part folder */
  title: string;
  optional: boolean;
  /** set on a "Part N" folder: it opens that part (its lectures are the part's introduction) */
  part: { number: number; projects: number } | null;
  lectures: OutlineLecture[];
}
export interface CourseOutline { course: string; sections: OutlineSection[]; }

// The JSON is checked once, at import: a malformed regeneration fails the build and every test loudly,
// instead of rendering a half-empty week on the coach page.
function parseOutline(raw: unknown, file: string): CourseOutline {
  const fail = (what: string): never => { throw new Error(`${file}: ${what}`); };
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
  const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  if (!isObj(raw) || typeof raw.course !== 'string' || !Array.isArray(raw.sections)) return fail('expected { course, sections: [] }');
  const sections = raw.sections.map((s: unknown, i): OutlineSection => {
    if (!isObj(s) || !isNum(s.number) || typeof s.title !== 'string' || typeof s.optional !== 'boolean' || !Array.isArray(s.lectures)) {
      return fail(`sections[${i}] must be { number, title, optional, part, lectures }`);
    }
    let part: OutlineSection['part'] = null;
    const p = s.part;
    if (p !== null) {
      if (!isObj(p) || !isNum(p.number) || !isNum(p.projects)) return fail(`sections[${i}].part must be null or { number, projects }`);
      part = { number: p.number, projects: p.projects };
    }
    const lectures = s.lectures.map((l: unknown, j): OutlineLecture => {
      if (!isObj(l) || !isNum(l.number) || typeof l.title !== 'string' || (l.kind !== 'video' && l.kind !== 'article') || !isNum(l.seconds)) {
        return fail(`sections[${i}].lectures[${j}] must be { number, title, kind: video|article, seconds }`);
      }
      return { number: l.number, title: l.title, kind: l.kind, seconds: l.seconds };
    });
    return { number: s.number, title: s.title, optional: s.optional, part, lectures };
  });
  return { course: raw.course, sections };
}

const REACT_OUTLINE = parseOutline(reactOutlineJson, 'lib/outline/react-2023.json');

/** The course's outline, or null for a course without one (JS, or anything unknown). */
export function outlineFor(course: string): CourseOutline | null {
  return course === REACT_OUTLINE.course ? REACT_OUTLINE : null;
}

// ---- a plan week, lecture by lecture (the coach page's plan accordion) ------------------------------

export interface OutlineLectureRow extends OutlineLecture {
  /** in the snapshot's doneLectures (always false without one) */
  done: boolean;
  /** the lecture "Continue" points at (only with doneLectures, like the ✓ marks) */
  current: boolean;
}
export interface OutlineSectionRow {
  number: number;
  title: string;
  optional: boolean;
  /** the plan skips it (React 04) and she has not finished it — finished wins, like the player's sectionMeta */
  skipped: boolean;
  /** a "Part N" folder: the part's introduction */
  partIntro: boolean;
  /** the section's length = its lectures' seconds */
  seconds: number;
  /** finished: snapshot sectionsDone ∪ the logs (doneSectionIds) */
  done: boolean;
  /** holds the lecture "Continue" points at — the section that opens by default in the current week */
  current: boolean;
  lectures: OutlineLectureRow[];
}
export interface OutlineGroup {
  /** the Part these sections sit in (overline "PART 2" + title); null before Part 1 (React 01) */
  part: { number: number; title: string; projects: number } | null;
  sections: OutlineSectionRow[];
}
export interface WeekOutline {
  week: number;
  /** false without the snapshot's doneLectures (no snapshot, or an older player): the lectures carry no
   *  ✓ / current marks — sections still show ✓ from sectionsDone and the logs */
  lectureMarks: boolean;
  groups: OutlineGroup[];
}

/** One plan week's sections grouped under their Part, each with its lectures and her marks. A week covers
 *  the sections after last week's goal up to its own (planWeeks: `after` < number ≤ `through`, plan-skipped
 *  ones included and marked); a "keep going" week covers the section it continues. Outside the plan (week 0,
 *  past the last week) → no groups. */
export function weekOutline(
  o: { sections: Section[]; logs: LogEntry[]; config: ScheduleConfig; snapshot: ProgressSnapshot | null },
  week: number,
  outline: CourseOutline,
): WeekOutline {
  const doneLectures = o.snapshot?.doneLectures;
  const lectureMarks = doneLectures !== undefined;
  const pw = planWeeks(o.sections, o.config).find((w) => w.milestone.week === week);
  if (!pw) return { week, lectureMarks, groups: [] };
  const covers = (n: number) => (pw.continues ? n === pw.continues.sortOrder : n > pw.after && n <= pw.through.sortOrder);

  const done = doneSectionIds(o.sections, o.logs, o.snapshot?.sectionsDone);
  const doneNumbers = new Set(o.sections.filter((s) => done.has(s.id)).map((s) => s.sortOrder));
  const planSkips = new Set(o.sections.filter((s) => s.kind === 'skip').map((s) => s.sortOrder));
  const current = o.snapshot?.current ?? null;

  const groups: OutlineGroup[] = [];
  let part: OutlineGroup['part'] = null; // the part each section sits in = the last Part folder at or before it
  for (const s of outline.sections) {
    if (s.part) part = { number: s.part.number, title: s.title, projects: s.part.projects };
    if (!covers(s.number)) continue;
    const isDone = doneNumbers.has(s.number);
    const isCurrent = current?.sectionNumber === s.number;
    const ticked = new Set(doneLectures?.[String(s.number)] ?? []);
    const row: OutlineSectionRow = {
      number: s.number,
      title: s.title,
      optional: s.optional,
      skipped: planSkips.has(s.number) && !isDone,
      partIntro: s.part !== null,
      seconds: s.lectures.reduce((sum, l) => sum + l.seconds, 0),
      done: isDone,
      current: isCurrent,
      lectures: s.lectures.map((l) => ({
        ...l,
        done: lectureMarks && ticked.has(l.number),
        current: lectureMarks && isCurrent && current?.lectureNumber === l.number,
      })),
    };
    const last = groups[groups.length - 1];
    if (last && last.part?.number === part?.number) last.sections.push(row);
    else groups.push({ part, sections: [row] });
  }
  return { week, lectureMarks, groups };
}
