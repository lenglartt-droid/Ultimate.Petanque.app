/**
 * Geo Leaderboard Service
 * Aggregates player stats by city, country, and continent for geographic rankings.
 */
import { getSupabaseClient } from '@/template';
import { getContinent } from '@/constants/geoData';

export interface GeoEntry {
  key: string; // city name, country name, or continent key
  label: string;
  playerCount: number;
  avgElo: number;
  totalMatches: number;
  avgWinRate: number;
  topPlayer?: { name: string; elo: number };
  flag?: string;
}

interface PlayerRow {
  name: string;
  city: string | null;
  country: string | null;
  elo_rating: number;
  stats: any;
  is_public: boolean;
}

export interface PlayerGeoRank {
  city: { name: string; rank: number; total: number } | null;
  country: { name: string; rank: number; total: number } | null;
  continent: { name: string; rank: number; total: number } | null;
}

/**
 * Fetch a specific player's geographic ranking (city, country, continent).
 * Returns the player's rank position in each geographic level.
 */
export async function fetchPlayerGeoRank(playerId: string): Promise<{ geoRank: PlayerGeoRank | null; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    // Get the target player
    const { data: targetPlayer, error: tpError } = await supabase
      .from('players')
      .select('id, name, city, country, elo_rating, is_public')
      .eq('id', playerId)
      .single();

    if (tpError || !targetPlayer) {
      return { geoRank: null, error: tpError?.message || 'Player not found' };
    }

    if (!targetPlayer.is_public) {
      return { geoRank: null, error: null };
    }

    const playerElo = targetPlayer.elo_rating || 1000;
    const playerCity = targetPlayer.city || null;
    const playerCountry = targetPlayer.country || 'France';
    const playerContinent = getContinent(playerCountry);

    const result: PlayerGeoRank = { city: null, country: null, continent: null };

    // City rank
    if (playerCity) {
      const { data: cityPlayers } = await supabase
        .from('players')
        .select('id, elo_rating')
        .eq('city', playerCity)
        .eq('is_public', true)
        .order('elo_rating', { ascending: false });

      if (cityPlayers && cityPlayers.length > 0) {
        const rank = cityPlayers.findIndex(p => p.id === playerId) + 1;
        result.city = { name: playerCity, rank: rank > 0 ? rank : cityPlayers.length, total: cityPlayers.length };
      }
    }

    // Country rank
    const { data: countryPlayers } = await supabase
      .from('players')
      .select('id, elo_rating')
      .eq('country', playerCountry)
      .eq('is_public', true)
      .order('elo_rating', { ascending: false });

    if (countryPlayers && countryPlayers.length > 0) {
      const rank = countryPlayers.findIndex(p => p.id === playerId) + 1;
      result.country = { name: playerCountry, rank: rank > 0 ? rank : countryPlayers.length, total: countryPlayers.length };
    }

    // Continent rank — need all public players in the continent
    // Get all countries in same continent
    const { data: continentPlayers } = await supabase
      .from('players')
      .select('id, country, elo_rating')
      .eq('is_public', true)
      .order('elo_rating', { ascending: false });

    if (continentPlayers && continentPlayers.length > 0) {
      const sameContinent = continentPlayers.filter(p => getContinent(p.country || 'France') === playerContinent);
      if (sameContinent.length > 0) {
        const rank = sameContinent.findIndex(p => p.id === playerId) + 1;
        result.continent = { name: playerContinent, rank: rank > 0 ? rank : sameContinent.length, total: sameContinent.length };
      }
    }

    return { geoRank: result, error: null };
  } catch (err: any) {
    console.error('[GeoRank] Error:', err);
    return { geoRank: null, error: err.message || 'Failed to fetch geo rank' };
  }
}

export async function fetchGeoLeaderboard(): Promise<{
  cities: GeoEntry[];
  countries: GeoEntry[];
  continents: GeoEntry[];
  error: string | null;
}> {
  const supabase = getSupabaseClient();

  try {
    // Fetch all public players with stats
    const { data: players, error } = await supabase
      .from('players')
      .select('name, city, country, elo_rating, stats, is_public')
      .eq('is_public', true);

    if (error) throw error;

    if (!players || players.length === 0) {
      return { cities: [], countries: [], continents: [], error: null };
    }

    const cityMap = new Map<string, { players: PlayerRow[]; country: string }>();
    const countryMap = new Map<string, PlayerRow[]>();
    const continentMap = new Map<string, PlayerRow[]>();

    for (const p of players as PlayerRow[]) {
      const country = p.country || 'France';
      const city = p.city || null;
      const continent = getContinent(country);

      // City aggregation
      if (city) {
        if (!cityMap.has(city)) cityMap.set(city, { players: [], country });
        cityMap.get(city)!.players.push(p);
      }

      // Country aggregation
      if (!countryMap.has(country)) countryMap.set(country, []);
      countryMap.get(country)!.push(p);

      // Continent aggregation
      if (!continentMap.has(continent)) continentMap.set(continent, []);
      continentMap.get(continent)!.push(p);
    }

    const buildEntries = (
      map: Map<string, PlayerRow[]>,
      getLabel: (key: string) => string,
      getFlag?: (key: string) => string
    ): GeoEntry[] => {
      const entries: GeoEntry[] = [];
      for (const [key, group] of map.entries()) {
        const totalMatches = group.reduce((sum, p) => sum + (p.stats?.matchesPlayed || 0), 0);
        const avgElo = Math.round(group.reduce((sum, p) => sum + (p.elo_rating || 1000), 0) / group.length);
        const totalWinRate = group.reduce((sum, p) => sum + (p.stats?.winRate || 0), 0);
        const avgWinRate = Math.round((totalWinRate / group.length) * 10) / 10;
        const topPlayer = group.reduce((best, p) =>
          (p.elo_rating || 1000) > (best.elo_rating || 1000) ? p : best, group[0]);

        entries.push({
          key,
          label: getLabel(key),
          playerCount: group.length,
          avgElo,
          totalMatches,
          avgWinRate,
          topPlayer: { name: topPlayer.name, elo: topPlayer.elo_rating || 1000 },
          flag: getFlag ? getFlag(key) : undefined,
        });
      }
      // Sort by composite score: players * avgElo
      return entries.sort((a, b) => (b.playerCount * b.avgElo) - (a.playerCount * a.avgElo));
    };

    // Build city entries using cityMap (needs slightly different handling)
    const cityEntries: GeoEntry[] = [];
    for (const [city, { players: group, country }] of cityMap.entries()) {
      const totalMatches = group.reduce((sum, p) => sum + (p.stats?.matchesPlayed || 0), 0);
      const avgElo = Math.round(group.reduce((sum, p) => sum + (p.elo_rating || 1000), 0) / group.length);
      const totalWinRate = group.reduce((sum, p) => sum + (p.stats?.winRate || 0), 0);
      const avgWinRate = Math.round((totalWinRate / group.length) * 10) / 10;
      const topPlayer = group.reduce((best, p) =>
        (p.elo_rating || 1000) > (best.elo_rating || 1000) ? p : best, group[0]);

      cityEntries.push({
        key: city,
        label: city,
        playerCount: group.length,
        avgElo,
        totalMatches,
        avgWinRate,
        topPlayer: { name: topPlayer.name, elo: topPlayer.elo_rating || 1000 },
        flag: undefined,
      });
    }
    cityEntries.sort((a, b) => (b.playerCount * b.avgElo) - (a.playerCount * a.avgElo));

    const countries = buildEntries(countryMap, (k) => k);
    const continents = buildEntries(continentMap, (k) => k);

    return { cities: cityEntries, countries, continents, error: null };
  } catch (err: any) {
    console.error('[GeoLeaderboard] Error:', err);
    return { cities: [], countries: [], continents: [], error: err.message || 'Failed to load geo leaderboard' };
  }
}
