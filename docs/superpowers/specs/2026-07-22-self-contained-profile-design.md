# Self-Contained Profile Generator — Design

- **Date:** 2026-07-22
- **Status:** Approved for implementation (autonomous session; user mandate: rebuild without external GitHub Actions, best possible quality)
- **Branch:** `worktree-self-contained-profile`
- **Supersedes:** `2026-06-02-resilient-profile-readme-design.md`

## Problem

The profile pipeline replaced view-time third-party services with generation-time
third-party GitHub Actions. Those actions now fail routinely: 22 of the last 30
scheduled runs failed. Root causes, from run logs:

- `abozanona/pacman-contribution-graph` — `FATAL ERROR: Ineffective mark-compacts
  near heap limit` even with `--max-old-space-size=8192`.
- `cicirello/user-statistician` — GitHub GraphQL rejects its query: *"Resource
  limits for this query exceeded"*; the action retries once and exits 1.

Both defects live inside the actions. They cannot be fixed from this repository.
Every generator in the workflow is third-party code, so the profile's reliability
is bounded by the least-maintained dependency.

## Goals

- Remove every external GitHub Action (`uses:`) from every workflow. First-party
  shell and Node.js only.
- Remove third-party code from the scheduled runtime entirely: generation runs on
  Node.js built-ins with **zero npm dependencies at runtime**.
- Consolidate, extend, and reorganize the current cards into a clean,
  professional page.
- Keep the committed-SVG + `<picture>` light/dark architecture (view-time
  resilience is already solved and stays).
- Keep GITHUB_TOKEN-only auth (no PAT).

## Non-Goals

- Real-time accuracy (6-hour snapshot cadence stays).
- Interactive SVG. GitHub renders README images via `<img>`; scripts never
  execute (browser SVG-as-image rules + `default-src 'none'` CSP on
  githubusercontent). Verified 2026-07-22.
- Replacing the shields.io *link* badges with external services. They are
  replaced by committed first-party SVG badges instead.

## Verified constraints (primary sources, 2026-07-22)

| Fact | Source |
|---|---|
| Profile README column measures 846px on desktop; `width="100%"` on `<img>` survives sanitization | live measurement github.com/seijikohara; POST /markdown API |
| Relative-path images bypass camo; raw.githubusercontent serves `max-age=300` → changes propagate in ~5 min | live headers |
| `<picture>` + `prefers-color-scheme` is the documented theme mechanism; `#gh-dark-mode-only` is undocumented and broken for camo URLs | github.blog changelog 2022-08-15 |
| Inside SVG-in-`<img>`: embedded `<style>`, `@keyframes`, `@media (prefers-reduced-motion)` all work; scripts/external resources blocked | MDN + live CSP headers + empirical render test |
| ubuntu-24.04 runner: system Node is 22.x, but Node **24.18.0 sits in `/opt/hostedtoolcache/node/24.*`** — a PATH prepend replaces `actions/setup-node`; `git` 2.54, `gh` 2.96 preinstalled | actions/runner-images readme + toolset json |
| Node 24 (Active LTS, EOL 2028-04): runs `.ts` directly, **type stripping is Stable, no flags**; erasable syntax only; import specifiers must include `.ts`; `fetch` stable | nodejs.org/api/typescript.html, cli.html |
| TypeScript 7.0 GA (2026-07-08): `typescript@7.0.2`, binary is `tsc`; no `baseUrl`, `moduleResolution` bundler/node16/nodenext only | devblogs.microsoft.com/typescript |
| Vite+ is MIT now but **beta (v0.2.5)**; stable pieces: `vite` 8.1.5, `vitest` 4.1.10, `oxlint` 1.75.0; vitest bundles vite | voidzero.dev blog, npm registry |
| GraphQL: full profile query (100 repos × 10 langs + calendar) costs **1 point**, GITHUB_TOKEN budget 1,000 points/h/repo; `contributionsCollection` window ≤ 1 year; split queries is the documented mitigation for resource-limit errors | docs.github.com GraphQL limits, live query |
| `restrictedContributionsCount` (and private days in the calendar) are visible to other viewers only if the profile enables "include private contributions" — the generator reports what GITHUB_TOKEN sees, same as today | docs.github.com |
| GITHUB_TOKEN pushes do not retrigger workflows; `[skip ci]` honored; `x-access-token:<token>` is the documented clone credential; scheduled workflows auto-disable after 60 days *of no repository activity* (activity definition undocumented) — re-enabling via the Actions API resets the counter | docs.github.com |
| simple-icons v16.27.0 has github/facebook/qiita/zenn/npm/apachemaven/wantedly/sonatype; **no linkedin (legal removal), no lapras, no maven-central** | npm package enumeration |

## Approach

```
.github/workflows/profile.yml   (schedule 6h + dispatch; ZERO uses:)
  └─ job refresh (permissions: contents: write)
       1. PATH-prepend Node 24 from hosted toolcache (fallback: checksummed
          download from nodejs.org/dist/latest-v24.x)
       2. shallow clone via x-access-token + GITHUB_TOKEN
       3. node src/main.ts          ← zero npm deps; Node built-ins only
       4. git commit + push only when assets/ diff is non-empty
  └─ job keepalive (permissions: actions: write)
       gh workflow enable profile.yml   ← documented reset of the 60-day timer

.github/workflows/ci.yml        (pull_request; ZERO uses:)
  └─ typecheck (tsc 7) + lint (oxlint) + test (vitest) with npm ci --ignore-scripts
```

Generation is all-or-nothing: every card renders in memory first; files are
written only after all succeed. A failed run leaves the previous snapshot
committed and visible — same resilience contract as today, minus the flaky
generators.

### Why zero runtime dependencies matter

The scheduled job holds a `contents: write` token. With no `uses:` and no
`npm install`, the supply-chain surface of that job is: the GitHub runner image,
Node.js, and first-party code in this repo. Nothing else can break — or
compromise — the scheduled path. Dev tooling (typescript, vitest, oxlint, vite,
simple-icons) is installed only in CI/dev contexts that hold read-only tokens.

## Content: consolidate → extend → reorganize

| Current item | Disposition |
|---|---|
| Stats card (github-readme-stats) | **Merged into Overview card** |
| Overview (user-statistician totals + languages) | **Split**: totals → Overview card; language rollup → Languages card |
| Top Languages card | **Merged into Languages card** (cross-repo, by bytes, top 8 + Other) |
| Streak card | **Merged into Contributions card** (current/longest streak tiles) |
| Pac-Man contribution graph | **Replaced** by an isometric 3D contribution graph (user directive 2026-07-22: discontinue Pac-Man, render contributions as 3D SVG) |
| shields.io social/package badges | **Replaced** by committed first-party SVG badges (light/dark) |
| shields.io followers/stars badges | **Removed** (numbers live in the Overview card; GitHub's own UI shows followers) |

New/extended content: lifetime contribution total, per-year career columns
(2014→present), merged-PR count, review count, refresh timestamp caption.

## The page

```
# Seiji Kohara
Software Engineer.
[GitHub] [LinkedIn] [Facebook] [Findy] [LAPRAS] [Wantedly] [Qiita] [Zenn]   ← badge SVGs, linked

┌ Overview ────────────────────────────────────┐  846×~340
│ 8 stat tiles (2×4): lifetime contributions,  │
│ this year, stars, followers, merged PRs,     │
│ issues, reviews, public repos                │
│ career columns 2014→2026 (13 thin columns,   │
│   selective labels) — activity by year       │
└──────────────────────────────────────────────┘
┌ Contributions ───────────────────────────────┐  846×~560  ← signature card
│ tiles: current streak · longest · this year  │
│ trailing-12-month ISOMETRIC 3D graph:        │
│   53×7 grid in 2:1 isometric projection,     │
│   each day an extruded column, height ∝      │
│   contribution count (linear, capped), top   │
│   face = Primer green quartile ramp, side    │
│   faces shaded; staggered rise-in animation  │
│ footer: "Refreshed 2026-07-22 03:17 UTC"     │
└──────────────────────────────────────────────┘
┌ Languages ───────────────────────────────────┐  846×~200
│ one stacked proportion bar (24px, 2px gaps,  │
│   rounded ends) + 8-entry legend with %      │
└──────────────────────────────────────────────┘

Packages   [Maven Central] [npm]                ← badge SVGs, linked
```

No markdown section headings between cards — each card carries its own title;
headings would duplicate them. Every image: `<picture>` light/dark, `alt` text,
`width="100%"` (Overview/Contributions/Languages) or natural size (badges).

## Visual design

**Direction.** The cards render *inside* GitHub's page, so they must read as
native instrumentation, not a poster. Distinctiveness is spent on structure —
the career panorama — while chrome stays quiet Primer. This is a deliberate
choice, not a default: a loud palette inside someone else's UI reads as an ad.

**Tokens** (Primer primitives 11.9.0, current values — several differ from
older widely-copied palettes):

| Role | Light | Dark |
|---|---|---|
| Card background | `#ffffff` | `#0d1117` |
| Inset background | `#f6f8fa` | `#151b23` |
| Border | `#d1d9e0` | `#3d444d` |
| Text | `#1f2328` | `#f0f6fc` |
| Muted text | `#59636e` | `#9198a1` |
| Accent | `#0969da` | `#4493f8` |
| Heatmap ramp | `#ebedf0 #9be9a8 #40c463 #30a14e #216e39` | `#161b22 #0e4429 #006d32 #26a641 #39d353` |

Language colors come from the GraphQL `Language.color` field (linguist) — they
are the entity colors readers already know; identity is never color-alone (every
slice is direct-labeled with name + %).

**Type.** System stacks only (SVG-in-img cannot load fonts).
Sans: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`.
Mono: `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace` —
used for eyebrow labels, axis ticks, and the refresh timestamp; the mono texture
is the typographic personality (engineering instrumentation), sans carries
values and body. Tile values: sans semibold 28px, proportional figures. Card
titles: sans semibold 15px. Eyebrows/captions: mono 10–11px uppercase, muted.

**Marks** (dataviz spec): columns ≤ 24px with 4px rounded data-ends, square
baseline; stacked bar segments separated by 2px surface gaps, no strokes;
hairline solid gridlines one step off surface; values labeled selectively
(endpoint + extreme), never on every mark.

**Isometric 3D graph** (the signature; replaces both Pac-Man and a flat
heatmap). 2:1 isometric projection: tile width 24px → grid footprint
(53+7)·12 = 720px wide, fitting the 798px inner width. Day (week `w`, weekday
`d`) projects to `x = x0 + (w−d)·12`, `y = y0 + (w+d)·6`. A zero day renders as
a flat diamond in the level-0 color; an active day extrudes to height
`4 + (count/max)·56` px (linear, capped — relative heights stay honest). Each
column is three `<polygon>`s: top face in the API's quartile color
(`contributionLevel` → Primer green ramp), left/right faces darkened steps of
the same hue (per-theme, precomputed — no CSS filters). Painter's order: back
rows first (`w+d` ascending). Color still carries the true quartile encoding;
height is redundant reinforcement, so the 3D never misstates the data. Month
ticks along the front-left edge in 9px mono muted.

**Motion.** One orchestrated moment: the 3D columns rise into place with a
staggered per-week delay (translateY + fade, ~0.9s total sweep) and career
columns grow from the baseline. Other cards: single 300ms fade. All animation
is CSS inside the SVG, disabled under `@media (prefers-reduced-motion:
reduce)`. No loops.

**Badges.** Pill: 1px border, 6px radius, inset background, 13px sans label,
optional 14px brand glyph (simple-icons path, brand hex; monochrome fg in dark
theme when brand hex fails contrast). LinkedIn/LAPRAS/Maven Central get
text-only pills — simple-icons removed/never had them (LinkedIn for legal
reasons; imitating the mark would recreate the problem). Icons are embedded at
*badge-generation time* (dev-time script with the simple-icons devDependency);
badges are committed and are NOT part of the scheduled run.

## Data

One shallow profile query (1 point) + one calendar query per contribution year
(13 queries, 1 point each, ≤ 371 day-nodes each) — far under every limit, and
structurally immune to the resource-limit error that kills user-statistician.

- Profile: name, followers, `repositories(OWNER, first:100)` → stars/fork
  totals + per-repo `languages(first:10, orderBy SIZE)`; `pullRequests(MERGED)`,
  `issues`, `repositoriesContributedTo`, `contributionsCollection.contributionYears`.
  (106 repos < 100? No — 106 > 100: paginate repositories with `after` cursor.)
- Per year `Y`: `contributionsCollection(from: Y-01-01, to: Y+1-01-01)` →
  yearly totals + `contributionCalendar.weeks.contributionDays { date
  contributionCount contributionLevel }`.
- Trailing-12-month series for the 3D graph: `contributionsCollection()` with
  no args (defaults to the last year — matches GitHub's own profile graph
  window).
- Streaks: computed from the concatenated daily series (all years), tolerant of
  the boundary duplication between year windows (dedupe by date).
- Languages: aggregate bytes across non-fork, non-archived owner repos; top 8 +
  "Other"; percentages of the aggregate.

Client: `fetch` with 3 attempts, exponential backoff + jitter, explicit handling
of GraphQL `errors[]` vs HTTP errors, 30s per-request timeout via `AbortSignal`.

## Repository layout

```
package.json            # private; devDependencies only; engines.node >=24
tsconfig.json           # strict, nodenext, erasableSyntaxOnly, verbatimModuleSyntax,
                        # allowImportingTsExtensions, noEmit
.node-version           # 24  (mise/asdf/fnm parity)
src/
  main.ts               # entry: fetch → compute → render both themes → write
  config.ts             # login, badge/link definitions, card geometry
  theme.ts              # Primer tokens, ramps, font stacks
  github/client.ts      # fetch wrapper: retries, backoff, abort, error types
  github/queries.ts     # GraphQL documents + response types
  github/fetch-profile.ts
  compute/streaks.ts  compute/languages.ts  compute/career.ts
  svg/dsl.ts            # element builder + escaping (the only HTML/XML emitter)
  svg/text.ts           # width estimation table, number formatting
  cards/frame.ts        # shared chrome: bg, border, title, footer
  cards/overview.ts  cards/contributions.ts  cards/languages.ts  cards/badge.ts
scripts/generate-badges.ts   # dev-time; imports simple-icons; writes assets/badges/
preview/index.html  preview/main.ts   # Vite playground: fixtures → live cards, both themes
fixtures/profile.json        # captured real API shapes for tests + preview
test/*.test.ts               # vitest
assets/                      # generated: overview/contributions/languages .light/.dark.svg
assets/badges/               # generated at dev time, committed
.github/workflows/profile.yml  ci.yml
```

Every `.ts` file uses only erasable syntax and explicit `.ts` import
specifiers, so `node src/main.ts` runs identically in dev and in the scheduled
job with no build step, no flags, and no dependencies.

## Toolchain decision (user asked for Node 24 / TypeScript 7 / Vite+)

- **Node 24** — runtime everywhere (toolcache on runners, `.node-version` for dev).
- **TypeScript 7.0.2** — typecheck only (`tsc --noEmit`); Node strips types at run time.
- **Vite+** — is beta (v0.2.5) as of today; adopting a 0.x CLI would reintroduce
  exactly the churn this redesign removes. We use its stable constituent tools
  directly — **Vitest 4** (tests), **Oxlint 1** (lint), **Vite 8** (preview
  playground only) — and can fold them into `vp` when Vite+ ships 1.0. All are
  dev-only; none touch the scheduled path.

## Workflows

`profile.yml` — triggers: `schedule` (`17 */6 * * *`, offset per docs guidance),
`workflow_dispatch`. Top-level `permissions: {}`. Job `refresh`:
`contents: write`, `runs-on: ubuntu-24.04` (pinned; ubuntu-latest will
eventually move to 26.04), `timeout-minutes: 10`, concurrency group. Steps: node
PATH-prepend → clone (`x-access-token`, depth 1) → `node src/main.ts`
(token via step-level `env:`) → conditional commit/push with
`github-actions[bot]` identity and `[skip ci]`. Job `keepalive`:
`actions: write`, runs `gh workflow enable profile.yml` — the only *documented*
reset for the 60-day scheduled-workflow disable (bot-commit "activity" is
unverified folklore).

`ci.yml` — `pull_request`; `permissions: contents: read`; node PATH-prepend →
clone → `npm ci --ignore-scripts` → `tsc --noEmit`, `oxlint`, `vitest run`.
Same zero-`uses:` discipline (manual clone; no cache action — the dep tree is
tiny).

Renovate: enable the `npm` manager alongside `github-actions` (which now only
watches for accidental reintroduction of `uses:`).

## Failure semantics

| Failure | Behavior |
|---|---|
| GraphQL/network error after retries | exit 1; nothing written; previous assets stay; run shows red (owner gets the standard failure email) |
| Partial data (missing fields) | schema-validated at parse; exit 1, nothing written |
| No asset diff | no commit (push skipped); run green |
| Renderer bug producing malformed SVG | vitest gates: XML well-formedness, no external refs, no `<script>`, deterministic output for fixed fixtures |

## Testing & verification

1. Unit: streak math (gaps, today-open streak, year boundaries, dedupe),
   language aggregation (top-8 + Other, rounding to 100.0%), career series,
   number formatting, text-width fitting (no overflow at max plausible values),
   XML validity/escaping (property-ish cases: names with `&<>"`).
2. Golden: fixture → byte-identical SVG per theme (catches nondeterminism).
3. Integration (local): `GITHUB_TOKEN=$(gh auth token) node src/main.ts`
   against the live API; inspect output in the Vite preview, light + dark.
4. Workflow: `gh workflow run profile.yml --ref <branch>` after the PR exists —
   documented to execute the branch's file — verifying clone/generate/commit
   end-to-end before merge.
5. CI on the PR runs typecheck/lint/test with the same Node 24 path used by the
   scheduled job.

## Out of scope

- Deleting the stale `fix-pacman-oom` worktree/branches (separate housekeeping).
- WakaTime, profile views, trophies (already removed; still out).
- Auto-merge of this change (user merges the PR).
