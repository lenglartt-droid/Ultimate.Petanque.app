// ============================================
// Club Leaderboard Service
// Aggregates public player stats by club
// ============================================
import { getSupabaseClient } from '@/template';
import { fetchLeaderboard, LeaderboardPlayer, LeaderboardPeriod } from './leaderboardService';

export interface LeaderboardClub {
  id: string; // club name as ID (no club table join needed for public)
  name: string;
  city?: string;
  country?: string;
  logo?: string;
  playerCount: number;
  totalMatches: number;
  stats: {
    avgWinRate: number;
    avgTirRate: number;
    avgPointRate: number;
    avgCarreauRate: number;
    totalWins: number;
    totalLosses: number;
    compositeScore: number; // weighted: 40% winRate + 25% tirRate + 20% carreauRate + 15% activity
  };
  topPlayers: { name: string; avatar?: string; winRate: number }[];
}

export type ClubLeaderboardSort = 'compositeScore' | 'avgWinRate' | 'totalMatches' | 'playerCount' | 'avgTirRate' | 'avgCarreauRate';

export async function fetchClubLeaderboard(period?: LeaderboardPeriod): Promise<{ clubs: LeaderboardClub[]; error: string | null }> {
  try {
    const { players, error } = await fetchLeaderboard(period);
    if (error) return { clubs: [], error };

    // Group players by club
    const clubMap = new Map<string, LeaderboardPlayer[]>();
    for (const p of players) {
      if (!p.club) continue;
      const existing = clubMap.get(p.club) || [];
      existing.push(p);
      clubMap.set(p.club, existing);
    }

    // Try to fetch club details (logo, city) for matched clubs
    const supabase = getSupabaseClient();
    const clubNames = [...clubMap.keys()];
    let clubDetails = new Map<string, { logo?: string; city?: string; country?: string; id?: string }>();

    if (clubNames.length > 0) {
      try {
        const { data: clubsData } = await supabase
          .from('clubs')
          .select('id, name, logo, city, country')
          .eq('is_public', true);

        if (clubsData) {
          for (const c of clubsData) {
            clubDetails.set(c.name, {
              id: c.id,
              logo: c.logo || undefined,
              city: c.city || undefined,
              country: c.country || undefined,
            });
          }
        }
      } catch { /* silent */ }
    }

    const clubs: LeaderboardClub[] = [];

    for (const [clubName, clubPlayers] of clubMap) {
      if (clubPlayers.length === 0) continue;

      const totalMatches = clubPlayers.reduce((sum, p) => sum + p.stats.matchesPlayed, 0);
      const totalWins = clubPlayers.reduce((sum, p) => sum + p.stats.wins, 0);
      const totalLosses = clubPlayers.reduce((sum, p) => sum + p.stats.losses, 0);

      const avgWinRate = Math.round(clubPlayers.reduce((sum, p) => sum + p.stats.winRate, 0) / clubPlayers.length);
      const avgTirRate = Math.round(
        clubPlayers.filter(p => p.stats.tirRate > 0).reduce((sum, p) => sum + p.stats.tirRate, 0) /
        Math.max(1, clubPlayers.filter(p => p.stats.tirRate > 0).length)
      );
      const avgPointRate = Math.round(
        clubPlayers.filter(p => p.stats.pointRate > 0).reduce((sum, p) => sum + p.stats.pointRate, 0) /
        Math.max(1, clubPlayers.filter(p => p.stats.pointRate > 0).length)
      );
      const avgCarreauRate = Math.round(
        clubPlayers.filter(p => p.stats.carreauRate > 0).reduce((sum, p) => sum + p.stats.carreauRate, 0) /
        Math.max(1, clubPlayers.filter(p => p.stats.carreauRate > 0).length)
      );

      // Activity score: normalize based on matches per player (max 50 matches/player → 100)
      const activityScore = Math.min(100, Math.round((totalMatches / clubPlayers.length / 50) * 100));

      // Composite score: weighted combination
      const compositeScore = Math.round(
        avgWinRate * 0.40 +
        avgTirRate * 0.25 +
        avgCarreauRate * 0.20 +
        activityScore * 0.15
      );

      const detail = clubDetails.get(clubName);

      // Top 3 players by win rate
      const topPlayers = [...clubPlayers]
        .sort((a, b) => b.stats.winRate - a.stats.winRate)
        .slice(0, 3)
        .map(p => ({ name: p.name, avatar: p.avatar, winRate: p.stats.winRate }));

      clubs.push({
        id: detail?.id || clubName,
        name: clubName,
        city: detail?.city || clubPlayers[0]?.city,
        country: detail?.country || clubPlayers[0]?.country,
        logo: detail?.logo,
        playerCount: clubPlayers.length,
        totalMatches,
        stats: {
          avgWinRate,
          avgTirRate,
          avgPointRate,
          avgCarreauRate,
          totalWins,
          totalLosses,
          compositeScore,
        },
        topPlayers,
      });
    }

    return { clubs, error: null };
  } catch (e: any) {
    return { clubs: [], error: e.message || 'Club leaderboard error' };
  }
}

export function sortClubLeaderboard(clubs: LeaderboardClub[], sortBy: ClubLeaderboardSort): LeaderboardClub[] {
  return [...clubs].sort((a, b) => {
    switch (sortBy) {
      case 'compositeScore':
        if (b.stats.compositeScore !== a.stats.compositeScore) return b.stats.compositeScore - a.stats.compositeScore;
        return b.totalMatches - a.totalMatches;
      case 'avgWinRate':
        if (b.stats.avgWinRate !== a.stats.avgWinRate) return b.stats.avgWinRate - a.stats.avgWinRate;
        return b.totalMatches - a.totalMatches;
      case 'totalMatches':
        return b.totalMatches - a.totalMatches;
      case 'playerCount':
        if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount;
        return b.stats.compositeScore - a.stats.compositeScore;
      case 'avgTirRate':
        if (b.stats.avgTirRate !== a.stats.avgTirRate) return b.stats.avgTirRate - a.stats.avgTirRate;
        return b.totalMatches - a.totalMatches;
      case 'avgCarreauRate':
        if (b.stats.avgCarreauRate !== a.stats.avgCarreauRate) return b.stats.avgCarreauRate - a.stats.avgCarreauRate;
        return b.totalMatches - a.totalMatches;
      default:
        return b.stats.compositeScore - a.stats.compositeScore;
    }
  });
}
