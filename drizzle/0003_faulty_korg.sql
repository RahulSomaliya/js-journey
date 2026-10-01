-- 0003 — v2 coaching: read state, replies, progress snapshots. ADDITIVE ONLY, safe on live data:
--  * stuck / auto_closed: NOT NULL DEFAULT false — Postgres 11+ "fast default", no table rewrite;
--    every existing row reads "not stuck, closed by her" (true: v1 had neither flag)
--  * coach_read_at / student_read_at / log_entry_id: NULL on existing rows, then the two hand-added
--    UPDATEs at the end mark ALL existing history read (every log row for Rahul, every coach message
--    for Mansi) — otherwise months of JS history would land in his unread inbox and her "From Rahul" block
--  * messages.log_entry_id FK holds trivially — every existing row is NULL
--  * progress_snapshots is new and empty; the coach stats fall back to sessions until the player sends one
--  * the feed index is (course, created_at DESC NULLS FIRST, id DESC NULLS FIRST) on purpose — exactly the
--    feed's ORDER BY + keyset cursor; any other shape is ignored by the planner (see lib/db/schema.ts)
-- Apply in ONE transaction, BEFORE deploying the v2 code (it reads these columns). Rows the old code
-- writes after this runs stay unread — correct: they are new updates/notes.
-- HOW (Rahul runs it himself — never print .env.local). It is re-runnable ONLY as one transaction: there
-- is no IF NOT EXISTS, so a run that stopped half-way fails at CREATE TABLE "progress_snapshots" next time.
--   Neon SQL Editor (no psql on the Mac): paste  BEGIN;  then this whole file, then  COMMIT;  and run once —
--     any error aborts the transaction, COMMIT then rolls back, nothing is half-applied.
--   or psql (brew install libpq), from the repo root with DATABASE_URL in the shell:
--     psql "$DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f drizzle/0003_faulty_korg.sql
-- Check afterwards (both 0):
--   SELECT count(*) FROM log_entries WHERE coach_read_at IS NULL;
--   SELECT count(*) FROM messages WHERE author = 'coach' AND student_read_at IS NULL;
CREATE TABLE "progress_snapshots" (
	"course" "course_id" PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "stuck" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "auto_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "coach_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "log_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "student_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_log_entry_id_log_entries_id_fk" FOREIGN KEY ("log_entry_id") REFERENCES "public"."log_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "log_entries_course_created_at_idx" ON "log_entries" USING btree ("course","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "messages_log_entry_id_idx" ON "messages" USING btree ("log_entry_id");--> statement-breakpoint
-- hand-added backfill (drizzle-kit does not generate data changes) — see the header
UPDATE "log_entries" SET "coach_read_at" = now() WHERE "coach_read_at" IS NULL;--> statement-breakpoint
UPDATE "messages" SET "student_read_at" = now() WHERE "author" = 'coach' AND "student_read_at" IS NULL;
