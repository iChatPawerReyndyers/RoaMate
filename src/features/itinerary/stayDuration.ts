/**
 * ITIN-06: "time to spend" at a stop.
 *
 * The person types hours (1, 1.5, 2.25 ...) but the server stores whole
 * minutes (see Destination.plannedDurationMinutes), so nothing downstream
 * ever has to deal with fractional-hour rounding.
 *
 * Display rules:
 *   x     -> "x hr(s)"
 *   x.25  -> "x hr(s) 15 mins"      (0.25 -> "15 mins")
 *   x.5   -> "x hr(s) 30 mins"
 *   x.75  -> "x hr(s) 45 mins"
 * Anything that isn't a quarter hour is rounded to the nearest 15 minutes
 * (and the form's readout says so).
 */

export const MAX_STAY_MINUTES = 24 * 60;
const STEP_MINUTES = 15;

export type StayParseResult =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ok'; minutes: number; rounded: boolean };

/** Parses what the person typed into the hours field. Blank / zero => 'empty' (no duration set). */
export function parseStayHours(raw: string): StayParseResult {
  // Phones set to a comma-decimal locale type "1,5" on the decimal keypad.
  const text = raw.trim().replace(',', '.');
  if (text === '') {
    return { status: 'empty' };
  }
  if (!/^\d*\.?\d*$/.test(text) || text === '.') {
    return { status: 'error', message: 'Enter hours as a number, like 1.5' };
  }
  const hours = parseFloat(text);
  if (!(hours > 0)) {
    return { status: 'empty' };
  }
  if (hours > MAX_STAY_MINUTES / 60) {
    return { status: 'error', message: 'Max 24 hours' };
  }
  const exactMinutes = hours * 60;
  // Never round a positive entry down to 0 - the smallest stay is 15 minutes.
  const minutes = Math.max(STEP_MINUTES, Math.round(exactMinutes / STEP_MINUTES) * STEP_MINUTES);
  return { status: 'ok', minutes, rounded: Math.abs(minutes - exactMinutes) > 0.001 };
}

/** 150 -> "2 hrs 30 mins", 60 -> "1 hr", 15 -> "15 mins". */
export function formatStayMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(hours === 1 ? '1 hr' : `${hours} hrs`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} mins`);
  }
  return parts.join(' ');
}

/** Stored minutes -> the text shown in the hours field when editing (150 -> "2.5", 60 -> "1", 45 -> "0.75"). */
export function minutesToHoursField(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) {
    return '';
  }
  return String(minutes / 60);
}

/** What the form shows under the hours field: "= 2 hrs 30 mins (rounded to nearest 15 mins)" or an error. */
export function describeStayInput(raw: string): { text: string; isError: boolean } {
  const result = parseStayHours(raw);
  if (result.status === 'empty') {
    return { text: '', isError: false };
  }
  if (result.status === 'error') {
    return { text: result.message, isError: true };
  }
  const suffix = result.rounded ? ' (rounded to nearest 15 mins)' : '';
  return { text: `= ${formatStayMinutes(result.minutes)}${suffix}`, isError: false };
}