/**
 * Text measurement and number formatting for SVG layout.
 *
 * SVG-in-<img> renders with the viewer's system font, so exact metrics are
 * unknowable. Layout uses Helvetica AFM advance widths (the narrowest common
 * member of the stack is close to these) plus a small safety factor applied by
 * callers that truncate.
 */

/** Helvetica advance widths for ASCII 32..126, in 1/1000 em. */
const HELVETICA_WIDTHS: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

const DEFAULT_EM = 0.6; // fallback for characters outside ASCII
const BOLD_FACTOR = 1.08; // Helvetica Bold runs ~8% wider

export type FontWeight = "regular" | "semibold";

/** Estimated rendered width of `text` at `size` px in the sans stack. */
export function measureSans(
  text: string,
  size: number,
  weight: FontWeight = "regular",
): number {
  let em = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const w =
      code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32] : undefined;
    em += (w ?? DEFAULT_EM * 1000) / 1000;
  }
  return em * size * (weight === "semibold" ? BOLD_FACTOR : 1);
}

/** Monospace width: fixed 0.602em per character (SF Mono / Menlo ratio). */
export function measureMono(text: string, size: number): number {
  return [...text].length * 0.602 * size;
}

/** 12345 -> "12,345". Hand-rolled so output never depends on ICU data. */
export function formatInt(v: number): string {
  const sign = v < 0 ? "-" : "";
  const digits = String(Math.trunc(Math.abs(v)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "2026-07-22T03:17:45.123Z" -> "2026-07-22 03:17 UTC". */
export function formatUtcTimestamp(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  if (!m) throw new Error(`invalid ISO timestamp: ${iso}`);
  return `${m[1]} ${m[2]} UTC`;
}

/** Compact form for constrained slots: 12345 -> "12.3k" (only used when a full value cannot fit). */
export function formatCompact(v: number): string {
  if (Math.abs(v) < 10_000) return formatInt(v);
  const k = v / 1000;
  const rounded = Math.round(k * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
}
