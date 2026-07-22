/** Languages card: one stacked proportion bar plus a direct-labeled legend. */

import { CARD_PADDING, CARD_WIDTH } from "../config.ts";
import { languageShares, type LanguageShare } from "../compute/languages.ts";
import type { ProfileData } from "../model.ts";
import { el, textNode } from "../svg/dsl.ts";
import type { Theme } from "../theme.ts";
import { cardFrame } from "./frame.ts";

const BAR_HEIGHT = 20;
const BAR_GAP = 2;
const LEGEND_COLUMNS = 3;
const LEGEND_ROW_HEIGHT = 30;

/** Fallback for languages without a linguist color, and for "Other". */
function sliceColor(share: LanguageShare, theme: Theme): string {
  return share.color ?? theme.fgMuted;
}

export function renderLanguages(data: ProfileData, theme: Theme): string {
  const shares = languageShares(data.languages);
  const inner = CARD_WIDTH - CARD_PADDING * 2;
  const barY = 64;

  // Stacked proportion bar. Segments are separated by 2px of card surface;
  // outer corners are rounded by the clip, not per-segment strokes.
  const clipId = "bar-clip";
  const gapsTotal = BAR_GAP * Math.max(0, shares.length - 1);
  const usable = inner - gapsTotal;
  let cursor = CARD_PADDING;
  const segments = shares.map((share) => {
    const width = (share.pct / 100) * usable;
    const rect = el("rect", {
      x: cursor,
      y: barY,
      width: Math.max(width, 1),
      height: BAR_HEIGHT,
      fill: sliceColor(share, theme),
    });
    cursor += width + BAR_GAP;
    return rect;
  });

  const bar =
    el(
      "clipPath",
      { id: clipId },
      el("rect", {
        x: CARD_PADDING,
        y: barY,
        width: inner,
        height: BAR_HEIGHT,
        rx: BAR_HEIGHT / 2,
      }),
    ) + el("g", { "clip-path": `url(#${clipId})` }, ...segments);

  // Legend grid: swatch dot + name + muted percentage.
  const legendTop = barY + BAR_HEIGHT + 28;
  const columnWidth = inner / LEGEND_COLUMNS;
  const entries = shares.map((share, index) => {
    const column = index % LEGEND_COLUMNS;
    const row = Math.floor(index / LEGEND_COLUMNS);
    const x = CARD_PADDING + column * columnWidth;
    const y = legendTop + row * LEGEND_ROW_HEIGHT;
    return el(
      "g",
      {},
      el("circle", { cx: x + 5, cy: y - 4, r: 5, fill: sliceColor(share, theme) }),
      el("text", { x: x + 18, y, class: "t-name" }, textNode(share.name)),
      el(
        "text",
        { x: x + columnWidth - 20, y, class: "t-tick", "text-anchor": "end" },
        textNode(`${share.pct.toFixed(1)}%`),
      ),
    );
  });

  const rows = Math.ceil(shares.length / LEGEND_COLUMNS);
  const height = legendTop + (rows - 1) * LEGEND_ROW_HEIGHT + CARD_PADDING + 8;

  const topShare = shares[0];
  return cardFrame(
    {
      theme,
      height,
      title: "Languages",
      note: "public source repositories · by bytes",
      description: `Language breakdown for ${data.login}${topShare ? `, led by ${topShare.name} at ${topShare.pct.toFixed(1)}%` : ""}.`,
      extraCss: `.t-name{font-size:13px;fill:${theme.fg}}`,
    },
    el("g", { class: "fade" }, bar, ...entries),
  );
}
