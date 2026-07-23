/**
 * Embedded webfonts for the cards.
 *
 * Emit @font-face rules whose src is a Base64 woff2 data URI, so the typeface
 * renders in the README's <img> context — GitHub's SVG CSP blocks network fonts
 * but not inline data URIs (verified 2026-07-23). Faces come from the committed,
 * dev-time-generated constants; nothing is read from disk at runtime, so this
 * works identically under Node (generator, tests) and Vite (preview).
 */

import {
  ROBOTO_200,
  ROBOTO_400,
  ROBOTO_600,
  ROBOTO_MONO_400,
} from "./fonts.generated.ts";

export type FontKey = "sans200" | "sans400" | "sans600" | "mono400";

interface Face {
  readonly family: string;
  readonly weight: number;
  /** Base64 woff2 payload. */
  readonly data: string;
}

const FACES: Record<FontKey, Face> = {
  sans200: { family: "Roboto", weight: 200, data: ROBOTO_200 },
  sans400: { family: "Roboto", weight: 400, data: ROBOTO_400 },
  sans600: { family: "Roboto", weight: 600, data: ROBOTO_600 },
  mono400: { family: "Roboto Mono", weight: 400, data: ROBOTO_MONO_400 },
};

/** Faces every card embeds by default: ExtraLight base, SemiBold emphasis, mono. */
export const DEFAULT_FONTS: readonly FontKey[] = ["sans200", "sans600", "mono400"];

/** Build @font-face rules (Base64 woff2 data URIs) for the requested faces. */
export function fontFaceCss(keys: readonly FontKey[]): string {
  return keys
    .map((key) => {
      const face = FACES[key];
      return (
        `@font-face{font-family:'${face.family}';font-style:normal;` +
        `font-weight:${face.weight};` +
        `src:url(data:font/woff2;base64,${face.data}) format('woff2')}`
      );
    })
    .join("");
}
