import { ThemeToggle } from '@/components/theme-toggle';

// The bare domain: no data here — both real pages live behind private links (/m/<token>, /r/<token>).
export default function Cover() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8 sm:px-6">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <div className="my-auto pb-16">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-ink-muted">Personal &amp; private</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Mansi’s JS Journey</h1>
        <p className="mt-3 max-w-md text-base text-ink-muted">JavaScript done, React next — one day at a time.</p>
        <p className="mt-10 text-sm text-ink-subtle">This page has no data. Access is by private link.</p>
      </div>
    </main>
  );
}
