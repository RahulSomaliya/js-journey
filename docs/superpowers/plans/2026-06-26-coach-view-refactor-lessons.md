# Coach View Refactor + Full Curriculum Lessons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the coach read-only view (`/r/[token]`) into a desktop-only, hierarchy-driven dashboard and add a collapsible Full Curriculum view whose sections expand to show Jonas's real lecture lists.

**Architecture:** The page stays a Next.js server component that fetches logs/sections once and computes per-section status via a new pure helper. A new **client** accordion component owns only open/closed UI state. Lesson titles live in a static `lib/lessons.ts` map (sourced from Udemy). No DB or schema changes.

**Tech Stack:** Next.js 16.2.9 (App Router, breaking changes vs. older Next), React 19, Tailwind v4 (CSS-var theme tokens), Drizzle/Neon (read-only here), Vitest, pnpm.

## Global Constraints

_Every task implicitly includes these._

- **Next.js 16.2.9 is NOT the Next you know** (per `AGENTS.md`): before using any unfamiliar Next API, read the relevant guide in `node_modules/next/dist/docs/`. Follow existing component patterns in `components/coach/*` and `app/r/[token]/page.tsx`.
- **Theme tokens only — never hardcoded colors.** Use the existing role tokens from `app/globals.css`: `surface`, `surface-2`, `ink`, `ink-2`, `muted`, `faint`, `accent`, `accent-deep`, `accent-soft`, `hair`, `hair-strong`, `warn`, `warn-soft`. Fraunces = `font-serif`, IBM Plex = `font-sans`. No `bg-gray-*`, no hex.
- **Desktop-only.** Remove every `md:`/responsive breakpoint in touched coach components. Container width target ≈ **1120–1152px** (`max-w-6xl`).
- **No DB / schema changes.** Progress stays section-level; no per-lesson state.
- **Scope = `/r/[token]` only.** Do not touch the student `/m/[token]` view.
- **Never bypass hooks:** no `--no-verify`, no `--no-gpg-sign`. Fix root causes.
- **Build before commit:** run `pnpm build` (and `pnpm test`) green before any commit of UI changes.
- **Commits are gated on Rahul's explicit approval.** The `git commit` step in each task is prepared and staged, but actually committing waits for his go-ahead (batch-approve at checkpoints).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `lib/lessons.ts` | Static `Record<sectionId, Lesson[]>` of real lecture titles + durations | **Create** |
| `tests/lessons.test.ts` | Structural validation of the lessons data | **Create** |
| `lib/schedule.ts` | Add `buildCurriculumRows` derivation (+ `SectionStatus`, `CurriculumRow` types) | **Modify** |
| `tests/schedule.test.ts` | Add `buildCurriculumRows` cases | **Modify** |
| `components/coach/curriculum.tsx` | Client accordion: rows, expand/collapse, lessons outline | **Create** |
| `app/r/[token]/page.tsx` | Re-zone layout; compute rows; wire accordion; drop schedule table | **Modify** |
| `components/coach/schedule-table.tsx` | Folded into curriculum rows | **Delete** |
| `components/coach/pace-card.tsx` | Split 6 equal stats → 3 hero + 3 quiet; remove `md:` | **Modify** |
| `components/coach/status-headline.tsx` `this-week.tsx` `heatmap.tsx` `logs-feed.tsx` `send-note-form.tsx` `stuck-list.tsx` | Restyle for new zones/hierarchy; remove `md:`; add interaction states | **Modify** |

---

## Task 1: Lessons data (`lib/lessons.ts`) + validation test

**Files:**
- Create: `lib/lessons.ts`
- Create: `tests/lessons.test.ts`

**Interfaces:**
- Produces: `export type Lesson = { title: string; minutes?: number }` and `export const LESSONS: Record<number, Lesson[]>` keyed by `Section.id`. Section order on Udemy maps 1:1 to `CURRICULUM` order, so Udemy section N → `CURRICULUM[N-1].id`.

- [ ] **Step 1: Write the failing structural test**

Create `tests/lessons.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LESSONS } from '@/lib/lessons';
import { CURRICULUM } from '@/lib/curriculum';

const coreIds = CURRICULUM.filter((s) => s.kind === 'core').map((s) => s.id);
const validIds = new Set(CURRICULUM.map((s) => s.id));

describe('lessons data', () => {
  it('has at least one lesson for every core section', () => {
    for (const id of coreIds) {
      expect(LESSONS[id]?.length ?? 0, `section ${id}`).toBeGreaterThan(0);
    }
  });
  it('every lesson has a non-empty title', () => {
    for (const list of Object.values(LESSONS)) {
      for (const l of list) expect(l.title.trim().length).toBeGreaterThan(0);
    }
  });
  it('every key is a valid section id', () => {
    for (const k of Object.keys(LESSONS)) expect(validIds.has(Number(k))).toBe(true);
  });
  it('total lecture count is in the published range (~332)', () => {
    const total = Object.values(LESSONS).reduce((n, l) => n + l.length, 0);
    expect(total).toBeGreaterThan(280);
    expect(total).toBeLessThan(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/lessons.test.ts`
Expected: FAIL — cannot resolve `@/lib/lessons` (module does not exist).

- [ ] **Step 3: Fetch the real curriculum from Udemy (Claude-in-Chrome)**

This step is performed in-session by the orchestrator (browser MCP), not a sandboxed subagent:
1. Load Chrome tools: `ToolSearch` → `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__computer`.
2. `tabs_context_mcp`, then `tabs_create_mcp` a fresh tab.
3. Navigate to the public course page for *The Complete JavaScript Course: From Zero to Expert!* (Jonas Schmedtmann). Expand the curriculum ("Show all sections" / "Expand all lectures"), then `read_page`/`get_page_text` to extract, **per section in order**, each lecture's title and (if shown) duration.
4. Map Udemy section N → `CURRICULUM[N-1].id`. Spot-check 2 section titles against `lib/curriculum.ts` to confirm the order alignment before trusting it.

- [ ] **Step 4: Write `lib/lessons.ts` with the fetched data**

Shape (populate every section's array from the fetch; durations optional):

```ts
export type Lesson = { title: string; minutes?: number };

// Lecture lists for "The Complete JavaScript Course" (Jonas Schmedtmann,
// 2025 ES2024/ES2025 edition). Keyed by CURRICULUM section id. Sourced from
// the public Udemy curriculum; editable. Section quiz/assignment items included
// as they appear in the course outline.
export const LESSONS: Record<number, Lesson[]> = {
  1: [
    { title: 'Course Structure and Projects' },
    { title: 'Watch Before You Start!' },
    { title: 'Setup' },
    // …full list per fetched data
  ],
  2: [
    { title: "Hello World!" },
    { title: 'A Brief Introduction to JavaScript' },
    // …
  ],
  // … sections 3–21 (skip-kind section 6 may have an empty array; bonus sections optional)
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test tests/lessons.test.ts`
Expected: PASS (4 tests). If the total-count assertion fails, the fetch was incomplete — re-expand the Udemy curriculum and refill.

- [ ] **Step 6: Show Rahul 2 sections for spot-check, then commit**

Print sections 2 and 11 (`JavaScript Fundamentals – Part 1`, `Working With Arrays — Bankist`) for Rahul to eyeball. After his OK:

```bash
git add lib/lessons.ts tests/lessons.test.ts
git commit -m "feat: real per-section lecture data + validation"
```

---

## Task 2: `buildCurriculumRows` derivation in `lib/schedule.ts`

**Files:**
- Modify: `lib/schedule.ts` (append after `sectionEffortMinutes`, ~line 150)
- Modify: `tests/schedule.test.ts` (add a `describe` block; extend the import on lines 3-6)

**Interfaces:**
- Consumes: existing `Section`, `LogEntry`, `WeeklyMilestone`, `sectionEffortMinutes(logs, sectionId)`, `finishedSectionIds(logs)`, `currentSection(sections, logs)`.
- Produces:
  ```ts
  export type SectionStatus = 'done' | 'in_progress' | 'overdue' | 'upcoming';
  export interface CurriculumRow {
    section: Section;
    status: SectionStatus;
    minutesLogged: number;
    targetFriday: string | null; // ISO date; null for non-core (bonus/skip)
  }
  export function buildCurriculumRows(
    sections: Section[], logs: LogEntry[], milestones: WeeklyMilestone[], today: string,
  ): CurriculumRow[]
  ```

- [ ] **Step 1: Write the failing tests**

Add to `tests/schedule.test.ts` (also add `buildCurriculumRows` to the import block on lines 3-6):

```ts
describe('buildCurriculumRows', () => {
  const ms = buildMilestones(CURRICULUM, CFG);
  it('marks a finished section done, current section in_progress, and rest upcoming (early date)', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-22', minutes: 24, sectionId: 1, finishedSection: true },
      { id: 'b', studyDate: '2026-06-23', minutes: 60, sectionId: 2, finishedSection: false },
    ];
    const rows = buildCurriculumRows(CURRICULUM, logs, ms, '2026-06-24');
    const byId = Object.fromEntries(rows.map((r) => [r.section.id, r]));
    expect(byId[1].status).toBe('done');
    expect(byId[1].minutesLogged).toBe(24);
    expect(byId[2].status).toBe('in_progress');
    expect(byId[3].status).toBe('upcoming');
  });
  it('marks an unfinished, non-current core section overdue once its target Friday has passed', () => {
    const logs: LogEntry[] = [
      { id: 'a', studyDate: '2026-06-22', minutes: 24, sectionId: 1, finishedSection: true },
    ];
    // far-future "today" → every later core section's target Friday is in the past
    const rows = buildCurriculumRows(CURRICULUM, logs, ms, '2026-12-31');
    const s3 = rows.find((r) => r.section.id === 3)!;
    expect(s3.status).toBe('overdue');
    expect(s3.targetFriday).not.toBeNull();
  });
  it('gives bonus/skip sections a null targetFriday', () => {
    const rows = buildCurriculumRows(CURRICULUM, [], ms, '2026-06-24');
    expect(rows.find((r) => r.section.id === 4)!.targetFriday).toBeNull(); // bonus
    expect(rows.find((r) => r.section.id === 6)!.targetFriday).toBeNull(); // skip
  });
  it('returns one row per section, in sortOrder', () => {
    const rows = buildCurriculumRows(CURRICULUM, [], ms, '2026-06-24');
    expect(rows).toHaveLength(CURRICULUM.length);
    expect(rows.map((r) => r.section.id)).toEqual(CURRICULUM.map((s) => s.id));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/schedule.test.ts`
Expected: FAIL — `buildCurriculumRows is not a function` / type not exported.

- [ ] **Step 3: Implement `buildCurriculumRows`**

Append to `lib/schedule.ts`:

```ts
export type SectionStatus = 'done' | 'in_progress' | 'overdue' | 'upcoming';

export interface CurriculumRow {
  section: Section;
  status: SectionStatus;
  minutesLogged: number;
  targetFriday: string | null;
}

export function buildCurriculumRows(
  sections: Section[],
  logs: LogEntry[],
  milestones: WeeklyMilestone[],
  today: string,
): CurriculumRow[] {
  const done = finishedSectionIds(logs);
  const currentId = currentSection(sections, logs)?.id ?? null;
  const ordered = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);

  return ordered.map((section) => {
    const minutesLogged = sectionEffortMinutes(logs, section.id);

    // Core sections inherit the Friday of the earliest milestone whose
    // throughSectionId reaches this section. Bonus/skip don't gate → null.
    let targetFriday: string | null = null;
    if (section.kind === 'core') {
      const m = milestones.find((mi) => mi.throughSectionId >= section.id);
      targetFriday = m?.fridayDate ?? null;
    }

    let status: SectionStatus;
    if (done.has(section.id)) status = 'done';
    else if (section.id === currentId) status = 'in_progress';
    else if (targetFriday && targetFriday < today) status = 'overdue';
    else status = 'upcoming';

    return { section, status, minutesLogged, targetFriday };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test tests/schedule.test.ts`
Expected: PASS (existing suite + 4 new cases).

- [ ] **Step 5: Commit**

```bash
git add lib/schedule.ts tests/schedule.test.ts
git commit -m "feat: buildCurriculumRows — per-section status/progress derivation"
```

---

## Task 3: Curriculum accordion client component

**Files:**
- Create: `components/coach/curriculum.tsx`

**Interfaces:**
- Consumes: `CurriculumRow`, `SectionStatus` (Task 2); `Lesson` (Task 1); `fmtDur`, `fmtDate` from `lib/format.ts`.
- Produces: `export function Curriculum({ rows, lessons, currentSectionId }: { rows: CurriculumRow[]; lessons: Record<number, Lesson[]>; currentSectionId: number | null })`.

- [ ] **Step 1: Write the component**

Create `components/coach/curriculum.tsx` (collapsed by default; tokens only; desktop fixed widths):

```tsx
'use client';

import { useState } from 'react';
import type { CurriculumRow, SectionStatus } from '@/lib/schedule';
import type { Lesson } from '@/lib/lessons';
import { fmtDur, fmtDate } from '@/lib/format';

const STATUS: Record<SectionStatus, { label: string; cls: string }> = {
  done:        { label: 'done ✓',     cls: 'text-accent' },
  in_progress: { label: 'in progress', cls: 'text-accent-deep' },
  overdue:     { label: 'overdue',     cls: 'text-warn' },
  upcoming:    { label: 'upcoming',    cls: 'text-faint' },
};

export function Curriculum({
  rows, lessons, currentSectionId,
}: {
  rows: CurriculumRow[];
  lessons: Record<number, Lesson[]>;
  currentSectionId: number | null;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set()); // collapsed by default
  const doneCount = rows.filter((r) => r.status === 'done').length;
  const watched = rows.reduce((n, r) => n + r.minutesLogged, 0);
  const totalVideo = rows.reduce((n, r) => n + r.section.videoMinutes, 0);
  const allOpen = open.size === rows.length;

  const toggle = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const setAll = (openAll: boolean) =>
    setOpen(openAll ? new Set(rows.map((r) => r.section.id)) : new Set());

  return (
    <section className="rounded-2xl border border-hair bg-surface shadow">
      <div className="flex items-baseline justify-between border-b border-hair px-6 py-4">
        <div>
          <h2 className="font-serif text-xl text-ink">Full curriculum</h2>
          <p className="mt-0.5 text-sm text-muted">
            {doneCount} / {rows.length} sections done · {fmtDur(watched)} of {fmtDur(totalVideo)} watched
          </p>
        </div>
        <button
          onClick={() => setAll(!allOpen)}
          className="text-sm font-medium text-accent transition-colors hover:text-accent-deep"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <ul>
        {rows.map((r) => {
          const isOpen = open.has(r.section.id);
          const isCurrent = r.section.id === currentSectionId;
          const isSkip = r.section.kind === 'skip';
          const meta = STATUS[r.status];
          const items = lessons[r.section.id] ?? [];
          const pct = r.section.videoMinutes
            ? Math.min(100, Math.round((r.minutesLogged / r.section.videoMinutes) * 100))
            : 0;

          return (
            <li
              key={r.section.id}
              className={`border-t border-hair ${isCurrent ? 'border-l-2 border-l-accent' : ''} ${isSkip ? 'opacity-60' : ''}`}
            >
              <button
                onClick={() => toggle(r.section.id)}
                className="flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-surface-2"
                aria-expanded={isOpen}
              >
                <span className="w-8 shrink-0 text-sm font-semibold text-faint">S{r.section.id}</span>
                <span className="flex-1 font-medium text-ink">
                  {r.section.title}
                  {r.section.kind !== 'core' && (
                    <span className="ml-2 text-[0.65rem] uppercase tracking-wider text-faint">{r.section.kind}</span>
                  )}
                </span>
                <span className="w-28 shrink-0" aria-hidden>
                  <span className="block h-1 rounded-full bg-hair">
                    <span className="block h-1 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <span className="w-16 shrink-0 text-right text-sm text-muted">{fmtDur(r.section.videoMinutes)}</span>
                <span className={`w-24 shrink-0 text-right text-sm ${meta.cls}`}>{meta.label}</span>
                <span className={`shrink-0 text-faint transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
              </button>

              {isOpen && (
                <div className="px-6 pb-4 pl-[4.25rem]">
                  {items.length === 0 ? (
                    <p className="text-sm text-faint">Lessons coming soon.</p>
                  ) : (
                    <ol className="space-y-1">
                      {items.map((l, i) => (
                        <li key={i} className="flex justify-between gap-4 text-sm text-muted">
                          <span><span className="text-faint">{i + 1}.</span> {l.title}</span>
                          {l.minutes != null && <span className="shrink-0 text-faint">{fmtDur(l.minutes)}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                  {r.targetFriday && (
                    <p className="mt-3 text-[0.7rem] uppercase tracking-wider text-faint">
                      Target by {fmtDate(r.targetFriday)}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Type-check / build the component**

Run: `pnpm build`
Expected: PASS (no type errors). If `Lesson`/`CurriculumRow` import errors appear, Tasks 1–2 are incomplete.

- [ ] **Step 3: Commit (after `pnpm build` green)**

```bash
git add components/coach/curriculum.tsx
git commit -m "feat: collapsible full-curriculum accordion (collapsed by default)"
```

> Visual verification happens against the live page in Task 6, once it's wired in.

---

## Task 4: Re-zone the page + wire the accordion + drop the schedule table

**Files:**
- Modify: `app/r/[token]/page.tsx` (full replacement of the JSX/return + imports)
- Delete: `components/coach/schedule-table.tsx`

**Interfaces:**
- Consumes: `buildCurriculumRows`, `currentSection` (Task 2); `Curriculum` (Task 3); `LESSONS` (Task 1); existing query/compute functions already imported in the page.

- [ ] **Step 1: Replace the page with the zoned layout**

Rewrite `app/r/[token]/page.tsx`:

```tsx
import { getSections, getLogs, openStuckFlags } from '@/lib/db/queries';
import { computePace, buildMilestones, totalWeeks, currentWeek, currentSection, buildCurriculumRows } from '@/lib/schedule';
import { LESSONS } from '@/lib/lessons';
import { PLAN } from '@/lib/config';
import { todayInTZ, fridayOfWeek } from '@/lib/date';
import { ThemeToggle } from '@/components/theme-toggle';
import { StatusHeadline } from '@/components/coach/status-headline';
import { PaceCard } from '@/components/coach/pace-card';
import { ThisWeek } from '@/components/coach/this-week';
import { Heatmap } from '@/components/coach/heatmap';
import { LogsFeed } from '@/components/coach/logs-feed';
import { Curriculum } from '@/components/coach/curriculum';
import { StuckList } from '@/components/coach/stuck-list';
import { SendNoteForm } from '@/components/coach/send-note-form';

export const dynamic = 'force-dynamic';

export default async function CoachPage() {
  const today = todayInTZ(PLAN.timeZone);
  const [sections, logs, stuck] = await Promise.all([getSections(), getLogs(), openStuckFlags()]);
  const pace = computePace({ today, sections, logs, config: PLAN });
  const milestones = buildMilestones(sections, PLAN);
  const weeks = totalWeeks(sections, PLAN);
  const target = fridayOfWeek(PLAN.startDate, weeks);
  const deadline = fridayOfWeek(PLAN.startDate, weeks + PLAN.graceWeeks);
  const week = currentWeek(today, PLAN);
  const thisWeekMilestone = milestones.find((m) => m.week === week) ?? null;
  const rows = buildCurriculumRows(sections, logs, milestones, today);
  const curId = currentSection(sections, logs)?.id ?? null;

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-sm font-medium text-faint">Mansi&rsquo;s JS Journey</span>
        <ThemeToggle />
      </div>

      {/* Zone 1 — Status hero */}
      <header className="reveal space-y-5">
        <StatusHeadline pace={pace} />
        <StuckList items={stuck} />
        <PaceCard pace={pace} target={target} deadline={deadline} />
      </header>

      {/* Zone 2 — Right now */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <ThisWeek week={week} milestone={thisWeekMilestone} sections={sections} logs={logs} />
        <Heatmap logs={logs} startDate={PLAN.startDate} weeks={weeks} today={today} />
      </div>

      {/* Zone 3 — Full curriculum */}
      <div className="mt-8">
        <Curriculum rows={rows} lessons={LESSONS} currentSectionId={curId} />
      </div>

      {/* Zone 4 — Activity */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <LogsFeed logs={logs} sections={sections} />
        <SendNoteForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Delete the schedule table**

Run: `git rm components/coach/schedule-table.tsx`
Expected: file removed; no remaining imports of it (the page no longer references it).

- [ ] **Step 3: Build to confirm nothing else imported the table**

Run: `pnpm build`
Expected: PASS. If it fails on a missing `schedule-table` import, grep `grep -rn schedule-table app components` and remove the stragglers.

- [ ] **Step 4: Commit (after build green)**

```bash
git add app/r/[token]/page.tsx
git commit -m "feat: re-zone coach view into hero/right-now/curriculum/activity; drop schedule table"
```

---

## Task 5: Restyle existing coach components (hierarchy + desktop-only)

Apply Refactoring UI hierarchy: emphasize with weight+color not size, vary card emphasis, remove `md:` breakpoints. Each change below is specific; final spacing/size values are tuned against the browser in Task 6.

**Files:** Modify `pace-card.tsx`, `status-headline.tsx`, `this-week.tsx`, `heatmap.tsx`, `logs-feed.tsx`, `send-note-form.tsx`, `stuck-list.tsx`.

- [ ] **Step 1: Split `PaceCard` into 3 emphasized + 3 quiet stats**

Rewrite `components/coach/pace-card.tsx` so the three "on track?" stats (Content done, Projected finish, Deadline) are emphasized and the other three (Expected by today, Effort, Course target) are a quieter strip. Keep the existing `Countdown` import and props signature `{ pace, target, deadline }`.

```tsx
import type { PaceResult } from '@/lib/schedule';
import { Countdown } from '@/components/coach/countdown';

function Stat({ label, value, tone = 'ink', sub }: { label: string; value: React.ReactNode; tone?: 'ink' | 'accent'; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">{label}</div>
      <div className={`mt-1 font-serif text-2xl ${tone === 'accent' ? 'text-accent' : 'text-ink'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function PaceCard({ pace, target, deadline }: { pace: PaceResult; target: string; deadline: string }) {
  return (
    <div className="rounded-2xl border border-hair bg-surface p-6 shadow">
      {/* emphasized trio */}
      <div className="grid grid-cols-3 gap-6">
        <Stat label="Content done" value={`${fmtDur(pace.contentMinutesDone)} / ${fmtDur(pace.contentMinutesTotal)}`} />
        <Stat label="Projected finish" value={pace.projectedFinish} />
        <Stat label="Deadline" value={deadline} tone="accent" sub={<Countdown deadline={deadline} />} />
      </div>
      {/* quiet trio */}
      <div className="mt-5 grid grid-cols-3 gap-6 border-t border-hair pt-4 text-sm">
        <div><span className="text-faint">Expected by today</span> <span className="text-ink-2">{fmtDur(pace.expectedContentToday)}</span></div>
        <div><span className="text-faint">Effort</span> <span className="text-ink-2">{fmtDur(pace.effortMinutes)} / {fmtDur(pace.expectedEffortMinutes)}</span></div>
        <div><span className="text-faint">Course target</span> <span className="text-accent">{target}</span></div>
      </div>
    </div>
  );
}
```

> Verify the exact `PaceResult` field names against `lib/schedule.ts:18-25` while editing and match them (e.g. `contentMinutesDone`/`projectedFinish` — adjust to the real names). Add `import { fmtDur } from '@/lib/format';`.

- [ ] **Step 2: Remove `md:` breakpoints + quiet the rail cards in the other components**

In each of `this-week.tsx`, `heatmap.tsx`, `logs-feed.tsx`, `send-note-form.tsx`: delete any `md:` classes (the page now controls columns). For the Zone-2/Zone-4 cards, keep `border border-hair bg-surface` but it's fine to drop `shadow` so the hero reads as the most elevated element (Refactoring UI: vary emphasis). Ensure each card header still uses the `text-[0.7rem] font-semibold uppercase tracking-wider text-faint` label pattern.

- [ ] **Step 3: Add interaction states**

`send-note-form.tsx`: ensure the Send button has hover (`hover:bg-accent-deep`), `disabled:opacity-50`, and a pending/sent state (reuse the existing client action pattern). `stuck-list.tsx`: the resolve control gets `hover:text-accent-deep`.

- [ ] **Step 4: Build + lint**

Run: `pnpm build && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit (after build green)**

```bash
git add components/coach
git commit -m "refactor: hierarchy + desktop-only restyle of coach components"
```

---

## Task 6: Live verification in Chrome + finishing pass

**Files:** touch-ups only across `components/coach/*` and `app/globals.css` (additive token/util only if genuinely needed).

- [ ] **Step 1: Run the app**

Run: `pnpm dev` (or verify against the deployed Vercel URL with the existing `/r/<token>`). Confirm the token/auth path in `lib/auth.ts` if running locally.

- [ ] **Step 2: Verify with Claude-in-Chrome**

Load Chrome tools, open the coach view, and check against the spec's verification list:
- Hierarchy reads at a glance: the pace verdict dominates; rail/secondary cards are visibly quieter.
- Accordion: all sections collapsed on load; click expands/collapses; "Expand all / Collapse all" works; current section shows the accent left-border; lessons render; "Lessons coming soon" appears for any empty section.
- No horizontal overflow at ~1120–1152px; comfortable whitespace, not edge-to-edge.
- Toggle theme: both dark and light are clean (tokens only — no stray grays).
- Capture a before/after with `gif_creator` or screenshots for Rahul.

- [ ] **Step 3: Finishing touches**

Fix anything the browser pass surfaced — ambiguous spacing, a label that's too loud, a missing empty/hover state. Keep changes token-based.

- [ ] **Step 4: Final green build + tests**

Run: `pnpm build && pnpm test && pnpm lint`
Expected: all PASS.

- [ ] **Step 5: Commit + (optional) deploy**

```bash
git add -A
git commit -m "polish: live-verified coach view refactor + curriculum view"
```
Hold the push/deploy for Rahul's explicit go-ahead.

---

## Self-Review

**Spec coverage:**
- Desktop-only / remove `md:` → Tasks 4-5 + Global Constraints. ✓
- 4-zone IA (hero / right-now / curriculum / activity) → Task 4. ✓
- Schedule table folded/removed → Task 4 (delete) + Task 2 (`targetFriday` in rows). ✓
- Full Curriculum accordion, collapsed by default, lessons on expand, current highlighted, expand/collapse-all, empty states → Task 3. ✓
- Real Udemy lesson data → Task 1. ✓
- Section status/progress from existing data → Task 2 (reuses `sectionEffortMinutes`). ✓
- Tokens only / hierarchy / states / dark-mode depth → Tasks 3,5,6 + Global Constraints. ✓
- No DB changes → honored throughout. ✓
- Verification (build + live Chrome) → Task 6. ✓

**Placeholder scan:** Logic/data tasks (1-2) carry complete test + impl code. UI tasks (3-5) carry complete component code; Task 5 Step 2 gives specific per-file class changes (not "make it nicer"), with final pixel values explicitly deferred to the Task 6 browser pass — an intentional, named step, not a vague TODO.

**Type consistency:** `Lesson` (Task 1) consumed in Tasks 3-4; `CurriculumRow`/`SectionStatus`/`buildCurriculumRows` (Task 2) consumed in Tasks 3-4; `Curriculum` prop shape identical between Task 3 (definition) and Task 4 (call site). `PaceCard` keeps its existing `{ pace, target, deadline }` signature (Task 5 notes verifying real `PaceResult` field names against source).
