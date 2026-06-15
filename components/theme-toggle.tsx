'use client';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark');
  }, []);
  function toggle() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    setDark(next === 'dark');
  }
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      aria-pressed={dark}
      className="fixed top-4 right-4 z-50 grid h-10 w-10 place-items-center rounded-full border border-hair-strong bg-surface text-accent shadow transition hover:-translate-y-px hover:border-accent"
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}
