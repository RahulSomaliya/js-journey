CREATE TYPE "public"."message_author" AS ENUM('coach', 'student');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('encouragement', 'stuck');--> statement-breakpoint
CREATE TYPE "public"."section_kind" AS ENUM('core', 'bonus', 'skip');--> statement-breakpoint
CREATE TABLE "log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"section_id" integer,
	"minutes" integer NOT NULL,
	"note" text,
	"mood" text,
	"finished_section" boolean DEFAULT false NOT NULL,
	CONSTRAINT "uniq_day_section" UNIQUE("study_date","section_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"author" "message_author" NOT NULL,
	"kind" "message_kind" NOT NULL,
	"body" text NOT NULL,
	"section_id" integer,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"video_minutes" integer NOT NULL,
	"kind" "section_kind" NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "log_entries" ADD CONSTRAINT "log_entries_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;