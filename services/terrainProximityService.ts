/**
 * Terrain Proximity Service
 *
 * Detects nearby active terrains based on user location, match history, 
 * scheduled meetups, and ongoing tournaments.
 */
import { getSupabaseClient } from '@/template';
import { getCurrentPositionAsync, requestForegroundPermissionsAsync, Accuracy } from '@/services/location';
import {
  parseTerrainTimezone,
  getWeekdayInTimezone,
  getHourInTimezone,
  getDateStringInTimezone,
} from '@/services/timezoneService';

export interface NearbyActiveTerrain {
  id: string;
  name: string;
  city: string;
  type: string;
  distance: number; // meters
  activityScore: number;
  activityLabel: string;
  latitude: number;
  longitude: number;
  hasMeetupToday: boolean;
  hasTournamentToday: boolean;
  matchCountAtSlot: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula.
 * Returns distance in meters.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Haversine distance in kilometers. */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineDistance(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Get user's current location with permission check.
 */
async function getUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status } = await requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await getCurrentPositionAsync({ accuracy: Accuracy.Balanced });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Fetch all terrains with valid locations from Supabase (own + public).
 * Includes the facility timezone so activity scoring can compare match times
 * in the FACILITY'S local time rather than the device's.
 */
async function fetchTerrainsWithLocations(): Promise<
  { id: string; name: string; city: string; type: string; latitude: number; longitude: number; userId: string; timezone: string | null }[]
> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const results: { id: string; name: string; city: string; type: string; latitude: number; longitude: number; userId: string; timezone: string | null }[] = [];
  const seen = new Set<string>();

  // Own terrains
  if (userId) {
    const { data: own } = await supabase
      .from('terrains')
      .select('id, name, city, type, location, user_id, timezone')
      .eq('user_id', userId);
    (own || []).forEach((t: any) => {
      if (t.location?.latitude && t.location?.longitude && !seen.has(t.id)) {
        seen.add(t.id);
        results.push({ id: t.id, name: t.name, city: t.city, type: t.type, latitude: t.location.latitude, longitude: t.location.longitude, userId: t.user_id, timezone: t.timezone || null });
      }
    });
  }

  // Public terrains
  const { data: pub } = await supabase
    .from('terrains')
    .select('id, name, city, type, location, user_id, timezone')
    .eq('is_public', true);
  (pub || []).forEach((t: any) => {
    if (t.location?.latitude && t.location?.longitude && !seen.has(t.id)) {
      seen.add(t.id);
      results.push({ id: t.id, name: t.name, city: t.city, type: t.type, latitude: t.location.latitude, longitude: t.location.longitude, userId: t.user_id, timezone: t.timezone || null });
    }
  });

  return results;
}

/**
 * Compute activity score for a terrain at the current time.
 *
 * All day-of-week / hour-of-day comparisons are performed in the FACILITY'S
 * local timezone rather than the device's, so a match logged Friday 20:00
 * Paris time is scored against the Friday-20:00 slot regardless of whether
 * the current user is in Paris, Montreal, or Tokyo. This also makes the
 * "today" comparison for meetups/tournaments robust to the UTC-midnight
 * boundary (before this fix, a match at 22:00 UTC-3 could fall on the wrong
 * ISO day).
 *
 * Factors: match history (same facility-local weekday + hour), meetups today,
 * tournaments today (all evaluated in facility time).
 */
async function computeTerrainActivityScore(
  terrainId: string,
  now: Date,
  language: string,
  terrainTimezone: string | null | undefined
): Promise<{ score: number; label: string; hasMeetupToday: boolean; hasTournamentToday: boolean; matchCountAtSlot: number }> {
  const supabase = getSupabaseClient();
  const parsedTz = parseTerrainTimezone(terrainTimezone);
  // Facility-local "now" components (used everywhere below)
  const currentDow = getWeekdayInTimezone(now, parsedTz);
  const currentHour = getHourInTimezone(now, parsedTz);
  const todayStr = getDateStringInTimezone(now, parsedTz);

  let score = 0;
  let matchCountAtSlot = 0;
  let sameDayCount = 0;

  // Fetch matches at this terrain
  const { data: matches } = await supabase
    .from('matches')
    .select('date')
    .eq('terrain_id', terrainId)
    .limit(200);

  (matches || []).forEach((m: any) => {
    const d = new Date(m.date);
    if (!Number.isFinite(d.getTime())) return;
    // Compare in facility timezone, NOT device timezone
    const matchDow = getWeekdayInTimezone(d, parsedTz);
    const matchHour = getHourInTimezone(d, parsedTz);
    if (matchDow === currentDow) {
      sameDayCount++;
      score += 3;
      if (Math.abs(matchHour - currentHour) <= 2) {
        matchCountAtSlot++;
        score += 10;
      }
    }
  });

  // Fetch meetups today at this terrain
  const { data: meetups } = await supabase
    .from('terrain_meetups')
    .select('id, date, status')
    .eq('terrain_id', terrainId)
    .eq('status', 'active');

  let hasMeetupToday = false;
  (meetups || []).forEach((mt: any) => {
    const mtDate = new Date(mt.date);
    if (!Number.isFinite(mtDate.getTime())) return;
    // Compare in facility timezone to avoid UTC-midnight boundary bugs
    if (getDateStringInTimezone(mtDate, parsedTz) === todayStr) {
      hasMeetupToday = true;
      score += 30; // Meetup today = very high signal
    }
  });

  // Fetch tournaments today at this terrain
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, date, status')
    .eq('terrain_id', terrainId)
    .in('status', ['En cours', 'À venir']);

  let hasTournamentToday = false;
  (tournaments || []).forEach((t: any) => {
    if (t.date) {
      const tDate = new Date(t.date);
      if (Number.isFinite(tDate.getTime()) && getDateStringInTimezone(tDate, parsedTz) === todayStr) {
        hasTournamentToday = true;
        score += 25;
      }
    }
    if (t.status === 'En cours') {
      score += 15;
    }
  });

  // Build label
  const dayNames = language === 'fr' ? ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let label = '';
  if (hasMeetupToday) {
    label = language === 'fr' ? 'RDV prevu aujourd\'hui' : 'Meetup scheduled today';
  } else if (hasTournamentToday) {
    label = language === 'fr' ? 'Tournoi aujourd\'hui' : 'Tournament today';
  } else if (matchCountAtSlot > 0) {
    label = `${matchCountAtSlot} ${language === 'fr' ? 'partie(s)' : 'game(s)'} ${dayNames[currentDow]} ~${currentHour}h`;
  } else if (sameDayCount > 0) {
    label = `${sameDayCount} ${language === 'fr' ? 'partie(s) le' : 'game(s) on'} ${dayNames[currentDow]}`;
  }

  return { score, label, hasMeetupToday, hasTournamentToday, matchCountAtSlot };
}

/**
 * Main function: Find nearby active terrains.
 * 
 * @param radiusMeters - Search radius in meters (default 3000m = 3km)
 * @param language - 'fr' or 'en'
 * @returns Array of nearby active terrains sorted by proximity
 */
export async function findNearbyActiveTerrains(
  radiusMeters: number = 3000,
  language: string = 'fr'
): Promise<{ terrains: NearbyActiveTerrain[]; userLocation: { latitude: number; longitude: number } | null; error: string | null }> {
  try {
    // 1. Get user location
    const userLoc = await getUserLocation();
    if (!userLoc) {
      return { terrains: [], userLocation: null, error: 'location_unavailable' };
    }

    // 2. Fetch all geolocated terrains
    const allTerrains = await fetchTerrainsWithLocations();
    if (allTerrains.length === 0) {
      return { terrains: [], userLocation: userLoc, error: null };
    }

    // 3. Filter by proximity
    const now = new Date();
    const nearbyTerrains = allTerrains
      .map(t => ({
        ...t,
        distance: haversineDistance(userLoc.latitude, userLoc.longitude, t.latitude, t.longitude),
      }))
      .filter(t => t.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance);

    if (nearbyTerrains.length === 0) {
      return { terrains: [], userLocation: userLoc, error: null };
    }

    // 4. Compute activity scores (limit to top 10 closest to avoid too many queries)
    const candidates = nearbyTerrains.slice(0, 10);
    const results: NearbyActiveTerrain[] = [];

    for (const t of candidates) {
      const activity = await computeTerrainActivityScore(t.id, now, language, t.timezone);
      if (activity.score > 0) {
        results.push({
          id: t.id,
          name: t.name,
          city: t.city,
          type: t.type,
          distance: Math.round(t.distance),
          activityScore: activity.score,
          activityLabel: activity.label,
          latitude: t.latitude,
          longitude: t.longitude,
          hasMeetupToday: activity.hasMeetupToday,
          hasTournamentToday: activity.hasTournamentToday,
          matchCountAtSlot: activity.matchCountAtSlot,
        });
      }
    }

    // Sort by activity score descending
    results.sort((a, b) => b.activityScore - a.activityScore);

    return { terrains: results, userLocation: userLoc, error: null };
  } catch (e: any) {
    console.log('[ProximityService] Error:', e.message);
    return { terrains: [], userLocation: null, error: e.message };
  }
}

/**
 * Format distance for display.
 */
export function formatDistance(meters: number, language: string): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km}km`;
}
