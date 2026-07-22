import { describe, expect, it } from "vitest";
import { el, esc, num } from "../src/svg/dsl.ts";
import {
  formatCompact,
  formatDate,
  formatDateRange,
  formatInt,
  formatUtcTimestamp,
  measureMono,
  measureSans,
} from "../src/svg/text.ts";
import { mergeDailySeries } from "../src/github/fetch-profile.ts";
import { contrast, hexToRgb, shade } from "../src/theme.ts";

describe("esc", () => {
  it("escapes markup-significant characters", () => {
    expect(esc(`<img src="x" onload='a&b'>`)).toBe(
      "&lt;img src=&quot;x&quot; onload=&#39;a&amp;b&#39;&gt;",
    );
  });
});

describe("num", () => {
  it("rounds to two decimals without trailing noise", () => {
    expect(num(1.006)).toBe("1.01");
    expect(num(3)).toBe("3");
    expect(num(-0.3333)).toBe("-0.33");
  });
  it("rejects non-finite values", () => {
    expect(() => num(Number.NaN)).toThrow(/non-finite/);
    expect(() => num(Infinity)).toThrow(/non-finite/);
  });
});

describe("el", () => {
  it("self-closes empty elements and escapes attributes", () => {
    expect(el("rect", { x: 1, fill: "#fff", title: `a"b` })).toBe(
      '<rect x="1" fill="#fff" title="a&quot;b"/>',
    );
  });
  it("skips undefined attributes", () => {
    expect(el("g", { class: undefined })).toBe("<g/>");
  });
});

describe("formatting", () => {
  it("groups thousands", () => {
    expect(formatInt(0)).toBe("0");
    expect(formatInt(999)).toBe("999");
    expect(formatInt(11145)).toBe("11,145");
    expect(formatInt(-1234567)).toBe("-1,234,567");
  });
  it("compacts large values only", () => {
    expect(formatCompact(9999)).toBe("9,999");
    expect(formatCompact(12345)).toBe("12.3k");
    expect(formatCompact(120000)).toBe("120k");
  });
  it("formats UTC timestamps to minute precision", () => {
    expect(formatUtcTimestamp("2026-07-22T03:17:45.123Z")).toBe("2026-07-22 03:17 UTC");
    expect(() => formatUtcTimestamp("not a date")).toThrow(/invalid ISO/);
  });
  it("formats dates and ranges, collapsing shared years", () => {
    expect(formatDate("2026-07-22", true)).toBe("Jul 22, 2026");
    expect(formatDate("2026-01-05", false)).toBe("Jan 5");
    expect(formatDateRange("2026-05-31", "2026-07-22")).toBe("May 31 – Jul 22, 2026");
    expect(formatDateRange("2025-12-30", "2026-02-19")).toBe("Dec 30, 2025 – Feb 19, 2026");
    expect(formatDateRange("2026-07-22", "2026-07-22")).toBe("Jul 22, 2026");
    expect(() => formatDate("2026-13-99", true)).toThrow(/invalid calendar date/);
  });
});

describe("measurement", () => {
  it("scales linearly with size and grows with weight", () => {
    const base = measureSans("Contributions", 12);
    expect(measureSans("Contributions", 24)).toBeCloseTo(base * 2, 5);
    expect(measureSans("Contributions", 12, "semibold")).toBeGreaterThan(base);
  });
  it("measures monospace by character count", () => {
    expect(measureMono("abc", 10)).toBeCloseTo(3 * 6.02, 5);
  });
});

describe("mergeDailySeries", () => {
  it("dedupes overlapping dates keeping the higher count and sorts ascending", () => {
    const merged = mergeDailySeries([
      [
        { date: "2025-12-31", count: 2, level: 1 },
        { date: "2026-01-01", count: 0, level: 0 },
      ],
      [
        { date: "2026-01-01", count: 5, level: 2 },
        { date: "2025-12-30", count: 1, level: 1 },
      ],
    ]);
    expect(merged.map((day) => day.date)).toEqual(["2025-12-30", "2025-12-31", "2026-01-01"]);
    expect(merged.at(-1)?.count).toBe(5);
  });
});

describe("color utilities", () => {
  it("parses and shades hex colors", () => {
    expect(hexToRgb("#40c463")).toEqual([0x40, 0xc4, 0x63]);
    expect(shade("#ffffff", 0.5)).toBe("#808080");
    expect(() => hexToRgb("nope")).toThrow(/invalid hex/);
  });
  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#181717", "#151b23")).toBeLessThan(1.6);
  });
});
