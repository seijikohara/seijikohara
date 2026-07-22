/** Streak math over the merged daily contribution series. */

import type { DayContribution, Streaks } from "../model.ts";

const DAY_MS = 86_400_000;

function toUtcMs(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`invalid calendar date: ${date}`);
  return ms;
}

/**
 * Compute current and longest streaks.
 *
 * `days` must be ascending and date-unique (mergeDailySeries guarantees both).
 * The "today" anchor is the series' last day, so results do not depend on the
 * generator host's clock or timezone. A current streak stays alive when the
 * last day has no contributions yet (the day is not over — GitHub streak
 * convention).
 */
export function computeStreaks(days: readonly DayContribution[]): Streaks {
  let longest = 0;
  let run = 0;
  let lastActiveMs = Number.NaN;
  for (const day of days) {
    if (day.count === 0) continue;
    const ms = toUtcMs(day.date);
    run = ms - lastActiveMs === DAY_MS ? run + 1 : 1;
    lastActiveMs = ms;
    if (run > longest) longest = run;
  }

  // Current streak: walk back from the end; forgive the final day if zero.
  let index = days.length - 1;
  const last = days[index];
  if (last !== undefined && last.count === 0) index -= 1;
  let current = 0;
  let expectedMs = Number.NaN;
  for (; index >= 0; index -= 1) {
    const day = days[index];
    if (day === undefined || day.count === 0) break;
    const ms = toUtcMs(day.date);
    if (!Number.isNaN(expectedMs) && ms !== expectedMs) break;
    current += 1;
    expectedMs = ms - DAY_MS;
  }

  return { current, longest };
}
