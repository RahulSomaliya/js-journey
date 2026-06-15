# Mansi's JS Journey — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed Next.js app where Mansi logs daily JS-course progress (warm `/m/<token>` view) and Rahul reviews it honestly against a fixed 14-week schedule (`/r/<token>` view).

**Architecture:** One Next.js (App Router) app on Vercel, Neon Postgres as the single source of truth via Drizzle ORM. Access is by two secret URL tokens resolved to a role cookie in middleware (no accounts). All schedule/pace math lives in a pure, fully-tested `lib/schedule.ts` engine driven by centralized constants. Email heads-ups via Resend + a Vercel Cron route.

**Tech Stack:** Next.js 15 (App Router, TypeScript, React 19) · Tailwind CSS v4 (design tokens ported from the reference file) · Neon Postgres · Drizzle ORM + drizzle-kit · Vitest · Resend · pnpm.

**Spec:** `docs/superpowers/specs/2026-06-15-mansi-js-journey-design.md`

---

## Plan review notes (v2 — applied after adversarial review)

This plan was hardened after a 4-lens review. **Applied fixes:** cookie `secure` gated on production (Safari drops Secure cookies over `http://localhost`); `revalidatePath` uses the `'/m/[token]','page'` dynamic-route form (bare `'/m'` matched no route); middleware matcher uses single-segment `:token`; Resend `{ error }` is inspected (the SDK never throws); `server-only` is an explicit dependency; the cron fails closed when `CRON_SECRET` is unset; the seed uses atomic `db.batch`. **Spec gaps closed:** the trailing-14-day projection, `idealEffortMinutes`, monthly **phases**, the **This week** panel, a **live countdown**, dual **target (25 Sep)** + **deadline (2 Oct)** dates, **same-day correction** (unique `(study_date, section_id)` + upsert), an hours **stepper** with **varied** confirmation copy, and an explicit **in-progress** state.

**Accepted deviations (intentional):** `mood` is stored as free-text emoji (not the spec's enum) — the 4 choices are constrained in the UI; the bad-token response is a plain `404` (fine for a private-link app); the Tailwind `warn`/`warn-soft` utilities map to the reference's amber tokens, named to avoid colliding with Tailwind's built-in `amber-*` scale.

---

## Shared Contracts (authoritative — every task uses these exact names)

**Units rule:** All durations are stored and computed in **whole minutes** (avoids float/`numeric` string issues). Hours are presentation-only: `hours = minutes / 60`.

### Environment variables (`.env.local`, `.env.example`)
```
DATABASE_URL=            # Neon pooled connection string (postgres://...)
STUDENT_TOKEN=           # long random string for Mansi's link
COACH_TOKEN=             # long random string for Rahul's link
RESEND_API_KEY=          # Resend API key
COACH_EMAIL=             # where heads-up emails go (Rahul)
COACH_NAME=Rahul         # used in copy
STUDENT_NAME=Mansi       # used in copy
CRON_SECRET=             # guards the daily cron route
```

### `lib/config.ts`
```ts
export const PLAN = {
  startDate: '2026-06-22',     // Monday (IST). Week 1 = Mon 22 Jun .. Fri 26 Jun.
  dailyHours: 2.5,
  studyDaysPerWeek: 5,
  multiplier: 2.5,
  graceWeeks: 1,
  timeZone: 'Asia/Kolkata',
} as const;

export type Plan = typeof PLAN;
```

### `lib/schedule.ts` (pure) — type & function signatures
```ts
export type SectionKind = 'core' | 'bonus' | 'skip';
export interface Section { id: number; title: string; videoMinutes: number; kind: SectionKind; sortOrder: number; }
export interface LogEntry {
  id: string; studyDate: string;           // 'YYYY-MM-DD'
  minutes: number; sectionId: number | null;
  finishedSection: boolean; note?: string | null; mood?: string | null; createdAt?: string;
}
export type PaceLabel = 'ahead' | 'on_track' | 'behind';
export interface ScheduleConfig {
  startDate: string; dailyHours: number; studyDaysPerWeek: number;
  multiplier: number; graceWeeks: number; timeZone: string;
}
export interface WeeklyMilestone {
  week: number; fridayDate: string;
  cumulativeContentMinutes: number; throughSectionId: number; throughSectionTitle: string;
}
export interface PaceResult {
  status: PaceLabel;
  contentMinutesDone: number; contentMinutesTotal: number; contentPct: number;
  idealContentMinutes: number; idealEffortMinutes: number; gapMinutes: number; daysOffPace: number;
  effortMinutes: number; effortBudgetMinutes: number;
  projectedFinishDate: string | null; weeksElapsed: number;
}

export function coreSections(sections: Section[]): Section[];          // kind === 'core', sorted by sortOrder
export function coreContentMinutes(sections: Section[]): number;       // sum of core videoMinutes
export function contentMinutesPerWeek(config: ScheduleConfig): number; // dailyHours*studyDaysPerWeek/multiplier*60
export function totalWeeks(sections: Section[], config: ScheduleConfig): number; // ceil(coreMinutes / perWeek)
export function buildMilestones(sections: Section[], config: ScheduleConfig): WeeklyMilestone[];
export function finishedSectionIds(logs: LogEntry[]): Set<number>;
export function currentSection(sections: Section[], logs: LogEntry[]): Section | null; // first core section not finished
export function studyWeeksElapsed(today: string, config: ScheduleConfig): number;      // completed Mon-Fri weeks since start
export function computePace(args: { today: string; sections: Section[]; logs: LogEntry[]; config: ScheduleConfig }): PaceResult;
export function streak(logs: LogEntry[], today: string, config: ScheduleConfig): number;
export interface Phase { n: number; name: string; weekStart: number; weekEnd: number; }
export const PHASES: Phase[];
export function currentWeek(today: string, config: ScheduleConfig): number;   // 1-based week index (0 before start)
export function phaseForWeek(week: number): Phase | null;
export function sectionEffortMinutes(logs: LogEntry[], sectionId: number): number;
```

### `lib/date.ts` (pure)
```ts
export function todayInTZ(timeZone: string, now?: Date): string;  // 'YYYY-MM-DD' for that tz
export function addDays(iso: string, days: number): string;
export function diffDays(a: string, b: string): number;           // b - a, in whole days
export function dayOfWeek(iso: string): number;                   // 0=Sun..6=Sat
export function isWeekend(iso: string): boolean;
export function fridayOfWeek(startMondayIso: string, week: number): string; // week 1-based
```

### `lib/auth.ts`
```ts
export type Role = 'student' | 'coach';
export const ROLE_COOKIE = 'journey_role';
export function roleFromToken(token: string): Role | null; // constant-time compare to STUDENT_TOKEN / COACH_TOKEN
```

### `lib/db/schema.ts` — table/column names
- `sections`: `id` (int PK = course section number), `title` (text), `videoMinutes`→`video_minutes` (int), `kind` (`section_kind` enum: core|bonus|skip), `sortOrder`→`sort_order` (int).
- `logEntries`→`log_entries`: `id` (uuid PK), `studyDate`→`study_date` (date), `createdAt`→`created_at` (timestamptz), `sectionId`→`section_id` (int FK→sections), `minutes` (int), `note` (text null), `mood` (text null, free-text emoji — intentionally relaxed from the spec's enum), `finishedSection`→`finished_section` (bool default false). **Unique `(study_date, section_id)`** → same-day correction via upsert.
- `messages`: `id` (uuid PK), `createdAt`→`created_at` (timestamptz), `author` (`message_author` enum: coach|student), `kind` (`message_kind` enum: encouragement|stuck), `body` (text), `sectionId`→`section_id` (int FK null), `resolvedAt`→`resolved_at` (timestamptz null).

### `lib/db/queries.ts` — data access functions
```ts
export async function getSections(): Promise<Section[]>;
export async function getLogs(): Promise<LogEntry[]>;
export interface NewLog { studyDate: string; sectionId: number | null; minutes: number; note?: string | null; mood?: string | null; finishedSection: boolean; }
export async function insertLog(input: NewLog): Promise<void>;
export async function hasLogOn(studyDate: string): Promise<boolean>;
export interface Message { id: string; createdAt: string; author: 'coach'|'student'; kind: 'encouragement'|'stuck'; body: string; sectionId: number | null; resolvedAt: string | null; }
export async function latestCoachNote(): Promise<Message | null>;
export async function openStuckFlags(): Promise<Message[]>;
export interface NewMessage { author: 'coach'|'student'; kind: 'encouragement'|'stuck'; body: string; sectionId?: number | null; }
export async function insertMessage(input: NewMessage): Promise<void>;
export async function resolveStuck(id: string): Promise<void>;
```

### Routes & components
- `middleware.ts` — matches `/m/:token` and `/r/:token`; validates; sets httpOnly `journey_role` cookie; `notFound` (404) on bad token.
- `app/page.tsx` — public cover (no data).
- `app/m/[token]/page.tsx` — student server component.
- `app/r/[token]/page.tsx` — coach server component.
- `app/api/cron/daily/route.ts` — Vercel Cron daily no-log check (guarded by `CRON_SECRET`).
- Server actions: `lib/actions/log.ts` → `createLogAction`; `lib/actions/message.ts` → `sendCoachNoteAction`, `sendStuckAction`, `resolveStuckAction`.
- `lib/email.ts` → `sendCoachEmail(subject, body)`, `logEmailLine(log, pace, sections)`.

---

## Phase 0 — Scaffold, tooling, tokens (working app shell)

### Task 0.1: Scaffold Next.js into the existing repo

**Files:** creates Next.js app files at repo root; preserves `docs/`, `README.md`, `.gitignore`, `.git`.

- [ ] **Step 1: Scaffold into a temp dir** (create-next-app refuses a non-empty dir)

```bash
cd /Users/rahulsomaliya/Developer
pnpm create next-app@latest js-journey-scaffold \
  --ts --app --tailwind --eslint --no-src-dir --turbopack \
  --import-alias "@/*" --use-pnpm
```

- [ ] **Step 2: Merge scaffold into the repo, then remove temp**

```bash
cd /Users/rahulsomaliya/Developer/js-journey-scaffold
# copy everything except its git/readme/gitignore into the repo
rsync -a --exclude='.git' --exclude='README.md' --exclude='.gitignore' ./ /Users/rahulsomaliya/Developer/js-journey/
cd /Users/rahulsomaliya/Developer && rm -rf js-journey-scaffold
cd /Users/rahulsomaliya/Developer/js-journey && pnpm install
```

- [ ] **Step 3: Verify dev server boots**

Run: `pnpm dev` (then Ctrl-C after it prints the local URL)
Expected: `✓ Ready` and a `http://localhost:3000` URL, no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (TS, App Router, Tailwind v4)"
```

### Task 0.2: Add project dependencies

**Files:** Modify `package.json` (via pnpm).

- [ ] **Step 1: Install runtime + dev deps**

```bash
pnpm add drizzle-orm @neondatabase/serverless resend server-only
pnpm add -D drizzle-kit vitest @types/node tsx dotenv
```

- [ ] **Step 2: Add scripts to `package.json`** (`scripts` block)

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

- [ ] **Step 3: Verify install**

Run: `pnpm test --run` (no tests yet)
Expected: Vitest runs and reports "No test files found" (exit 0 or 1 — acceptable; confirms vitest is installed).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: add drizzle, neon, resend, vitest deps"
```

### Task 0.3: Vitest config + `.env.example`

**Files:**
- Create: `vitest.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 2: Write `.env.example`** (the env block from Shared Contracts, values blank)

```
DATABASE_URL=
STUDENT_TOKEN=
COACH_TOKEN=
RESEND_API_KEY=
COACH_EMAIL=
COACH_NAME=Rahul
STUDENT_NAME=Mansi
CRON_SECRET=
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: vitest config + env example"
```

---

## Phase 1 — Pure domain core (config, curriculum, date, schedule) — full TDD

### Task 1.1: `lib/config.ts`

**Files:** Create: `lib/config.ts`

- [ ] **Step 1: Write the file** (exactly the `PLAN` block from Shared Contracts)
- [ ] **Step 2: Commit**

```bash
git add lib/config.ts && git commit -m "feat: plan constants"
```

### Task 1.2: `lib/curriculum.ts` — seed data (TDD the totals)

**Files:**
- Create: `lib/curriculum.ts`
- Test: `tests/curriculum.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/curriculum.test.ts
import { describe, it, expect } from 'vitest';
import { CURRICULUM } from '@/lib/curriculum';
import { coreContentMinutes } from '@/lib/schedule';

describe('curriculum seed', () => {
  it('has 21 sections in order 1..21', () => {
    expect(CURRICULUM).toHaveLength(21);
    expect(CURRICULUM.map((s) => s.id)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(CURRICULUM.map((s) => s.sortOrder)).toEqual(CURRICULUM.map((s) => s.id));
  });
  it('marks section 6 (HTML/CSS crash course) as skip', () => {
    expect(CURRICULUM.find((s) => s.id === 6)!.kind).toBe('skip');
  });
  it('core content sums to 4092 minutes (68.2h)', () => {
    expect(coreContentMinutes(CURRICULUM)).toBe(4092);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run tests/curriculum.test.ts`
Expected: FAIL — cannot import `CURRICULUM` / `coreContentMinutes` (modules not created yet).

- [ ] **Step 3: Write `lib/curriculum.ts`**

```ts
import type { Section } from '@/lib/schedule';

// videoMinutes are estimates scaled to the published ~71h total; editable.
export const CURRICULUM: Section[] = [
  { id: 1,  title: 'Welcome, Welcome, Welcome!',                         videoMinutes: 24,  kind: 'core', sortOrder: 1 },
  { id: 2,  title: 'JavaScript Fundamentals – Part 1',                   videoMinutes: 300, kind: 'core', sortOrder: 2 },
  { id: 3,  title: 'JavaScript Fundamentals – Part 2',                   videoMinutes: 270, kind: 'core', sortOrder: 3 },
  { id: 4,  title: 'How to Navigate This Course',                        videoMinutes: 12,  kind: 'bonus', sortOrder: 4 },
  { id: 5,  title: 'Developer Skills & Editor Setup',                    videoMinutes: 108, kind: 'core', sortOrder: 5 },
  { id: 6,  title: '[OPTIONAL] HTML & CSS Crash Course',                 videoMinutes: 90,  kind: 'skip', sortOrder: 6 },
  { id: 7,  title: 'JS in the Browser: DOM & Events [PROJECT]',          videoMinutes: 300, kind: 'core', sortOrder: 7 },
  { id: 8,  title: 'How JavaScript Works Behind the Scenes',             videoMinutes: 180, kind: 'core', sortOrder: 8 },
  { id: 9,  title: 'Data Structures, Modern Operators & Strings',        videoMinutes: 270, kind: 'core', sortOrder: 9 },
  { id: 10, title: 'A Closer Look at Functions',                         videoMinutes: 210, kind: 'core', sortOrder: 10 },
  { id: 11, title: 'Working With Arrays — Bankist [PROJECT]',            videoMinutes: 360, kind: 'core', sortOrder: 11 },
  { id: 12, title: 'Numbers, Dates, Intl & Timers [PROJECT]',           videoMinutes: 180, kind: 'core', sortOrder: 12 },
  { id: 13, title: 'Advanced DOM and Events [PROJECT]',                  videoMinutes: 270, kind: 'core', sortOrder: 13 },
  { id: 14, title: 'Object-Oriented Programming (OOP)',                  videoMinutes: 330, kind: 'core', sortOrder: 14 },
  { id: 15, title: 'Mapty App: OOP, Geolocation, Libraries [PROJECT]',   videoMinutes: 270, kind: 'core', sortOrder: 15 },
  { id: 16, title: 'Asynchronous JS: Promises, Async/Await, AJAX',       videoMinutes: 330, kind: 'core', sortOrder: 16 },
  { id: 17, title: 'Modern JS Development: Modules, Tooling, Functional',videoMinutes: 270, kind: 'core', sortOrder: 17 },
  { id: 18, title: 'Forkify App: Building a Modern Application [PROJECT]',videoMinutes: 420, kind: 'core', sortOrder: 18 },
  { id: 19, title: 'Setting Up Git and Deployment',                      videoMinutes: 48,  kind: 'bonus', sortOrder: 19 },
  { id: 20, title: 'The End!',                                           videoMinutes: 12,  kind: 'bonus', sortOrder: 20 },
  { id: 21, title: '[LEGACY] Access the Old Course',                     videoMinutes: 24,  kind: 'bonus', sortOrder: 21 },
];
```

- [ ] **Step 4: Run test** (will still fail until `lib/schedule.ts` exists — implement `coreSections`/`coreContentMinutes` in Task 1.4 Step 3, then re-run). For now run only the "21 sections" + "skip" assertions by temporarily skipping the totals test is NOT needed — instead implement `coreContentMinutes` now as a one-liner stub in schedule (Task 1.4). Proceed to Task 1.3/1.4; this test goes green at the end of Task 1.4.

- [ ] **Step 5: Commit** (after Task 1.4 makes it green)

```bash
git add lib/curriculum.ts tests/curriculum.test.ts && git commit -m "feat: curriculum seed data + totals test"
```

### Task 1.3: `lib/date.ts` — date helpers (full TDD)

**Files:**
- Create: `lib/date.ts`
- Test: `tests/date.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/date.test.ts
import { describe, it, expect } from 'vitest';
import { addDays, diffDays, dayOfWeek, isWeekend, fridayOfWeek, todayInTZ } from '@/lib/date';

describe('date helpers', () => {
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-06-22', 4)).toBe('2026-06-26');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
  });
  it('diffDays is end minus start', () => {
    expect(diffDays('2026-06-22', '2026-06-26')).toBe(4);
    expect(diffDays('2026-06-26', '2026-06-22')).toBe(-4);
  });
  it('dayOfWeek: 2026-06-22 is Monday(1), 2026-06-26 is Friday(5)', () => {
    expect(dayOfWeek('2026-06-22')).toBe(1);
    expect(dayOfWeek('2026-06-26')).toBe(5);
  });
  it('isWeekend true for Sat/Sun', () => {
    expect(isWeekend('2026-06-27')).toBe(true);  // Sat
    expect(isWeekend('2026-06-28')).toBe(true);  // Sun
    expect(isWeekend('2026-06-26')).toBe(false); // Fri
  });
  it('fridayOfWeek returns the Friday of week N (1-based) from a Monday start', () => {
    expect(fridayOfWeek('2026-06-22', 1)).toBe('2026-06-26');
    expect(fridayOfWeek('2026-06-22', 14)).toBe('2026-09-25');
  });
  it('todayInTZ returns YYYY-MM-DD for a fixed instant', () => {
    // 2026-06-22T20:00:00Z == 2026-06-23 01:30 IST
    const d = new Date('2026-06-22T20:00:00Z');
    expect(todayInTZ('Asia/Kolkata', d)).toBe('2026-06-23');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run tests/date.test.ts`
Expected: FAIL — `@/lib/date` not found.

- [ ] **Step 3: Write `lib/date.ts`**

```ts
// All dates are ISO 'YYYY-MM-DD' strings interpreted as calendar dates (no time/tz drift).
function toUTCDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function addDays(iso: string, days: number): string {
  const d = toUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fmt(d);
}
export function diffDays(a: string, b: string): number {
  return Math.round((toUTCDate(b).getTime() - toUTCDate(a).getTime()) / 86_400_000);
}
export function dayOfWeek(iso: string): number {
  return toUTCDate(iso).getUTCDay(); // 0=Sun..6=Sat
}
export function isWeekend(iso: string): boolean {
  const d = dayOfWeek(iso);
  return d === 0 || d === 6;
}
export function fridayOfWeek(startMondayIso: string, week: number): string {
  return addDays(startMondayIso, (week - 1) * 7 + 4);
}
export function todayInTZ(timeZone: string, now: Date = new Date()): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --run tests/date.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/date.ts tests/date.test.ts && git commit -m "feat: pure date helpers (tz-safe ISO dates)"
```

### Task 1.4: `lib/schedule.ts` — the pace engine (full TDD)

**Files:**
- Create: `lib/schedule.ts`
- Test: `tests/schedule.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/schedule.test.ts
import { describe, it, expect } from 'vitest';
import {
  coreContentMinutes, contentMinutesPerWeek, totalWeeks, buildMilestones,
  finishedSectionIds, currentSection, studyWeeksElapsed, computePace, streak,
  currentWeek, phaseForWeek, sectionEffortMinutes,
} from '@/lib/schedule';
import type { ScheduleConfig, LogEntry } from '@/lib/schedule';
import { CURRICULUM } from '@/lib/curriculum';

const CFG: ScheduleConfig = {
  startDate: '2026-06-22', dailyHours: 2.5, studyDaysPerWeek: 5,
  multiplier: 2.5, graceWeeks: 1, timeZone: 'Asia/Kolkata',
};

describe('schedule engine', () => {
  it('coreContentMinutes = 4092', () => {
    expect(coreContentMinutes(CURRICULUM)).toBe(4092);
  });
  it('contentMinutesPerWeek = 300 (5.0h)', () => {
    expect(contentMinutesPerWeek(CFG)).toBe(300);
  });
  it('totalWeeks = 14', () => {
    expect(totalWeeks(CURRICULUM, CFG)).toBe(14);
  });
  it('buildMilestones: 14 weeks, week 1 ends 2026-06-26, week 14 ends 2026-09-25 at full core', () => {
    const ms = buildMilestones(CURRICULUM, CFG);
    expect(ms).toHaveLength(14);
    expect(ms[0].fridayDate).toBe('2026-06-26');
    expect(ms[0].cumulativeContentMinutes).toBe(300);
    expect(ms[13].fridayDate).toBe('2026-09-25');
    expect(ms[13].cumulativeContentMinutes).toBe(4092);
  });
  it('finishedSectionIds collects sections with a finished log', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-22', minutes: 150, sectionId: 1, finishedSection: true },
      { id: 'b', studyDate: '2026-06-23', minutes: 150, sectionId: 2, finishedSection: false },
    ];
    expect([...finishedSectionIds(logs)]).toEqual([1]);
  });
  it('currentSection = first unfinished core section', () => {
    const logs: LogEntry[] = [{ id: 'a', studyDate: '2026-06-22', minutes: 24, sectionId: 1, finishedSection: true }];
    expect(currentSection(CURRICULUM, logs)!.id).toBe(2);
  });
  it('studyWeeksElapsed counts completed Mon-Fri weeks', () => {
    expect(studyWeeksElapsed('2026-06-22', CFG)).toBe(0); // first Monday: 0 completed weeks
    expect(studyWeeksElapsed('2026-06-29', CFG)).toBe(1); // next Monday: 1 week done
    expect(studyWeeksElapsed('2026-07-06', CFG)).toBe(2);
  });
  it('computePace: behind when nothing done after 2 weeks', () => {
    const r = computePace({ today: '2026-07-06', sections: CURRICULUM, logs: [], config: CFG });
    expect(r.idealContentMinutes).toBe(600);  // 2 weeks * 300
    expect(r.contentMinutesDone).toBe(0);
    expect(r.status).toBe('behind');
    expect(r.contentMinutesTotal).toBe(4092);
  });
  it('computePace: on_track when done ~= ideal', () => {
    const logs: LogEntry[] = [
      { id: '1', studyDate: '2026-06-26', minutes: 750, sectionId: 1, finishedSection: true }, // s1 24
      { id: '2', studyDate: '2026-07-03', minutes: 750, sectionId: 2, finishedSection: true }, // s2 300
      { id: '3', studyDate: '2026-07-03', minutes: 1, sectionId: 3, finishedSection: true },   // s3 270 -> 594
    ];
    const r = computePace({ today: '2026-07-06', sections: CURRICULUM, logs, config: CFG });
    expect(r.contentMinutesDone).toBe(594);    // 24+300+270
    expect(r.idealContentMinutes).toBe(600);
    expect(r.status).toBe('on_track');         // within +/-150 (half week)
  });
  it('streak counts consecutive study-days back from today, skipping weekends', () => {
    const logs: LogEntry[] = [
      { id: '1', studyDate: '2026-06-24', minutes: 150, sectionId: 2, finishedSection: false },
      { id: '2', studyDate: '2026-06-25', minutes: 150, sectionId: 2, finishedSection: false },
    ];
    expect(streak(logs, '2026-06-25', CFG)).toBe(2);
  });
  it('idealEffortMinutes = idealContentMinutes * multiplier', () => {
    const r = computePace({ today: '2026-07-06', sections: CURRICULUM, logs: [], config: CFG });
    expect(r.idealEffortMinutes).toBe(1500); // 600 * 2.5
  });
  it('projectedFinishDate is set via plan-rate fallback when there is no recent data', () => {
    const r = computePace({ today: '2026-07-06', sections: CURRICULUM, logs: [], config: CFG });
    expect(r.projectedFinishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('currentWeek is 1-based from start', () => {
    expect(currentWeek('2026-06-22', CFG)).toBe(1);
    expect(currentWeek('2026-06-29', CFG)).toBe(2);
    expect(currentWeek('2026-09-25', CFG)).toBe(14);
  });
  it('phaseForWeek maps weeks to the four phases', () => {
    expect(phaseForWeek(1)!.name).toBe('Foundations');
    expect(phaseForWeek(7)!.n).toBe(3);
    expect(phaseForWeek(14)!.n).toBe(4);
  });
  it('sectionEffortMinutes sums minutes for one section', () => {
    const logs: LogEntry[] = [
      { id: '1', studyDate: '2026-06-24', minutes: 120, sectionId: 2, finishedSection: false },
      { id: '2', studyDate: '2026-06-25', minutes: 90, sectionId: 2, finishedSection: false },
      { id: '3', studyDate: '2026-06-25', minutes: 60, sectionId: 3, finishedSection: false },
    ];
    expect(sectionEffortMinutes(logs, 2)).toBe(210);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --run tests/schedule.test.ts`
Expected: FAIL — `@/lib/schedule` not found.

- [ ] **Step 3: Write `lib/schedule.ts`**

```ts
import { addDays, diffDays, fridayOfWeek, isWeekend } from '@/lib/date';

export type SectionKind = 'core' | 'bonus' | 'skip';
export interface Section { id: number; title: string; videoMinutes: number; kind: SectionKind; sortOrder: number; }
export interface LogEntry {
  id: string; studyDate: string; minutes: number; sectionId: number | null;
  finishedSection: boolean; note?: string | null; mood?: string | null; createdAt?: string;
}
export type PaceLabel = 'ahead' | 'on_track' | 'behind';
export interface ScheduleConfig {
  startDate: string; dailyHours: number; studyDaysPerWeek: number;
  multiplier: number; graceWeeks: number; timeZone: string;
}
export interface WeeklyMilestone {
  week: number; fridayDate: string; cumulativeContentMinutes: number;
  throughSectionId: number; throughSectionTitle: string;
}
export interface PaceResult {
  status: PaceLabel; contentMinutesDone: number; contentMinutesTotal: number; contentPct: number;
  idealContentMinutes: number; idealEffortMinutes: number; gapMinutes: number; daysOffPace: number;
  effortMinutes: number; effortBudgetMinutes: number;
  projectedFinishDate: string | null; weeksElapsed: number;
}

export function coreSections(sections: Section[]): Section[] {
  return sections.filter((s) => s.kind === 'core').sort((a, b) => a.sortOrder - b.sortOrder);
}
export function coreContentMinutes(sections: Section[]): number {
  return coreSections(sections).reduce((sum, s) => sum + s.videoMinutes, 0);
}
export function contentMinutesPerWeek(config: ScheduleConfig): number {
  return Math.round((config.dailyHours * config.studyDaysPerWeek / config.multiplier) * 60);
}
export function totalWeeks(sections: Section[], config: ScheduleConfig): number {
  return Math.ceil(coreContentMinutes(sections) / contentMinutesPerWeek(config));
}
export function buildMilestones(sections: Section[], config: ScheduleConfig): WeeklyMilestone[] {
  const core = coreSections(sections);
  const total = coreContentMinutes(sections);
  const perWeek = contentMinutesPerWeek(config);
  const weeks = totalWeeks(sections, config);
  // cumulative section boundaries
  const cum: { id: number; title: string; cumEnd: number }[] = [];
  let running = 0;
  for (const s of core) { running += s.videoMinutes; cum.push({ id: s.id, title: s.title, cumEnd: running }); }
  const out: WeeklyMilestone[] = [];
  for (let w = 1; w <= weeks; w++) {
    const target = Math.min(perWeek * w, total);
    // last section whose cumulative end <= target (i.e. fully completed by target)
    let through = cum[0];
    for (const c of cum) { if (c.cumEnd <= target + 1e-6) through = c; }
    out.push({ week: w, fridayDate: fridayOfWeek(config.startDate, w), cumulativeContentMinutes: target, throughSectionId: through.id, throughSectionTitle: through.title });
  }
  return out;
}
export function finishedSectionIds(logs: LogEntry[]): Set<number> {
  const ids = new Set<number>();
  for (const l of logs) if (l.finishedSection && l.sectionId != null) ids.add(l.sectionId);
  return ids;
}
export function currentSection(sections: Section[], logs: LogEntry[]): Section | null {
  const done = finishedSectionIds(logs);
  return coreSections(sections).find((s) => !done.has(s.id)) ?? null;
}
export function studyWeeksElapsed(today: string, config: ScheduleConfig): number {
  const days = diffDays(config.startDate, today);
  if (days < 0) return 0;
  return Math.floor(days / 7);
}
function contentDoneMinutes(sections: Section[], logs: LogEntry[]): number {
  const done = finishedSectionIds(logs);
  return coreSections(sections).filter((s) => done.has(s.id)).reduce((sum, s) => sum + s.videoMinutes, 0);
}
export function computePace(args: { today: string; sections: Section[]; logs: LogEntry[]; config: ScheduleConfig }): PaceResult {
  const { today, sections, logs, config } = args;
  const perWeek = contentMinutesPerWeek(config);
  const total = coreContentMinutes(sections);
  const weeksElapsed = studyWeeksElapsed(today, config);
  const idealContentMinutes = Math.min(perWeek * weeksElapsed, total);
  const contentMinutesDone = contentDoneMinutes(sections, logs);
  const effortMinutes = logs.reduce((s, l) => s + l.minutes, 0);
  const effortBudgetMinutes = Math.round(total * config.multiplier);
  const gapMinutes = contentMinutesDone - idealContentMinutes;
  const halfWeek = perWeek / 2; // tolerance band (±2.5h)
  const status: PaceLabel = gapMinutes >= halfWeek ? 'ahead' : gapMinutes <= -halfWeek ? 'behind' : 'on_track';
  const daysOffPace = Math.round((gapMinutes / perWeek) * config.studyDaysPerWeek);
  const idealEffortMinutes = Math.round(idealContentMinutes * config.multiplier);

  // projected finish from the TRAILING 14-day content rate; fall back to the plan rate when there's no recent data
  const windowDays = 14;
  const windowStart = addDays(today, -(windowDays - 1));
  const minutesById = new Map(coreSections(sections).map((s) => [s.id, s.videoMinutes]));
  let windowContent = 0;
  for (const l of logs) {
    if (l.finishedSection && l.sectionId != null && l.studyDate >= windowStart && l.studyDate <= today) {
      windowContent += minutesById.get(l.sectionId) ?? 0; // ISO strings compare lexically for YYYY-MM-DD
    }
  }
  const planRatePerDay = perWeek / config.studyDaysPerWeek;
  const ratePerDay = windowContent > 0 ? windowContent / windowDays : planRatePerDay;
  const remaining = Math.max(0, total - contentMinutesDone);
  let projectedFinishDate: string | null = null;
  if (remaining === 0) projectedFinishDate = today;
  else if (ratePerDay > 0) projectedFinishDate = addDays(today, Math.ceil(remaining / ratePerDay));

  return {
    status, contentMinutesDone, contentMinutesTotal: total,
    contentPct: total ? Math.round((contentMinutesDone / total) * 100) : 0,
    idealContentMinutes, idealEffortMinutes, gapMinutes, daysOffPace, effortMinutes, effortBudgetMinutes,
    projectedFinishDate, weeksElapsed,
  };
}
export function streak(logs: LogEntry[], today: string, config: ScheduleConfig): number {
  const days = new Set(logs.map((l) => l.studyDate));
  let count = 0;
  let cursor = today;
  // walk backwards; weekends don't break the streak but don't add to it
  for (let i = 0; i < 400; i++) {
    if (isWeekend(cursor)) { cursor = addDays(cursor, -1); continue; }
    if (days.has(cursor)) { count++; cursor = addDays(cursor, -1); }
    else break;
  }
  return count;
}

// --- monthly phases (the spec's "monthly goals") ---
export interface Phase { n: number; name: string; weekStart: number; weekEnd: number; }
export const PHASES: Phase[] = [
  { n: 1, name: 'Foundations', weekStart: 1, weekEnd: 3 },
  { n: 2, name: 'Core JS', weekStart: 4, weekEnd: 6 },
  { n: 3, name: 'Real apps & data', weekStart: 7, weekEnd: 10 },
  { n: 4, name: 'Modern JS & capstone', weekStart: 11, weekEnd: 14 },
];
export function currentWeek(today: string, config: ScheduleConfig): number {
  const days = diffDays(config.startDate, today);
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}
export function phaseForWeek(week: number): Phase | null {
  return PHASES.find((p) => week >= p.weekStart && week <= p.weekEnd) ?? null;
}
export function sectionEffortMinutes(logs: LogEntry[], sectionId: number): number {
  return logs.filter((l) => l.sectionId === sectionId).reduce((sum, l) => sum + l.minutes, 0);
}
```

- [ ] **Step 4: Run schedule + curriculum tests to verify both pass**

Run: `pnpm test --run tests/schedule.test.ts tests/curriculum.test.ts`
Expected: PASS (all). Now commit Task 1.2's files too.

- [ ] **Step 5: Commit**

```bash
git add lib/schedule.ts tests/schedule.test.ts lib/curriculum.ts tests/curriculum.test.ts
git commit -m "feat: pure pace/schedule engine + curriculum, fully tested"
```

---

## Phase 2 — Database (schema, client, seed, queries)

### Task 2.1: Drizzle schema + client + config

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle.config.ts`

- [ ] **Step 1: Write `lib/db/schema.ts`**

```ts
import { pgTable, integer, text, uuid, timestamp, boolean, date, pgEnum, unique } from 'drizzle-orm/pg-core';

export const sectionKind = pgEnum('section_kind', ['core', 'bonus', 'skip']);
export const messageAuthor = pgEnum('message_author', ['coach', 'student']);
export const messageKind = pgEnum('message_kind', ['encouragement', 'stuck']);

export const sections = pgTable('sections', {
  id: integer('id').primaryKey(),
  title: text('title').notNull(),
  videoMinutes: integer('video_minutes').notNull(),
  kind: sectionKind('kind').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const logEntries = pgTable('log_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  studyDate: date('study_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  sectionId: integer('section_id').references(() => sections.id),
  minutes: integer('minutes').notNull(),
  note: text('note'),
  mood: text('mood'),
  finishedSection: boolean('finished_section').notNull().default(false),
}, (t) => ({
  // one row per (study_date, section) enables same-day correction via upsert.
  // section_id NULL rows are exempt (Postgres NULLS DISTINCT default), so "review/other" entries can repeat.
  daySection: unique('uniq_day_section').on(t.studyDate, t.sectionId),
}));

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  author: messageAuthor('author').notNull(),
  kind: messageKind('kind').notNull(),
  body: text('body').notNull(),
  sectionId: integer('section_id').references(() => sections.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});
```

- [ ] **Step 2: Write `lib/db/index.ts`**

```ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 3: Write `drizzle.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/db drizzle.config.ts && git commit -m "feat: drizzle schema + neon client"
```

### Task 2.2: Provision Neon + push schema (needs Rahul)

**Files:** writes `.env.local` (gitignored); generates `drizzle/` migrations.

- [ ] **Step 1: Get a Neon database URL.** Rahul creates a project at https://neon.tech (free), copies the **pooled** connection string. Put it in `.env.local`:

```
DATABASE_URL=postgresql://<user>:<pwd>@<host>/<db>?sslmode=require
```
Also generate the two tokens and add them:
```bash
echo "STUDENT_TOKEN=$(openssl rand -hex 24)" >> .env.local
echo "COACH_TOKEN=$(openssl rand -hex 24)" >> .env.local
```

- [ ] **Step 2: Generate + push schema**

Run: `pnpm db:generate && pnpm db:push`
Expected: drizzle creates SQL in `drizzle/` and applies the three tables + enums to Neon (prints "Changes applied").

- [ ] **Step 3: Commit migrations** (not `.env.local`)

```bash
git add drizzle && git commit -m "chore: initial drizzle migration"
```

### Task 2.3: Seed script

**Files:** Create: `scripts/seed.ts`

- [ ] **Step 1: Write `scripts/seed.ts`**

```ts
import 'dotenv/config';
import { db } from '@/lib/db';
import { sections } from '@/lib/db/schema';
import { CURRICULUM } from '@/lib/curriculum';

async function main() {
  // neon-http has no interactive transactions; db.batch runs these atomically
  await db.batch([
    db.delete(sections),
    db.insert(sections).values(
      CURRICULUM.map((s) => ({ id: s.id, title: s.title, videoMinutes: s.videoMinutes, kind: s.kind, sortOrder: s.sortOrder })),
    ),
  ]);
  console.log(`Seeded ${CURRICULUM.length} sections.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the seed**

Run: `pnpm db:seed`
Expected: prints "Seeded 21 sections."

- [ ] **Step 3: Commit**

```bash
git add scripts/seed.ts && git commit -m "feat: section seed script"
```

### Task 2.4: Data-access queries

**Files:** Create: `lib/db/queries.ts`

- [ ] **Step 1: Write `lib/db/queries.ts`** (implements every signature from Shared Contracts)

```ts
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

export interface Message { id: string; createdAt: string; author: 'coach'|'student'; kind: 'encouragement'|'stuck'; body: string; sectionId: number | null; resolvedAt: string | null; }
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
export interface NewMessage { author: 'coach'|'student'; kind: 'encouragement'|'stuck'; body: string; sectionId?: number | null; }
export async function insertMessage(input: NewMessage): Promise<void> {
  await db.insert(messages).values({ author: input.author, kind: input.kind, body: input.body, sectionId: input.sectionId ?? null });
}
export async function resolveStuck(id: string): Promise<void> {
  await db.update(messages).set({ resolvedAt: new Date() }).where(eq(messages.id, id));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/queries.ts && git commit -m "feat: data-access queries"
```

---

## Phase 3 — Auth (tokens → role) + middleware + theming foundation

### Task 3.1: `lib/auth.ts` (full TDD)

**Files:**
- Create: `lib/auth.ts`
- Test: `tests/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { roleFromToken } from '@/lib/auth';

beforeEach(() => { process.env.STUDENT_TOKEN = 'stu-secret'; process.env.COACH_TOKEN = 'coach-secret'; });

describe('roleFromToken', () => {
  it('maps the student token', () => expect(roleFromToken('stu-secret')).toBe('student'));
  it('maps the coach token', () => expect(roleFromToken('coach-secret')).toBe('coach'));
  it('rejects unknown / empty tokens', () => {
    expect(roleFromToken('nope')).toBeNull();
    expect(roleFromToken('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test --run tests/auth.test.ts`
Expected: FAIL — `@/lib/auth` not found.

- [ ] **Step 3: Write `lib/auth.ts`**

```ts
export type Role = 'student' | 'coach';
export const ROLE_COOKIE = 'journey_role';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export function roleFromToken(token: string): Role | null {
  const student = process.env.STUDENT_TOKEN ?? '';
  const coach = process.env.COACH_TOKEN ?? '';
  if (token && student && safeEqual(token, student)) return 'student';
  if (token && coach && safeEqual(token, coach)) return 'coach';
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test --run tests/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts tests/auth.test.ts && git commit -m "feat: token->role auth (constant-time)"
```

### Task 3.2: Middleware (token guard + role cookie)

**Files:** Create: `middleware.ts`

- [ ] **Step 1: Write `middleware.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { roleFromToken, ROLE_COOKIE } from '@/lib/auth';

export const config = { matcher: ['/m/:token', '/r/:token'] }; // single segment, not :token* (zero-or-more)

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const seg = pathname.split('/').filter(Boolean); // ['m', token] or ['r', token]
  const token = seg[1] ?? '';
  const role = roleFromToken(token);
  const expected = seg[0] === 'm' ? 'student' : 'coach';
  if (!role || role !== expected) {
    return new NextResponse('Not found', { status: 404 });
  }
  const res = NextResponse.next();
  // secure must be conditional: a Secure cookie is NOT stored over http://localhost in Safari, breaking local verify.
  res.cookies.set(ROLE_COOKIE, role, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  return res;
}
```

- [ ] **Step 2: Manual verify (after pages exist in Phase 4/5).** For now typecheck.

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts && git commit -m "feat: middleware token guard + role cookie"
```

### Task 3.3: Design tokens + fonts + theme init (Tailwind v4)

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `components/theme-toggle.tsx`

- [ ] **Step 1: Replace `app/globals.css`** — port the reference tokens and expose them to Tailwind v4 via `@theme inline`. (USER RULE: components must use these token utilities, never static colors like `bg-gray-950`.)

```css
@import "tailwindcss";

:root {
  --paper:#f6f3ec; --surface:#fffdf8; --surface-2:#fbf8f1;
  --ink:#1c211b; --ink-2:#34382f; --muted:#5f6358; --faint:#8a8c80;
  --accent:#1d6b57; --accent-deep:#143f33; --accent-soft:#e7efe9;
  --hair:#e4ddcd; --hair-strong:#d6cdb8; --amber:#8a5a12; --amber-soft:#f3ead7;
  --shadow:0 1px 2px rgba(28,33,27,.04),0 8px 28px -16px rgba(28,33,27,.18);
  color-scheme: light;
}
:root[data-theme="dark"] {
  --paper:#161814; --surface:#1d201a; --surface-2:#22251e;
  --ink:#e9eae1; --ink-2:#d3d6ca; --muted:#a2a799; --faint:#767b6d;
  --accent:#5cc4a3; --accent-deep:#8fe0c4; --accent-soft:#1b2c25;
  --hair:#2c302a; --hair-strong:#3a4035; --amber:#d9a441; --amber-soft:#2c2516;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 12px 32px -18px rgba(0,0,0,.7);
  color-scheme: dark;
}
@theme inline {
  --color-paper: var(--paper); --color-surface: var(--surface); --color-surface-2: var(--surface-2);
  --color-ink: var(--ink); --color-ink-2: var(--ink-2); --color-muted: var(--muted); --color-faint: var(--faint);
  --color-accent: var(--accent); --color-accent-deep: var(--accent-deep); --color-accent-soft: var(--accent-soft);
  --color-hair: var(--hair); --color-hair-strong: var(--hair-strong);
  /* 'warn'/'warn-soft' map to the reference's amber tokens; named 'warn' to avoid colliding with Tailwind's built-in amber-* scale */
  --color-warn: var(--amber); --color-warn-soft: var(--amber-soft);
  --font-serif: var(--font-fraunces), Georgia, serif;
  --font-sans: var(--font-plex), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
body { background: var(--paper); color: var(--ink); font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }
::selection { background: var(--accent); color:#fff; }
@media (prefers-reduced-motion: no-preference) {
  .reveal { opacity:0; transform: translateY(12px); animation: rise .7s cubic-bezier(.2,.8,.2,1) forwards; }
  @keyframes rise { to { opacity:1; transform:none; } }
}
```

- [ ] **Step 2: Replace `app/layout.tsx`** — load fonts, set the no-flash theme script.

```tsx
import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400','500','600'], variable: '--font-plex', display: 'swap' });

export const metadata: Metadata = { title: "Mansi's JS Journey", description: 'Daily progress through The Complete JavaScript Course.' };

const themeInit = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plex.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Write `components/theme-toggle.tsx`** (client; mirrors the reference's sun/moon toggle)

```tsx
'use client';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === 'dark'); }, []);
  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    setDark(next === 'dark');
  }
  return (
    <button onClick={toggle} aria-label="Toggle dark mode" aria-pressed={dark}
      className="fixed top-4 right-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-hair-strong bg-surface text-accent shadow transition hover:-translate-y-px hover:border-accent">
      {dark ? '☀' : '☾'}
    </button>
  );
}
```

- [ ] **Step 4: Verify build + theme**

Run: `pnpm dev`, open `http://localhost:3000`, confirm warm paper background and that the toggle flips light/dark with no flash on reload. Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx components/theme-toggle.tsx
git commit -m "feat: design tokens, fonts, theme toggle (from reference)"
```

### Task 3.4: Public cover page

**Files:** Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`** (no data; calm masthead in the reference style)

```tsx
import { ThemeToggle } from '@/components/theme-toggle';

export default function Cover() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 reveal">
      <ThemeToggle />
      <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Personal &amp; private
      </span>
      <h1 className="mt-5 font-serif text-5xl font-semibold leading-tight tracking-tight text-ink">
        Mansi&apos;s <em className="text-accent">JS</em> Journey
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted">
        A quiet place to track the climb through The Complete JavaScript Course — one day at a time.
      </p>
      <p className="mt-10 text-sm text-faint">This page has no data. Access is by private link.</p>
    </main>
  );
}
```

- [ ] **Step 2: Verify** — visit `/`; confirm styling. **Step 3: Commit**

```bash
git add app/page.tsx && git commit -m "feat: public cover page"
```

---

## Phase 4 — Student view (`/m/[token]`)

> Shared UI primitives first, then the page. All colors via token utilities.

### Task 4.1: Progress ring + streak badge

**Files:** Create: `components/progress-ring.tsx`, `components/streak-badge.tsx`

- [ ] **Step 1: Write `components/progress-ring.tsx`**

```tsx
export function ProgressRing({ pct, label }: { pct: number; label?: string }) {
  const r = 52, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--hair)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--accent)" strokeWidth="10"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute text-center">
        <div className="font-serif text-2xl font-semibold text-ink">{pct}%</div>
        {label && <div className="text-[0.7rem] uppercase tracking-wider text-faint">{label}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/streak-badge.tsx`**

```tsx
export function StreakBadge({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-3 py-1 text-sm font-semibold text-warn">
      🔥 {days} day{days === 1 ? '' : 's'}
    </span>
  );
}
```

- [ ] **Step 3: Typecheck + Commit**

```bash
pnpm exec tsc --noEmit
git add components/progress-ring.tsx components/streak-badge.tsx
git commit -m "feat: progress ring + streak badge"
```

### Task 4.2: Log server action

**Files:** Create: `lib/actions/log.ts`

- [ ] **Step 1: Write `lib/actions/log.ts`**

```ts
'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ROLE_COOKIE } from '@/lib/auth';
import { insertLog, getSections, getLogs } from '@/lib/db/queries';
import { computePace } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { todayInTZ } from '@/lib/date';
import { sendCoachEmail, logEmailLine } from '@/lib/email';

export async function createLogAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const role = (await cookies()).get(ROLE_COOKIE)?.value;
  if (role !== 'student') return { ok: false, error: 'unauthorized' };

  const minutes = Number(form.get('minutes'));
  const sectionId = form.get('sectionId') ? Number(form.get('sectionId')) : null;
  const note = (form.get('note') as string | null)?.trim() || null;
  const mood = (form.get('mood') as string | null) || null;
  const finishedSection = form.get('finishedSection') === 'on';
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return { ok: false, error: 'invalid minutes' };

  const studyDate = todayInTZ(PLAN.timeZone);
  await insertLog({ studyDate, sectionId, minutes, note, mood, finishedSection });

  // fire-and-forget email (do not block UX on failure)
  try {
    const [sections, logs] = await Promise.all([getSections(), getLogs()]);
    const pace = computePace({ today: studyDate, sections, logs, config: PLAN });
    await sendCoachEmail(`Mansi logged ${(minutes / 60).toFixed(1)}h today`, logEmailLine({ minutes, sectionId, finishedSection }, pace, sections));
  } catch (e) { console.error('email failed', e); }

  revalidatePath('/m/[token]', 'page'); // dynamic-segment route pattern; bare '/m' matches no real route
  revalidatePath('/r/[token]', 'page');
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck** (depends on `lib/email.ts`; create a stub now if needed, full impl in Phase 6). Create minimal `lib/email.ts`:

```ts
import type { PaceResult, Section } from '@/lib/schedule';
export async function sendCoachEmail(_subject: string, _body: string): Promise<void> { /* implemented in Phase 6 */ }
export function logEmailLine(log: { minutes: number; sectionId: number | null; finishedSection: boolean }, pace: PaceResult, sections: Section[]): string {
  const s = sections.find((x) => x.id === log.sectionId);
  const status = pace.status === 'on_track' ? 'on track' : pace.status;
  return `Mansi logged ${(log.minutes / 60).toFixed(1)}h on ${s?.title ?? 'review'}${log.finishedSection ? ' (finished it ✓)' : ''} — ${status}. ${pace.contentPct}% of the course done.`;
}
```

Run: `pnpm exec tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/actions/log.ts lib/email.ts && git commit -m "feat: createLog server action + email line (email stub)"
```

### Task 4.3: Check-in form (client)

**Files:** Create: `components/student/check-in-form.tsx`

- [ ] **Step 1: Write the component** (controlled; calls the action; confetti via a tiny inline burst — no extra dep)

```tsx
'use client';
import { useState, useTransition } from 'react';
import { createLogAction } from '@/lib/actions/log';
import type { Section } from '@/lib/schedule';

const MOODS = ['🚀', '😊', '😐', '😮‍💨'];

// varied, hours-aware confirmation lines (spec §6 asks for a "varied" encouraging line)
function encouragement(hours: string): string {
  const lines = [
    `🎉 ${hours}h logged — that's real progress today.`,
    `🔥 ${hours}h in the books. Future-you says thanks.`,
    `✨ Nice — ${hours}h closer. Consistency is the whole game.`,
    `💪 ${hours}h done. Showing up is most of the battle.`,
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

export function CheckInForm({ sections, currentSectionId }: { sections: Section[]; currentSectionId: number | null }) {
  const [minutes, setMinutes] = useState(150); // 2.5h default
  const [sectionId, setSectionId] = useState<number | null>(currentSectionId);
  const [mood, setMood] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [done, setDone] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    formData.set('minutes', String(minutes));
    if (sectionId != null) formData.set('sectionId', String(sectionId));
    if (mood) formData.set('mood', mood);
    if (finished) formData.set('finishedSection', 'on');
    start(async () => {
      const res = await createLogAction(formData);
      if (res.ok) { setDoneMsg(encouragement((minutes / 60).toFixed(1))); setDone(true); setTimeout(() => setDone(false), 4000); }
    });
  }

  if (done) return <div className="rounded-2xl bg-accent-soft p-6 text-center text-accent-deep reveal">{doneMsg}</div>;

  return (
    <form action={submit} className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <label className="block text-sm font-semibold text-ink-2">Today I worked on</label>
      <select value={sectionId ?? ''} onChange={(e) => setSectionId(Number(e.target.value))}
        className="mt-2 w-full rounded-lg border border-hair bg-surface-2 p-3 text-ink">
        {sections.filter((s) => s.kind === 'core').map((s) => (
          <option key={s.id} value={s.id}>{s.id}. {s.title}</option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-semibold text-ink-2">For how long?</label>
      <div className="mt-2 flex items-center justify-center gap-4">
        <button type="button" aria-label="Less time" onClick={() => setMinutes((m) => Math.max(15, m - 15))}
          className="grid h-11 w-11 place-items-center rounded-full border border-hair bg-surface-2 text-2xl text-ink">−</button>
        <div className="min-w-24 text-center font-serif text-3xl font-semibold text-ink">{(minutes / 60).toFixed(2).replace(/\.?0+$/, '')}h</div>
        <button type="button" aria-label="More time" onClick={() => setMinutes((m) => Math.min(360, m + 15))}
          className="grid h-11 w-11 place-items-center rounded-full border border-hair bg-surface-2 text-2xl text-ink">+</button>
      </div>

      <input name="note" placeholder="One line about today (optional)"
        className="mt-4 w-full rounded-lg border border-hair bg-surface-2 p-3 text-ink placeholder:text-faint" />

      <div className="mt-4 flex items-center gap-2">
        {MOODS.map((m) => (
          <button type="button" key={m} onClick={() => setMood(m === mood ? null : m)}
            className={`grid h-10 w-10 place-items-center rounded-full border text-lg transition ${mood === m ? 'border-accent bg-accent-soft' : 'border-hair bg-surface-2'}`}>{m}</button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
        I finished this section ✓
      </label>

      <button type="submit" disabled={pending}
        className="mt-5 w-full rounded-xl bg-accent py-3 font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60">
        {pending ? 'Saving…' : 'Log today'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck + Commit**

```bash
pnpm exec tsc --noEmit
git add components/student/check-in-form.tsx && git commit -m "feat: daily check-in form"
```

### Task 4.4: Coach-note card + stuck button + student page

**Files:**
- Create: `components/student/coach-note-card.tsx`, `components/student/stuck-button.tsx`
- Create: `lib/actions/message.ts`
- Create: `app/m/[token]/page.tsx`

- [ ] **Step 1: Write `lib/actions/message.ts`**

```ts
'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { ROLE_COOKIE } from '@/lib/auth';
import { insertMessage, resolveStuck } from '@/lib/db/queries';
import { sendCoachEmail } from '@/lib/email';

async function role() { return (await cookies()).get(ROLE_COOKIE)?.value; }

export async function sendStuckAction(form: FormData) {
  if ((await role()) !== 'student') return { ok: false };
  const body = (form.get('body') as string)?.trim();
  const sectionId = form.get('sectionId') ? Number(form.get('sectionId')) : null;
  if (!body) return { ok: false };
  await insertMessage({ author: 'student', kind: 'stuck', body, sectionId });
  try { await sendCoachEmail('Mansi is stuck on something', body); } catch {}
  revalidatePath('/r/[token]', 'page');
  return { ok: true };
}
export async function sendCoachNoteAction(form: FormData) {
  if ((await role()) !== 'coach') return { ok: false };
  const body = (form.get('body') as string)?.trim();
  if (!body) return { ok: false };
  await insertMessage({ author: 'coach', kind: 'encouragement', body });
  revalidatePath('/m/[token]', 'page');
  return { ok: true };
}
export async function resolveStuckAction(form: FormData) {
  if ((await role()) !== 'coach') return { ok: false };
  await resolveStuck(form.get('id') as string);
  revalidatePath('/r/[token]', 'page');
  return { ok: true };
}
```

- [ ] **Step 2: Write `components/student/coach-note-card.tsx`**

```tsx
import type { Message } from '@/lib/db/queries';
export function CoachNoteCard({ note }: { note: Message | null }) {
  if (!note) return null;
  return (
    <div className="rounded-2xl border-l-[3px] border-accent bg-accent-soft p-4">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">A note from your coach</div>
      <p className="mt-1 text-ink-2">{note.body}</p>
    </div>
  );
}
```

- [ ] **Step 3: Write `components/student/stuck-button.tsx`** (client; expandable field)

```tsx
'use client';
import { useState, useTransition } from 'react';
import { sendStuckAction } from '@/lib/actions/message';

export function StuckButton({ sectionId }: { sectionId: number | null }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent) return <p className="text-sm text-accent">Sent to your coach — help is on the way. 💚</p>;
  if (!open) return <button onClick={() => setOpen(true)} className="text-sm text-faint underline underline-offset-2 hover:text-amber">I&apos;m stuck on something…</button>;
  return (
    <form action={(fd) => { if (sectionId != null) fd.set('sectionId', String(sectionId)); start(async () => { const r = await sendStuckAction(fd); if (r.ok) setSent(true); }); }}
      className="rounded-xl border border-hair bg-surface-2 p-3">
      <textarea name="body" rows={2} placeholder="What's tripping you up?" className="w-full resize-none bg-transparent text-ink placeholder:text-faint" />
      <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white">{pending ? 'Sending…' : 'Send'}</button>
    </form>
  );
}
```

- [ ] **Step 4: Write `app/m/[token]/page.tsx`** (server component assembling the warm view)

```tsx
import { getSections, getLogs, latestCoachNote } from '@/lib/db/queries';
import { computePace, currentSection, streak } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { todayInTZ } from '@/lib/date';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProgressRing } from '@/components/progress-ring';
import { StreakBadge } from '@/components/streak-badge';
import { CheckInForm } from '@/components/student/check-in-form';
import { CoachNoteCard } from '@/components/student/coach-note-card';
import { StuckButton } from '@/components/student/stuck-button';

export const dynamic = 'force-dynamic';

const PACE_COPY: Record<string, string> = {
  ahead: "You're ahead — gorgeous work. ✨",
  on_track: "You're right on track. Keep the rhythm. 💚",
  behind: "A little behind — one good session closes the gap. You've got this.",
};

export default async function StudentPage() {
  const today = todayInTZ(PLAN.timeZone);
  const [sections, logs, note] = await Promise.all([getSections(), getLogs(), latestCoachNote()]);
  const pace = computePace({ today, sections, logs, config: PLAN });
  const cur = currentSection(sections, logs);
  const days = streak(logs, today, PLAN);

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <ThemeToggle />
      <header className="reveal">
        <p className="text-sm text-faint">Hi {process.env.STUDENT_NAME ?? 'there'} 👋</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-ink">Today&apos;s focus</h1>
        <p className="mt-1 text-lg text-accent-deep">{cur ? `${cur.id}. ${cur.title}` : 'Course complete — incredible! 🎉'}</p>
      </header>

      <section className="mt-6 flex items-center gap-5 reveal">
        <ProgressRing pct={pace.contentPct} label="of course" />
        <div className="space-y-2">
          <StreakBadge days={days} />
          <p className="text-sm text-muted">{PACE_COPY[pace.status]}</p>
        </div>
      </section>

      <section className="mt-6"><CheckInForm sections={sections} currentSectionId={cur?.id ?? null} /></section>
      <section className="mt-6 space-y-4">
        <CoachNoteCard note={note} />
        <StuckButton sectionId={cur?.id ?? null} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: End-to-end manual verify** (DB seeded, `.env.local` set)

Run: `pnpm dev`, open `http://localhost:3000/m/<STUDENT_TOKEN>`.
Expected: warm page; pick section, drag hours, submit → confetti card; reload → log persisted, % moved if "finished" ticked. Visiting `/m/wrong-token` → 404.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/message.ts components/student app/m
git commit -m "feat: student view — check-in, coach note, stuck flag"
```

---

## Phase 5 — Coach view (`/r/[token]`)

### Task 5.1: Status headline + pace card

**Files:** Create: `components/coach/status-headline.tsx`, `components/coach/countdown.tsx`, `components/coach/pace-card.tsx`

- [ ] **Step 1: Write `components/coach/status-headline.tsx`**

```tsx
import type { PaceResult } from '@/lib/schedule';
const TONE: Record<PaceResult['status'], string> = {
  ahead: 'text-accent', on_track: 'text-accent', behind: 'text-warn',
};
export function StatusHeadline({ pace }: { pace: PaceResult }) {
  const gapH = Math.abs(pace.gapMinutes / 60).toFixed(1);
  const msg = pace.status === 'behind' ? `Behind by ${gapH}h (~${Math.abs(pace.daysOffPace)} study-days)`
    : pace.status === 'ahead' ? `Ahead by ${gapH}h` : 'On track';
  return (
    <div>
      <div className={`font-serif text-3xl font-semibold ${TONE[pace.status]}`}>{msg}</div>
      <p className="mt-1 text-muted">{pace.contentPct}% complete · {(pace.effortMinutes / 60).toFixed(1)}h logged vs {(pace.idealEffortMinutes / 60).toFixed(1)}h expected by today</p>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/coach/countdown.tsx`** (client; live days/hours to the deadline)

```tsx
'use client';
import { useEffect, useState } from 'react';
export function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  if (now === null) return <span className="text-faint">—</span>; // null on first render avoids hydration mismatch
  const end = new Date(`${deadline}T23:59:59+05:30`).getTime();   // IST end-of-day
  const ms = end - now;
  if (ms <= 0) return <span className="text-warn">deadline passed</span>;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return <span className="text-accent-deep">{days}d {hours}h left</span>;
}
```

- [ ] **Step 3: Write `components/coach/pace-card.tsx`** (content done vs ideal, EFFORT vs ideal, projected finish vs BOTH the 25 Sep target and 2 Oct deadline + live countdown)

```tsx
import type { PaceResult } from '@/lib/schedule';
import { Countdown } from './countdown';
export function PaceCard({ pace, target, deadline }: { pace: PaceResult; target: string; deadline: string }) {
  const idealH = (pace.idealContentMinutes / 60).toFixed(1);
  const doneH = (pace.contentMinutesDone / 60).toFixed(1);
  const totalH = (pace.contentMinutesTotal / 60).toFixed(1);
  const effH = (pace.effortMinutes / 60).toFixed(1);
  const effIdealH = (pace.idealEffortMinutes / 60).toFixed(1);
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
        <div><div className="text-faint">Content done</div><div className="font-serif text-xl text-ink">{doneH}h / {totalH}h</div></div>
        <div><div className="text-faint">Expected by today</div><div className="font-serif text-xl text-ink">{idealH}h</div></div>
        <div><div className="text-faint">Effort</div><div className="font-serif text-xl text-ink">{effH}h / {effIdealH}h</div></div>
        <div><div className="text-faint">Projected finish</div><div className="font-serif text-xl text-ink">{pace.projectedFinishDate ?? '—'}</div></div>
        <div><div className="text-faint">Course target</div><div className="font-serif text-xl text-accent-deep">{target}</div></div>
        <div><div className="text-faint">Deadline</div><div className="font-serif text-xl text-accent-deep">{deadline}</div><div className="mt-0.5 text-xs"><Countdown deadline={deadline} /></div></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + Commit**

```bash
pnpm exec tsc --noEmit
git add components/coach/status-headline.tsx components/coach/countdown.tsx components/coach/pace-card.tsx
git commit -m "feat: coach status headline + pace card + live countdown"
```

### Task 5.2: Study heatmap + logs feed

**Files:** Create: `components/coach/heatmap.tsx`, `components/coach/logs-feed.tsx`

- [ ] **Step 1: Write `components/coach/heatmap.tsx`** (last 14 weeks, Mon–Fri columns; intensity by minutes)

```tsx
import type { LogEntry } from '@/lib/schedule';
import { addDays } from '@/lib/date';

export function Heatmap({ logs, startDate, weeks }: { logs: LogEntry[]; startDate: string; weeks: number }) {
  const byDate = new Map<string, number>();
  for (const l of logs) byDate.set(l.studyDate, (byDate.get(l.studyDate) ?? 0) + l.minutes);
  const cell = (min: number) => min === 0 ? 'var(--hair)' : min < 60 ? 'var(--accent-soft)' : min < 150 ? 'var(--accent)' : 'var(--accent-deep)';
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Study days</div>
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className="flex flex-col gap-1.5">
            {Array.from({ length: 5 }, (_, d) => {
              const date = addDays(startDate, w * 7 + d);
              const min = byDate.get(date) ?? 0;
              return <div key={d} title={`${date}: ${(min/60).toFixed(1)}h`} className="h-4 w-4 rounded-[3px]" style={{ background: cell(min) }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/coach/logs-feed.tsx`**

```tsx
import type { LogEntry, Section } from '@/lib/schedule';
export function LogsFeed({ logs, sections }: { logs: LogEntry[]; sections: Section[] }) {
  const title = (id: number | null) => sections.find((s) => s.id === id)?.title ?? 'Review';
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Recent logs</div>
      <ul className="mt-3 divide-y divide-hair">
        {logs.slice(0, 12).map((l) => (
          <li key={l.id} className="flex items-start justify-between gap-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-ink">{title(l.sectionId)} {l.finishedSection && <span className="text-accent">✓</span>}</div>
              {l.note && <div className="text-sm text-muted">{l.note}</div>}
            </div>
            <div className="whitespace-nowrap text-right text-sm text-faint">{l.mood} {(l.minutes/60).toFixed(1)}h<br />{l.studyDate.slice(5)}</div>
          </li>
        ))}
        {logs.length === 0 && <li className="py-3 text-sm text-faint">No logs yet.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + Commit**

```bash
pnpm exec tsc --noEmit
git add components/coach/heatmap.tsx components/coach/logs-feed.tsx
git commit -m "feat: study heatmap + logs feed"
```

### Task 5.3: Schedule table + stuck list + send-note form

**Files:** Create: `components/coach/this-week.tsx`, `components/coach/schedule-table.tsx`, `components/coach/stuck-list.tsx`, `components/coach/send-note-form.tsx`

- [ ] **Step 1: Write `components/coach/schedule-table.tsx`**

```tsx
import type { WeeklyMilestone, LogEntry, Section } from '@/lib/schedule';
import { finishedSectionIds, currentSection, phaseForWeek } from '@/lib/schedule';

export function ScheduleTable({ milestones, logs, sections, today }: { milestones: WeeklyMilestone[]; logs: LogEntry[]; sections: Section[]; today: string }) {
  const done = finishedSectionIds(logs);
  const curId = currentSection(sections, logs)?.id ?? null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-hair bg-surface shadow">
      <table className="w-full text-sm">
        <thead><tr className="bg-surface-2 text-left text-[0.7rem] uppercase tracking-wider text-faint">
          <th className="p-3">Phase</th><th className="p-3">Wk</th><th className="p-3">By Friday</th><th className="p-3">Through</th><th className="p-3">State</th></tr></thead>
        <tbody>
          {milestones.map((m) => {
            const isDone = done.has(m.throughSectionId);
            const isCurrent = !isDone && m.throughSectionId === curId;       // the in-progress section (0-credit but active)
            const overdue = m.fridayDate < today && !isDone && !isCurrent;
            const phase = phaseForWeek(m.week);
            return (
              <tr key={m.week} className="border-t border-hair">
                <td className="p-3 text-faint">{phase ? `P${phase.n}` : ''}</td>
                <td className="p-3 text-faint">{m.week}</td>
                <td className="p-3 text-ink-2">{m.fridayDate}</td>
                <td className="p-3 text-ink">S{m.throughSectionId}: {m.throughSectionTitle}</td>
                <td className="p-3">{isDone ? <span className="text-accent">done ✓</span> : isCurrent ? <span className="text-accent-deep">in progress</span> : overdue ? <span className="text-warn">overdue</span> : <span className="text-faint">upcoming</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/coach/stuck-list.tsx`** (uses `resolveStuckAction`)

```tsx
import type { Message } from '@/lib/db/queries';
import { resolveStuckAction } from '@/lib/actions/message';

export function StuckList({ items }: { items: Message[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border-l-[3px] border-warn bg-warn-soft p-5">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-warn">Needs your help</div>
      <ul className="mt-3 space-y-3">
        {items.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-3">
            <p className="text-ink-2">{m.body}</p>
            <form action={resolveStuckAction}><input type="hidden" name="id" value={m.id} />
              <button className="whitespace-nowrap rounded-lg border border-hair-strong px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent">resolve</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Write `components/coach/send-note-form.tsx`** (client)

```tsx
'use client';
import { useState, useTransition } from 'react';
import { sendCoachNoteAction } from '@/lib/actions/message';

export function SendNoteForm() {
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form action={(fd) => start(async () => { const r = await sendCoachNoteAction(fd); if (r.ok) { setSent(true); setTimeout(() => setSent(false), 3000); } })}
      className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Send Mansi a note</div>
      <textarea name="body" rows={2} placeholder="A line of encouragement…" className="mt-2 w-full resize-none rounded-lg border border-hair bg-surface-2 p-3 text-ink placeholder:text-faint" />
      <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white">{sent ? 'Sent 💚' : pending ? 'Sending…' : 'Send'}</button>
    </form>
  );
}
```

- [ ] **Step 4: Write `components/coach/this-week.tsx`** (current week + phase + current-section effort vs budget)

```tsx
import type { WeeklyMilestone, Section, LogEntry } from '@/lib/schedule';
import { finishedSectionIds, currentSection, sectionEffortMinutes, phaseForWeek } from '@/lib/schedule';
import { PLAN } from '@/lib/config';

export function ThisWeek({ week, milestone, sections, logs }: { week: number; milestone: WeeklyMilestone | null; sections: Section[]; logs: LogEntry[] }) {
  const done = finishedSectionIds(logs);
  const cur = currentSection(sections, logs);
  const phase = phaseForWeek(week);
  const curEffort = cur ? sectionEffortMinutes(logs, cur.id) : 0;
  const curBudget = cur ? Math.round(cur.videoMinutes * PLAN.multiplier) : 0;
  return (
    <div className="rounded-2xl border border-hair bg-surface p-5 shadow">
      <div className="flex items-baseline justify-between">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">This week · Week {week || '—'}</div>
        {phase && <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">Phase {phase.n}: {phase.name}</div>}
      </div>
      {cur ? (
        <div className="mt-3 space-y-1">
          <div className="text-ink">Current: <span className="font-medium">S{cur.id} {cur.title}</span> <span className="text-faint">· in progress</span></div>
          <div className="text-sm text-muted">{(curEffort / 60).toFixed(1)}h spent vs {(curBudget / 60).toFixed(1)}h budgeted for this section</div>
          {milestone && <div className="text-sm text-muted">Target by {milestone.fridayDate}: through S{milestone.throughSectionId} {done.has(milestone.throughSectionId) ? <span className="text-accent">✓</span> : <span className="text-faint">(not yet)</span>}</div>}
        </div>
      ) : <div className="mt-3 text-accent">All core sections complete 🎉</div>}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + Commit**

```bash
pnpm exec tsc --noEmit
git add components/coach/this-week.tsx components/coach/schedule-table.tsx components/coach/stuck-list.tsx components/coach/send-note-form.tsx
git commit -m "feat: this-week panel, schedule table, stuck list, send-note form"
```

### Task 5.4: Coach page

**Files:** Create: `app/r/[token]/page.tsx`

- [ ] **Step 1: Write `app/r/[token]/page.tsx`**

```tsx
import { getSections, getLogs, openStuckFlags } from '@/lib/db/queries';
import { computePace, buildMilestones, totalWeeks, currentWeek } from '@/lib/schedule';
import { PLAN } from '@/lib/config';
import { todayInTZ, fridayOfWeek } from '@/lib/date';
import { ThemeToggle } from '@/components/theme-toggle';
import { StatusHeadline } from '@/components/coach/status-headline';
import { PaceCard } from '@/components/coach/pace-card';
import { ThisWeek } from '@/components/coach/this-week';
import { Heatmap } from '@/components/coach/heatmap';
import { LogsFeed } from '@/components/coach/logs-feed';
import { ScheduleTable } from '@/components/coach/schedule-table';
import { StuckList } from '@/components/coach/stuck-list';
import { SendNoteForm } from '@/components/coach/send-note-form';

export const dynamic = 'force-dynamic';

export default async function CoachPage() {
  const today = todayInTZ(PLAN.timeZone);
  const [sections, logs, stuck] = await Promise.all([getSections(), getLogs(), openStuckFlags()]);
  const pace = computePace({ today, sections, logs, config: PLAN });
  const milestones = buildMilestones(sections, PLAN);
  const weeks = totalWeeks(sections, PLAN);
  const target = fridayOfWeek(PLAN.startDate, weeks);                      // 25 Sep 2026 — core complete
  const deadline = fridayOfWeek(PLAN.startDate, weeks + PLAN.graceWeeks);  // 2 Oct 2026 — official deadline
  const week = currentWeek(today, PLAN);
  const thisWeekMilestone = milestones.find((m) => m.week === week) ?? null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 space-y-6">
      <ThemeToggle />
      <header className="reveal"><StatusHeadline pace={pace} /></header>
      <StuckList items={stuck} />
      <PaceCard pace={pace} target={target} deadline={deadline} />
      <ThisWeek week={week} milestone={thisWeekMilestone} sections={sections} logs={logs} />
      <Heatmap logs={logs} startDate={PLAN.startDate} weeks={weeks} />
      <div className="grid gap-6 md:grid-cols-2">
        <LogsFeed logs={logs} sections={sections} />
        <SendNoteForm />
      </div>
      <ScheduleTable milestones={milestones} logs={logs} sections={sections} today={today} />
    </main>
  );
}
```

- [ ] **Step 2: End-to-end verify**

Run: `pnpm dev`, open `/r/<COACH_TOKEN>`.
Expected: status headline + pace card with the real 2 Oct deadline, heatmap, logs feed (shows logs created on the student page), schedule table with done/overdue/upcoming, send-note posts a note that appears on `/m`. `/r/<wrong>` → 404. Submitting a stuck flag on `/m` shows it here; "resolve" clears it.

- [ ] **Step 3: Commit**

```bash
git add app/r && git commit -m "feat: coach dashboard page"
```

---

## Phase 6 — Notifications (Resend email + daily cron)

### Task 6.1: Implement `lib/email.ts` with Resend

**Files:** Modify: `lib/email.ts`

- [ ] **Step 1: Replace the stub `sendCoachEmail`** (keep `logEmailLine` as-is)

```ts
import { Resend } from 'resend';
import type { PaceResult, Section } from '@/lib/schedule';

export async function sendCoachEmail(subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.COACH_EMAIL;
  if (!key || !to) { console.warn('email skipped: missing RESEND_API_KEY/COACH_EMAIL'); return; }
  const resend = new Resend(key);
  // resend.emails.send resolves with { data, error } and does NOT throw on API-level failures — inspect it.
  const { error } = await resend.emails.send({ from: "Mansi's JS Journey <onboarding@resend.dev>", to, subject, text: body });
  if (error) console.error('resend error', error);
}

export function logEmailLine(log: { minutes: number; sectionId: number | null; finishedSection: boolean }, pace: PaceResult, sections: Section[]): string {
  const s = sections.find((x) => x.id === log.sectionId);
  const status = pace.status === 'on_track' ? 'on track' : pace.status;
  return `Mansi logged ${(log.minutes / 60).toFixed(1)}h on ${s?.title ?? 'review'}${log.finishedSection ? ' (finished it ✓)' : ''} — ${status}. ${pace.contentPct}% of the course done.`;
}
```

- [ ] **Step 2: Add `RESEND_API_KEY` + `COACH_EMAIL` to `.env.local`.** Rahul provides the key from resend.com. **Hard constraint:** while using the shared `onboarding@resend.dev` sender, Resend only delivers to the Resend account owner's own email — so `COACH_EMAIL` MUST be the exact address Rahul signed up to Resend with, or every email is silently rejected (the SDK returns `{ error }`, it does not throw). To send elsewhere, verify a domain in Resend and change the `from`. Typecheck: `pnpm exec tsc --noEmit`.

- [ ] **Step 3: Manual verify** — submit a log on `/m`; confirm an email arrives at `COACH_EMAIL`. (Note: `onboarding@resend.dev` only sends to the account owner's email until a domain is verified — fine for personal use.)

- [ ] **Step 4: Commit**

```bash
git add lib/email.ts && git commit -m "feat: Resend email for log/stuck heads-up"
```

### Task 6.2: Daily no-log cron route

**Files:**
- Create: `app/api/cron/daily/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write `app/api/cron/daily/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { hasLogOn } from '@/lib/db/queries';
import { sendCoachEmail } from '@/lib/email';
import { PLAN } from '@/lib/config';
import { todayInTZ, isWeekend } from '@/lib/date';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // fail closed: if the secret is unset, a header of literally "Bearer undefined" must NOT pass
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const today = todayInTZ(PLAN.timeZone);
  if (isWeekend(today)) return NextResponse.json({ skipped: 'weekend' });
  const logged = await hasLogOn(today);
  if (!logged) await sendCoachEmail('No log from Mansi today', `No study log recorded for ${today}.`);
  return NextResponse.json({ today, logged });
}
```

- [ ] **Step 2: Write `vercel.json`** (15:30 UTC ≈ 21:00 IST)

```json
{ "crons": [{ "path": "/api/cron/daily", "schedule": "30 15 * * 1-5" }] }
```

> Vercel sends cron requests with the `Authorization: Bearer <CRON_SECRET>` header automatically when `CRON_SECRET` is set as an env var.
>
> **Hobby-plan caveat:** Vercel's free plan runs crons at most once per day and does not guarantee the exact minute or honor the `1-5` day-of-week field — timing is approximate, and the in-route `isWeekend(today)` guard (already present) is what actually skips weekends. For precise 21:00 IST timing, use a Pro plan or an external scheduler (e.g. cron-job.org) hitting the route with the Bearer secret.

- [ ] **Step 3: Local verify**

Run: `pnpm dev`, then `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily`
Expected: JSON `{ today, logged }`; an email if no log today. Without the header → 401.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/daily/route.ts vercel.json && git commit -m "feat: daily no-log cron heads-up"
```

---

## Phase 7 — Polish + deploy

### Task 7.1: Reduced-motion confetti + entrance polish

**Files:** Modify: `components/student/check-in-form.tsx` (add a CSS confetti burst on `done`), `app/globals.css` (confetti keyframes).

- [ ] **Step 1: Add confetti** — on `done`, render ~12 absolutely-positioned spans animated with a `confetti` keyframe (guarded by `prefers-reduced-motion`). Full snippet:

```css
/* append to app/globals.css */
@media (prefers-reduced-motion: no-preference) {
  .confetti span { position:absolute; top:0; width:8px; height:8px; border-radius:2px; animation: confetti 1.1s ease-out forwards; }
  @keyframes confetti { to { transform: translateY(120px) rotate(360deg); opacity:0; } }
}
```

```tsx
// inside CheckInForm, replace the `done` return with:
if (done) return (
  <div className="relative overflow-hidden rounded-2xl bg-accent-soft p-6 text-center text-accent-deep reveal">
    <div className="confetti pointer-events-none absolute inset-x-0 top-0">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} style={{ left: `${(i / 12) * 100}%`, background: i % 2 ? 'var(--accent)' : 'var(--amber)', animationDelay: `${i * 40}ms` }} />
      ))}
    </div>
    {doneMsg}
  </div>
);
```

- [ ] **Step 2: Verify** in browser (and with OS reduced-motion on → no confetti, no errors). **Step 3: Commit**

```bash
git add components/student/check-in-form.tsx app/globals.css
git commit -m "polish: confetti on log (reduced-motion safe)"
```

### Task 7.2: Run /fix-build, full test + typecheck gate

- [ ] **Step 1: Lint + typecheck + tests + build**

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm test --run && pnpm build
```
Expected: all green. (Per Rahul's rule, invoke the `/fix-build` skill if `pnpm build` fails — fix root cause, never bypass.)

- [ ] **Step 2: Commit any fixes**

```bash
git add -A && git commit -m "chore: green build, types, tests"
```

### Task 7.3: Push + deploy to Vercel

**Files:** none (deploy config already in `vercel.json`).

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Create the Vercel project + set env vars.** Use the Vercel MCP (`deploy_to_vercel`) or the Vercel dashboard (import `RahulSomaliya/js-journey`). Set env vars for Production: `DATABASE_URL`, `STUDENT_TOKEN`, `COACH_TOKEN`, `RESEND_API_KEY`, `COACH_EMAIL`, `COACH_NAME`, `STUDENT_NAME`, `CRON_SECRET`.

- [ ] **Step 3: Deploy + smoke test the live URL**

- Visit `https://<app>.vercel.app/` → cover page.
- `/m/<STUDENT_TOKEN>` → log a session on a phone; `/r/<COACH_TOKEN>` on another device shows it (cross-device source-of-truth confirmed).
- Bad token → 404. Email arrives. Cron route returns 401 without the secret.

- [ ] **Step 4: Final commit / tag**

```bash
git commit --allow-empty -m "release: Mansi's JS Journey live" && git push
```

- [ ] **Step 5: Hand Mansi her link.** Send only `/m/<STUDENT_TOKEN>`; keep `/r/<COACH_TOKEN>` private.

---

## Self-Review (completed by author)

**Spec coverage:** purpose (Phases 4/5) · curriculum-aware logging (4.3) · two token views (3.1/3.2, 4.4, 5.4) · warm-vs-honest tone (4.4 copy / 5.1) · binary section credit (schedule.ts `contentDoneMinutes`) · coach notes + stuck flags (4.4, 5.3) · pace engine + trailing-window projection (1.4) · 14-week date-anchored schedule (1.4 tests assert 26 Jun…25 Sep) · This-week panel + effort-vs-ideal + dual dates + live countdown (5.1/5.3/5.4) · monthly phases (1.4) · same-day correction (2.1/2.4) · email + daily cron (6.1/6.2) · visual system from reference (3.3) · Neon+Drizzle+Vercel+Resend (2.x, 7.3). **Correction:** v1's "no gaps" claim was wrong — the adversarial review found 6 real spec gaps (projection rate, This-week, effort-vs-ideal, countdown/dual-dates, monthly phases, same-day correction), all now closed (see "Plan review notes (v2)").

**Placeholder scan:** every code step contains complete code; no TBD/TODO. The `lib/email.ts` stub in Task 4.2 is intentional and fully replaced in Task 6.1 (noted in both).

**Type consistency:** `Section`/`LogEntry`/`PaceResult`/`Message` names and fields match across `schedule.ts`, `queries.ts`, components, and actions. Minutes-as-integer is uniform. `ROLE_COOKIE`/`roleFromToken` consistent in `auth.ts`, `middleware.ts`, and both action files. `buildMilestones`/`computePace`/`currentSection`/`streak` signatures identical between contracts, tests, and implementation.
