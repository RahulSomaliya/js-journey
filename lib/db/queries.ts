import 'server-only';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from './index';
import { sections, logEntries, messages } from './schema';
import type { Section, LogEntry, NewLog } from '@/lib/schedule';
import type { CourseId } from '@/lib/courses';

// Every section/log read is scoped to ONE course: the schedule engine assumes the
// sections and logs it gets belong together (mixing JS rows into the React pace
// would credit finished JS content to the React plan).
export async function getSections(course: CourseId): Promise<Section[]> {
  const rows = await db.select().from(sections).where(eq(sections.course, course)).orderBy(sections.sortOrder);
  return rows.map((r) => ({ id: r.id, title: r.title, videoMinutes: r.videoMinutes, kind: r.kind, sortOrder: r.sortOrder }));
}

export async function getLogs(course: CourseId): Promise<LogEntry[]> {
  // createdAt tiebreaker: same-day sessions must order newest-first so logs[0] is truly the latest
  const rows = await db.select().from(logEntries)
    .where(eq(logEntries.course, course))
    .orderBy(desc(logEntries.studyDate), desc(logEntries.createdAt));
  return rows.map((r) => ({
    id: r.id, studyDate: r.studyDate, minutes: r.minutes, sectionId: r.sectionId,
    finishedSection: r.finishedSection, note: r.note, mood: r.mood, createdAt: r.createdAt.toISOString(),
    alsoFinishedIds: r.alsoFinishedIds, source: r.source, lecturesCompleted: r.lecturesCompleted,
    startedAt: r.startedAt?.toISOString() ?? null, endedAt: r.endedAt?.toISOString() ?? null,
  }));
}

function toRow(input: NewLog): typeof logEntries.$inferInsert {
  return {
    course: input.course, studyDate: input.studyDate, sectionId: input.sectionId, minutes: input.minutes,
    note: input.note, mood: input.mood, finishedSection: input.finishedSection,
    alsoFinishedIds: input.alsoFinishedIds.length ? input.alsoFinishedIds : null,
    lecturesCompleted: input.lecturesCompleted, source: input.source, externalId: input.externalId,
    startedAt: input.startedAt ? new Date(input.startedAt) : null,
    endedAt: input.endedAt ? new Date(input.endedAt) : null,
  };
}

export async function insertLog(input: NewLog): Promise<void> {
  // append-only: every submit is its own session row; totals are summed at read time
  await db.insert(logEntries).values(toRow(input));
}

// Course Player sessions: idempotent on the session id (UNIQUE external_id). A retry
// from the player's outbox hits the conflict, inserts nothing and reports 'duplicate'.
export async function insertPlayerLog(input: NewLog): Promise<'created' | 'duplicate'> {
  if (!input.externalId) throw new Error(`insertPlayerLog: player row without externalId (course ${input.course}, ${input.studyDate})`);
  const rows = await db.insert(logEntries).values(toRow(input))
    .onConflictDoNothing({ target: logEntries.externalId })
    .returning({ id: logEntries.id });
  return rows.length > 0 ? 'created' : 'duplicate';
}

export async function hasLogOn(studyDate: string): Promise<boolean> {
  const rows = await db.select({ id: logEntries.id }).from(logEntries).where(eq(logEntries.studyDate, studyDate)).limit(1);
  return rows.length > 0;
}

// One aggregate row for a course's history badge (the finished JS course) — summed in
// SQL so the student page doesn't pull every JS row just to print three numbers.
export interface CourseSummary { minutes: number; sessions: number; studyDays: number; firstDate: string | null; lastDate: string | null; }
export async function getCourseSummary(course: CourseId): Promise<CourseSummary> {
  const [row] = await db.select({
    minutes: sql<number>`coalesce(sum(${logEntries.minutes}), 0)::int`,
    sessions: sql<number>`count(*)::int`,
    studyDays: sql<number>`count(distinct ${logEntries.studyDate})::int`,
    firstDate: sql<string | null>`min(${logEntries.studyDate})::text`,
    lastDate: sql<string | null>`max(${logEntries.studyDate})::text`,
  }).from(logEntries).where(eq(logEntries.course, course));
  return row;
}

export interface Message { id: string; createdAt: string; author: 'coach' | 'student'; kind: 'encouragement' | 'stuck'; body: string; sectionId: number | null; resolvedAt: string | null; }
function toMessage(r: typeof messages.$inferSelect): Message {
  return { id: r.id, createdAt: r.createdAt.toISOString(), author: r.author, kind: r.kind, body: r.body, sectionId: r.sectionId, resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null };
}
export async function latestCoachNote(): Promise<Message | null> {
  const rows = await db.select().from(messages).where(and(eq(messages.author, 'coach'), eq(messages.kind, 'encouragement'))).orderBy(desc(messages.createdAt)).limit(1);
  return rows[0] ? toMessage(rows[0]) : null;
}
export async function openStuckFlags(): Promise<Message[]> {
  const rows = await db.select().from(messages).where(and(eq(messages.kind, 'stuck'), isNull(messages.resolvedAt))).orderBy(desc(messages.createdAt));
  return rows.map(toMessage);
}
export interface NewMessage { author: 'coach' | 'student'; kind: 'encouragement' | 'stuck'; body: string; sectionId?: number | null; }
export async function insertMessage(input: NewMessage): Promise<void> {
  await db.insert(messages).values({ author: input.author, kind: input.kind, body: input.body, sectionId: input.sectionId ?? null });
}
export async function resolveStuck(id: string): Promise<void> {
  await db.update(messages).set({ resolvedAt: new Date() }).where(eq(messages.id, id));
}
