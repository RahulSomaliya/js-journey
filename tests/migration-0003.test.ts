import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Migration 0003 (coaching: read state, replies, progress snapshots) runs on the LIVE
// database with months of JS history. It must be additive, and it must backfill the read
// markers so that history does not flood Rahul's unread inbox / Mansi's "From Rahul" block.
const dir = path.resolve(__dirname, '../drizzle');
const file = readdirSync(dir).find((f) => f.startsWith('0003_') && f.endsWith('.sql'));
const sql = file ? readFileSync(path.join(dir, file), 'utf8') : '';
// statements only (comments stripped), whitespace-normalised
const statements = sql
  .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
  .split('--> statement-breakpoint').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const has = (re: RegExp) => statements.some((s) => re.test(s));
const indexOf = (re: RegExp) => statements.findIndex((s) => re.test(s));

describe('drizzle/0003 migration', () => {
  it('exists and is registered in the journal after 0002', () => {
    expect(file).toBeDefined();
    const journal = JSON.parse(readFileSync(path.join(dir, 'meta/_journal.json'), 'utf8')) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries.map((e) => e.tag)).toEqual([expect.stringMatching(/^0000_/), expect.stringMatching(/^0001_/), expect.stringMatching(/^0002_/), file?.replace(/\.sql$/, '')]);
  });
  it('is additive: no DROP, no RENAME, no type change, no TRUNCATE/DELETE', () => {
    // ("ON DELETE no action" on the new FK is fine — it is not a DELETE statement)
    for (const s of statements) {
      expect(s).not.toMatch(/^(DROP|TRUNCATE|DELETE)\b|\bDROP (COLUMN|TABLE|CONSTRAINT|INDEX|TYPE|DEFAULT|NOT NULL)\b|\bRENAME\b|ALTER COLUMN .* TYPE/i);
    }
  });
  it('log_entries gains stuck / auto_closed (NOT NULL DEFAULT false: safe on existing rows) and coach_read_at', () => {
    expect(has(/ALTER TABLE "log_entries" ADD COLUMN "stuck" boolean DEFAULT false NOT NULL/)).toBe(true);
    expect(has(/ALTER TABLE "log_entries" ADD COLUMN "auto_closed" boolean DEFAULT false NOT NULL/)).toBe(true);
    expect(has(/ALTER TABLE "log_entries" ADD COLUMN "coach_read_at" timestamp with time zone;?$/)).toBe(true);
  });
  it('messages gains a nullable reply link to log_entries and student_read_at', () => {
    expect(has(/ALTER TABLE "messages" ADD COLUMN "log_entry_id" uuid;?$/)).toBe(true);
    expect(has(/ALTER TABLE "messages" ADD COLUMN "student_read_at" timestamp with time zone;?$/)).toBe(true);
    expect(has(/ADD CONSTRAINT "messages_log_entry_id_log_entries_id_fk" FOREIGN KEY \("log_entry_id"\) REFERENCES "public"."log_entries"\("id"\)/)).toBe(true);
  });
  it('creates progress_snapshots keyed by course', () => {
    expect(has(/CREATE TABLE "progress_snapshots" \( "course" "course_id" PRIMARY KEY NOT NULL, "payload" jsonb NOT NULL, "updated_at" timestamp with time zone NOT NULL \)/)).toBe(true);
  });
  it('indexes the feed: log_entries(course, created_at desc) and messages(log_entry_id)', () => {
    // exactly the feed's ORDER BY (DESC = NULLS FIRST) + id: any other shape is ignored by the planner (lib/db/schema.ts)
    expect(has(/CREATE INDEX "log_entries_course_created_at_idx" ON "log_entries" USING btree \("course","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST\)/)).toBe(true);
    expect(has(/CREATE INDEX "messages_log_entry_id_idx" ON "messages" USING btree \("log_entry_id"\)/)).toBe(true);
  });
  it('backfills: every existing update is read by the coach, every existing coach message read by her — after the columns exist', () => {
    const logs = indexOf(/^UPDATE "log_entries" SET "coach_read_at" = now\(\) WHERE "coach_read_at" IS NULL;?$/);
    const msgs = indexOf(/^UPDATE "messages" SET "student_read_at" = now\(\) WHERE "author" = 'coach' AND "student_read_at" IS NULL;?$/);
    expect(logs).toBeGreaterThan(indexOf(/ADD COLUMN "coach_read_at"/));
    expect(msgs).toBeGreaterThan(indexOf(/ADD COLUMN "student_read_at"/));
  });
  it('carries the hand-written header (how to apply it, what to check)', () => {
    expect(sql).toMatch(/^-- 0003 /);
    expect(sql).toMatch(/ONE transaction/);
  });
  it('says HOW to run it as one transaction — it has no IF NOT EXISTS, so a half-applied run cannot be re-run', () => {
    // the file itself has no BEGIN/COMMIT (drizzle-kit wraps its own); applied statement by statement,
    // a failure after CREATE TABLE "progress_snapshots" left a retry failing at that CREATE TABLE
    const header = sql.split('\n').filter((l) => l.startsWith('--')).join('\n');
    expect(header).toContain(`psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f drizzle/${file}`);
    expect(header).toMatch(/BEGIN;[^]*COMMIT;/); // the Neon SQL Editor way
    expect(statements.some((s) => /^(BEGIN|COMMIT)\b/i.test(s))).toBe(false);
  });
});
