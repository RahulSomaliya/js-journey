-- 0002 — multi-course (js | react-2023) + Course Player sessions. ADDITIVE ONLY, safe on live data:
--  * every existing sections / log_entries row gets course = 'js' from the column DEFAULT
--    (Postgres 11+ "fast default": no table rewrite, no existing value changes)
--  * every existing log row gets source = 'manual'; the other new columns are NULL on old rows
--  * UNIQUE(external_id) holds trivially — every existing row is NULL (NULLs never conflict)
-- Apply in ONE transaction, then `pnpm db:seed` to add the React sections (ids 101..131).
-- Check afterwards: SELECT course, count(*) FROM log_entries GROUP BY 1;  -- all 'js', same total as before
CREATE TYPE "public"."course_id" AS ENUM('js', 'react-2023');--> statement-breakpoint
CREATE TYPE "public"."log_source" AS ENUM('manual', 'player');--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "course" "course_id" DEFAULT 'js' NOT NULL;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "source" "log_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "lectures_completed" jsonb;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "also_finished_section_ids" integer[];--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "course" "course_id" DEFAULT 'js' NOT NULL;--> statement-breakpoint
CREATE INDEX "log_entries_course_study_date_idx" ON "log_entries" USING btree ("course","study_date");--> statement-breakpoint
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_external_id_unique" UNIQUE("external_id");