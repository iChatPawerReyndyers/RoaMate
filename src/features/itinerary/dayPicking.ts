/**
 * ITIN-06: pure date helpers for the itinerary date picker.
 *
 * Days are plain 'YYYY-MM-DD' strings (what the server's LocalDate and the
 * itinerary's day grouping already use), and everything is computed from
 * local calendar parts - never via UTC-parsed Date strings, which shift a
 * day for anyone west of UTC. Names are spelled out instead of using Intl,
 * so the output doesn't depend on the device's/Hermes' Intl support.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WEEKDAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export interface DayParts {
  year: number;
  /** 0-11, like Date#getMonth */
  month: number;
  day: number;
}

/** A local Date -> 'YYYY-MM-DD'. */
export function toISODate(date: Date): string {
  return isoFromParts(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Today (device-local) as 'YYYY-MM-DD'. `now` is injectable for tests. */
export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** 'YYYY-MM-DD' -> parts, or null if it isn't a real calendar day. */
export function parseISODate(iso: string | null | undefined): DayParts | null {
  if (!iso) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const check = new Date(year, month, day);
  if (check.getFullYear() !== year || check.getMonth() !== month || check.getDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** ISO strings sort chronologically, so plain string comparison is enough. */
export function isPastDay(iso: string, today: string): boolean {
  return iso < today;
}

/** 'Sat, Sep 26' - short enough for the half-width date field; the year is visible in the calendar sheet. */
export function formatDayShort(iso: string | null | undefined): string {
  const parts = parseISODate(iso);
  if (!parts) {
    return '';
  }
  const weekday = WEEKDAY_SHORT[new Date(parts.year, parts.month, parts.day).getDay()];
  return `${weekday}, ${MONTH_SHORT[parts.month]} ${parts.day}`;
}

/** 'September 2026' */
export function formatMonthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/** Steps a (year, month) pair by +/- N months, wrapping the year. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

/**
 * The month's cells in reading order: `null` for the blank cells before the
 * 1st (so the 1st lands under its weekday), then 1..N. Not padded at the end.
 */
export function buildMonthCells(year: number, month: number): Array<number | null> {
  const leadingBlanks = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  return cells;
}

/** The back arrow is only usable while the shown month is later than today's month. */
export function canGoToPreviousMonth(year: number, month: number, today: string): boolean {
  const todayParts = parseISODate(today);
  if (!todayParts) {
    return true;
  }
  return year * 12 + month > todayParts.year * 12 + todayParts.month;
}

/**
 * Whether the person is allowed to newly pick `iso`. A stop's existing date
 * that has already passed stays valid as-is (see NeuDatePickerModal) - this
 * only gates choosing a different day.
 */
export function isSelectableDay(iso: string, today: string): boolean {
  return !isPastDay(iso, today);
}