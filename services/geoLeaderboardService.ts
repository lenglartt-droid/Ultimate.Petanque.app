/**
 * Geo Leaderboard Service
 * Aggregates player stats by city, country, and continent for geographic rankings.
 */
import { getSupabaseClient } from '@/template';
import { getContinent } from '@/constants/geoData';
import { LEADERBOARD_MIN_MATCHES } from '@/services/leaderboardService';

export interface GeoEntry {
  key: string; // city name, country name, or continent key
  label: string;
  playerCount: number;
  avgElo: number;
  totalMatches: number;
  avgWinRate: number;
  avgTrustScore: number;
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
  id: string;
}

export interface PlayerGeoRank {
  city: { name: string; rank: number; total: number } | null;
  country: { name: string; rank: number; total: number } | null;
  continent: { name: string; rank: number; total: number } | null;
}

/**
 * Fetch a specific player's geographic ranking (city, country, continent).
 * Returns the player's rank position in each geographic level.
 * Only players with 3+ multi-player matches are included in the ranking pool.
 * Also returns the target player's multi-player match count for progress UI.
 */
export async function fetchPlayerGeoRank(playerId: string): Promise<{ geoRank: PlayerGeoRank | null; multiPlayerMatchCount: number; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    // Get the target player
    const { data: targetPlayer, error: tpError } = await supabase
      .from('players')
      .select('id, name, city, country, elo_rating, is_public')
      .eq('id', playerId)
      .single();

    if (tpError || !targetPlayer) {
      return { geoRank: null, multiPlayerMatchCount: 0, error: tpError?.message || 'Player not found' };
    }

    if (!targetPlayer.is_public) {
      return { geoRank: null, multiPlayerMatchCount: 0, error: null };
    }

    const playerCity = targetPlayer.city || null;
    const playerCountry = targetPlayer.country || 'France';
    const playerContinent = getContinent(playerCountry);

    // Fetch all public real-profile players
    const { data: allPublicPlayers } = await supabase
      .from('players')
      .select('id, user_id, city, country, elo_rating')
      .eq('is_public', true)
      .order('elo_rating', { ascending: false });

    const realPlayers = (allPublicPlayers || []).filter((p: any) => p.user_id && p.id === p.user_id);
    const realPlayerIds = realPlayers.map((p: any) => p.id);

    // Count multi-player matches per player (participant_user_ids >= 2)
    const multiPlayerCountMap = new Map<string, number>();
    if (realPlayerIds.length > 0) {
      const { data: allMatches } = await supabase
        .from('matches')
        .select('team_a, team_b, participant_user_ids');

      if (allMatches) {
        for (const m of allMatches) {
          const participantIds: string[] = m.participant_user_ids || [];
          if (participantIds.length < 2) continue;
          const teamAPlayers: string[] = m.team_a?.players || [];
          const teamBPlayers: string[] = m.team_b?.players || [];
          const allMatchPlayers = [...teamAPlayers, ...teamBPlayers];
          for (const pid of allMatchPlayers) {
            if (realPlayerIds.includes(pid)) {
              multiPlayerCountMap.set(pid, (multiPlayerCountMap.get(pid) || 0) + 1);
            }
          }
        }
      }
    }

    const targetMultiPlayerCount = multiPlayerCountMap.get(playerId) || 0;

    // If the target player is not qualified, return null geo rank with progress info
    if (targetMultiPlayerCount < LEADERBOARD_MIN_MATCHES) {
      return { geoRank: null, multiPlayerMatchCount: targetMultiPlayerCount, error: null };
    }

    // Filter to only qualified players (3+ multi-player matches)
    const qualifiedPlayers = realPlayers.filter((p: any) => {
      const count = multiPlayerCountMap.get(p.id) || 0;
      return count >= LEADERBOARD_MIN_MATCHES;
    });

    const result: PlayerGeoRank = { city: null, country: null, continent: null };

    // City rank
    if (playerCity) {
      const cityPlayers = qualifiedPlayers.filter((p: any) => p.city === playerCity);
      if (cityPlayers.length > 0) {
        const rank = cityPlayers.findIndex((p: any) => p.id === playerId) + 1;
        result.city = { name: playerCity, rank: rank > 0 ? rank : cityPlayers.length, total: cityPlayers.length };
      }
    }

    // Country rank
    const countryPlayers = qualifiedPlayers.filter((p: any) => (p.country || 'France') === playerCountry);
    if (countryPlayers.length > 0) {
      const rank = countryPlayers.findIndex((p: any) => p.id === playerId) + 1;
      result.country = { name: playerCountry, rank: rank > 0 ? rank : countryPlayers.length, total: countryPlayers.length };
    }

    // Continent rank
    const continentPlayers = qualifiedPlayers.filter((p: any) => getContinent(p.country || 'France') === playerContinent);
    if (continentPlayers.length > 0) {
      const rank = continentPlayers.findIndex((p: any) => p.id === playerId) + 1;
      result.continent = { name: playerContinent, rank: rank > 0 ? rank : continentPlayers.length, total: continentPlayers.length };
    }

    return { geoRank: result, multiPlayerMatchCount: targetMultiPlayerCount, error: null };
  } catch (err: any) {
    console.error('[GeoRank] Error:', err);
    return { geoRank: null, multiPlayerMatchCount: 0, error: err.message || 'Failed to fetch geo rank' };
  }
}

/**
 * Fetch geo leaderboard in PREVIEW mode (no minimum match filter).
 * Used to show unofficial rankings when no fully qualified players exist.
 */
export async function fetchGeoLeaderboardPreview(): Promise<{
  cities: GeoEntry[];
  countries: GeoEntry[];
  continents: GeoEntry[];
  error: string | null;
}> {
  const supabase = getSupabaseClient();
  try {
    const { data: authUsers } = await supabase.from('user_profiles').select('id');
    const authIdSet = new Set((authUsers || []).map((u: any) => u.id));

    const { data: rawPlayers, error } = await supabase
      .from('players')
      .select('id, user_id, name, city, country, elo_rating, stats, is_public')
      .eq('is_public', true);

    if (error) throw error;

    // Only real authenticated self-players (no match threshold)
    const players = (rawPlayers || []).filter((p: any) => p.user_id && p.id === p.user_id && authIdSet.has(p.id));

    if (players.length === 0) {
      return { cities: [], countries: [], continents: [], error: null };
    }

    const cityMap = new Map<string, { players: PlayerRow[]; country: string }>();
    const countryMap = new Map<string, PlayerRow[]>();
    const continentMap = new Map<string, PlayerRow[]>();

    for (const p of players as PlayerRow[]) {
      const country = p.country || 'France';
      const city = p.city || null;
      const continent = getContinent(country);
      if (city) {
        if (!cityMap.has(city)) cityMap.set(city, { players: [], country });
        cityMap.get(city)!.players.push(p);
      }
      if (!countryMap.has(country)) countryMap.set(country, []);
      countryMap.get(country)!.push(p);
      if (!continentMap.has(continent)) continentMap.set(continent, []);
      continentMap.get(continent)!.push(p);
    }

    const buildEntries = (map: Map<string, PlayerRow[]>): GeoEntry[] => {
      const entries: GeoEntry[] = [];
      for (const [key, group] of map.entries()) {
        const totalMatches = group.reduce((sum, p) => sum + (p.stats?.matchesPlayed || 0), 0);
        const avgElo = Math.round(group.reduce((sum, p) => sum + (p.elo_rating || 1000), 0) / group.length);
        const totalWinRate = group.reduce((sum, p) => sum + (p.stats?.winRate || 0), 0);
        const avgWinRate = Math.round((totalWinRate / group.length) * 10) / 10;
        const topPlayer = group.reduce((best, p) => (p.elo_rating || 1000) > (best.elo_rating || 1000) ? p : best, group[0]);
        entries.push({ key, label: key, playerCount: group.length, avgElo, totalMatches, avgWinRate, avgTrustScore: 50, topPlayer: { name: topPlayer.name, elo: topPlayer.elo_rating || 1000 } });
      }
      return entries.sort((a, b) => {
        const scoreA = a.playerCount * a.avgElo;
        const scoreB = b.playerCount * b.avgElo;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.avgElo - a.avgElo;
      });
    };

    const cityEntries: GeoEntry[] = [];
    for (const [city, { players: group }] of cityMap.entries()) {
      const totalMatches = group.reduce((sum, p) => sum + (p.stats?.matchesPlayed || 0), 0);
      const avgElo = Math.round(group.reduce((sum, p) => sum + (p.elo_rating || 1000), 0) / group.length);
      const totalWinRate = group.reduce((sum, p) => sum + (p.stats?.winRate || 0), 0);
      const avgWinRate = Math.round((totalWinRate / group.length) * 10) / 10;
      const topPlayer = group.reduce((best, p) => (p.elo_rating || 1000) > (best.elo_rating || 1000) ? p : best, group[0]);
      cityEntries.push({ key: city, label: city, playerCount: group.length, avgElo, totalMatches, avgWinRate, avgTrustScore: 50, topPlayer: { name: topPlayer.name, elo: topPlayer.elo_rating || 1000 } });
    }
    cityEntries.sort((a, b) => (b.playerCount * b.avgElo) - (a.playerCount * a.avgElo));

    const countries2 = buildEntries(countryMap);
    const continents2 = buildEntries(continentMap);

    return { cities: cityEntries, countries: countries2, continents: continents2, error: null };
  } catch (err: any) {
    return { cities: [], countries: [], continents: [], error: err.message || 'Preview failed' };
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
    // Fetch auth user IDs to verify real accounts
    const { data: authUsers } = await supabase.from('user_profiles').select('id');
    const authIdSet = new Set((authUsers || []).map((u: any) => u.id));

    // Fetch all public players with stats
    const { data: rawPlayers, error } = await supabase
      .from('players')
      .select('id, user_id, name, city, country, elo_rating, stats, is_public')
      .eq('is_public', true);

    // Filter to only REAL authenticated user profiles:
    // 1. player.id === player.user_id (self-player)
    // 2. player.id exists in user_profiles (confirmed auth account)
    const realPlayers = (rawPlayers || []).filter((p: any) => p.user_id && p.id === p.user_id && authIdSet.has(p.id));

    // ANTI-CHEAT: Only include players with minimum multi-player matches
    // Fetch matches with participant_user_ids to count multi-player matches per player
    const realPlayerIds = realPlayers.map((p: any) => p.id);
    let multiPlayerCountMap = new Map<string, number>();
    if (realPlayerIds.length > 0) {
      const { data: matchesData } = await supabase
        .from('matches')
        .select('id, team_a, team_b, participant_user_ids')
        .or(realPlayerIds.map(id => `team_a->>players.cs.${id}`).join(','));

      // Simpler approach: fetch all matches and count per player
      const { data: allMatches } = await supabase
        .from('matches')
        .select('team_a, team_b, participant_user_ids');

      if (allMatches) {
        for (const m of allMatches) {
          const participantIds: string[] = m.participant_user_ids || [];
          if (participantIds.length < 2) continue;
          const teamAPlayers: string[] = m.team_a?.players || [];
          const teamBPlayers: string[] = m.team_b?.players || [];
          const allMatchPlayers = [...teamAPlayers, ...teamBPlayers];
          for (const pid of allMatchPlayers) {
            if (realPlayerIds.includes(pid)) {
              multiPlayerCountMap.set(pid, (multiPlayerCountMap.get(pid) || 0) + 1);
            }
          }
        }
      }
    }

    // Only include players meeting minimum multi-player match threshold
    const players = realPlayers.filter((p: any) => {
      const count = multiPlayerCountMap.get(p.id) || 0;
      return count >= LEADERBOARD_MIN_MATCHES;
    });

    // Fetch trust scores for all public players
    const playerIds = players.map((p: any) => p.id);
    let trustMap = new Map<string, number>();
    if (playerIds.length > 0) {
      try {
        const { data: trustData } = await supabase
          .from('suspicious_players')
          .select('player_id, trust_score')
          .in('player_id', playerIds);
        if (trustData) {
          trustData.forEach((t: any) => trustMap.set(t.player_id, t.trust_score));
        }
      } catch { /* silent */ }
    }

    if (error) throw error;

    if (players.length === 0) {
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
        // Compute average trust score (default 50 if no score found)
        const totalTrust = group.reduce((sum, p) => sum + (trustMap.get(p.id) ?? 50), 0);
        const avgTrustScore = Math.round(totalTrust / group.length);

        entries.push({
          key,
          label: getLabel(key),
          playerCount: group.length,
          avgElo,
          totalMatches,
          avgWinRate,
          avgTrustScore,
          topPlayer: { name: topPlayer.name, elo: topPlayer.elo_rating || 1000 },
          flag: getFlag ? getFlag(key) : undefined,
        });
      }
      // Sort by composite score: players * avgElo, with tiebreakers
      return entries.sort((a, b) => {
        const scoreA = a.playerCount * a.avgElo;
        const scoreB = b.playerCount * b.avgElo;
        if (scoreB !== scoreA) return scoreB - scoreA;
        if (b.avgElo !== a.avgElo) return b.avgElo - a.avgElo;
        if (b.avgWinRate !== a.avgWinRate) return b.avgWinRate - a.avgWinRate;
        if (b.totalMatches !== a.totalMatches) return b.totalMatches - a.totalMatches;
        return a.key.localeCompare(b.key);
      });
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

      // Compute average trust score for city
      const totalTrust = group.reduce((sum, p) => sum + (trustMap.get(p.id) ?? 50), 0);
      const avgTrustScore = Math.round(totalTrust / group.length);

      cityEntries.push({
        key: city,
        label: city,
        playerCount: group.length,
        avgElo,
        totalMatches,
        avgWinRate,
        avgTrustScore,
        topPlayer: { name: topPlayer.name, elo: topPlayer.elo_rating || 1000 },
        flag: undefined,
      });
    }
    cityEntries.sort((a, b) => {
      const scoreA = a.playerCount * a.avgElo;
      const scoreB = b.playerCount * b.avgElo;
      if (scoreB !== scoreA) return scoreB - scoreA;
      if (b.avgElo !== a.avgElo) return b.avgElo - a.avgElo;
      if (b.avgWinRate !== a.avgWinRate) return b.avgWinRate - a.avgWinRate;
      if (b.totalMatches !== a.totalMatches) return b.totalMatches - a.totalMatches;
      return a.key.localeCompare(b.key);
    });

    const countries = buildEntries(countryMap, (k) => k);
    const continents = buildEntries(continentMap, (k) => k);

    return { cities: cityEntries, countries, continents, error: null };
  } catch (err: any) {
    console.error('[GeoLeaderboard] Error:', err);
    return { cities: [], countries: [], continents: [], error: err.message || 'Failed to load geo leaderboard' };
  }
}
