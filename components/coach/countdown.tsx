'use client';
import { useEffect, useState } from 'react';

export function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className="text-faint">—</span>; // null on first render avoids hydration mismatch
  const end = new Date(`${deadline}T23:59:59+05:30`).getTime(); // IST end-of-day
  const ms = end - now;
  if (ms <= 0) return <span className="text-warn">deadline passed</span>;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return <span className="text-accent-deep">{days}d {hours}h left</span>;
}
