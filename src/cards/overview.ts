/** Overview card: eight stat tiles plus the activity-by-year column strip. */

import { CARD_PADDING, CARD_WIDTH } from "../config.ts";
import type { ProfileData } from "../model.ts";
import { el, textNode } from "../svg/dsl.ts";
import { formatInt } from "../svg/text.ts";
import type { Theme } from "../theme.ts";
import { cardFrame, tileRow, type TileSpec } from "./frame.ts";

const COLUMN_MAX_HEIGHT = 84;
const COLUMN_WIDTH = 22;

/** Column with a 4px-rounded data-end and a square baseline. */
function roundedColumn(x: number, baseline: number, width: number, height: number, fill: string): string {
  const r = Math.min(4, height / 2, width / 2);
  const top = baseline - height;
  const d =
    `M${x} ${baseline}` +
    `V${top + r}` +
    `Q${x} ${top} ${x + r} ${top}` +
    `H${x + width - r}` +
    `Q${x + width} ${top} ${x + width} ${top + r}` +
    `V${baseline}Z`;
  return el("path", { d, fill });
}

export function renderOverview(data: ProfileData, theme: Theme): string {
  const lifetime = data.years.reduce((sum, year) => sum + year.total, 0);
  const latestYear = data.years.at(-1);
  const thisYearTotal = latestYear?.total ?? 0;

  const rowA: TileSpec[] = [
    { label: "Contributions (all time)", value: formatInt(lifetime) },
    { label: `Contributions (${latestYear?.year ?? "this year"})`, value: formatInt(thisYearTotal) },
    { label: "Stars earned", value: formatInt(data.starsEarned) },
    { label: "Followers", value: formatInt(data.followers) },
  ];
  const rowB: TileSpec[] = [
    { label: "Pull requests merged", value: formatInt(data.mergedPullRequests) },
    { label: "Issues opened", value: formatInt(data.issues) },
    { label: "Public repositories", value: formatInt(data.publicSourceRepos) },
    { label: "Contributed to", value: formatInt(data.contributedTo) },
  ];

  const tilesA = tileRow(theme, rowA, 60);
  const tilesB = tileRow(theme, rowB, 60 + tilesA.height + 12);

  // Activity-by-year strip.
  const stripTop = 60 + tilesA.height * 2 + 12 + 36;
  const baseline = stripTop + COLUMN_MAX_HEIGHT;
  const inner = CARD_WIDTH - CARD_PADDING * 2;
  const band = inner / data.years.length;
  const max = Math.max(1, ...data.years.map((year) => year.total));

  const columns = data.years.map((year, index) => {
    const height = year.total === 0 ? 0 : Math.max(3, (year.total / max) * COLUMN_MAX_HEIGHT);
    const x = CARD_PADDING + index * band + (band - COLUMN_WIDTH) / 2;
    const isMax = year.total === max;
    const isLatest = index === data.years.length - 1;
    const delay = `${(index * 45).toFixed(0)}ms`;
    const label =
      isMax || (isLatest && year.total > 0)
        ? el(
            "text",
            {
              x: x + COLUMN_WIDTH / 2,
              y: baseline - height - 7,
              class: "t-tick",
              "text-anchor": "middle",
            },
            textNode(formatInt(year.total)),
          )
        : "";
    const column =
      height === 0 ? "" : roundedColumn(x, baseline, COLUMN_WIDTH, height, theme.contribRamp[isMax ? 4 : 2]);
    return el(
      "g",
      {
        class: "col",
        style: `animation-delay:${delay};transform-origin:${(x + COLUMN_WIDTH / 2).toFixed(1)}px ${baseline.toFixed(0)}px`,
      },
      column,
      label,
    );
  });

  const ticks = data.years.map((year, index) => {
    const x = CARD_PADDING + index * band + band / 2;
    return el(
      "text",
      { x, y: baseline + 16, class: "t-tick", "text-anchor": "middle" },
      textNode(`’${String(year.year).slice(2)}`),
    );
  });

  const height = baseline + 16 + CARD_PADDING;

  return cardFrame(
    {
      theme,
      height,
      title: "Overview",
      note: `@${data.login} · public activity`,
      description: `GitHub overview for ${data.login}: ${formatInt(lifetime)} contributions all time, ${formatInt(data.starsEarned)} stars earned, ${formatInt(data.followers)} followers.`,
      extraCss: `.col{opacity:0;animation:rise .45s cubic-bezier(.2,.7,.3,1) forwards}`,
    },
    el("g", { class: "fade" }, tilesA.svg, tilesB.svg),
    el(
      "text",
      { x: CARD_PADDING, y: stripTop - 12, class: "t-mono" },
      textNode("CONTRIBUTIONS BY YEAR"),
    ),
    el("line", {
      x1: CARD_PADDING,
      y1: baseline + 0.5,
      x2: CARD_WIDTH - CARD_PADDING,
      y2: baseline + 0.5,
      stroke: theme.border,
      "stroke-width": 1,
    }),
    ...columns,
    ...ticks,
  );
}
