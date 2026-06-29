'use client';
import { useEffect, useMemo, useState } from 'react';

// Types `text` out once, character by character, with a blinking caret.
// Adapted from animata.design's typing-text (no deps, no repeat, no mono):
// an invisible full-text copy reserves the final height so the card doesn't
// jump line-by-line while an absolutely-positioned copy types over it.
export function TypingText({ text, delay = 26, className }: { text: string; delay?: number; className?: string }) {
  // split on code points so emojis (surrogate pairs) never get cut in half
  const chars = useMemo(() => Array.from(text), [text]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(chars.length); // no animation — show it all at once
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= chars.length) clearInterval(id);
    }, delay);
    return () => clearInterval(id);
  }, [chars, delay]);

  const done = count >= chars.length;

  return (
    <div className={`relative ${className ?? ''}`} aria-label={text}>
      {/* reserves the final height/width so layout doesn't shift while typing */}
      <span className="invisible" aria-hidden>
        {text}
      </span>
      {/* the part that types over it */}
      <span className="absolute inset-0" aria-hidden>
        {chars.slice(0, count).join('')}
        <span className={`ml-px font-sans text-accent ${done ? 'caret' : ''}`}>|</span>
      </span>
    </div>
  );
}
