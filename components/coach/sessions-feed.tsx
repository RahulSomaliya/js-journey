import type { LogEntry, Section } from '@/lib/schedule';
import { sectionsFinishedBy } from '@/lib/schedule';
import { fmtDate, fmtDur, sectionTag } from '@/lib/format';
import { TIME_ZONE } from '@/lib/config';

const SHOWN = 20;
const time = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE }).format(new Date(iso));

// Every session, honestly: where it came from (Course Player vs manual check-in), when,
// how long, which sections it finished, the lectures the player saw her complete, mood + note.
export function SessionsFeed({ logs, sections }: { logs: LogEntry[]; sections: Section[] }) {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const label = (id: number | null) => {
    const s = id != null ? byId.get(id) : undefined;
    return s ? `${sectionTag(s.sortOrder)} ${s.title}` : 'Review / other';
  };
  const playerCount = logs.filter((l) => l.source === 'player').length;
  return (
    <div className="rounded-2xl border border-hair bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-faint">Sessions</div>
        <div className="text-xs text-faint">
          {logs.length} total · {playerCount} from the player · {logs.length - playerCount} manual
          {logs.length > SHOWN ? ` · newest ${SHOWN} shown` : ''}
        </div>
      </div>
      {logs.length === 0 ? (
        <p className="mt-3 text-sm text-faint">No sessions yet.</p>
      ) : (
        <ul className="mt-4 grid gap-x-12 xl:grid-cols-2">
          {logs.slice(0, SHOWN).map((l) => {
            const player = l.source === 'player';
            const finished = sectionsFinishedBy(l).map((id) => byId.get(id)).filter((s): s is Section => s !== undefined);
            const lectures = l.lecturesCompleted ?? [];
            const when = player && l.startedAt && l.endedAt
              ? `${time(l.startedAt)}–${time(l.endedAt)}`
              : l.createdAt ? `logged ${time(l.createdAt)}` : null;
            return (
              <li key={l.id} className="border-b border-hair py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${player ? 'bg-accent-soft text-accent-deep' : 'bg-surface-2 text-faint'}`}>
                        {player ? '▶ player' : '✎ manual'}
                      </span>
                      <span className="font-medium text-ink">{label(l.sectionId)}</span>
                    </div>
                    {finished.length > 0 && (
                      <div className="mt-1 text-xs font-medium text-accent">
                        finished {finished.map((s) => sectionTag(s.sortOrder)).join(', ')} ✓
                      </div>
                    )}
                    {l.note && <p className="mt-1 text-sm text-muted">{l.note}</p>}
                  </div>
                  <div className="shrink-0 whitespace-nowrap text-right text-sm text-faint">
                    {l.mood} <span className="font-medium text-ink-2">{fmtDur(l.minutes)}</span>
                    <br />
                    {fmtDate(l.studyDate)}{when && <span> · {when}</span>}
                  </div>
                </div>
                {player && (
                  lectures.length > 0 ? (
                    <details className="group mt-2">
                      <summary className="cursor-pointer list-none text-xs text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                        <span className="inline-block transition-transform duration-200 group-open:rotate-90">›</span>{' '}
                        {lectures.length} lecture{lectures.length === 1 ? '' : 's'} completed
                      </summary>
                      <ol className="mt-1.5 space-y-0.5 pl-3 text-xs text-muted">
                        {lectures.map((lec) => (
                          <li key={`${lec.section}-${lec.lecture}`}>
                            <span className="text-faint">{sectionTag(lec.section)}.{String(lec.lecture).padStart(2, '0')}</span> {lec.title}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : (
                    <p className="mt-2 text-xs text-faint">no lectures completed in this session</p>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
