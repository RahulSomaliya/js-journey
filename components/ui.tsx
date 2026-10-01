// Primitives both pages share (the Course Player's components/ui.tsx, trimmed to what these pages
// use). Token classes only (app/globals.css) — a raw colour here breaks the other theme.
import type { ReactNode, SVGProps } from 'react';
import { moodLabel } from '@/lib/journey-view';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent shadow-e1 hover:bg-accent-hover active:shadow-none',
  secondary: 'border border-line bg-surface text-ink hover:bg-fill',
  ghost: 'text-ink-muted hover:bg-fill hover:text-ink',
};
const SIZES: Record<Size, string> = { sm: 'h-8 gap-1.5 px-3 text-sm', md: 'h-10 gap-2 px-4 text-sm' };
// No colour transition: a screenshot (or her eye) must never catch a button mid-fade.
const BASE =
  'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium ' +
  'transition-[box-shadow,transform] duration-150 ease-out active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-50';

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

/** The column both pages sit in: a calm reading width, 16 px gutters on a phone. */
export const COLUMN = 'mx-auto w-full max-w-3xl px-4 sm:px-6';

export function SectionHeading({ id, title, meta }: { id: string; title: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-base font-semibold text-ink">{title}</h2>
      {meta && <p className="text-sm tabular-nums text-ink-muted">{meta}</p>}
    </div>
  );
}

/** Pace: ahead / on track = accent pill; behind = a quiet fill pill (honest, never alarm red). */
export function PacePill({ label, tone }: { label: string; tone: 'good' | 'quiet' }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-full px-3 text-sm font-medium ${tone === 'good' ? 'bg-accent-soft text-accent-ink' : 'bg-fill text-ink'}`}>
      {label}
    </span>
  );
}

export function StuckPill() {
  return <span className="inline-flex h-6 items-center rounded-full bg-accent-soft px-2.5 text-xs font-medium text-accent-ink">Stuck</span>;
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 text-xs text-ink-muted">{children}</span>;
}

export function Mood({ mood }: { mood: string }) {
  return (
    <span className="text-base leading-none" role="img" aria-label={`Mood: ${moodLabel(mood) ?? mood}`}>
      {mood}
    </span>
  );
}

/** Errors are not red (design.md): calm ink text, an icon, plain words. */
export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-ink">
      <AlertIcon className="mt-0.5 size-4 shrink-0 text-ink-muted" />
      {children}
    </p>
  );
}

// Icons: Lucide's shapes (stroke 1.5, currentColor), inline — no icon package for six glyphs.
type IconProps = SVGProps<SVGSVGElement>;
function Icon({ children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>;
export const AlertIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></Icon>;
export const SunIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Icon>
);
export const MoonIcon = (p: IconProps) => <Icon {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Icon>;
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>
);
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
