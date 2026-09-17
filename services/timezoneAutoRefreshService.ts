/**
 * Timezone Auto Refresh Service
 *
 * Batch resolves missing terrain timezones. Two strategies:
 *   1. Google Places v1 API when the terrain has a stored `google_place_id`
 *      (returns precise IANA-friendly offset via `utcOffsetMinutes`).
 *   2. Longitude-based estimation via `guessTimezoneFromLongitude` when no
 *      place id is available (rough `UTC±N` fallback).
 *
 * The batch is capped by `limit` per invocation so a large backlog doesn't
 * exhaust the caller. Each terrain is retried independently — one failure
 * doesn't abort the run.
 */
import { getSupabaseClient } from '@/template';
import { guessTimezoneFromLongitude } from './timezoneService';

export interface TerrainMissingTz {
  id: string;
  name: string;
  city: string;
  googlePlaceId: string | null;
  longitude: number | null;
  latitude: number | null;
}

export interface BatchRefreshOutcome {
  terrainId: string;
  terrainName: string;
  status: 'updated_google' | 'updated_longitude' | 'skipped' | 'error';
  timezone?: string;
  error?: string;
}

/** Convert Google Places `utcOffsetMinutes` to compact `UTC±H[:MM]`. */
function offsetMinutesToTimezone(offsetMinutes: number): string {
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const mins = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  if (mins === 0) return `UTC${sign}${hours}`;
  return `UTC${sign}${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Fetch terrains with no timezone set. Prefers rows that have a
 * `google_place_id` (best chance of accurate resolution) but also returns
 * rows with only coordinates so the caller can fall back to longitude.
 */
export async function listTerrainsMissingTimezone(limit: number = 50): Promise<{
  terrains: TerrainMissingTz[];
  total: number;
  withPlaceId: number;
  error: string | null;
}> {
  try {
    const supabase = getSupabaseClient();
    // total count of missing rows
    const { count: totalCount } = await supabase
      .from('terrains')
      .select('id', { count: 'exact', head: true })
      .is('timezone', null);
    const { count: withPidCount } = await supabase
      .from('terrains')
      .select('id', { count: 'exact', head: true })
      .is('timezone', null)
      .not('google_place_id', 'is', null);
    const { data, error } = await supabase
      .from('terrains')
      .select('id, name, city, google_place_id, location')
      .is('timezone', null)
      .order('google_place_id', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) return { terrains: [], total: 0, withPlaceId: 0, error: error.message };
    const terrains: TerrainMissingTz[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name || '',
      city: row.city || '',
      googlePlaceId: row.google_place_id || null,
      longitude: row.location?.longitude ?? null,
      latitude: row.location?.latitude ?? null,
    }));
    return {
      terrains,
      total: totalCount || 0,
      withPlaceId: withPidCount || 0,
      error: null,
    };
  } catch (e: any) {
    return { terrains: [], total: 0, withPlaceId: 0, error: e?.message || 'unknown' };
  }
}

/** Update a terrain row's timezone. */
async function persistTerrainTimezone(terrainId: string, timezone: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('terrains')
      .update({ timezone, updated_at: new Date().toISOString() })
      .eq('id', terrainId);
    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e?.message || 'unknown' };
  }
}

/**
 * Call Google Places v1 `places/{placeId}` for a terrain and extract
 * `utcOffsetMinutes`. Returns null if unavailable.
 */
async function resolveTimezoneFromGoogle(placeId: string, language: string, apiKey: string): Promise<string | null> {
  try {
    const cleanId = String(placeId).replace(/^places\//, '').split('/')[0];
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(cleanId)}?languageCode=${language}`,
      { method: 'GET', headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'utcOffsetMinutes' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.utcOffsetMinutes === 'number') {
      return offsetMinutesToTimezone(data.utcOffsetMinutes);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Batch resolver. For each terrain, attempts Google first (if googlePlaceId +
 * apiKey provided), then longitude fallback. Skips otherwise. Persists a
 * successful resolution immediately so a partial run keeps its progress.
 */
export async function batchRefreshTerrainTimezones(params: {
  terrains: TerrainMissingTz[];
  apiKey?: string | null;
  language?: string;
  useLongitudeFallback?: boolean;
  onProgress?: (index: number, total: number, current: TerrainMissingTz) => void;
}): Promise<{ outcomes: BatchRefreshOutcome[]; updated: number; error: string | null }> {
  const { terrains, apiKey, language = 'fr', useLongitudeFallback = true, onProgress } = params;
  const outcomes: BatchRefreshOutcome[] = [];
  let updated = 0;

  for (let i = 0; i < terrains.length; i++) {
    const t = terrains[i];
    onProgress?.(i, terrains.length, t);

    let resolvedTz: string | null = null;
    let source: 'google' | 'longitude' | null = null;

    // Attempt Google first when possible
    if (t.googlePlaceId && apiKey) {
      resolvedTz = await resolveTimezoneFromGoogle(t.googlePlaceId, language, apiKey);
      if (resolvedTz) source = 'google';
    }

    // Longitude fallback
    if (!resolvedTz && useLongitudeFallback && typeof t.longitude === 'number' && Number.isFinite(t.longitude)) {
      const guess = guessTimezoneFromLongitude(t.longitude);
      if (guess) {
        resolvedTz = guess;
        source = 'longitude';
      }
    }

    if (!resolvedTz) {
      outcomes.push({ terrainId: t.id, terrainName: t.name, status: 'skipped' });
      continue;
    }

    const { error } = await persistTerrainTimezone(t.id, resolvedTz);
    if (error) {
      outcomes.push({ terrainId: t.id, terrainName: t.name, status: 'error', error });
      continue;
    }
    updated++;
    outcomes.push({
      terrainId: t.id,
      terrainName: t.name,
      status: source === 'google' ? 'updated_google' : 'updated_longitude',
      timezone: resolvedTz,
    });
  }

  return { outcomes, updated, error: null };
}
