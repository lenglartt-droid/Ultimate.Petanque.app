/**
 * Calendar-date helpers.
 *
 * Postgres DATE values (`YYYY-MM-DD`) must not be parsed with `new Date('YYYY-MM-DD')`.
 * That constructor treats the string as UTC midnight, so timezones west of UTC
 * (Americas, Caribbean) show the previous local day.
 */

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UTC_MIDNIGHT = /T00:00:00(\.0+)?(Z|[+-]00:00)$/;

export function parseLocalCalendarDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
  }

  const text = String(value).trim();
  const prefix = text.match(DATE_PREFIX);
  if (prefix && (DATE_ONLY.test(text) || UTC_MIDNIGHT.test(text))) {
    const date = new Date(Number(prefix[1]), Number(prefix[2]) - 1, Number(prefix[3]), 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Prefer a real timestamptz (startTime); fall back to DATE-only eventDate. */
export function getSponsoredEventDisplayDate(event: {
  eventDate?: string | null;
  startTime?: string | null;
  event_date?: string | null;
  start_time?: string | null;
}): Date | null {
  const start = event.startTime || event.start_time;
  if (start) {
    const instant = new Date(start);
    if (!Number.isNaN(instant.getTime())) return instant;
  }
  return parseLocalCalendarDate(event.eventDate || event.event_date);
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole local calendar days from `now` until `date` (negative if in the past). */
export function calendarDaysUntil(date: Date, now: Date = new Date()): number {
  const a = startOfLocalDay(now).getTime();
  const b = startOfLocalDay(date).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function formatLocalCalendarDate(
  value: string | Date | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  const date = parseLocalCalendarDate(value);
  if (!date) return '';
  return date.toLocaleDateString(locale, options);
}
