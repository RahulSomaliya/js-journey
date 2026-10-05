import { ThemeToggle } from '@/components/theme-toggle';

// The head of a finished course's history page — hers (/m?course=js) and his (/r?course=js): the way
// back to the active course, the course, its record (lib/journey-view.ts courseHistoryLine).
export function CourseHistoryHeader({ back, title, line }: { back: string; title: string; line: string }) {
  return (
    <header className="flex items-start justify-between gap-4 pt-8 pb-10 sm:pt-12">
      <div className="min-w-0">
        <a href="?" className="rounded-sm text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">← {back}</a>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{line}</p>
      </div>
      <ThemeToggle />
    </header>
  );
}
