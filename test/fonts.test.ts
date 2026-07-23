import { describe, expect, it } from "vitest";
import {
  ROBOTO_200,
  ROBOTO_400,
  ROBOTO_600,
  ROBOTO_MONO_400,
} from "../src/fonts.generated.ts";
import { DEFAULT_FONTS, fontFaceCss, type FontKey } from "../src/fonts.ts";

const GENERATED: Record<string, string> = {
  ROBOTO_200,
  ROBOTO_400,
  ROBOTO_600,
  ROBOTO_MONO_400,
};

describe("embedded fonts", () => {
  it("every generated face decodes to a valid woff2", () => {
    for (const [name, b64] of Object.entries(GENERATED)) {
      expect(b64.length, `${name} is non-empty`).toBeGreaterThan(0);
      // A woff2 file starts with the "wOF2" signature.
      const signature = Buffer.from(b64, "base64").subarray(0, 4).toString("latin1");
      expect(signature, `${name} woff2 signature`).toBe("wOF2");
    }
  });

  it("emits one @font-face per requested key with a woff2 data URI", () => {
    const keys: readonly FontKey[] = ["sans200", "sans400", "sans600", "mono400"];
    const css = fontFaceCss(keys);
    expect(css.match(/@font-face/g) ?? []).toHaveLength(keys.length);
    expect(css).toContain("src:url(data:font/woff2;base64,");
    expect(css).toContain("font-family:'Roboto'");
    expect(css).toContain("font-family:'Roboto Mono'");
  });

  it("emits a face for each key in the default set", () => {
    const css = fontFaceCss(DEFAULT_FONTS);
    expect(css.match(/@font-face/g) ?? []).toHaveLength(DEFAULT_FONTS.length);
  });
});
