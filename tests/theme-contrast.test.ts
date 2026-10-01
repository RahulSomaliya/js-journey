import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The colour tokens in app/globals.css (ported from the Course Player, docs/design.md there) are the
// ONLY place raw colours live. This pins every text pairing the pages use at WCAG AA (4.5:1) in BOTH
// themes, checks the two dark blocks never drift apart, and catches a raw colour sneaking into a
// component (one hardcoded colour breaks the other theme).
const ROOT = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');

type Rgb = [number, number, number];

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`globals.css has no "${selector} {" block`);
  return css.slice(start, css.indexOf('}', start));
}
/** --name: oklch(L C H) → linear-light sRGB (alpha tokens like the scrim are skipped) */
function tokens(selector: string): Record<string, Rgb> {
  const out: Record<string, Rgb> = {};
  for (const m of block(selector).matchAll(/--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g)) {
    out[m[1]] = oklchToLinearRgb(Number(m[2]), Number(m[3]), Number(m[4]));
  }
  return out;
}
// OKLCH → OKLab → linear sRGB (Björn Ottosson's matrices), clamped to the sRGB gamut.
function oklchToLinearRgb(L: number, C: number, h: number): Rgb {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const contrast = (x: Rgb, y: Rgb) => {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

// [text token, the backgrounds it sits on] — every pairing the pages paint
const TEXT_ON: [string, string[]][] = [
  ['ink', ['canvas', 'surface', 'fill', 'raised', 'accent-soft']],
  ['ink-muted', ['canvas', 'surface', 'fill', 'raised']],
  ['ink-subtle', ['canvas', 'surface', 'fill']], // "subtle" is still text: AA on fill too (design.md trap)
  ['accent-ink', ['canvas', 'surface', 'accent-soft']],
  ['on-accent', ['accent', 'accent-hover']],
];
const THEMES = [['light', ':root'], ['dark', ":root[data-theme='dark']"]] as const;

describe('theme tokens (app/globals.css)', () => {
  for (const [theme, selector] of THEMES) {
    it(`${theme}: every text pairing reads at AA (4.5:1)`, () => {
      const t = tokens(selector);
      for (const [fg, bgs] of TEXT_ON) {
        for (const bg of bgs) {
          expect(t[fg], `--${fg} missing in ${selector}`).toBeDefined();
          expect(t[bg], `--${bg} missing in ${selector}`).toBeDefined();
          expect(contrast(t[fg], t[bg]), `${theme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    it(`${theme}: chart bars and the accent stand out from the page (3:1, non-text)`, () => {
      const t = tokens(selector);
      expect(contrast(t['chart-bar'], t.canvas), 'chart-bar on canvas').toBeGreaterThanOrEqual(3);
      expect(contrast(t.accent, t.canvas), 'accent on canvas').toBeGreaterThanOrEqual(3);
    });
  }

  it('the OS-dark block and the picked-dark block are the same tokens', () => {
    const media = tokens(":root:not([data-theme='light'])");
    expect(Object.keys(media).length).toBeGreaterThan(10);
    expect(media).toEqual(tokens(":root[data-theme='dark']"));
  });

  it('the text selection colour uses tokens', () => {
    expect(css).toMatch(/::selection\s*{[^}]*background:\s*var\(--accent-soft\);[^}]*color:\s*var\(--ink\)/);
  });
});

describe('components use token classes only', () => {
  const RAW = [
    /\btext-white\b|#fff\b|#ffffff\b/i,
    // Tailwind's palette (bg-gray-950, text-blue-500…): never themed
    /\b(?:bg|text|border|fill|stroke|ring|outline|from|to|via|decoration)-(?:white|black|gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/,
    /\b(?:rgba?|hsla?|oklch|oklab)\(/,
    /#[0-9a-f]{6}\b/i,
  ];
  it('no .tsx in components/ or app/ paints a raw colour', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (p.endsWith('.tsx')) {
          fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
            if (RAW.some((re) => re.test(line))) offenders.push(`${path.relative(ROOT, p)}:${i + 1}`);
          });
        }
      }
    };
    walk(path.join(ROOT, 'components'));
    walk(path.join(ROOT, 'app'));
    expect(offenders).toEqual([]);
  });
});
