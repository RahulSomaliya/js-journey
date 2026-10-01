import { buildDynamicSchedule, computePace, currentWeek, planBreakFor, planTimeline, type LogEntry, type ScheduleConfig, type Section } from '@/lib/schedule';
import type { JourneyStatus } from '@/lib/player';

// GET /api/player/status — the same numbers the student view shows, for the player:
// - pace     = computePace (content finished vs prorated plan, ±half-week band) — the
//              student page's pace line and the coach headline use the same call
// - daysDelta = buildDynamicSchedule's projected finish vs target, in STUDY days
//              (the student page's "N days ahead/behind" line uses dyn.studyDaysDelta)
// - goal     = the dynamic current section + its due date ("Next checkpoint")
// - planBreak = planBreakFor: the break in progress, else the next within 14 days
//              (both views show the same break; every number above already skips it)
// Pure: the route handler only loads the rows and the clock.
export function computeJourneyStatus(args: {
  today: string;
  sections: Section[];
  logs: LogEntry[];
  config: ScheduleConfig;
  coachNote: { body: string; createdAt: string } | null;
}): JourneyStatus {
  const { today, sections, logs, config, coachNote } = args;
  const pace = computePace({ today, sections, logs, config });
  const dyn = buildDynamicSchedule(sections, logs, config, today);
  const plan = planTimeline(sections, config);
  const cur = dyn.currentSection;
  return {
    pace: pace.status === 'on_track' ? 'on-track' : pace.status,
    daysDelta: dyn.studyDaysDelta,
    week: Math.max(1, currentWeek(today, config)), // pre-start reads "week 1", like the student page
    totalWeeks: plan.weeks,
    targetDate: plan.target,
    deadline: plan.deadline,
    // sortOrder = the course's own section number (React: folder NN) — what the player knows
    goal: cur && dyn.currentDueDate ? { sectionNumber: cur.sortOrder, title: cur.title, due: dyn.currentDueDate } : null,
    coachNote: coachNote ? { body: coachNote.body, createdAt: coachNote.createdAt } : null,
    planBreak: planBreakFor(today, config.breaks),
  };
}

