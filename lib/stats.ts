import { TIME_ZONE } from '@/lib/config';
import { addDays, inBreak, isoWeekday, todayInTZ, type DayRange } from '@/lib/date';
import { finishedSectionIds, type LogEntry, type Section } from '@/lib/schedule';
import type { JourneyStatus, ProgressSnapshot } from '@/lib/player';

// "The same stats she sees" (spec-v2 decision 7): the Course Player's home row — Today ·
// Streak · Complete · Due — and its 30-day chart, for the coach view and her web page.
// MIRROR of course-player web/src/lib/stats.ts (streak, last30, completion) and
// screens/home/Stats.tsx (the % label): change a rule there → change it here, or Rahul
// reads a different number than she does. Both streaks walk the plan calendar JourneyStatus
// carries (studyWeekdays + planBreaks) — the player gets it from GET /api/player/status.
//
// Source: the player's latest ProgressSnapshot (her exact numbers). Without one (player not
// updated yet, or she only signs off on the web) the sessions stand in — close, not exact:
// minutes are rounded per session and land on the day a session STARTED, and Complete
// counts whole finished sections, not lectures.
// Known gap, on purpose: with a snapshot, a manual (web) update's minutes are not in
// Today/Streak/chart — the player never sees them either, and both views must agree.

/** a day counts towards the streak at 5 min of study (player: STREAK_MIN_SECONDS) */
export const STREAK_MIN_SECONDS = 300;

export interface JourneyStats {
  source: 'snapshot' | 'sessions';
  /** ISO time the snapshot was taken (her Mac's clock); null when computed from sessions */
  asOf: string | null;
  today: { date: string; seconds: number };
  /** study days in a row with ≥ 5 min, walking back from today (see `streak`) */
  streak: number;
  /** percent 0–100 unrounded; label = the player's figure ("<1%", "42%");
   *  lecturesTotal null when computed from sessions (only the player knows the lecture count) */
  complete: { percent: number; label: string; lecturesDone: number; lecturesTotal: number | null };
  /** the course target date + pace; pace is null before the plan starts and during a plan break (onBreak
   *  names it). The day she is back is weekView's (lib/journey-view.ts, addDays(end, 1) like the player) —
   *  not repeated here: a second "back on" rule here once disagreed with it (addStudyDays). */
  due: { date: string; pace: JourneyStatus['pace'] | null; daysDelta: number; onBreak: { label: string } | null };
  /** oldest → today, always 30 days; average over all 30 */
  last30: { days: { date: string; seconds: number }[]; averageSeconds: number };
  /** the lecture "Continue" points at; null without a snapshot */
  current: ProgressSnapshot['current'];
}

export function percentLabel(percent: number): string {
  return percent > 0 && percent < 1 ? '<1%' : `${Math.min(100, Math.floor(percent))}%`;
}

export function computeStats(args: {
  /** the clock; "today" is its Asia/Kolkata date — the player keys days by her Mac's local (IST) date */
  now: Date;
  snapshot: ProgressSnapshot | null;
  logs: LogEntry[];
  sections: Section[];
  status: JourneyStatus;
  /** the plan's first day (ScheduleConfig.startDate): no pace before it */
  startDate: string;
}): JourneyStats {
  const { now, snapshot, logs, sections, status, startDate } = args;
  const today = todayInTZ(TIME_ZONE, now);
  const days = snapshot ? snapshot.days : secondsByStudyDate(logs);
  const complete = snapshot ? snapshotCompletion(snapshot) : sessionCompletion(logs, sections);

  const series: { date: string; seconds: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = addDays(today, -i);
    series.push({ date, seconds: days[date] ?? 0 });
  }

  const brk = status.planBreak;
  const onBreak = brk !== null && brk.start <= today && today <= brk.end;
  // same rule as weekView: nothing to be on or off pace with before day 1 (JourneyStatus still reads
  // "on-track" then — the player hides it the same way)
  const notStarted = today < startDate;
  return {
    source: snapshot ? 'snapshot' : 'sessions',
    asOf: snapshot ? new Date(snapshot.takenAt).toISOString() : null,
    today: { date: today, seconds: days[today] ?? 0 },
    streak: streak(days, today, { studyWeekdays: status.studyWeekdays, breaks: status.planBreaks }),
    complete: { ...complete, label: percentLabel(complete.percent) },
    due: {
      date: status.targetDate,
      pace: onBreak || notStarted ? null : status.pace,
      daysDelta: status.daysDelta,
      onBreak: onBreak ? { label: brk.label } : null,
    },
    last30: { days: series, averageSeconds: series.reduce((sum, d) => sum + d.seconds, 0) / series.length },
    current: snapshot?.current ?? null,
  };
}

/** The plan calendar the streak walks (player: StudyCalendar). */
export interface StudyCalendar {
  /** ISO 1 = Mon … 7 = Sun */
  studyWeekdays: readonly number[];
  breaks: readonly DayRange[];
}

/** Study days in a row, walking back from today — the player's rule (course-player web/src/lib/stats.ts
 *  streak), same test table: a day with ≥ 5 min adds 1 (a weekend or break day too); a plan study day
 *  under 5 min ends it — except today, still in progress; a weekend / break day under 5 min is skipped.
 *  A calendar-day streak reset every Monday and all of Diwali (2026-10-01). `today` is the IST date. */
export function streak(days: Record<string, number>, today: string, cal: StudyCalendar): number {
  const studied = (d: string) => (days[d] ?? 0) >= STREAK_MIN_SECONDS;
  const isStudyDay = (d: string) => cal.studyWeekdays.includes(isoWeekday(d)) && !inBreak(d, cal.breaks);
  // nothing before the oldest real study day can add, so the walk ends there (and always ends —
  // a plan with no study days never breaks it)
  const oldest = Object.keys(days).filter(studied).reduce<string | null>((a, k) => (a === null || k < a ? k : a), null);
  let count = 0;
  for (let day = today; oldest !== null && day >= oldest; day = addDays(day, -1)) {
    if (studied(day)) count++;
    else if (day !== today && isStudyDay(day)) break;
  }
  return count;
}

function secondsByStudyDate(logs: LogEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of logs) out[l.studyDate] = (out[l.studyDate] ?? 0) + l.minutes * 60;
  return out;
}

function snapshotCompletion(s: ProgressSnapshot): Omit<JourneyStats['complete'], 'label'> {
  const percent = s.videoSecondsTotal > 0 ? Math.min(100, (s.videoSecondsDone / s.videoSecondsTotal) * 100) : 0;
  return { percent, lecturesDone: s.lecturesDone, lecturesTotal: s.lecturesTotal };
}

// every section counts toward the total (the player's total is the whole course, §04 too)
function sessionCompletion(logs: LogEntry[], sections: Section[]): Omit<JourneyStats['complete'], 'label'> {
  const done = finishedSectionIds(logs); // sectionsFinishedBy: mid-session finishes count
  const total = sections.reduce((sum, s) => sum + s.videoMinutes, 0);
  const finished = sections.filter((s) => done.has(s.id)).reduce((sum, s) => sum + s.videoMinutes, 0);
  const lectures = new Set(logs.flatMap((l) => (l.lecturesCompleted ?? []).map((x) => `${x.section}:${x.lecture}`)));
  return { percent: total > 0 ? (finished / total) * 100 : 0, lecturesDone: lectures.size, lecturesTotal: null };
}
