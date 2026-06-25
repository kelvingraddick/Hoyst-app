import {DateTime} from 'luxon';

import type {HomeProgressCell} from '../../home/services/home-data-service';
import type {CircleProgressDay} from '../../../types/models';

// `monthProgress` is a chronological run of opportunity states for the current
// commitment window, with exactly one `today` entry (past days are done/missed,
// upcoming days are future). WeekProgressStrip needs HomeProgressCell objects
// keyed by real calendar dates so it can derive weekday labels, so we anchor the
// `today` entry to the real current date — in the circle's timezone — and lay
// the surrounding entries out before and after it. We render the most recent
// seven entries to match the strip's seven-day layout.
export function circleProgressToWeekCells(
  monthProgress: CircleProgressDay[],
  timezone?: string,
  now: Date = new Date(),
): HomeProgressCell[] {
  const base = DateTime.fromJSDate(now, timezone ? {zone: timezone} : undefined);
  const today = (base.isValid ? base : DateTime.fromJSDate(now)).startOf('day');
  const cells = monthProgress.slice(-7);
  const todayIndex = cells.findIndex(cell => cell.state === 'today');
  const anchor = todayIndex >= 0 ? todayIndex : cells.length - 1;

  return cells.map((entry, index) => {
    const date = today.plus({days: index - anchor});

    return {
      dateKey: date.toFormat('yyyy-LL-dd'),
      label: date.toFormat('dd'),
      state: entry.state,
    };
  });
}
