import { getSupabaseClient } from '@/template';

export interface LeaderboardPlayer {
  id: string;
  userId: string;
  name: string;
  nickname?: string;
  avatar?: string;
  club?: string;
  role: string;
  level: string;
  country?: string;
  city?: string;
  boulesBrand?: string;
  boulesModel?: string;
  terrainName?: string;
  isPremium?: boolean;
  trustScore?: number;
  trustLevel?: 'high' | 'medium' | 'low' | 'suspicious';
  createdAt?: string;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    tirRate: number;
    pointRate: number;
    carreauRate: number;
  };
}

export type LeaderboardSort = 'winRate' | 'matches' | 'tirRate' | 'pointRate' | 'carreauRate';

export const LEADERBOARD_MIN_MATCHES = 10;

export async function fetchLeaderboard(): Promise<{ players: LeaderboardPlayer[]; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, user_id, name, nickname, avatar, club, role, level, country, location, stats, boules, terrain_name, created_at')
      .eq('is_public', true);

    if (error) return { players: [], error: error.message };

    const filteredData = (data || []).filter((p: any) => {
      const stats = p.stats || {};
      return (stats.matchesPlayed || 0) >= LEADERBOARD_MIN_MATCHES;
    });

    // Fetch premium status for all player user_ids
    const userIds = filteredData.map((p: any) => p.user_id).filter(Boolean);
    let premiumIds: Set<string> = new Set();
    if (userIds.length > 0) {
      try {
        const { data: premiumData } = await supabase.rpc('get_premium_user_ids', { user_ids: userIds });
        if (Array.isArray(premiumData)) {
          premiumIds = new Set(premiumData);
        }
      } catch { /* silent - premium badges just won't show */ }
    }

    // Fetch trust scores from suspicious_players table
    const playerIds = filteredData.map((p: any) => p.id);
    let trustScoreMap = new Map<string, { score: number; flags: string[] }>();
    if (playerIds.length > 0) {
      try {
        const { data: trustData } = await supabase
          .from('suspicious_players')
          .select('player_id, trust_score, flags')
          .in('player_id', playerIds);
        if (Array.isArray(trustData)) {
          for (const td of trustData) {
            trustScoreMap.set(td.player_id, { score: td.trust_score, flags: td.flags || [] });
          }
        }
      } catch { /* silent */ }
    }

    const players: LeaderboardPlayer[] = filteredData.map((p: any) => {
        const stats = p.stats || {};
        return {
          id: p.id,
          userId: p.user_id,
          name: p.name,
          nickname: p.nickname || undefined,
          avatar: p.avatar || undefined,
          club: p.club || undefined,
          role: p.role || 'Milieu',
          level: p.level || 'Intermédiaire',
          country: p.country || undefined,
          city: p.location?.city || undefined,
          boulesBrand: p.boules?.brand || undefined,
          boulesModel: p.boules?.model || undefined,
          terrainName: p.terrain_name || undefined,
          isPremium: premiumIds.has(p.user_id),
          trustScore: trustScoreMap.get(p.id)?.score,
          trustLevel: (() => {
            const ts = trustScoreMap.get(p.id)?.score;
            if (ts === undefined) return undefined;
            if (ts >= 75) return 'high' as const;
            if (ts >= 50) return 'medium' as const;
            if (ts >= 25) return 'low' as const;
            return 'suspicious' as const;
          })(),
          createdAt: p.created_at || undefined,
          stats: {
            matchesPlayed: stats.matchesPlayed || 0,
            wins: stats.wins || 0,
            losses: stats.losses || 0,
            winRate: stats.winRate || 0,
            tirRate: stats.tirRate || 0,
            pointRate: stats.pointRate || 0,
            carreauRate: stats.carreauRate || 0,
          },
        };
      });

    return { players, error: null };
  } catch (e: any) {
    return { players: [], error: e.message || 'Leaderboard error' };
  }
}

export function sortLeaderboard(players: LeaderboardPlayer[], sortBy: LeaderboardSort): LeaderboardPlayer[] {
  return [...players].sort((a, b) => {
    switch (sortBy) {
      case 'winRate':
        if (b.stats.winRate !== a.stats.winRate) return b.stats.winRate - a.stats.winRate;
        return b.stats.matchesPlayed - a.stats.matchesPlayed;
      case 'matches':
        return b.stats.matchesPlayed - a.stats.matchesPlayed;
      case 'tirRate':
        if (b.stats.tirRate !== a.stats.tirRate) return b.stats.tirRate - a.stats.tirRate;
        return b.stats.matchesPlayed - a.stats.matchesPlayed;
      case 'pointRate':
        if (b.stats.pointRate !== a.stats.pointRate) return b.stats.pointRate - a.stats.pointRate;
        return b.stats.matchesPlayed - a.stats.matchesPlayed;
      case 'carreauRate':
        if (b.stats.carreauRate !== a.stats.carreauRate) return b.stats.carreauRate - a.stats.carreauRate;
        return b.stats.matchesPlayed - a.stats.matchesPlayed;
      default:
        return b.stats.winRate - a.stats.winRate;
    }
  });
}
