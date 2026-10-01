import { COURSE_IDS, getCourse, type CourseId } from '@/lib/courses';

// Active course first; finished courses stay one click away as history (?course=js).
// Relative hrefs keep the coach token out of yet another place in the markup.
// Active pill text is text-on-accent, never a hardcoded white: dark mode's accent is light mint (white ≈ 2:1).
export function CourseSwitcher({ current }: { current: CourseId }) {
  const courses = COURSE_IDS.map(getCourse).sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1));
  return (
    <nav aria-label="Course" className="inline-flex rounded-full border border-hair bg-surface p-1 text-sm shadow">
      {courses.map((c) => {
        const on = c.id === current;
        return (
          <a
            key={c.id}
            href={`?course=${c.id}`}
            aria-current={on ? 'page' : undefined}
            className={`rounded-full px-3.5 py-1 font-medium transition-colors ${on ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}
          >
            {c.shortTitle}
            <span className={`ml-1.5 text-[0.65rem] uppercase tracking-wider ${on ? 'text-on-accent/80' : 'text-faint'}`}>
              {c.status === 'active' ? 'active' : 'done ✓'}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
