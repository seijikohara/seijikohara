/**
 * Local playground: renders every card from the committed fixture in both
 * themes with Vite HMR. `npm run dev`, then edit any card module.
 */

import { makeFixture } from "../fixtures/fixture.ts";
import { renderBadge } from "../src/cards/badge.ts";
import { renderComposition } from "../src/cards/composition.ts";
import { renderContributions } from "../src/cards/contributions.ts";
import { renderLanguages } from "../src/cards/languages.ts";
import { renderLifetime } from "../src/cards/lifetime.ts";
import { renderOverview } from "../src/cards/overview.ts";
import { renderRhythm } from "../src/cards/rhythm.ts";
import { computeStreaks } from "../src/compute/streaks.ts";
import { PACKAGE_BADGES, SOCIAL_BADGES } from "../src/config.ts";
import { THEMES } from "../src/theme.ts";

const data = makeFixture();
const streaks = computeStreaks(data.lifetimeDays);

/** Render an SVG string the way GitHub does: as an <img>, scripts inert. */
function asImg(svg: string): string {
  return `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" style="width:100%" alt="">`;
}

function asBadgeImg(svg: string): string {
  return `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" alt="">`;
}

// innerHTML is safe here: every string comes from first-party renderers whose
// dynamic values pass through esc(), and the page never receives user input.
const app = document.getElementById("app");
if (app) {
  app.innerHTML = THEMES.map((theme) => {
    const badges = [...SOCIAL_BADGES, ...PACKAGE_BADGES]
      .map((spec) => asBadgeImg(renderBadge(spec.label, undefined, theme)))
      .join("");
    return `
      <section class="pane ${theme.id}">
        <h2>${theme.id}</h2>
        <div class="col">
          <div class="badges">${badges}</div>
          ${asImg(renderOverview(data, theme))}
          ${asImg(renderLifetime(data, theme))}
          ${asImg(renderContributions(data, streaks, theme))}
          ${asImg(renderComposition(data, theme))}
          ${asImg(renderRhythm(data, theme))}
          ${asImg(renderLanguages(data, theme))}
        </div>
      </section>`;
  }).join("");
}
