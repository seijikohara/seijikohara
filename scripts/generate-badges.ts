/**
 * Dev-time badge generation.
 *
 * Runs locally / in CI only — the simple-icons devDependency never enters the
 * scheduled workflow. Badges change only when the link list changes, so the
 * output is committed.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { siFacebook, siNpm, siQiita, siWantedly, siZenn } from "simple-icons";
import { renderBadge, type BadgeIcon } from "../src/cards/badge.ts";
import { PACKAGE_BADGES, SOCIAL_BADGES } from "../src/config.ts";
import { THEMES } from "../src/theme.ts";

const ICONS: Record<string, BadgeIcon> = {
  facebook: { path: siFacebook.path, hex: `#${siFacebook.hex}` },
  wantedly: { path: siWantedly.path, hex: `#${siWantedly.hex}` },
  qiita: { path: siQiita.path, hex: `#${siQiita.hex}` },
  zenn: { path: siZenn.path, hex: `#${siZenn.hex}` },
  npm: { path: siNpm.path, hex: `#${siNpm.hex}` },
};

const outDir = join(import.meta.dirname, "..", "assets", "badges");
await mkdir(outDir, { recursive: true });

let count = 0;
for (const spec of [...SOCIAL_BADGES, ...PACKAGE_BADGES]) {
  const icon = spec.icon === undefined ? undefined : ICONS[spec.icon];
  if (spec.icon !== undefined && icon === undefined) {
    throw new Error(`icon mapping missing for slug: ${spec.icon}`);
  }
  for (const theme of THEMES) {
    const svg = renderBadge(spec.label, icon, theme);
    await writeFile(join(outDir, `${spec.id}.${theme.id}.svg`), `${svg}\n`, "utf8");
    count += 1;
  }
}

console.log(`generated ${count} badge SVGs in ${outDir}`);
