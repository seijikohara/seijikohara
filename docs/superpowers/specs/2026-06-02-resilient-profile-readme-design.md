# Resilient GitHub Profile README — Design

- **Date:** 2026-06-02
- **Status:** Approved (pending spec review)
- **Branch:** `profile-redesign`

## Problem

The profile README (`README.md`) embeds many badges and stat cards that are
fetched in real time from shared third-party services. When those services are
rate-limited, cold-started, or shut down, GitHub renders broken images. Observed
failure sources:

- **Shared Vercel instances** (`github-readme-stats`, `github-profile-summary-cards`,
  `github-profile-trophy`, `github-readme-activity-graph`, `github-contributor-stats`)
  hit the GitHub API rate limit (5000 req/h) and return 502/timeout.
- **Heroku free dynos** (`github-readme-streak-stats.herokuapp.com`) no longer run
  since Heroku removed the free tier in 2022, so the Streak card is effectively dead.

A GitHub README cannot recover from these failures on the client side: GitHub
proxies images through Camo and sanitizes HTML, so `<img onerror>`, multi-source
`<picture>` fallbacks, and JavaScript do not work. A broken upstream means a
broken image with no automatic fallback.

## Goals

- Eliminate real-time dependence on shared third-party rendering services.
- Render stat cards from assets committed to this repository, so the README always
  shows the last successfully generated snapshot even while a generator is down.
- Support GitHub light and dark appearance.
- Keep the profile visually rich (the user chose to retain all selected cards).

## Non-Goals

- Real-time accuracy. A snapshot refreshed every 6 hours is acceptable.
- A page-view counter. It cannot be reproduced by a static, committed asset and is
  removed.
- WakaTime cards. The user chose to drop them.

## Approach Overview

```
GitHub Actions (cron: every 6h + workflow_dispatch + push to README/workflow)
  ├─ lowlighter/metrics → generate one SVG per card, light and dark variants
  ├─ Platane/snk        → generate contribution-snake SVG, light and dark variants
  └─ commit changed SVGs under assets/ (single commit, only when content changes)

README.md → references assets/ via relative paths
          → <picture> + (prefers-color-scheme) selects light/dark
```

The README never calls an external service at view time. Display always uses
committed SVGs. If a generator fails during a run, the previous committed SVGs
remain and the README keeps rendering them.

## Content Inventory & Decisions

| Card / element | Current source | Stability | Decision |
|---|---|---|---|
| Social links (LinkedIn, Facebook, Findy, LAPRAS, Wantedly, Qiita) | shields.io | Stable | **Keep** (static badge) |
| Packages (Maven Central, npm) | shields.io | Stable | **Keep** (static badge) |
| Followers / Stars | shields.io | Stable | **Keep** (static badge) |
| GitHub Stats summary | github-readme-stats | Unstable | **Generate** (metrics base) |
| Language breakdown | github-readme-stats + summary-cards | Unstable | **Generate** (metrics languages) |
| Streak / continuity | streak-stats (Heroku) | Down | **Generate** (metrics isocalendar) |
| Activity line graph | activity-graph | Unstable | **Generate** (metrics activity) |
| Productive time | summary-cards | Unstable | **Generate** (metrics habits) |
| Trophies / achievements | github-profile-trophy | Unstable | **Generate** (metrics achievements) |
| Top contributed repos | github-contributor-stats | Unstable | **Generate** (approximation; see below) |
| Contribution snake | — | — | **Add** (Platane/snk) |
| Profile views | komarev | — | **Remove** |
| WakaTime stat cards | wakatime.com | Moderate | **Remove** |
| WakaTime profile link badge | shields.io | Stable | **Remove** (consistency with dropping WakaTime) |

## Architecture

### GitHub Actions workflow

- **File:** `.github/workflows/profile.yml`
- **Triggers:** `schedule` (cron every 6 hours), `workflow_dispatch` (manual),
  and `push` on changes to the workflow itself (for fast iteration).
- **Concurrency:** a single concurrency group cancels overlapping runs so two runs
  do not commit conflicting assets.
- **Permissions:** `contents: write` (the job commits generated SVGs).
- **Jobs/steps:**
  1. Run `lowlighter/metrics` once per card per theme, writing each SVG to a
     distinct file under `assets/metrics/`.
  2. Run `Platane/snk` to produce `assets/snake/` SVGs (light + dark).
  3. Commit changed files with a single auto-commit step
     (`stefanzweifel/git-auto-commit-action`), only when there is a diff.

### Generation tools

- **lowlighter/metrics** — GitHub Action that renders profile metrics to SVG. Each
  card is produced by enabling one plugin (or base component) per step and writing a
  separate `filename`. This matches the chosen "section-split, individual cards"
  layout (option B).
- **Platane/snk** — generates the contribution-graph "snake" animation as SVG.

> The exact metrics plugin names, options, and theming/color flags are confirmed
> during implementation planning against the current upstream docs (via Context7 /
> official README), because these flags change across versions. This spec fixes the
> intent and structure; the plan fixes the precise YAML.

### Asset storage & commit strategy

- Generated SVGs live under `assets/` (committed; not ignored).
- A single auto-commit step commits all changed SVGs per run, only when content
  differs, to avoid empty commits.
- Commit message uses a fixed Conventional-Commits style line (e.g.
  `chore(profile): refresh generated metrics`).

### README rendering

- The README references committed SVGs by **relative path**.
- Light/dark selection uses the one mechanism GitHub honors:

  ```html
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/metrics/stats-dark.svg">
    <img src="./assets/metrics/stats-light.svg" alt="GitHub stats">
  </picture>
  ```

- Two-column rows (e.g. stats | languages) use a `<table>` for reliable
  side-by-side layout on GitHub.

## Card → Tool Mapping

| Card | Tool | Plugin / component (intent) |
|---|---|---|
| Stats summary | metrics | base (header/stats) |
| Language breakdown | metrics | languages |
| Streak / continuity | metrics | isocalendar (full year) |
| Activity line graph | metrics | activity |
| Productive time | metrics | habits (time-of-day charts) |
| Trophies / achievements | metrics | achievements |
| Top repositories | metrics | repositories / stargazers family (approximation) |
| Contribution snake | snk | — |

## Repositories Approximation

`metrics` has no exact equivalent of `github-contributor-stats` "top contributed
repositories." The card instead shows the user's **public repositories ranked
automatically** (e.g. by stars), with no manual repository list. The semantics
shift slightly from "most contributed" to "most notable owned." The precise plugin
(`repositories` vs `stargazers` vs an alternative) is selected during implementation
planning after checking current metrics capabilities.

## Theming (Light / Dark)

- Each generated card is produced in two color variants and selected at view time
  with `prefers-color-scheme` via `<picture>`.
- `Platane/snk` supports separate light and dark outputs directly.
- The metrics color approach (transparent background vs explicit per-theme colors)
  is finalized during implementation planning against upstream docs.

## Secrets & Permissions

- **`GH_METRICS_TOKEN`** — a classic personal access token (scopes: `repo`,
  `read:org`, `read:user`) is recommended for metrics. `GITHUB_TOKEN` alone is
  insufficient for some plugins (full-year isocalendar, private contribution counts).
- Workflow `permissions: contents: write` for committing assets.
- No third-party tokens are needed after dropping WakaTime.

## Resilience / Error Handling

- **View-time:** zero external calls. The README only references committed assets,
  so upstream outages cannot break rendering.
- **Generation-time:** if a generator step fails, the prior committed SVGs remain
  and the README is unaffected. The commit step runs only on a real diff.
- **Failure visibility:** a failed Actions run notifies the owner through GitHub's
  standard workflow-failure email, prompting a look without breaking the profile.

## Testing & Verification

1. Run the workflow via `workflow_dispatch` to perform the first generation.
2. Confirm `assets/metrics/` and `assets/snake/` are populated and committed.
3. View the README on GitHub in both light and dark appearance; confirm each
   `<picture>` selects the correct variant and two-column rows align.
4. Confirm the README contains no `img.shields.io` dynamic-stat URLs and no
   `*.vercel.app` / `herokuapp.com` / `komarev.com` references (only the retained
   static social/package/follower badges remain on shields.io).

## Directory Structure

```
.github/
  workflows/
    profile.yml
assets/
  metrics/
    stats-light.svg        stats-dark.svg
    languages-light.svg    languages-dark.svg
    isocalendar-light.svg  isocalendar-dark.svg
    activity-light.svg     activity-dark.svg
    habits-light.svg       habits-dark.svg
    achievements-light.svg achievements-dark.svg
    repositories-light.svg repositories-dark.svg
  snake/
    snake-light.svg        snake-dark.svg
README.md
docs/superpowers/specs/2026-06-02-resilient-profile-readme-design.md
```

## Deferred to Implementation Planning

- Exact `metrics` plugin names, options, and per-theme color flags (verified against
  current upstream docs).
- Final choice of plugin for the Repositories approximation.
- Whether the activity line graph and isocalendar visuals look redundant in practice
  once rendered (the user chose to keep both; revisit only if the rendered result
  looks duplicated).

## Out of Scope

- Real-time page-view counting (removed).
- WakaTime integration (removed).
- Redesigning the social/package/follower badges (kept as-is; they are stable).

## Implementation Outcome (2026-06-03)

The design shipped with these refinements discovered during implementation:

- **Secret name:** the metrics token is stored as `GH_METRICS_TOKEN` (classic PAT). GitHub
  App installation tokens and fine-grained PATs cannot read the account-level GraphQL data
  metrics needs, so a classic PAT is required.
- **Parallel generation:** instead of one sequential job, generation runs as a matrix of
  one job per (card × theme). Each job uploads its SVG as an artifact, and a single `commit`
  job (`needs: [metrics, snake]`) downloads all artifacts and commits once — avoiding
  parallel push races while cutting wall-clock from ~20 min to a few minutes.
- **metrics output recovery:** with `use_prebuilt_image` (default) and `output_action: none`,
  metrics writes to `/metrics_renders/<filename>`, NOT the workspace. Each job copies the SVG
  from `/metrics_renders` into `assets/metrics/` before uploading.
- **Activity card removed:** the metrics v3.34 activity plugin throws
  `TypeError: Cannot read properties of undefined (reading 'login')` on events whose user is
  null (e.g. deleted accounts), and neither `plugin_activity_filter` nor `plugin_activity_days`
  avoids it. The card is dropped; isocalendar covers contribution visualization. (Resolves the
  "keep both activity + isocalendar" question deferred above.)
- **Node 24 actions:** `upload-artifact@v7` and `download-artifact@v8` (Node 24) replace the
  deprecated `@v4` (Node 20), with `merge-multiple`/`pattern` confirmed retained.
- **Repositories approximation:** `plugin_repositories` with `plugin_repositories_starred`
  (most-starred) plus `_pinned`.
- **Verified:** light and dark rendering confirmed on GitHub; the 6-hour schedule runs
  automatically and commits refreshed assets.

## Migration to Active Tooling (2026-06-03)

After shipping the metrics-based version, the activity, habits, and achievements plugins began
rendering "Unexpected error" on the current GitHub API, and metrics proved to be **frozen** (last
code commit 2023-12; fix PRs unmerged; the `@master` image is 2-year-old code). The profile was
migrated off metrics to actively-maintained committed-SVG actions:

- **github-readme-stats** (`stats-organization/github-readme-stats-action`): stats + top-languages.
- **Auto-pinned top repositories:** a workflow step resolves the owner's most-starred public repos
  via `gh api graphql` (`repositories orderBy {field: STARGAZERS, direction: DESC}`) and feeds the
  names to the `pin` card — no manual repo list (replaces the metrics Repositories approximation).
- **streak-stats** (`DenverCoder1/github-readme-streak-stats`): contribution streak.
- **Platane/snk**: contribution snake (retained).
- All generators use the built-in **GITHUB_TOKEN** (no PAT; `GH_METRICS_TOKEN` removed).
- **Security hardening:** split into a read-only `generate` job and a `contents: write` `commit`
  job (write isolated from third-party generators); every third-party action pinned to a commit SHA.
- **Dropped** (no stable committed-SVG equivalent): isocalendar, achievements, activity, productive-time.

### Final metric set (2026-06-03)

After review the Top Repositories `pin` cards were removed (they duplicate GitHub's native
pinned/popular repositories). Snake was replaced with **Pac-Man** (`abozanona/pacman-contribution-graph`,
write-only into `dist/`, GITHUB_TOKEN). **user-statistician** (`cicirello/user-statistician`) was added
for a cross-repo language rollup plus lifetime commits/PRs/issues/reviews, run with `commit-and-push: false`
(write-only) so it fits the read-only generate job. WakaTime was offered (the one metric GitHub never shows)
but declined. Final cards: **Stats, Top Languages, Streak, Overview (user-statistician), Pac-Man** — all
GITHUB_TOKEN-only, SHA-pinned, generated in a read-only job and committed by the write-isolated commit job.
