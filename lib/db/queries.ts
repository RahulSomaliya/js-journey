import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './index';
import { sections, logEntries, messages } from './schema';
import type { Section, LogEntry } from '@/lib/schedule';

export async function getSections(): Promise<Section[]> {
  const rows = await db.select().from(sections).orderBy(sections.sortOrder);
  return rows.map((r) => ({ id: r.id, title: r.title, videoMinutes: r.videoMinutes, kind: r.kind, sortOrder: r.sortOrder }));
}

export async function getLogs(): Promise<LogEntry[]> {
  const rows = await db.select().from(logEntries).orderBy(desc(logEntries.studyDate));
  return rows.map((r) => ({
    id: r.id, studyDate: r.studyDate, minutes: r.minutes, sectionId: r.sectionId,
    finishedSection: r.finishedSection, note: r.note, mood: r.mood, createdAt: r.createdAt.toISOString(),
  }));
}

export interface NewLog { studyDate: string; sectionId: number | null; minutes: number; note?: string | null; mood?: string | null; finishedSection: boolean; }
export async function insertLog(input: NewLog): Promise<void> {
  // upsert: a second submit for the same (study_date, section) corrects today's entry instead of duplicating it
  await db.insert(logEntries).values({
    studyDate: input.studyDate, sectionId: input.sectionId, minutes: input.minutes,
    note: input.note ?? null, mood: input.mood ?? null, finishedSection: input.finishedSection,
  }).onConflictDoUpdate({
    target: [logEntries.studyDate, logEntries.sectionId],
    set: { minutes: input.minutes, note: input.note ?? null, mood: input.mood ?? null, finishedSection: input.finishedSection },
  });
}

export async function hasLogOn(studyDate: string): Promise<boolean> {
  const rows = await db.select({ id: logEntries.id }).from(logEntries).where(eq(logEntries.studyDate, studyDate)).limit(1);
  return rows.length > 0;
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
