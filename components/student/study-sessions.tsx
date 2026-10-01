import type { LogEntry, Section } from '@/lib/schedule';
import { sectionsFinishedBy } from '@/lib/schedule';
import { addDays } from '@/lib/date';
import { fmtDate, fmtDur, sectionTag, sessionSummary } from '@/lib/format';

const SHOWN = 6;

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return fmtDate(date);
}

// Her study sessions, newest first. Course Player sessions arrive on their own
// (POST /api/player/sessions) — this card is the proof she never has to log them.
export function StudySessions({
  logs, sections, today, startDate, notStarted,
}: {
  logs: LogEntry[]; sections: Section[]; today: string; startDate: string; notStarted: boolean;
}) {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const todays = logs.filter((l) => l.studyDate === today);
  const todayMinutes = todays.reduce((n, l) => n + l.minutes, 0);
  const recent = logs.slice(0, SHOWN); // getLogs is newest-first

  return (
    <section className="rounded-2xl border border-hair bg-surface p-6 shadow">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-serif text-xl font-semibold text-ink">Your study sessions</h2>
        {todayMinutes > 0 && (
          <span className="text-sm font-medium text-accent-deep">
            Today: {fmtDur(todayMinutes)}{todays.length > 1 ? ` across ${todays.length} sessions` : ''}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm text-faint">Sessions from the Course Player land here on their own — nothing to log. 💚</p>

      {recent.length === 0 ? (
        <div className="mt-5 rounded-xl bg-surface-2 p-5 text-sm leading-relaxed text-muted">
          {notStarted
            ? <>Your React journey starts <span className="font-medium text-ink">{fmtDate(startDate)}</span>. Press play in the Course Player and every session shows up here by itself.</>
            : <>No sessions yet. Press play in the Course Player — your sessions will show up here on their own.</>}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-hair">
          {recent.map((l) => {
            const section = l.sectionId != null ? byId.get(l.sectionId) ?? null : null;
            const finished = sectionsFinishedBy(l)
              .map((id) => byId.get(id))
              .filter((s): s is Section => s !== undefined)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            return (
              <li key={l.id} className="flex items-start gap-3 py-3">
                <span
                  aria-hidden
                  className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs ${l.source === 'player' ? 'bg-accent-soft text-accent-deep' : 'bg-surface-2 text-faint'}`}
                >
                  {l.source === 'player' ? '▶' : '✎'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{sessionSummary(l, section?.sortOrder ?? null)}</div>
                  <div className="mt-0.5 truncate text-xs text-faint">
                    {dayLabel(l.studyDate, today)}{section ? ` · ${section.title}` : ''}
                  </div>
                  {finished.length > 0 && (
                    <div className="mt-1 text-xs font-medium text-accent">
                      Finished {finished.map((s) => sectionTag(s.sortOrder)).join(', ')} ✓
                    </div>
                  )}
                  {l.note && <p className="mt-1 line-clamp-2 text-sm text-muted">“{l.note}”</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
