import { ThemeToggle } from '@/components/theme-toggle';

export default function Cover() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 reveal">
      <ThemeToggle />
      <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-widest text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Personal &amp; private
      </span>
      <h1 className="mt-5 font-serif text-5xl font-semibold leading-tight tracking-tight text-ink">
        Mansi&apos;s <em className="text-accent">JS</em> Journey
      </h1>
      <p className="mt-4 max-w-md text-lg text-muted">
        A quiet place to track the climb through The Complete JavaScript Course — one day at a time.
      </p>
      <p className="mt-10 text-sm text-faint">This page has no data. Access is by private link.</p>
    </main>
  );
}
