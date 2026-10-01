import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Text on an accent fill must come from the `--on-accent` token, never `text-white`:
// dark mode's accents are light mint (#5cc4a3, #8fe0c4), where white measures ~2:1.
// This pins the token pairs (WCAG AA 4.5:1) and catches a hardcoded white sneaking back.
const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`globals.css has no "${selector} {" block`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]));
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (c: number[]) => {
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** fg at `alpha` over bg — what `text-on-accent/80` paints */
const blend = (fg: number[], bg: number[], alpha: number) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

describe('on-accent theme token', () => {
  for (const [theme, selector] of [['light', ':root'], ['dark', ':root[data-theme="dark"]']] as const) {
    it(`${theme}: on-accent text reads at AA on accent and accent-deep`, () => {
      const t = tokens(selector);
      expect(t['on-accent'], `--on-accent missing in ${selector}`).toBeDefined();
      const on = rgb(t['on-accent']);
      for (const bg of ['accent', 'accent-deep']) {
        expect(contrast(on, rgb(t[bg])), `on-accent on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      // the course switcher's small "ACTIVE" label is on-accent at 80% opacity
      const accent = rgb(t.accent);
      expect(contrast(blend(on, accent, 0.8), accent), 'on-accent/80 on accent').toBeGreaterThanOrEqual(4.5);
    });
  }

  it('the text selection colour uses the token too', () => {
    expect(css).toMatch(/::selection\s*{[^}]*color:\s*var\(--on-accent\)/);
  });

  it('no component paints hardcoded white text', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith('.tsx')) {
          fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
            if (/\btext-white\b|#fff\b|#ffffff\b/i.test(line)) offenders.push(`${path.relative(ROOT, p)}:${i + 1}`);
          });
        }
      }
    };
    walk(path.join(ROOT, 'components'));
    walk(path.join(ROOT, 'app'));
    expect(offenders).toEqual([]);
  });
});
