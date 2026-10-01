import type { Section } from '@/lib/schedule';
import { CheckInForm } from './check-in-form';

// The manual check-in, demoted to a collapsed fallback: the Course Player logs her
// sessions automatically now; this is for study away from it (reading, a project).
export function ManualCheckIn({ sections, currentSectionId, finishedIds }: { sections: Section[]; currentSectionId: number | null; finishedIds: number[] }) {
  return (
    <details className="group rounded-2xl border border-hair bg-surface shadow">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-6 py-4 transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-ink-2">Studied away from the player?</span>
          <span className="block text-xs text-faint">Log a session by hand — reading, practice, a project.</span>
        </span>
        <span aria-hidden className="text-xl text-faint transition-transform duration-200 group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-hair px-6 pb-6 pt-4">
        <CheckInForm sections={sections} currentSectionId={currentSectionId} finishedIds={finishedIds} />
      </div>
    </details>
  );
}
