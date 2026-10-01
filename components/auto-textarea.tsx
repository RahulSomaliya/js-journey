'use client';
import { useEffect, useRef, type TextareaHTMLAttributes } from 'react';

// A textarea that grows with its text (and shrinks back when a send clears it). JS, not CSS
// `field-sizing: content`: iPhone Safari — where she writes — does not support that yet.
export function AutoTextarea({ value, className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`; // + the 1 px borders, or a scrollbar appears
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      className={`block w-full resize-none overflow-hidden rounded-md border border-line bg-canvas px-3 py-2.5 text-base leading-6 text-ink placeholder:text-ink-subtle ${className}`}
      {...rest}
    />
  );
}
