import { describe, expect, it } from "vitest";
import { makeFixture } from "../fixtures/fixture.ts";
import { renderBadge } from "../src/cards/badge.ts";
import { renderContributions, toWeeks } from "../src/cards/contributions.ts";
import { renderLanguages } from "../src/cards/languages.ts";
import { renderOverview } from "../src/cards/overview.ts";
import { computeStreaks } from "../src/compute/streaks.ts";
import { CARD_WIDTH } from "../src/config.ts";
import { DARK, LIGHT, THEMES } from "../src/theme.ts";
import { assertWellFormed } from "./xml.ts";

const data = makeFixture();
const streaks = computeStreaks(data.lifetimeDays);

function renderAll(): { name: string; svg: string }[] {
  return THEMES.flatMap((theme) => [
    { name: `overview.${theme.id}`, svg: renderOverview(data, theme) },
    { name: `contributions.${theme.id}`, svg: renderContributions(data, streaks, theme) },
    { name: `languages.${theme.id}`, svg: renderLanguages(data, theme) },
    { name: `badge.${theme.id}`, svg: renderBadge("Maven Central", undefined, theme) },
  ]);
}

describe("card rendering", () => {
  it("produces well-formed SVG for every card in both themes", () => {
    for (const { name, svg } of renderAll()) {
      expect(svg.startsWith("<svg "), `${name} starts with <svg`).toBe(true);
      assertWellFormed(svg);
    }
  });

  it("is deterministic for identical input", () => {
    const first = renderAll();
    const second = renderAll();
    for (const [index, card] of first.entries()) {
      expect(second[index]?.svg).toBe(card.svg);
    }
  });

  it("contains no scripts, external references, or foreignObject", () => {
    for (const { name, svg } of renderAll()) {
      const body = svg.replace('xmlns="http://www.w3.org/2000/svg"', "");
      for (const banned of ["<script", "http://", "https://", "url(http", "<foreignObject", "href="]) {
        expect(body.includes(banned), `${name} must not contain ${banned}`).toBe(false);
      }
    }
  });

  it("declares the profile column width and an accessible label", () => {
    for (const { name, svg } of renderAll()) {
      if (name.startsWith("badge")) continue;
      expect(svg, name).toContain(`viewBox="0 0 ${CARD_WIDTH} `);
      expect(svg, name).toContain('role="img"');
      expect(svg, name).toContain("aria-label=");
    }
  });

  it("respects reduced motion in every animated card", () => {
    for (const { name, svg } of renderAll()) {
      if (name.startsWith("badge")) continue;
      expect(svg, name).toContain("prefers-reduced-motion");
    }
  });

  it("renders one polygon set per contribution day", () => {
    const svg = renderContributions(data, streaks, LIGHT);
    const polygons = svg.match(/<polygon /g)?.length ?? 0;
    const active = data.trailing.days.filter((day) => day.count > 0).length;
    const zero = data.trailing.days.length - active;
    expect(polygons).toBe(active * 3 + zero);
  });

  it("uses the API quartile colors for top faces", () => {
    const svg = renderContributions(data, streaks, DARK);
    for (const color of DARK.contribRamp.slice(1)) {
      expect(svg).toContain(color);
    }
  });

  it("groups days into calendar weeks", () => {
    const weeks = toWeeks([...data.trailing.days]);
    expect(weeks).toHaveLength(53);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("shows every language share with its percentage", () => {
    const svg = renderLanguages(data, LIGHT);
    for (const name of ["TypeScript", "Kotlin", "Java", "Vue", "Rust", "Other"]) {
      expect(svg).toContain(name);
    }
    expect(svg).toContain("%");
  });

  it("sizes badges to their label", () => {
    const short = renderBadge("npm", undefined, LIGHT);
    const long = renderBadge("Maven Central", undefined, LIGHT);
    const width = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1]);
    expect(width(long)).toBeGreaterThan(width(short));
  });

  it("drops brand colors that vanish on the pill", () => {
    const githubDark = renderBadge("GitHub", { path: "M0 0h24v24H0z", hex: "#181717" }, DARK);
    expect(githubDark).not.toContain('fill="#181717"');
    const facebookDark = renderBadge("Facebook", { path: "M0 0h24v24H0z", hex: "#0866FF" }, DARK);
    expect(facebookDark).toContain('fill="#0866FF"');
  });
});
