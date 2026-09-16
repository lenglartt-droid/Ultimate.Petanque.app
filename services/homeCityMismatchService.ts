/**
 * Home City Mismatch Detection
 *
 * Detects when a user's recent matches are consistently played more than
 * 300 km away from their declared home city. Used to suggest a profile
 * city update via a non-intrusive banner on the Home tab.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';
import { haversineDistanceKm } from '@/services/trustScoreService';

const LAST_PROMPT_KEY = '@home_city_mismatch_last_prompt';
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DISTANCE_THRESHOLD_KM = 300;
const RECENT_MATCH_LIMIT = 20;
const MIN_MATCHES_WITH_GEO = 5;
const MISMATCH_RATIO_THRESHOLD = 0.6; // 60%

export interface HomeCityMismatchResult {
  detected: boolean;
  mismatchCount: number;
  totalMatchesWithGeo: number;
  ratio: number; // 0..1
  homeCity: string;
  dominantCity?: string;
  dominantCityCount?: number;
  averageDistanceKm: number;
}

export async function detectHomeCityMismatch(params: {
  playerLat: number | null | undefined;
  playerLng: number | null | undefined;
  playerCity: string | null | undefined;
}): Promise<HomeCityMismatchResult | null> {
  const { playerLat, playerLng, playerCity } = params;
  if (!playerCity) return null;
  if (!Number.isFinite(playerLat) || !Number.isFinite(playerLng)) return null;
  const lat = playerLat as number;
  const lng = playerLng as number;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null;

  // Cooldown check
  try {
    const lastPrompt = await AsyncStorage.getItem(LAST_PROMPT_KEY);
    if (lastPrompt && Date.now() - parseInt(lastPrompt, 10) < PROMPT_COOLDOWN_MS) return null;
  } catch {
    /* silent */
  }

  const supabase = getSupabaseClient();
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return null;

    const { data: matches } = await supabase
      .from('matches')
      .select('id, terrain_id, date')
      .eq('user_id', uid)
      .not('terrain_id', 'is', null)
      .order('date', { ascending: false })
      .limit(RECENT_MATCH_LIMIT);

    const terrainIds = Array.from(
      new Set((matches || []).map((m: any) => m.terrain_id).filter(Boolean)),
    ) as string[];
    if (terrainIds.length === 0) return null;

    const { data: terrains } = await supabase
      .from('terrains')
      .select('id, city, location')
      .in('id', terrainIds);

    const coordsMap = new Map<string, { lat: number; lng: number; city?: string }>();
    for (const t of terrains || []) {
      const tlat = t.location?.latitude;
      const tlng = t.location?.longitude;
      if (Number.isFinite(tlat) && Number.isFinite(tlng)) {
        coordsMap.set(t.id, { lat: tlat, lng: tlng, city: t.city });
      }
    }

    let mismatchCount = 0;
    let totalWithGeo = 0;
    let sumDistance = 0;
    const cityFreq = new Map<string, number>();
    for (const m of matches || []) {
      const c = coordsMap.get(m.terrain_id);
      if (!c) continue;
      totalWithGeo++;
      const dist = haversineDistanceKm(lat, lng, c.lat, c.lng);
      if (dist > DISTANCE_THRESHOLD_KM) {
        mismatchCount++;
        sumDistance += dist;
        if (c.city) cityFreq.set(c.city, (cityFreq.get(c.city) || 0) + 1);
      }
    }

    if (totalWithGeo < MIN_MATCHES_WITH_GEO) return null;
    const ratio = mismatchCount / totalWithGeo;
    if (ratio < MISMATCH_RATIO_THRESHOLD) return null;

    let dominantCity: string | undefined;
    let dominantCityCount = 0;
    for (const [city, count] of cityFreq) {
      if (count > dominantCityCount) {
        dominantCity = city;
        dominantCityCount = count;
      }
    }

    return {
      detected: true,
      mismatchCount,
      totalMatchesWithGeo: totalWithGeo,
      ratio,
      homeCity: playerCity,
      dominantCity,
      dominantCityCount,
      averageDistanceKm: mismatchCount > 0 ? Math.round(sumDistance / mismatchCount) : 0,
    };
  } catch {
    return null;
  }
}

export async function markHomeCityMismatchPromptShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
  } catch {
    /* silent */
  }
}

export async function resetHomeCityMismatchCooldown(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_PROMPT_KEY);
  } catch {
    /* silent */
  }
}
