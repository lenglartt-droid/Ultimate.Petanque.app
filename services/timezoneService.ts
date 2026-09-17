/**
 * Timezone Service
 *
 * Utilities for facility-timezone-aware date/time computations and formatting.
 * The system-wide timezone reference is the facility (terrain) local time,
 * never the device time. This avoids UTC-midnight boundary bugs and gives
 * users a consistent view of when facility events happen regardless of
 * where the user's phone currently is.
 */
import { getSupabaseClient } from '@/template';

export type DisplayTimezoneMode = 'auto' | 'terrain' | 'custom';

export interface DisplayTimezonePrefs {
  mode: DisplayTimezoneMode;
  customTimezone: string | null;
}

/**
 * Parse a terrain timezone string (IANA "Europe/Paris" or offset "UTC+2" / "+2").
 * Returns a value that can be passed to Intl.DateTimeFormat's timeZone option.
 */
export function parseTerrainTimezone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  const trimmed = String(tz).trim();
  if (!trimmed) return null;
  // IANA name (contains "/")
  if (trimmed.includes('/')) return trimmed;
  // UTC±N or ±N
  const offsetMatch = trimmed.match(/^(?:UTC|GMT)?([+-]?\d{1,2})(?::(\d{1,2}))?$/i);
  if (offsetMatch) {
    const hours = parseInt(offsetMatch[1], 10);
    if (!Number.isFinite(hours)) return null;
    // Etc/GMT is inverted (Etc/GMT-1 == UTC+1)
    return `Etc/GMT${hours >= 0 ? '-' : '+'}${Math.abs(hours)}`;
  }
  return null;
}

/** Return device IANA timezone. */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Format time (HH:MM) in a specific timezone. */
export function formatTimeInTimezone(date: Date, timezone: string | null | undefined, locale: string = 'fr-FR'): string {
  try {
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone || undefined,
    });
  } catch {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
}

/** Format date in a specific timezone. */
export function formatDateInTimezone(
  date: Date,
  timezone: string | null | undefined,
  locale: string = 'fr-FR',
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  try {
    return date.toLocaleDateString(locale, { ...options, timeZone: timezone || undefined });
  } catch {
    return date.toLocaleDateString(locale, options);
  }
}

/** Return YYYY-MM-DD as seen in the given timezone. Avoids UTC-midnight boundary bugs. */
export function getDateStringInTimezone(date: Date, timezone: string | null | undefined): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone || undefined,
    });
    const parts = fmt.formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch { /* fall through */ }
  return date.toISOString().slice(0, 10);
}

/** Weekday (0=Sun..6=Sat) as seen in the given timezone. */
export function getWeekdayInTimezone(date: Date, timezone: string | null | undefined): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone || undefined });
    const dayName = fmt.format(date);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    if (map[dayName] !== undefined) return map[dayName];
  } catch { /* fall through */ }
  return date.getDay();
}

/** Hour (0-23) as seen in the given timezone. */
export function getHourInTimezone(date: Date, timezone: string | null | undefined): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone || undefined,
    });
    const parts = fmt.formatToParts(date);
    const hourPart = parts.find(p => p.type === 'hour');
    if (hourPart) {
      const parsed = parseInt(hourPart.value, 10);
      if (Number.isFinite(parsed)) return ((parsed % 24) + 24) % 24;
    }
  } catch { /* fall through */ }
  return date.getHours();
}

/** UTC offset (in minutes, positive = east of UTC) for a timezone at a specific date. */
export function getTimezoneOffsetMinutes(date: Date, timezone: string | null | undefined): number {
  if (!timezone) return -date.getTimezoneOffset();
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' });
    const parts = fmt.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    if (tzPart) {
      const m = tzPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{1,2}))?/i);
      if (m) {
        const sign = m[1] === '-' ? -1 : 1;
        const h = parseInt(m[2], 10);
        const mm = m[3] ? parseInt(m[3], 10) : 0;
        return sign * (h * 60 + mm);
      }
      // "GMT" alone means UTC (offset 0)
      if (/^GMT$/i.test(tzPart.value.trim())) return 0;
    }
  } catch { /* fall through */ }
  return 0;
}

/** Difference tz1 - tz2 in minutes (positive = tz1 is ahead of tz2). */
export function computeTimezoneDiffMinutes(
  tz1: string | null | undefined,
  tz2: string | null | undefined,
  at?: Date
): number {
  const ref = at || new Date();
  return getTimezoneOffsetMinutes(ref, tz1 || null) - getTimezoneOffsetMinutes(ref, tz2 || null);
}

/** True if the two timezones represent different offsets right now. */
export function timezonesDiffer(
  tz1: string | null | undefined,
  tz2: string | null | undefined,
  at?: Date
): boolean {
  if (!tz1 || !tz2) return false;
  if (tz1 === tz2) return false;
  return Math.abs(computeTimezoneDiffMinutes(tz1, tz2, at)) > 0;
}

/**
 * Resolve the effective display timezone from user preferences + terrain timezone.
 * Falls back to device timezone when the requested mode has no target.
 */
export function resolveDisplayTimezone(
  prefs: DisplayTimezonePrefs,
  terrainTimezone?: string | null
): { effective: string; source: DisplayTimezoneMode | 'device' } {
  const parsedTerrain = parseTerrainTimezone(terrainTimezone);
  if (prefs.mode === 'terrain' && parsedTerrain) {
    return { effective: parsedTerrain, source: 'terrain' };
  }
  if (prefs.mode === 'custom' && prefs.customTimezone) {
    return { effective: prefs.customTimezone, source: 'custom' };
  }
  // auto (default): prefer terrain when available, else device
  if (parsedTerrain) return { effective: parsedTerrain, source: 'terrain' };
  return { effective: getDeviceTimezone(), source: 'device' };
}

/**
 * Friendly short label for a timezone (e.g. "Paris" from "Europe/Paris").
 * For offset-based zones returns the raw value.
 */
export function shortTimezoneLabel(timezone: string | null | undefined): string {
  if (!timezone) return '';
  const trimmed = String(timezone).trim();
  if (!trimmed.includes('/')) return trimmed;
  const parts = trimmed.split('/');
  return parts[parts.length - 1].replace(/_/g, ' ');
}

/** Format a UTC offset in minutes as "UTC+H" / "UTC-H". */
export function formatOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m > 0 ? `UTC${sign}${h}:${String(m).padStart(2, '0')}` : `UTC${sign}${h}`;
}

/** Compact "HH:MM Label" summary for a date in a given timezone. */
export function formatTimeWithLabel(
  date: Date,
  timezone: string | null | undefined,
  locale: string = 'fr-FR'
): string {
  const t = formatTimeInTimezone(date, timezone, locale);
  const label = shortTimezoneLabel(timezone);
  return label ? `${t} ${label}` : t;
}

// ============================================
// User preference loading (single-user helper)
// ============================================

/** Load the current user's display timezone preferences. Returns 'auto' fallback. */
export async function loadDisplayTimezonePrefs(): Promise<DisplayTimezonePrefs> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { mode: 'auto', customTimezone: null };
    const { data } = await supabase
      .from('user_preferences')
      .select('display_timezone, custom_timezone')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    const raw = String(data?.display_timezone || 'auto');
    const mode: DisplayTimezoneMode =
      raw === 'terrain' || raw === 'custom' ? raw : 'auto';
    return { mode, customTimezone: data?.custom_timezone || null };
  } catch {
    return { mode: 'auto', customTimezone: null };
  }
}

/** Save the current user's display timezone preferences. */
export async function saveDisplayTimezonePrefs(prefs: DisplayTimezonePrefs): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userData.user.id,
          display_timezone: prefs.mode,
          custom_timezone: prefs.mode === 'custom' ? prefs.customTimezone : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e?.message || 'unknown' };
  }
}
