# Dynamic Milestones — Design Spec

**Status:** Approved (design locked 2026-06-29)
**Author:** Rahul (with Claude)
**Topic:** Replace fixed calendar-Friday milestones with dynamic, progress-anchored section deadlines + a live "X days ahead/behind" projection, across both the student and coach views.

---

## 1. Problem

`buildMilestones` pins every checkpoint to a **fixed calendar Friday** counted from `PLAN.startDate`, and the UI ("Next checkpoint" in `JourneyStats`, `targetFriday` in `buildCurriculumRows`, the `ThisWeek` card) shows the *current week's* milestone. So when Mansi finishes a section early and moves on, the checkpoint never re-anchors — it still reads e.g. "finish Section 1 by 26 Jun" while she's actually on Section 3. She has no realistic deadline for the section she's on, and no sense of the buffer she's banked.

## 2. Goal

Deadlines and the projected course-finish must **recompute from her real progress** every time she completes a section, and credit (or honestly debit) the time she's saved:

- The **current section** shows a deadline counted forward from when she finished her **last** section.
- A **projected course-finish date** + **"X days ahead / behind schedule"** line motivates her with the banked tailwind (or a gentle nudge when behind).
- The same correction applies to the **coach roadmap** and **"This week"** card.

## 3. The model

All counting is in **study-days (Mon–Fri)**, matching the 5-day/week plan.

- **Content pace:** `perStudyDay = contentMinutesPerWeek(config) / config.studyDaysPerWeek`. At the live plan = `300 / 5 = 60` video-min per study-day.
- **Section budget (study-days):** for the schedule we accumulate *minutes* and convert once (avoids per-section rounding drift): `studyDays(throughMinutes) = ceil(throughMinutes / perStudyDay)`. (S2 = 300 min → 5; S3 = 270 → 5.)
- **Anchor** = the `studyDate` of the most recently finished section (`finishedSection === true`), else `config.startDate`.
- **Current section deadline** = `addStudyDays(anchor, ceil(currentSectionMinutes / perStudyDay))`.
- **Projected finish** = `addStudyDays(projAnchor, ceil(remainingCoreMinutes / perStudyDay))` where `remainingCoreMinutes` = sum of the current + all later unfinished core sections.
- **Original target** = `fridayOfWeek(startDate, totalWeeks(sections, config))` (the existing fixed course-target date — kept as the reference).
- **Days delta** = `diffDays(projectedFinish, originalTarget)` (calendar days). `> 0` ahead, `< 0` behind, `0` on track.

### Honest-when-behind
Anchoring purely to the last completion would keep cheerfully reporting "ahead" even if she's gone idle past a deadline. So:

1. `currentDueAtAnchor = addStudyDays(lastCompletion, ceil(currentMinutes / perStudyDay))`.
2. `isCurrentOverdue = today > currentDueAtAnchor`.
3. `projAnchor = isCurrentOverdue ? today : lastCompletion`.

When **not** overdue, the projection (and the current deadline) credit the early completion. When **overdue/idle**, everything re-anchors to **today** → a fresh, actionable deadline and an honest "X days behind" projection.

### Worked examples
- **Rahul's example** (20-day course, 2 sections × 10 study-days): finish S1 on day 5 → anchor = day 5 → S2 deadline = day 5 + 10 = **day 15**; projected finish = day 15 vs original day 20 → **5 days ahead**. ✓
- **Real data** (finished S2 on Fri 26 Jun, now on S3 = 5 study-days): S3 deadline = `addStudyDays(2026-06-26, 5)` = **Fri 3 Jul** (replacing the stale "Section 1 by 26 Jun").

## 4. Engine changes (`lib/schedule.ts`, `lib/date.ts`)

### New helper — `lib/date.ts`
```ts
// advance n study-days (Mon–Fri) forward from an ISO date
export function addStudyDays(iso: string, n: number): string
```

### New function — `lib/schedule.ts`
```ts
export interface DynamicSchedule {
  anchorDate: string;                  // lastCompletion or startDate (the credit anchor)
  currentSection: Section | null;
  currentDueDate: string | null;       // dynamic deadline for the current section
  isCurrentOverdue: boolean;
  projectedFinishDate: string;         // === lastCompletion when course already complete
  originalTargetDate: string;
  daysDelta: number;                   // + ahead / - behind / 0 on track
  perSectionDue: Record<number, string>; // sectionId -> dynamic due date (current + later core)
}

export function buildDynamicSchedule(
  sections: Section[], logs: LogEntry[], config: ScheduleConfig, today: string,
): DynamicSchedule
```
- `perSectionDue` covers the current + all later unfinished core sections (anchored at `projAnchor`, cumulative-minutes → `ceil` → `addStudyDays`). Done sections aren't keyed (they render "done"); bonus/skip never appear (don't gate).
- When `currentSection` is null (all core done): `currentDueDate = null`, `projectedFinishDate = anchorDate`, `perSectionDue = {}`.

### Refactor — `buildCurriculumRows`
Signature changes from `(sections, logs, milestones, today)` to `(sections, logs, dyn, today)`:
- Rename `CurriculumRow.targetFriday` → `targetDate` (it's no longer always a Friday).
- `targetDate = dyn.perSectionDue[section.id] ?? null`.
- `status`: `done` if finished; `in_progress` if `id === dyn.currentSection?.id`; `overdue` if `targetDate && targetDate < today`; else `upcoming`.

`buildMilestones` / `WeeklyMilestone` stay (still used to derive `totalWeeks`/`originalTarget` and not worth ripping out), but are **no longer the source of per-section deadlines**.

## 5. UI changes

### Student — `app/m/[token]/page.tsx` + `JourneyStats`
- Compute `dyn = buildDynamicSchedule(sections, logs, PLAN, today)`; pass to `JourneyStats` and the roadmap.
- Replace the stale "Next checkpoint: finish Section X by <fixed Friday>" with:
  - **Next checkpoint:** "Finish **<current section>** by **<currentDueDate>**" (or "overdue — aim to finish by <fresh date>" when overdue).
  - **Projected finish:** "On this pace you'll finish the course by **<projectedFinishDate>**."
  - **Buffer line / badge:** `daysDelta > 0` → "🎉 You're **<n> days ahead** — keep banking time!"; `< 0` → "You're **<n> days behind** — one good session brings it back. 💚"; `0` → "Right on schedule. 💚".
- Course-complete state: "Course complete — you did it! 🎉".

### Coach — `app/r/[token]/page.tsx`, `buildCurriculumRows`, `ThisWeek`
- Pass `dyn` into `buildCurriculumRows` so the roadmap's per-section dates are dynamic (`curriculum.tsx`: "Target by <targetDate>").
- `ThisWeek`: show the current section's dynamic `currentDueDate` + the `daysDelta` ("3h ahead"→ now "N days ahead of schedule") instead of `milestone.fridayDate`.

## 6. Edge cases
- **Not started** (no logs): anchor = `startDate`; current = first core section; `daysDelta ≈ 0`.
- **Idle / overdue:** re-anchors to `today` → fresh deadline + honest "behind".
- **All core done:** `currentSection = null`; finish = last completion; `daysDelta` vs target (likely "ahead").
- **Pre-start completion** (logged a finish before `startDate`): anchor may precede `startDate`; allowed (extra "ahead" credit) — not clamped.
- **Bonus/skip sections:** excluded from budgets and `perSectionDue` (only core gates).
- **`addStudyDays(iso, 0)`** returns `iso` unchanged.

## 7. Testing (TDD, `tests/date.test.ts` + `tests/schedule.test.ts`)
- `addStudyDays`: skips weekends (Fri +1 = Mon; +5 = next Fri); `n=0` identity.
- `buildDynamicSchedule`:
  - Not-started → current = S1, due = start + ceil(24/60)=1 study-day; `daysDelta` ≈ 0.
  - Synthetic 2-section / known-pace config reproducing the 20-day example → S2 due = day 15, `daysDelta = +5`.
  - Finished S1 & S2 early (real CURRICULUM) → current = S3, due = `addStudyDays(lastCompletion, 5)`, `daysDelta > 0`.
  - Overdue: last completion far in the past, `today` beyond `currentDueAtAnchor` → `isCurrentOverdue`, `projAnchor = today`, `daysDelta < 0`.
  - All core finished → `currentSection = null`, `projectedFinishDate = lastCompletion`.
- `buildCurriculumRows` (updated): `targetDate` comes from `dyn.perSectionDue`; statuses correct.

## 8. Out of scope
- Changing the effort/pace tolerance model in `computePace` (the "ahead/on-track/behind" *status* and `projectedFinishDate` there stay; the new `daysDelta` is milestone-based and separate).
- Mobile responsiveness (desktop-only stands).
- Any DB/schema change (pure derivation from existing logs).

## 9. Decisions (approved)
1. **Full scope** — student + coach both fixed by the one engine change.
2. **Study-days** (Mon–Fri) counting, not raw calendar days.
3. **Honest-when-behind** — re-anchor the projection to today once a section's deadline passes.
4. Fixed course **target/deadline** retained as the reference for `daysDelta`.
