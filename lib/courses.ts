import type { ScheduleConfig, Section } from '@/lib/schedule';
import { CURRICULUM, REACT_CURRICULUM } from '@/lib/curriculum';
import { JS_PLAN, REACT_PLAN } from '@/lib/config';

import { COURSE_IDS, type CourseId } from '@/lib/course-ids';

// The course registry. The id list itself lives in lib/course-ids.ts (it is also the
// Postgres enum); the player sends `course: "react-2023"` and asks `?course=react-2023`.
export { COURSE_IDS, type CourseId };

/** the course both views open on, and the one manual check-ins log against */
export const ACTIVE_COURSE: CourseId = 'react-2023';

export interface CourseDef {
  id: CourseId;
  title: string;
  shortTitle: string;
  status: 'completed' | 'active';
  plan: ScheduleConfig;
  /** seed data — the DB `sections` rows (scripts/seed.ts) are what the pages read */
  curriculum: Section[];
  /** When this course's era of Rahul's standalone notes begins (an ISO instant); null = from the start.
   *  See noteWindow. */
  notesFrom: string | null;
}

/** Rahul's notes from here on are React's; before it they belong to the finished JS course (v3, Rahul
 *  2026-10-05: his JS notes stop filling "Your updates" and his notes list, and live in the JS history).
 *  = the minute React went live in PRODUCTION: merge 1bcaeeb pushed to main Thu 1 Oct 19:32:16 IST (Vercel
 *  deploys main), rounded DOWN. Before it the pages knew only JS; from it on the coach page — and its "Send
 *  her a note" — opened on React. Never move it later than the go-live: the first draft said Fri 2 Oct 00:00,
 *  which filed his launch-evening notes (written on the React page) as JS — gone from her player, /m and his
 *  list, and an unread one never prompted again (the JS history marks nothing read). Earlier is the safe side:
 *  a JS note shown on React costs a line; a React note filed as JS is lost. Moving it = count notes READ-ONLY
 *  first (CLAUDE.md failure log). */
export const REACT_NOTES_FROM = '2026-10-01T19:32:00+05:30';

const COURSES: Record<CourseId, CourseDef> = {
  js: {
    id: 'js',
    title: 'The Complete JavaScript Course',
    shortTitle: 'JavaScript',
    status: 'completed',
    plan: JS_PLAN,
    curriculum: CURRICULUM,
    notesFrom: null,
  },
  'react-2023': {
    id: 'react-2023',
    title: 'The Ultimate React Course',
    shortTitle: 'React',
    status: 'active',
    plan: REACT_PLAN,
    curriculum: REACT_CURRICULUM,
    notesFrom: REACT_NOTES_FROM,
  },
};

export function getCourse(id: CourseId): CourseDef {
  return COURSES[id];
}

export function isCourseId(x: unknown): x is CourseId {
  return typeof x === 'string' && (COURSE_IDS as readonly string[]).includes(x);
}

// A section's own number in its course (React folder "07 …" → 7). sortOrder carries
// it for both courses (JS: sortOrder = id; React: id = 100 + sortOrder).
export function sectionIdFor(course: CourseId, sectionNumber: number): number | null {
  return COURSES[course].curriculum.find((s) => s.sortOrder === sectionNumber)?.id ?? null;
}
export function sectionNumberOf(course: CourseId, sectionId: number): number | null {
  return COURSES[course].curriculum.find((s) => s.id === sectionId)?.sortOrder ?? null;
}

// ---- note eras ---------------------------------------------------------------------------------
// A standalone note (messages row: author coach, log_entry_id NULL) has no course column — replies
// are scoped by their update, notes by TIME: a note belongs to the course whose era it was written in,
// [notesFrom, the next course's notesFrom). Every reader of notes goes through this ONE window —
// lib/db/queries.ts (notesQuery, unreadForStudentQuery, latestCoachNote) and the page fixtures
// (lib/fixtures.ts) — or the pages show notes that unreadForStudent does not count, or the reverse
// (the player's badge says "1 new" with nothing new to show). Adding a course = give it a notesFrom.

/** [from, until) — a null end is open */
export interface NoteWindow { from: Date | null; until: Date | null; }

const eraStart = (c: CourseDef): number => (c.notesFrom === null ? Number.NEGATIVE_INFINITY : Date.parse(c.notesFrom));
const eras = (): CourseDef[] => COURSE_IDS.map((id) => COURSES[id]).sort((a, b) => eraStart(a) - eraStart(b) || 0);

export function noteWindow(id: CourseId): NoteWindow {
  const list = eras();
  const i = list.findIndex((c) => c.id === id);
  const next = list[i + 1];
  return {
    from: COURSES[id].notesFrom === null ? null : new Date(COURSES[id].notesFrom),
    until: next?.notesFrom ? new Date(next.notesFrom) : null,
  };
}

/** The course whose era a note (by its created_at) falls in. */
export function noteCourse(createdAt: string | Date): CourseId {
  const t = new Date(createdAt).getTime();
  const hit = COURSE_IDS.find((id) => {
    const w = noteWindow(id);
    return (w.from === null || t >= w.from.getTime()) && (w.until === null || t < w.until.getTime());
  });
  if (!hit) throw new Error(`noteCourse: ${String(createdAt)} is in no course's note era (lib/courses.ts notesFrom)`);
  return hit;
}
