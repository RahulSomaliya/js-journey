import type { LogEntry } from '@/lib/schedule';
import { fmtDur, fmtDate } from '@/lib/format';

export function LatestFromMansi({ log, sectionTitle }: { log: LogEntry | null; sectionTitle: string }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-hair bg-surface p-6 shadow">
      <div className="flex items-center justify-between">
        <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-accent">Latest from Mansi</div>
        {log && <div className="text-sm text-faint">{fmtDate(log.studyDate)}</div>}
      </div>

      {log ? (
        <>
          <p className="mt-4 max-w-2xl font-serif text-xl leading-relaxed text-ink">
            {log.note ? `“${log.note}”` : <span className="text-muted">Logged {fmtDur(log.minutes)} — no note this time.</span>}
          </p>
          <div className="mt-auto flex items-center gap-2 pt-5 text-sm">
            {log.mood && <span className="text-base">{log.mood}</span>}
            <span className="font-medium text-ink-2">{sectionTitle}</span>
            <span className="text-faint">· {fmtDur(log.minutes)}{log.finishedSection ? ' · finished ✓' : ''}</span>
          </div>
        </>
      ) : (
        <p className="mt-4 text-muted">No updates yet — Mansi hasn’t logged a session.</p>
      )}
    </div>
  );
}
