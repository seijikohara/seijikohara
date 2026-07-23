# Detailed Profile Visualizations — Design

- **Date:** 2026-07-23
- **Status:** Approved for implementation (design confirmed with user 2026-07-23)
- **Branch:** `worktree-detailed-profile-viz`
- **Builds on:** `2026-07-22-self-contained-profile-design.md` (the zero-dependency,
  zero-`uses:`, committed-SVG generator). All constraints and conventions there
  remain in force; this document extends the card set, adds an embedded-font
  system, and enriches motion.

## Problem

The generator fetches meaningfully more data than it draws. Sitting unused in
`ProfileData` today:

- `years[].commits / pullRequests / issues / reviews` — per-year work composition
  (only `years[].total` is drawn, as the Overview column strip).
- `years[].restricted` — private contributions per year (never drawn).
- `lifetimeDays` — the deduplicated daily series back to 2014 (fed only to streak
  math, never drawn).
- `languages[].bytes` — raw magnitudes (only the percentage is drawn).

Separately, the cards render in the viewer's system font because the prior design
took "SVG-in-`<img>` cannot load fonts" as absolute. That is true only for
*network* fonts; an inline Base64 `@font-face` renders even under GitHub's CSP
(verified below). The profile can therefore adopt a deliberate typeface.

## Goals

- Surface the already-fetched-but-unvisualized data as new cards, using **no new
  GraphQL** — preserving the resource-limit immunity that motivated the split
  queries.
- Adopt **Roboto / Roboto Mono**, embedded and subsetted, for a light, clean,
  intentional typographic identity across every card. Keep a system-font
  fallback so a failed font load degrades, never breaks.
- Extend the CSS-only motion vocabulary tastefully (entrance-only, restrained,
  reduced-motion aware).
- Keep every existing invariant: committed SVG + `<picture>` light/dark, 846px
  column, zero runtime dependencies on the scheduled path, deterministic output,
  the XML/injection test gates, GITHUB_TOKEN-only auth.

## Non-Goals

- No new GitHub API calls. Every new card is computed from data already in
  `ProfileData`.
- No repository/topic card. (Considered as "B1/B2"; **cut** by the user on
  2026-07-23 — it was the only feature needing a query extension, so cutting it
  keeps the query surface untouched.)
- No selectable text in the README. `<img>`-embedded SVG is an atomic replaced
  element; its `<text>` is never selectable (verified). `<text>` is retained for
  accessibility, crispness, and small files, and is selectable only when a card
  is opened as a standalone document.
- No interactive/JS behavior (unchanged constraint).

## Verified constraints (primary sources + empirical, 2026-07-23)

Empirical tests were run in headless Chromium (Playwright) and inspected
visually; artifacts are in the session scratchpad. These extend, and in one case
correct, the 2026-07-22 table.

| Fact | How verified |
|---|---|
| A Base64 `@font-face` (`src:url(data:font/woff2;base64,…)`) **renders** when the SVG is embedded via `<img>` — the README path — **even under GitHub's real CSP** `default-src 'none'; style-src 'unsafe-inline'; sandbox`. No `font-src` violation is raised in the `<img>` context. | Replicated GitHub's exact response headers (captured from `raw.githubusercontent.com/.../overview.dark.svg`) on a local server; embedded via `<img>`; Chromium render shows the embedded sans, not the serif fallback; console clean. Visually confirmed. |
| The same font is **blocked only at top-level navigation** to the raw `.svg` URL (the SVG's own CSP governs it → `default-src 'none'` blocks the `data:` font). This does **not** affect README rendering. | Same harness, top-level navigation: font falls back to serif; explicit console CSP violation `Loading the font 'data:…' violates … "default-src 'none'"`. |
| CSS `@keyframes`/transitions run in `<img>`-embedded SVG (secure *animated* mode). | Already in production (`fade`/`rise`); corroborated by W3C SVG Integration spec. |
| Cross-browser: only *external/network* references are blocked in img-SVG; inline `data:` fonts and CSS animation render in current Chromium/Firefox/WebKit. | MDN "SVG as an image"; W3C SVG Integration. |
| `<text>` in `<img>`-embedded SVG is **not** selectable and not exposed to the a11y tree; it is selectable only inline/standalone. | MDN "SVG in HTML"; CSS-Tricks "Accessible SVGs". |
| GitHub sanitizer strips inline `<svg>`, `<object>`, `<embed>`, `<iframe>`; only `<img>`/`<picture>` survive. Raw `.svg` content is served unsanitized (`image/svg+xml`), so embedded `<style>`/`@font-face`/`@keyframes` are preserved. | html-pipeline allowlist; live headers. |
| **Roboto & Roboto Mono are SIL OFL 1.1** (not Apache-2.0 — corrects an assumption). No Reserved Font Name → subsetting and keeping the "Roboto" family name is permitted. Obligation: ship `OFL.txt` and retain the font `name`-table license records through subsetting. | `google/fonts` `ofl/roboto/OFL.txt`, `ofl/robotomono/OFL.txt`; openfontlicense.org. |
| Current Roboto is a **variable** font; instance to the target weights before subsetting or the whole `wght` axis is carried. Google's "latin" subset omits `→` (U+2192); a custom subset must add it explicitly. | google/fonts METADATA; measured unicode-range. |
| Subsetting (fixed charset ≈ printable ASCII + `· × – — … • → − % € ™ ' ' " "`) yields ≈ 7–12 KB woff2 per face → ≈ 10–16 KB Base64. | Measured with `pyftsubset`; a JS subsetter yields comparable output. |

## Scope: the card set

Final set (README order). "✓" = computed from data already in `ProfileData`.

| Card | File(s) | Disposition | Data |
|---|---|---|---|
| Overview | `overview.*.svg` | **Changed** — drop the by-year column strip (superseded by Composition); keep the 8 stat tiles | ✓ |
| Lifetime heatmap | `lifetime.*.svg` | **New (A1)** | ✓ `lifetimeDays` |
| Contributions | `contributions.*.svg` | Unchanged structurally; inherits the new type system | ✓ |
| Composition | `composition.*.svg` | **New (A2 + A5)** | ✓ `years[]` |
| Rhythm | `rhythm.*.svg` | **New (A3)** | ✓ `lifetimeDays` |
| Languages | `languages.*.svg` | **Changed** — stacked bar → treemap by bytes | ✓ `languages[]` |

Six cards × two themes = 12 generated SVGs (plus committed badges, unchanged).

## Font system (new infrastructure)

The scheduled runtime must stay dependency-free and must run identically under
Node (generator, tests) and Vite (preview). Therefore fonts are **baked to Base64
string constants at dev time**, not read from disk at runtime.

```
scripts/fonts-src/            # vendored OFL source woff2 (committed) + OFL.txt
  Roboto[wght].woff2          #   variable source
  RobotoMono-Regular.woff2
  OFL.txt
scripts/build-fonts.ts        # DEV-time (like generate-badges.ts): instance +
                              #   subset → emit Base64 constants. Uses a dev-only
                              #   subsetter dependency; never on the scheduled path.
src/fonts.generated.ts        # GENERATED, committed: `export const ROBOTO_200 = "…"` …
src/fonts.ts                  # RUNTIME: builds @font-face CSS from the constants.
                              #   Zero deps, no fs — works in Node and Vite.
```

- **Faces:** Roboto **200** (ExtraLight, the base weight), Roboto **400**
  (Regular), Roboto **600** (SemiBold), Roboto Mono **400**. Instanced to static
  weights (static `@font-face` is the empirically proven path; a single variable
  file is a possible later optimization but is not on the verified path and is not
  used here).
- **Charset:** printable ASCII (U+0020–007E) + `U+00A0 U+00B7(·) U+00D7(×)
  U+2013(–) U+2014(—) U+2018/2019(' ') U+201C/201D(" ") U+2022(•) U+2026(…)
  U+2192(→) U+2212(−) U+20AC(€) U+2122(™)`. Deterministic; any glyph outside it
  falls back to the system stack (rare — card text is overwhelmingly ASCII).
- **`src/fonts.ts` API:** `fontFaceCss(faces: FontFace[]): string`, emitting one
  `@font-face` per requested face. Each card requests only the faces it uses, so a
  card without mono does not carry the mono blob.
- **Type scale** (remapped in `src/cards/frame.ts` shared `<style>`): base
  `text{font-family:'Roboto',<sans stack>;font-weight:200}`; `.t-title`/`.t-value`
  → 600; `.t-unit` → 400; `.t-label` → 200; `.t-mono`/`.t-tick` →
  `'Roboto Mono'` 400. `FONT_SANS`/`FONT_MONO` in `theme.ts` gain the
  `'Roboto'` / `'Roboto Mono'` prefix. Small muted roles (`.t-label` 12px,
  `.t-tick` 9.5px) at ExtraLight are thin; verify legibility in the preview
  (both themes) and bump only those roles to 400 if they read faint — 400 is
  already an embedded face, so this costs nothing.
- **`@font-face` injection:** `cardFrame` prepends the requested faces' CSS to its
  `<style>` block (one place, every card).
- **Licensing:** commit `scripts/fonts-src/OFL.txt`; keep name-table license IDs
  in the subset; add a one-line OFL attribution to the README footnote.
- **Layout metrics:** `svg/text.ts` estimates widths from Helvetica AFM. Roboto's
  advances differ; to avoid truncation overflow when Roboto renders wider than the
  estimate, add a Roboto advance-width table (or a conservative safety factor) and
  extend `FontWeight` to cover light. Measurement stays an estimate (the viewer's
  fallback font is still unknowable), only more accurate for the common case.

## Motion

Extend the existing CSS-only, reduced-motion-gated vocabulary. Entrance-only,
short (300–900 ms), eased, staggered; **no infinite loops** (professional
restraint; the proxy restarts animations on each load anyway). Add keyframes
alongside `fade`/`rise`:

- `grow` — `scaleY` 0→1 from a baseline `transform-origin` (Composition bars,
  Rhythm month bars).
- `growX` — `scaleX` 0→1 from the left (Rhythm weekday bars, treemap optional).
- Heatmap cells reuse `fade` with a per-column staggered `animation-delay`.

All new keyframes live in the shared frame CSS, already covered by the global
`@media (prefers-reduced-motion: reduce)` reset.

## Card designs

Dimensions are targets; height is computed from content and passed to
`cardFrame`. All cards use `el()`/`textNode()` only, wrap in `cardFrame`, pull
colors from `Theme`, and pass the XML/injection/determinism/a11y/reduced-motion
gates.

### A1 — Lifetime heatmap (`src/cards/lifetime.ts`, 846×~280)

A "wall of years": one row per contribution year (2014→present), 53 week-columns,
each cell colored by that **week's** activity quartile (a weekly-resolution
compression of the daily series — bigger, cleaner cells than 13× tiny daily
grids, and reads clearly as a multi-year panorama).

- Compute (`src/compute/lifetime.ts`, pure + tested): group `lifetimeDays` by
  `(year, isoWeekIndex)`, sum counts per week, assign 0–4 levels by quartile
  thresholds over the non-empty weekly totals; return a `year → level[53]`
  matrix. Deterministic; ISO-week/weekday math is arithmetic (no `Date` objects,
  matching `text.ts`).
- Render: rows labeled by year (left, mono tick); month ticks along the top;
  cells `~13×10` with a `2–3px` gap, rounded ~2px; colors from `theme.contribRamp`.
  A `Less → More` legend bottom-left. Cells fade in as a left-to-right wave
  (per-column `animation-delay`).

### A2 + A5 — Composition (`src/cards/composition.ts`, 846×~280)

Per-year stacked bars of `commits / pullRequests / issues / reviews / restricted`,
telling the growth/maturity story (early years dominated by private/restricted;
recent years rich in typed public PRs/reviews).

- Compute (`src/compute/composition.ts`, pure + tested): per year, the five
  segment values and their sum; the max sum across years (bar scale); the overall
  private share `Σrestricted / Σ(all five)`. Bar height ∝ the five-segment **sum**
  (segments fill it exactly). Note: `year.total` may differ slightly from this sum
  (calendar-vs-event counting) — the card shows the typed composition, and the
  eyebrow says so ("by contribution type · incl. private").
- Palette: a 5-hue categorical set (Primer data colors), verified for WCAG
  contrast on both insets — starting set: commits = `theme.accent`; pull requests
  = purple; issues = green; reviews = amber; private = neutral/muted. Added to
  `theme.ts` as a per-theme `seriesRamp`.
- Render: 13 bars, year ticks below, a 5-entry legend, and a "N% private" mono
  caption. Bars `grow` from the baseline, staggered by year.

### A3 — Rhythm (`src/cards/rhythm.ts`, 846×~220)

Two panels from `lifetimeDays`: **weekday** distribution (Mon→Sun, horizontal
bars) and **month** seasonality (Jan→Dec, vertical bars). Surfaces "weekend vs
weekday" and seasonal cadence; peak weekday and month are highlighted.

- Compute (`src/compute/rhythm.ts`, pure + tested): `weekday[7]` and `month[12]`
  count sums; peak indices. Weekday derived via a pure day-of-week algorithm
  (Zeller) from the ISO date's y-m-d — no `Date`, no locale.
- Render: left half weekday bars (`growX`), right half month bars (`grow`),
  labels in `.t-label`/`.t-tick`, peaks accented.

### A4 — Languages treemap (`src/cards/languages.ts`, rewrite, 846×~260)

Replace the stacked proportion bar with a squarified treemap sized by bytes;
keep a compact legend.

- Compute (`src/compute/treemap.ts`, pure + tested): squarified treemap
  (weights + bounding rect → rects). Reuse `languageShares()` (top 8 + "Other",
  percentages to 100.0). Tests: rect count, full coverage, no overlap, bounded
  aspect ratios, determinism.
- Render: one rect per language (linguist color; `theme.fgMuted` fallback),
  `2px` surface gaps, ~2px radius; in-cell label (name + `%`) when the cell
  clears a size threshold, else color-only with the name in the legend. Cells
  fade/scale in, staggered. Must still contain each language name and `%` (test
  gate).

### Overview change (`src/cards/overview.ts`, → 846×~250)

Remove `roundedColumn`, the year ticks, and the "CONTRIBUTIONS BY YEAR" strip
(now the Composition card's job). Keep the two `tileRow`s (8 tiles). Height
shrinks accordingly.

## Data

**No GraphQL changes.** A1/A3 read `lifetimeDays`; A2/A5 read `years[]`
(including `restricted`); A4 reads `languages[]`. All are already fetched and
normalized by `github/fetch-profile.ts`. The resource-limit-immune query set is
untouched.

## Repository layout (delta)

```
src/
  fonts.ts                     # NEW runtime: @font-face CSS from constants (zero-dep)
  fonts.generated.ts           # NEW generated+committed: Base64 face constants
  theme.ts                     # + 'Roboto'/'Roboto Mono' in stacks; + seriesRamp
  cards/
    frame.ts                   # inject @font-face; remap type-scale weights; + keyframes
    overview.ts                # drop the year strip
    languages.ts               # rewrite → treemap
    lifetime.ts                # NEW (A1)
    composition.ts             # NEW (A2+A5)
    rhythm.ts                  # NEW (A3)
  compute/
    lifetime.ts  composition.ts  rhythm.ts  treemap.ts   # NEW, pure + tested
  svg/text.ts                  # + Roboto advance widths / safety factor
  main.ts                      # render + write lifetime/composition/rhythm; keep others
scripts/
  build-fonts.ts               # NEW dev-time: instance+subset → fonts.generated.ts
  fonts-src/                    # NEW: vendored OFL source woff2 + OFL.txt
preview-app/main.ts            # render the new cards for HMR
fixtures/fixture.ts            # extend lifetimeDays to a multi-year series (2014→2026)
test/
  cards.test.ts                # add new cards to renderAll(); harden the ban scan
  lifetime.test.ts composition.test.ts rhythm.test.ts treemap.test.ts   # NEW
README.md                      # embed new cards; treemap languages; OFL footnote
.github/workflows/ci.yml       # + font-freshness gate (re-run build-fonts, fail on diff)
package.json                   # + dev-only subsetter dependency; + `fonts` script
```

## Testing & verification

1. **Fixture extension.** `fixtures/fixture.ts` currently sets
   `lifetimeDays: trailing` (≈1 year). Extend it to a deterministic multi-year
   daily series spanning 2014→2026-07-22 (seeded PRNG) so A1/A3 are exercised;
   keep `trailing` as the last 371 days and `years[]` as-is.
2. **New card gates.** Add `lifetime`/`composition`/`rhythm` and the rewritten
   `languages` to `renderAll()`; they must pass the existing gates: starts with
   `<svg `, well-formed XML, deterministic, `viewBox="0 0 846 "`, `role="img"`,
   `aria-label=`, `prefers-reduced-motion`.
3. **Injection-scan robustness.** The banned-substring test scans the whole SVG.
   The Base64 alphabet excludes `< : (`, so `<script`/`http(s)://`/`url(http`/
   `<foreignObject` cannot occur inside the font blob; only `href=` is
   theoretically reachable (via a trailing `=` pad). Harden the test to **strip
   `url(data:…)` payloads before the scan** — the ban targets authored
   markup/external refs, not a vetted committed binary — and keep asserting on the
   remaining authored markup.
4. **Compute units.** `treemap` (coverage/overlap/aspect/determinism), `rhythm`
   (weekday/month sums, Zeller correctness, peak), `composition` (segment sums,
   max, private share), `lifetime` (weekly aggregation, leveling, week counts).
5. **Font pipeline.** `build-fonts.ts` output is committed; CI re-runs it and
   fails on any `src/fonts.generated.ts` diff (mirrors the badge-freshness gate,
   `git add --intent-to-add` so new files count). Pin the subsetter version for
   reproducibility. Optionally assert in a test that each embedded face decodes
   from Base64 to a valid `wOF2` signature.
6. **Library-API check (pre-implementation).** Confirm the chosen subsetter's
   API for variable-weight instancing + woff2 subsetting against its current docs
   (Context7) before wiring `build-fonts.ts`.
7. **Local integration.** `GITHUB_TOKEN=$(gh auth token) node src/main.ts` against
   the live API; inspect all six cards in the Vite preview, light + dark.
8. **End-to-end GitHub validation (before merge).** The empirical tests replicate
   GitHub's serving CSP, but only a rendered-README check is the real thing: after
   the PR exists, view a card with an embedded font on github.com (e.g., via the
   PR's README diff or `gh workflow run profile.yml --ref <branch>`) and confirm
   Roboto renders in the rendered image. Ship system-font fallback so this is a
   quality check, not a failure gate.

## Determinism & failure semantics

Unchanged from the base design: all-or-nothing render → write; a failed run
leaves the prior snapshot. New sources of nondeterminism to avoid: no `Date`/
`Math.random()` in compute or render (fixed dates threaded through data; Zeller
for weekdays); the font constants are committed, so Base64 is stable; treemap and
leveling are deterministic for fixed input.

## Size budget

Each card embeds only the faces it uses (~10–16 KB Base64 each; ~30–45 KB per
card file). Across 12 SVGs this adds roughly ~0.4 MB to `assets/`. The user
accepted the increase for the typographic upgrade. Mitigations already in the
design: aggressive subsetting, per-card face selection, static-weight instances.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Embedded font blocked in some viewer/browser we did not test | System-font fallback in every `font-family`; entrance and layout never depend on the font loading; end-to-end GitHub check before merge. |
| Subsetter dependency/reproducibility | Dev-only (never on scheduled path); pinned version; CI freshness gate; source woff2 vendored for offline rebuilds. |
| Roboto renders wider than Helvetica estimate → text overflow | Add Roboto advance widths / safety factor to `text.ts`; verify no overflow at max plausible values in the preview. |
| Composition segments don't sum to `year.total` | By design show typed composition; eyebrow states "by contribution type · incl. private". |
| Weekly heatmap reads as coarser than GitHub's daily graph | Deliberate multi-year compression; the daily-resolution recent view still exists as the Contributions card. |

## Out of scope / future

- Repository/topics card (cut 2026-07-23).
- Hour-of-day activity (daily calendar has no sub-day granularity; would need
  expensive commit-level queries).
- Consolidating the four static faces into one subsetted variable woff2 (smaller,
  but the variable-weight-in-img-SVG path is unverified; revisit with a spike).
- Auto-merge (the user merges the PR).

## Implementation Outcome (2026-07-23)

Shipped as designed, with these refinements (this section is authoritative where
it differs from the above):

- **Font source & subsetting.** Vendored Google's *latin-subset variable* woff2
  (Roboto 43 KB wght 100–900, Roboto Mono 33 KB) under `scripts/fonts-src/` with
  their `OFL.txt`. `scripts/build-fonts.ts` uses `subset-font` (dev dep) to
  instance to wght 200/400/600 (+ mono 400) and subset to the charset, emitting
  `src/fonts.generated.ts`. Output was byte-identical across two local runs
  (deterministic). Per-face subset sizes: sans ≈ 13 KB woff2 (~17 KB base64),
  mono ≈ 7.6 KB (~10 KB base64).
- **Arrows are SVG shapes, not glyphs.** `→` (U+2192) is outside Google's latin
  subset, so the charset omits it and the Less/More legends use text + swatches
  (no arrow glyph). This kept the source font small (no full-glyph vendoring).
- **Font validity test replaces the CI freshness gate.** A byte-diff re-run gate
  risks false failures if `harfbuzz` (wasm) is not byte-identical across
  platforms (verified identical only on macOS locally). Instead, `test/fonts.test.ts`
  asserts each generated face decodes to a `wOF2` signature and `fontFaceCss`
  emits the expected rules. `pnpm run fonts` stays a documented dev step; CI is
  unchanged.
- **Runtime has no `fs`.** Faces are Base64 constants in `src/fonts.generated.ts`,
  consumed by `src/fonts.ts`; `cardFrame` injects the default set
  (`sans200`+`sans600`+`mono400`) per card. `.t-unit` uses weight 200 (not 400)
  to keep the default embed to three faces.
- **`subset-font` ambient types.** Added `scripts/subset-font.d.ts` (the package
  ships none) so `tsc` passes.
- **Card heights (fixture):** overview 248, lifetime 287, contributions
  (unchanged), composition 248, rhythm 227, languages 332.
- **Verified end-to-end.** `node src/main.ts` against the live API generated all
  12 cards (@seijikohara: 11,139 lifetime contributions, 24 languages). Visual QA
  (cards embedded via `<img>`, both themes) confirmed the embedded Roboto renders
  and the layouts are clean. 90 tests pass; typecheck and lint are clean.
