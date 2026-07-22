/**
 * Entry point for the scheduled generator.
 *
 * Fetch → compute → render all cards in memory → write. Nothing touches
 * assets/ unless every card rendered, so a failed run leaves the previous
 * committed snapshot fully intact.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderContributions } from "./cards/contributions.ts";
import { renderLanguages } from "./cards/languages.ts";
import { renderOverview } from "./cards/overview.ts";
import { computeStreaks } from "./compute/streaks.ts";
import { LOGIN } from "./config.ts";
import { fetchProfile } from "./github/fetch-profile.ts";
import type { ProfileData } from "./model.ts";
import { THEMES } from "./theme.ts";

const token = process.env["GITHUB_TOKEN"];
if (!token) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}

const assetsDir = join(import.meta.dirname, "..", "assets");

const fetched = await fetchProfile(token, LOGIN);
const data: ProfileData = { ...fetched, generatedAt: new Date().toISOString() };
const streaks = computeStreaks(data.lifetimeDays);

const files = new Map<string, string>();
for (const theme of THEMES) {
  files.set(`overview.${theme.id}.svg`, renderOverview(data, theme));
  files.set(`contributions.${theme.id}.svg`, renderContributions(data, streaks, theme));
  files.set(`languages.${theme.id}.svg`, renderLanguages(data, theme));
}

await mkdir(assetsDir, { recursive: true });
for (const [name, svg] of files) {
  await writeFile(join(assetsDir, name), `${svg}\n`, "utf8");
}

console.log(
  `generated ${files.size} cards for @${data.login}: ` +
    `${data.years.reduce((sum, year) => sum + year.total, 0)} lifetime contributions, ` +
    `streak ${streaks.current}/${streaks.longest}, ` +
    `${data.languages.length} languages`,
);
