'use client';
import { MoonIcon, SunIcon } from '@/components/ui';

// Light ↔ dark. The inline script in app/layout.tsx sets data-theme before paint (the stored pick,
// else the OS), so the icon is pure CSS (`dark:` variant) — no state, no hydration flash.
export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      // private mode / blocked storage: the switch still applies to this page view
      console.warn('[theme] could not remember the choice', e);
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark"
      title="Light / dark"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-fill hover:text-ink"
    >
      <MoonIcon className="size-[18px] dark:hidden" />
      <SunIcon className="hidden size-[18px] dark:block" />
    </button>
  );
}
